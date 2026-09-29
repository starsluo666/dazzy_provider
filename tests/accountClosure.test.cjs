const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), vue = require('vue')
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/security/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script + '\nglobalThis.page = { submit, security, loading, panel, currentPassword };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
async function run(data, approved = true) {
  const calls = { requests: [], modals: [], navigation: [], cleared: 0, toasts: [] }
  const context = { exports: {}, Error, require(name) {
    if (name === 'vue') return vue
    if (name === '@dcloudio/uni-app') return { onShow() {} }
    if (name === '@/services/auth') return { closeAccount: async password => { calls.requests.push(password); return { data } } }
    if (name === '@/services/session') return { clearSession: () => { calls.cleared++ } }
    if (name === '@/utils/formatters') return { formatBusinessDateTime: value => value }
    return {}
  }, uni: {
    showModal: options => { calls.modals.push(options); if (options.showCancel !== false) options.success({ confirm: approved }) },
    showToast: options => calls.toasts.push(options), reLaunch: options => calls.navigation.push(options),
  } }
  vm.runInNewContext(compiled, context)
  const page = context.page
  page.loading.value = false
  page.security.value = { password_set: true }
  page.panel.value = 'close'
  page.currentPassword.value = 'local-test-pass-2026'
  await page.submit()
  return { calls, page }
}
;(async () => {
  const pending = { closed: false, status: 'pending', working_days: 5, execute_after: '2026-10-12T14:20:00+08:00' }
  const cancelled = await run(pending, false)
  assert.equal(cancelled.calls.requests.length, 0)
  const submitted = await run(pending)
  assert.equal(submitted.calls.requests.length, 1)
  assert.equal(submitted.calls.cleared, 1)
  assert.equal(submitted.page.currentPassword.value, '')
  assert.equal(submitted.calls.modals.at(-1).title, '注销申请已提交')
  assert.ok(submitted.calls.modals.at(-1).content.includes(pending.execute_after))
  submitted.calls.modals.at(-1).success({ confirm: true })
  assert.equal(submitted.calls.navigation[0].url, '/pages/auth/login?closurePending=1')
  for (const data of [undefined, { closed: true }, { ...pending, execute_after: 'invalid' }]) {
    const failed = await run(data)
    assert.equal(failed.calls.cleared, 0)
    assert.equal(failed.calls.modals.length, 1)
    assert.equal(failed.calls.toasts.at(-1).icon, 'none')
  }
  console.log('PASS provider closure: explicit confirmation, pending deadline, cleared credentials and safe invalid responses')
})().catch(error => { console.error(error); process.exitCode = 1 })
