const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(relative, dependencies, globals = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, relative), 'utf8').replaceAll('import.meta.env', '__env')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const context = {
    exports: {}, __env: { VITE_API_BASE_URL: '/api/v1', DEV: false }, ...globals,
    require: name => {
      assert.ok(name in dependencies, `Unexpected import: ${name}`)
      return dependencies[name]
    },
  }
  vm.runInNewContext(compiled, context)
  return context.exports
}

async function main() {
  let access = 'initial-token'
  const calls = []
  let rejectOnce = false
  let serverError = false
  const uni = {
    uploadFile: options => {
      calls.push(options)
      if (rejectOnce) {
        rejectOnce = false
        options.success({ statusCode: 401, data: '{}' })
      } else if (serverError) {
        options.success({ statusCode: 503, data: JSON.stringify({ detail: '认证照片水印服务暂不可用，请稍后重试或联系客服。' }) })
      } else {
        options.success({ statusCode: 201, data: JSON.stringify({ data: { id: 'synthetic-asset', url: 'https://private.test/signed-watermarked' } }) })
      }
    },
    request: options => {
      assert.equal(options.url, '/api/v1/auth/token/refresh/')
      queueMicrotask(() => {
        options.success({ statusCode: 200, data: { access: 'refreshed-token' } })
        options.complete()
      })
    },
  }
  const http = load('../src/services/http.ts', { './session': {
    getAccessToken: () => access,
    getRefreshToken: () => 'refresh-token',
    updateTokens: token => { access = token },
    handleSessionExpired: () => assert.fail('Session must not expire'),
  } }, { uni })
  const { uploadProviderIdentityPhoto, uploadProviderLifestylePhoto, uploadProviderVideo } = load('../src/services/providers.ts', { './http': http })
  const file = { type: 'image/png' }
  for (const kind of ['identity_front_photo', 'identity_back_photo', 'identity_face_photo']) {
    const result = await uploadProviderIdentityPhoto('/tmp/synthetic.png', file, kind)
    const sent = calls.at(-1)
    assert.equal(sent.url, '/api/v1/media/provider-identities/')
    assert.equal(sent.formData.kind, kind)
    assert.equal(sent.file, file)
    assert.equal(sent.name, 'file')
    assert.equal(sent.timeout, 30000)
    assert.equal(result.data.url, 'https://private.test/signed-watermarked')
  }
  await uploadProviderIdentityPhoto('/tmp/legacy.png')
  assert.equal(calls.at(-1).formData.kind, 'identity_front_photo')
  rejectOnce = true
  await uploadProviderIdentityPhoto('/tmp/retry.png', file, 'identity_back_photo')
  assert.equal(calls.at(-2).header.Authorization, 'Bearer initial-token')
  assert.equal(calls.at(-1).header.Authorization, 'Bearer refreshed-token')
  assert.equal(calls.at(-1).formData.kind, 'identity_back_photo')
  assert.equal(calls.at(-1).filePath, '/tmp/retry.png')
  // Existing non-identity callers retain their timeout and no role metadata.
  await http.uploadFile('/media/provider-videos/', '/tmp/video.mp4', 'file', file, 120000)
  assert.equal(calls.at(-1).timeout, 120000)
  assert.equal(calls.at(-1).formData, undefined)
  for (const upload of [uploadProviderLifestylePhoto, uploadProviderVideo]) {
    const nativeFile = { type: '', name: 'wx_temp' }
    await upload('blob:synthetic', { file: nativeFile, size: 100 })
    assert.equal(calls.at(-1).file, nativeFile)
    assert.equal(calls.at(-1).filePath, 'blob:synthetic')
  }
  assert.equal(calls.at(-1).timeout, 180000, 'video conversion retains its longer upload budget')
  serverError = true
  await assert.rejects(uploadProviderIdentityPhoto('/tmp/error.png'), /水印服务暂不可用/)

  const page = fs.readFileSync(path.resolve(__dirname, '../src/pages/identity/index.vue'), 'utf8')
  assert.match(page, /uploadProviderIdentityPhoto\(tempFilePaths\[0\], file, key\)/)
  assert.match(page, /previews\[key\] = result\.data\.url/)
  assert.match(page, /新上传的身份证正反面自动添加“仅用于达人验证”水印/)
  console.log('PASS identity uploads: per-photo role, signed preview, auth retry, server errors and other upload callers')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
