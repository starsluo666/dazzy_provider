// Synthetic fixtures only: no ID photos, network calls or paid Tencent requests.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/identity/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(`${script}\nexport { submit, verifyFront, choosePhoto, apply, locked, form, recognizedIdentity, submitting, verifying, loading, statusHeading };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const notice = '合成授权说明'
const consent = 'tencent-id-card-photo-v2'

function scenario({ enabled = true, accept = true, modalFailures = 0, modalThrows = false,
  verifyFailure = false, verifyFailures = 0, saveFailure = false, submitFailure = false, deferVerify = false, pickerFailures = 0 } = {}) {
  const calls = []
  let selected, completeVerification, unload, nextId = 0
  let data = {
    identity_status: 'unverified', identity_real_name: '', identity_number_masked: '',
    identity_front_photo_id: null, identity_back_photo_id: null, identity_face_photo_id: null,
    identity_verification: { enabled, required: false, consent_version: consent, notice, status: 'not_checked' },
  }
  function verified() {
    data = { ...data, identity_real_name: '测试姓名', identity_number_masked: '1101**********0015',
      identity_verification: { ...data.identity_verification, status: 'passed', required: true } }
    return { data }
  }
  const dependencies = {
    vue: { ref: value => ({ value }), reactive: value => value, computed: fn => ({ get value() { return fn() } }) },
    '@dcloudio/uni-app': { onLoad() {}, onUnload: fn => { unload = fn } },
    '@/components/NetworkState.vue': {}, '@/services/session': { guardCurrentPage: () => true },
    '@/utils/formatters': { getErrorMessage: error => error.message },
    '@/services/providers': {
      uploadProviderIdentityPhoto: async (_filePath, _file, kind) => {
        calls.push(['upload', kind]); return { data: { id: `photo-${++nextId}`, url: 'https://private.invalid/signed' } }
      },
      saveProviderIdentity: async payload => {
        calls.push(['save', { ...payload }])
        if (saveFailure) throw new Error('照片保存失败')
        data = { ...data, ...payload }
        if ('identity_front_photo_id' in payload) data = { ...data, identity_real_name: '', identity_number_masked: '',
          identity_verification: { ...data.identity_verification, status: 'not_checked', required: true } }
        return { data }
      },
      verifyProviderIdentity: async (id, version) => {
        calls.push(['verify', id, version])
        if (verifyFailure || verifyFailures > 0) { verifyFailures--; throw new Error('身份证照片不清晰') }
        if (deferVerify) return new Promise(resolve => { completeVerification = () => resolve(verified()) })
        return verified()
      },
      submitProviderIdentity: async (...args) => {
        calls.push(['submit', ...args])
        if (submitFailure) throw new Error('审核提交失败')
        data = { ...data, identity_status: 'pending' }; return { data }
      },
      getProviderIdentity: async () => { calls.push(['refresh']); return { data } },
    },
  }
  const context = {
    exports: {}, require: name => { assert.ok(name in dependencies, name); return dependencies[name] },
    uni: {
      chooseImage: opts => {
        calls.push(['picker'])
        if (pickerFailures > 0) { pickerFailures--; throw new Error('picker unavailable') }
        selected = opts
      },
      showModal: opts => {
        calls.push(['modal', opts.title])
        if ([opts.confirmText, opts.cancelText].some(text => text && text.length > 4)) {
          opts.fail?.({ errMsg: 'native button limit exceeded' }); return
        }
        if (modalFailures > 0) {
          modalFailures--
          if (modalThrows) throw new Error('native modal unavailable')
          opts.fail?.({ errMsg: 'showModal:fail' }); return
        }
        opts.success?.({ confirm: accept })
      },
      showToast: opts => calls.push(['toast', opts.title]),
    },
  }
  vm.runInNewContext(compiled, context)
  const page = context.exports
  page.apply(data); page.loading.value = false
  return { page, calls, get data() { return data }, unload: () => unload(),
    complete: () => completeVerification(),
    select: () => selected.success({ tempFilePaths: ['/synthetic.jpg'], tempFiles: [{ size: 100 }] }),
    pick: key => { page.choosePhoto(key); return selected.success({ tempFilePaths: ['/synthetic.jpg'], tempFiles: [{ size: 100 }] }) },
  }
}
const entries = (scenario, kind) => scenario.calls.filter(call => call[0] === kind)
async function main() {
  const flow = scenario()
  assert.equal(flow.page.statusHeading.value, '请上传身份证照片')
  await flow.pick('identity_front_photo')
  assert.deepEqual(flow.calls.slice(0, 5), [
    ['picker'], ['upload', 'identity_front_photo'],
    ['save', { recognition_mode: 'photo', identity_front_photo_id: 'photo-1' }],
    ['modal', '身份证验真授权'], ['verify', 'photo-1', consent],
  ])
  assert.equal(flow.page.recognizedIdentity.value, true)
  assert.equal(flow.page.locked.value, false, 'verification is not manual-review submission')
  assert.equal(entries(flow, 'submit').length, 0)
  await flow.page.submit()
  assert.deepEqual(flow.calls.at(-1), ['toast', '请上传全部认证材料'])
  await flow.pick('identity_back_photo'); await flow.pick('identity_face_photo')
  assert.equal(flow.page.recognizedIdentity.value, true)
  assert.equal(entries(flow, 'verify').length, 1, 'back and selfie do not reverify')
  await flow.pick('identity_front_photo')
  assert.equal(entries(flow, 'verify').length, 2, 'replacement front is reverified')
  assert.equal(entries(flow, 'modal').length, 1, 'same consent version is reused only during this page session')
  await flow.page.submit()
  assert.deepEqual(entries(flow, 'submit'), [['submit']])
  assert.equal(entries(flow, 'verify').length, 2, 'final submission never calls verification')
  assert.equal(flow.page.locked.value, true)
  await flow.page.submit(); assert.equal(entries(flow, 'submit').length, 1)

  const refused = scenario({ accept: false })
  await refused.pick('identity_front_photo')
  assert.equal(entries(refused, 'verify').length, 0)
  assert.equal(refused.page.form.identity_front_photo_id, 'photo-1', 'cancel keeps the automatically saved photo')
  assert.equal(refused.page.verifying.value, false)
  for (const modalThrows of [false, true]) {
    const modal = scenario({ modalFailures: 1, modalThrows })
    await modal.pick('identity_front_photo')
    assert.deepEqual(modal.calls.at(-1), ['toast', '授权弹窗未能打开，请重试'])
    assert.equal(entries(modal, 'verify').length, 0)
    assert.equal(entries(modal, 'refresh').length, 0)
    assert.equal(modal.page.verifying.value, false)
    await modal.page.verifyFront(); assert.equal(entries(modal, 'verify').length, 1)
  }
  const disabled = scenario({ enabled: false })
  await disabled.pick('identity_front_photo')
  assert.equal(entries(disabled, 'save').length, 1)
  assert.equal(entries(disabled, 'verify').length, 0)
  assert.deepEqual(disabled.calls.at(-1), ['toast', '身份验证暂不可用，请稍后重试'])
  const saveError = scenario({ saveFailure: true })
  await saveError.pick('identity_front_photo')
  assert.equal(entries(saveError, 'verify').length, 0)
  assert.equal(saveError.page.form.identity_front_photo_id, null)
  const failed = scenario({ verifyFailure: true })
  await failed.pick('identity_front_photo')
  assert.equal(entries(failed, 'refresh').length, 1)
  assert.equal(entries(failed, 'verify').length, 1, 'no automatic paid retries')
  assert.equal(failed.page.verifying.value, false)
  await failed.pick('identity_back_photo'); await failed.pick('identity_face_photo'); await failed.page.submit()
  assert.deepEqual(failed.calls.at(-1), ['toast', '请重新上传身份证人像面完成识别'])
  assert.equal(entries(failed, 'submit').length, 0)

  const retryUpload = scenario({ verifyFailures: 1 })
  await retryUpload.pick('identity_front_photo')
  assert.equal(retryUpload.page.recognizedIdentity.value, false)
  await retryUpload.pick('identity_front_photo')
  assert.equal(retryUpload.page.recognizedIdentity.value, true)
  assert.equal(entries(retryUpload, 'verify').length, 2, 're-upload is the retry entry without a verification card')
  assert.equal(entries(retryUpload, 'submit').length, 0)

  const waiting = scenario({ deferVerify: true })
  const upload = waiting.pick('identity_front_photo')
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.equal(waiting.page.verifying.value, true)
  await waiting.page.verifyFront(); waiting.page.choosePhoto('identity_back_photo'); await waiting.page.submit()
  assert.equal(entries(waiting, 'verify').length, 1)
  assert.equal(entries(waiting, 'picker').length, 1)
  waiting.complete(); await upload
  assert.equal(waiting.page.recognizedIdentity.value, true)
  const error = scenario({ submitFailure: true })
  for (const key of ['identity_front_photo', 'identity_back_photo', 'identity_face_photo']) await error.pick(key)
  await error.page.submit()
  assert.equal(entries(error, 'verify').length, 1)
  assert.equal(entries(error, 'refresh').length, 1)
  assert.equal(error.page.submitting.value, false)
  const departed = scenario()
  departed.page.choosePhoto('identity_front_photo'); departed.unload(); await departed.select()
  assert.equal(entries(departed, 'upload').length, 0)
  const pickerError = scenario({ pickerFailures: 1 })
  pickerError.page.choosePhoto('identity_front_photo')
  assert.deepEqual(pickerError.calls.at(-1), ['toast', '打开相册失败，请重试'])
  await pickerError.pick('identity_front_photo')
  assert.equal(entries(pickerError, 'verify').length, 1, 'native picker errors do not leave the page busy')
  assert.ok(source.indexOf('class="materials-card"') < source.indexOf('class="form-card"'))
  assert.doesNotMatch(source, />保存资料</)
  assert.doesNotMatch(source, /verification-card|verification-action|verificationTitle|verificationCopy|verificationError/)
  assert.doesNotMatch(source, /v-model="form\.(?:identity_real_name|id_number)"/)
  assert.match(source, /本人自拍仅供客服人工审核/)
  console.log('PASS identity auto-verification: upload/save/consent/verify ordering, no premature review, no repeated checks for back/selfie, cancel/retry, native limits, failures, double taps, read-only fields and layout order')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
