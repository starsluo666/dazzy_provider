const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), vue = require('vue')
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/security/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replaceAll('import.meta.env', '({ DEV: false })')
const compiled = ts.transpileModule(script + '\nglobalThis.page = { openPanel, panel, submit, security, loading, currentPassword, newPassword, confirmation, initialCode, closureAgreed, sendInitialCode, readClosureAgreement };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function setup(passwordSet = true) {
  const calls = { initial: [], changed: [], closure: [], modals: [], routes: [], sent: 0, toasts: [] }, hooks = {}
  const context = { exports: {}, Error, setInterval: () => 1, clearInterval() {}, require(name) {
    if (name === 'vue') return { ...vue, onBeforeUnmount: cb => { hooks.unmount = cb } }
    if (name === '@dcloudio/uni-app') return { onShow: cb => { hooks.show = cb }, onHide: cb => { hooks.hide = cb } }
    if (name === '@/services/session') return { guardCurrentPage: () => true }
    if (name === '@/content/legal') return { legalLinks: [], legalDocumentUrl: kind => '/pages/legal/document?type=' + kind }
    if (name === '@/services/auth') return {
      getAccountSecurity: async () => ({ data: { password_set: passwordSet, phone_masked: '138****0801' } }),
      sendInitialPasswordCode: async () => { calls.sent++; return { data: { retry_after: 60 } } },
      setInitialPassword: async (...args) => calls.initial.push(args),
      changePassword: async (...args) => calls.changed.push(args),
      closeAccount: async (...args) => calls.closure.push(args),
    }
    return {}
  }, uni: {
    showModal: options => calls.modals.push(options), showToast: options => calls.toasts.push(options), navigateTo: options => calls.routes.push(options),
  } }
  vm.runInNewContext(compiled, context)
  const page = context.page
  page.loading.value = false
  page.security.value = { password_set: passwordSet }
  return { page, calls, hooks }
}
;(async () => {
  const initial = setup(false)
  initial.page.openPanel('password')
  initial.page.newPassword.value = initial.page.confirmation.value = 'new-pass-2026'
  await initial.page.submit()
  assert.equal(initial.calls.initial.length, 0, 'initial password requires a verified SMS code')
  initial.page.initialCode.value = '123456'
  await initial.page.submit()
  assert.deepEqual(initial.calls.initial, [['123456', 'new-pass-2026']])
  assert.equal(initial.calls.changed.length, 0, 'do not send a missing old password to change endpoint')

  const code = setup(false)
  code.page.openPanel('password')
  await code.page.sendInitialCode(); await code.page.sendInitialCode()
  assert.equal(code.calls.sent, 1, 'SMS cooldown prevents repeats')
  code.hooks.unmount()

  const unconfigured = setup(false)
  unconfigured.page.openPanel('close')
  assert.equal(unconfigured.page.panel.value, '')
  assert.equal(unconfigured.calls.modals[0].title, '请先设置登录密码')
  unconfigured.calls.modals[0].success({ confirm: true })
  assert.equal(unconfigured.page.panel.value, 'password')

  const closure = setup()
  closure.page.openPanel('close')
  closure.page.currentPassword.value = 'old-pass-2026'
  await closure.page.submit()
  assert.equal(closure.calls.modals.length, 0, 'no confirmation/API call before agreement consent')
  assert.equal(closure.calls.closure.length, 0)
  closure.page.closureAgreed.value = true
  closure.page.readClosureAgreement()
  assert.equal(closure.calls.routes[0].url, '/pages/legal/document?type=closure')
  closure.hooks.hide()
  assert.equal(closure.page.currentPassword.value, '')
  assert.equal(closure.page.closureAgreed.value, false)
  await closure.hooks.show()
  assert.equal(closure.page.panel.value, 'close', 'reading returns to a freshly verified closure sheet')
  assert.equal(closure.page.currentPassword.value, '')
  assert.equal(closure.page.closureAgreed.value, false, 'reading a document is not consenting')
  assert.ok(source.includes('注销的是整个平台账号'))
  assert.ok(source.includes('用户端和达人端将同时退出登录'))
  assert.ok(!source.includes('<strong class="strong-text">账号状态正常</strong>'), 'account status must not be hardcoded')
  console.log('PASS provider security: initial password, SMS cooldown, consent, safe document roundtrip and platform closure scope')
})().catch(error => { console.error(error); process.exitCode = 1 })
