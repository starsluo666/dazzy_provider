const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')

const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/receiving-account/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script + '\nexports.page = { account, form, formError, actionDisabled, actionLabel, changeConsent, changeOnboardingConsent, saveOrApply };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const savedFields = {
  cert_begin_date: '2020-01-01', cert_end_date: null, cert_long_term: true,
  bank_name: '测试银行', bank_province: '河北省', bank_city: '邯郸市',
  bank_province_code: '130000', bank_city_code: '130400',
}
const updatedAt = '2026-11-21T08:00:00.123456Z'
const checked = { detail: { value: ['accepted'] } }

async function mount({ saved = false, enabled = true, saveError, submitError, saveResult } = {}) {
  let server = {
    identity_verified: true, can_edit: true, materials_saved: saved, onboarding_enabled: enabled,
    can_submit: saved && enabled, consent_version: 'collection-v1', onboarding_consent_version: 'onboarding-v2',
    ...savedFields, updated_at: saved ? updatedAt : null,
  }
  let onLoad
  const calls = []
  const providers = {
    getProviderReceivingAccount: async () => ({ data: server }),
    getReceivingBankRegions: async () => ({ data: [] }),
    saveProviderReceivingAccount: async payload => {
      calls.push(['save', payload.consent_version])
      if (saveError) throw Error(saveError)
      server = { ...server, ...savedFields, materials_saved: true, can_submit: enabled, updated_at: updatedAt, ...saveResult }
      return { data: server }
    },
    submitProviderReceivingAccount: async (version, timestamp) => {
      calls.push(['submit', version, timestamp])
      if (submitError) throw Error(submitError)
      return { data: { ...server, can_edit: false, can_submit: false, can_refresh: true } }
    },
  }
  const context = {
    exports: {},
    require: name => ({
      vue,
      '@dcloudio/uni-app': { onLoad: fn => { onLoad = fn }, onShow: () => {}, onUnload: () => {} },
      '@/services/providers': providers,
      '@/utils/formatters': { getErrorMessage: error => error.message },
    }[name]),
    uni: { showToast: () => {} },
  }
  vm.runInNewContext(compiled, context)
  await onLoad()
  const page = context.exports.page
  if (!saved) Object.assign(page.form, { id_number: 'fixture', bank_card_number: 'fixture', mobile: 'fixture' })
  return { ...page, calls }
}

async function main() {
  const first = await mount()
  assert.equal(first.actionLabel.value, '保存并申请开户')
  first.changeConsent(checked)
  assert.equal(first.actionDisabled.value, true)
  await first.saveOrApply()
  assert.deepEqual(first.calls, [])
  first.changeOnboardingConsent(checked)
  await Promise.all([first.saveOrApply(), first.saveOrApply()])
  assert.deepEqual(first.calls, [['save', 'collection-v1'], ['submit', 'onboarding-v2', updatedAt]])
  assert.equal(first.form.bank_card_number, '')

  const unchanged = await mount({ saved: true })
  assert.equal(unchanged.actionLabel.value, '申请开户')
  unchanged.changeOnboardingConsent(checked)
  await unchanged.saveOrApply()
  assert.deepEqual(unchanged.calls, [['submit', 'onboarding-v2', updatedAt]])

  for (const fixture of [{ enabled: false }, { saveError: '保存失败' }, { saveResult: { onboarding_consent_version: 'onboarding-v3' } }]) {
    const page = await mount(fixture)
    page.changeConsent(checked)
    if (fixture.enabled !== false) page.changeOnboardingConsent(checked)
    await page.saveOrApply()
    assert.deepEqual(page.calls, [['save', 'collection-v1']])
  }

  const timeout = await mount({ submitError: '请求超时' })
  timeout.changeConsent(checked)
  timeout.changeOnboardingConsent(checked)
  await timeout.saveOrApply()
  assert.equal(timeout.account.value.materials_saved, true)
  assert.equal(timeout.actionLabel.value, '申请开户')
  assert.equal(timeout.formError.value, '请求超时')
  assert.equal(timeout.calls.length, 2, 'do not automatically retry a channel submission')
  console.log('PASS one receiving action, separate consents and safe save/submit failure handling')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
