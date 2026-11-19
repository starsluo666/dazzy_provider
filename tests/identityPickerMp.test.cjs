// Run after build:mp-weixin. Exercise the native page's actual tap handler and
// chooseMedia response, rather than only transpiling the source Vue script.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const build = path.resolve(__dirname, '../dist/build/mp-weixin')
const calls = [], diagnostics = []
let page, load, selected
let identity = {
  identity_status: 'unverified', identity_real_name: '', identity_number_masked: '',
  identity_front_photo_id: null, identity_back_photo_id: null, identity_face_photo_id: null,
  identity_verification: { enabled: false, status: 'not_checked' },
}
const services = {
  guardCurrentPage: () => true,
  getErrorMessage: error => error.message,
  getProviderIdentity: async () => ({ data: identity }),
  uploadProviderIdentityPhoto: async (filePath, file, kind) => {
    calls.push(['upload', filePath, file.size, kind])
    return { data: { id: 'synthetic-front' } }
  },
  saveProviderIdentity: async payload => {
    calls.push(['save', payload.recognition_mode, payload.identity_front_photo_id])
    identity = { ...identity, ...payload }
    return { data: identity }
  },
  verifyProviderIdentity: () => assert.fail('never call a paid verification service in this test'),
}
const vendor = {
  ...vue, defineComponent: value => value, _export_sfc: value => value,
  onLoad: callback => { load = callback }, onUnload() {},
  e: (...values) => Object.assign({}, ...values), t: value => String(value ?? ''),
  n: vue.normalizeClass, o: handler => handler, p: value => value,
  f: (items, callback) => items.map((item, index) => callback(item, index, index)),
  index: {
    chooseImage: () => assert.fail('the WeChat page must not use the legacy chooseImage API'),
    chooseMedia: options => { selected = options },
    showToast: options => calls.push(['toast', options.title]),
  },
}
vm.runInNewContext(fs.readFileSync(path.join(build, 'pages/identity/index.js'), 'utf8'), {
  console: { warn: (...args) => diagnostics.push(args) },
  wx: { createPage: value => { page = value } },
  require(name) {
    if (name.endsWith('/vendor.js')) return vendor
    if (name.endsWith('/assets.js')) return require(path.join(build, 'common/assets.js'))
    return services
  },
})
;(async () => {
  const render = page.setup({})
  load()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  const rows = Object.values(render({})).find(value => Array.isArray(value)
    && value.some(row => Object.values(row).includes('身份证人像面')))
  assert.ok(rows, 'native render exposes all three material rows')
  const front = rows.find(row => Object.values(row).includes('身份证人像面'))
  const tap = Object.values(front).find(value => typeof value === 'function')
  assert.equal(typeof tap, 'function')
  tap()
  assert.ok(selected)
  assert.equal(selected.count, 1)
  assert.deepEqual(Array.from(selected.mediaType), ['image'])
  assert.deepEqual(Array.from(selected.sizeType), ['compressed'])
  await selected.success({ tempFiles: [{ tempFilePath: '/synthetic-id.jpg', size: 100, fileType: 'image' }], type: 'image' })
  assert.deepEqual(calls.slice(0, 2), [
    ['upload', '/synthetic-id.jpg', 100, 'identity_front_photo'],
    ['save', 'photo', 'synthetic-front'],
  ])
  tap()
  selected.fail({ errMsg: 'chooseMedia:fail privacy permission is not authorized', errCode: 42 })
  assert.equal(diagnostics[0][1].api, 'chooseMedia')
  assert.equal(diagnostics[0][1].errCode, 42)
  assert.deepEqual(calls.at(-1), ['toast', '请先同意小程序隐私保护指引后重试'])
  tap()
  selected.fail({ errMsg: 'chooseMedia:fail api scope is not declared in the privacy agreement' })
  assert.equal(diagnostics.at(-1)[1].api, 'chooseMedia')
  assert.deepEqual(calls.at(-1), ['toast', '照片选择暂不可用，请联系客服'])
  console.log('PASS native identity picker: compiled tap, chooseMedia contract, per-photo upload/save and privacy diagnostics')
})().catch(error => { console.error(error); process.exitCode = 1 })
