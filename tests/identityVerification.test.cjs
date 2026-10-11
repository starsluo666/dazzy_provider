const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/identity/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(`${script}\nexport { submit, apply, locked, payload, form, recognizedIdentity };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

function scenario({ enabled = true, accept = true, failure = false } = {}) {
  const calls = []
  const data = {
    identity_status: 'unverified', identity_real_name: '', identity_number_masked: '',
    identity_front_photo_id: 'front', identity_back_photo_id: 'back', identity_face_photo_id: 'face',
    identity_verification: { enabled, required: false, consent_version: 'tencent-id-card-photo-v2', notice: '合成授权说明', status: 'not_checked' },
  }
  const dependencies = {
    vue: { ref: value => ({ value }), reactive: value => value, computed: fn => ({ get value() { return fn() } }) },
    '@dcloudio/uni-app': { onLoad() {} },
    '@/components/NetworkState.vue': {},
    '@/services/session': { guardCurrentPage: () => true },
    '@/utils/formatters': { getErrorMessage: error => error.message },
    '@/services/providers': {
      saveProviderIdentity: async () => { calls.push('save'); return { data } },
      submitProviderIdentity: async version => {
        calls.push(['submit', version])
        if (failure) throw new Error('证件号不一致')
        return { data: { ...data, identity_status: 'pending' } }
      },
      getProviderIdentity: async () => { calls.push('refresh'); return { data } },
    },
  }
  const context = {
    exports: {}, require: name => { assert.ok(name in dependencies, name); return dependencies[name] },
    uni: {
      showModal: opts => { calls.push(['modal', opts.title]); opts.success?.({ confirm: accept }) },
      showToast: opts => calls.push(['toast', opts.title]),
    },
  }
  vm.runInNewContext(compiled, context)
  context.exports.apply(data)
  return { page: context.exports, calls, data }
}

async function main() {
  const refused = scenario({ accept: false })
  await refused.page.submit()
  assert.deepEqual(refused.calls, [['modal', '身份证验真授权']])
  const accepted = scenario()
  await accepted.page.submit()
  assert.deepEqual(accepted.calls.slice(0, 3), [['modal', '身份证验真授权'], 'save', ['submit', 'tencent-id-card-photo-v2']])
  assert.equal(accepted.page.locked.value, true)
  const sent = accepted.page.payload()
  assert.equal(sent.recognition_mode, 'photo')
  assert.equal(sent.identity_face_photo_id, 'face')
  assert.equal('identity_real_name' in sent, false)
  assert.equal('id_number' in sent, false)
  const legacy = scenario({ enabled: false })
  await legacy.page.submit()
  assert.deepEqual(legacy.calls, [['modal', '验真暂未开放']])
  const error = scenario({ failure: true })
  await error.page.submit()
  assert.ok(error.calls.includes('refresh'))
  assert.equal(error.page.locked.value, false)
  const processing = scenario()
  processing.page.apply({ ...processing.data, identity_verification: { ...processing.data.identity_verification, status: 'processing' } })
  assert.equal(processing.page.locked.value, true)
  await processing.page.submit()
  assert.equal(processing.calls.length, 0)
  const noSelfie = scenario()
  noSelfie.page.apply({ ...noSelfie.data, identity_face_photo_id: null })
  await noSelfie.page.submit()
  assert.deepEqual(noSelfie.calls, [['toast', '请上传全部认证材料']])
  const recognized = scenario()
  recognized.page.apply({ ...recognized.data, identity_real_name: '测试姓名', identity_number_masked: '1101**********0015',
    identity_verification: { ...recognized.data.identity_verification, status: 'passed' } })
  assert.equal(recognized.page.recognizedIdentity.value, true)
  recognized.page.form.identity_front_photo_id = 'replacement-photo'
  assert.equal(recognized.page.recognizedIdentity.value, false)
  assert.doesNotMatch(source, /v-model="form\.(?:identity_real_name|id_number)"/)
  assert.match(source, /本人自拍仅供客服人工核对/)
  console.log('PASS identity verification consent, rejection, legacy mode, recovery and in-flight protection')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
