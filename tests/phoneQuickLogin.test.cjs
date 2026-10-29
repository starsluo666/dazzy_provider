const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')

const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/auth/login.vue'), 'utf8')
function miniProgramSource(text) {
  const active = [true]
  return text.split('\n').filter(line => {
    const start = line.match(/#ifdef\s+([\w-]+(?:\s*\|\|\s*[\w-]+)*)/)
    if (start) {
      active.push(active.at(-1) && start[1].split('||').some(value => value.trim() === 'MP-WEIXIN'))
      return false
    }
    if (/#endif/.test(line)) { active.pop(); return false }
    return active.at(-1)
  }).join('\n')
}
const template = miniProgramSource(source.slice(0, source.indexOf('<script setup')))
const button = template.match(/<button\b[^>]*open-type="getPhoneNumber"[^>]*>[\s\S]*?<\/button>/)?.[0]
assert.ok(button, 'keep the native phone authorization component')
assert.match(button, /手机号快捷登录/)
assert.match(button, /登录中…/)
assert.doesNotMatch(template, /微信|腾讯|wechat\.svg|weixin\.svg/)
assert.doesNotMatch(button, /<image\b/)
assert.match(button, /:disabled="wechatSubmitting"/)
assert.match(button, /@getphonenumber="wechatLogin"/)
assert.match(button, /class="phone-quick-login"/)
assert.match(template, /<LegalConsent\b[^>]*v-model="agreed"/)

const script = miniProgramSource(source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1])
function setup(options = {}) {
  const calls = { sdk: 0, requests: [], toasts: [], navigations: [] }
  const services = {
    loginWithWechatMiniProgram: async (...args) => {
      calls.requests.push(args)
      if (options.apiError) throw new Error(options.apiError)
      return { closure_cancelled: false }
    },
    enterProviderApp: async target => calls.navigations.push(target),
    returnAfterAuthentication: target => calls.navigations.push(target),
    clearPendingInviteCode() {},
    getPendingInviteCode: () => 'test-invite',
    useSmsCode: () => ({}),
  }
  const context = {
    exports: {}, Error, setTimeout: callback => callback(),
    clearInterval() {},
    require(name) {
      if (name === 'vue') return { ...vue, onUnmounted() {} }
      if (name === '@dcloudio/uni-app') return { onLoad() {} }
      return services
    },
    uni: {
      login(params) {
        calls.sdk++
        assert.equal(params.provider, 'weixin', 'keep the SDK provider unchanged')
        if (options.sdkFailure) params.fail({})
        else params.success({ code: options.missingCode ? '' : 'test-login-code' })
      },
      showToast: toast => calls.toasts.push(toast.title),
    },
  }
  const code = ts.transpileModule(script + '\nglobalThis.loginPage = { agreed, wechatSubmitting, wechatLogin };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(code, context)
  return { page: context.loginPage, calls }
}
async function main() {
  const noConsent = setup()
  await noConsent.page.wechatLogin({ detail: { code: 'phone-code' } })
  assert.equal(noConsent.calls.sdk, 0)
  assert.equal(noConsent.calls.requests.length, 0)
  assert.match(noConsent.calls.toasts.at(-1), /请先阅读并同意/)
  for (const detail of [{ errMsg: 'getPhoneNumber:fail user deny' }, {}]) {
    const denied = setup()
    denied.page.agreed.value = true
    await denied.page.wechatLogin({ detail })
    assert.equal(denied.calls.sdk, 0)
    assert.equal(denied.calls.requests.length, 0)
    assert.doesNotMatch(denied.calls.toasts.at(-1), /微信|腾讯/)
  }
  const success = setup()
  success.page.agreed.value = true
  const pending = success.page.wechatLogin({ detail: { code: 'phone-code' } })
  assert.equal(success.page.wechatSubmitting.value, true)
  await pending
  assert.equal(success.calls.requests.length, 1)
  assert.equal(success.calls.requests[0][0], 'test-login-code')
  assert.equal(success.calls.requests[0][1], 'phone-code')
  assert.equal(success.calls.navigations.length, 1)
  assert.equal(success.page.wechatSubmitting.value, false)
  for (const options of [{ sdkFailure: true }, { missingCode: true }, { apiError: '服务暂时不可用，请稍后重试' }]) {
    const failed = setup(options)
    failed.page.agreed.value = true
    await failed.page.wechatLogin({ detail: { code: 'phone-code' } })
    assert.equal(failed.page.wechatSubmitting.value, false)
    assert.equal(failed.calls.navigations.length, 0)
    assert.doesNotMatch(failed.calls.toasts.at(-1), /微信|腾讯/)
    if (!options.apiError) assert.equal(failed.calls.requests.length, 0)
  }
  if (process.argv.includes('--compiled')) {
    const native = fs.readFileSync(path.resolve(__dirname, '../dist/build/mp-weixin/pages/auth/login.wxml'), 'utf8')
    const nativeButton = native.match(/<button\b[^>]*open-type="getPhoneNumber"[^>]*>[\s\S]*?<\/button>/)?.[0]
    assert.ok(nativeButton)
    assert.match(nativeButton, /phone-quick-login/)
    assert.match(nativeButton, /bindgetphonenumber=/)
    assert.match(nativeButton, /disabled=/)
    assert.doesNotMatch(nativeButton, /<image\b/)
    assert.doesNotMatch(native, /微信|腾讯|wechat\.svg|weixin\.svg/)
    const build = path.resolve(__dirname, '../dist/build/mp-weixin')
    const compiled = fs.readFileSync(path.join(build, 'pages/auth/login.js'), 'utf8')
    assert.doesNotMatch(compiled, /微信|腾讯/)
    let nativePage, requestCount = 0
    const vendor = {
      ...vue, defineComponent: value => value, _export_sfc: value => value,
      onLoad() {}, onUnmounted() {},
      e: (...values) => Object.assign({}, ...values), t: value => String(value ?? ''),
      o: handler => handler, p: value => value,
      index: { login: options => options.success({ code: 'native-login-code' }), showToast() {} },
    }
    const mocks = {
      useSmsCode: () => ({ seconds: vue.ref(0) }),
      getPendingInviteCode: () => '', clearPendingInviteCode() {},
      enterProviderApp: async () => {}, returnAfterAuthentication() {},
      loginWithWechatMiniProgram: async (code, phoneCode) => {
        requestCount++
        assert.equal(code, 'native-login-code')
        assert.equal(phoneCode, 'native-phone-code')
        return { closure_cancelled: false }
      },
    }
    vm.runInNewContext(compiled, {
      Error, setTimeout: callback => callback(), clearInterval() {},
      wx: { createPage: value => { nativePage = value } },
      require(name) {
        if (name.endsWith('/vendor.js')) return vendor
        if (name.endsWith('/assets.js')) return require(path.join(build, 'common/assets.js'))
        return mocks
      },
    })
    const render = nativePage.setup({})
    const bindingKey = (tag, attribute) => tag.match(new RegExp(attribute + '="\\{\\{(\\w+)\\}\\}"'))?.[1]
    const textKey = nativeButton.match(/<text[^>]*>\{\{(\w+)\}\}/)[1]
    const disabledKey = bindingKey(nativeButton, 'disabled')
    const tapKey = bindingKey(nativeButton, 'bindgetphonenumber')
    const consent = native.match(/<legal-consent\b[^>]*>/)[0]
    const consentKey = bindingKey(consent, 'bindupdateModelValue')
    assert.equal(render({})[textKey], '手机号快捷登录')
    assert.equal(render({})[disabledKey], false)
    await render({})[tapKey]({ detail: { code: 'native-phone-code' } })
    assert.equal(requestCount, 0, 'compiled consent gate stays in effect')
    render({})[consentKey](true)
    const nativePending = render({})[tapKey]({ detail: { code: 'native-phone-code' } })
    assert.equal(render({})[textKey], '登录中…')
    assert.equal(render({})[disabledKey], true)
    await nativePending
    assert.equal(requestCount, 1)
    assert.equal(render({})[textKey], '手机号快捷登录')
    assert.equal(render({})[disabledKey], false)
  }
  console.log('PASS phone quick login: neutral mini-program UI, no logo, consent, phone grant, SDK codes, success and failure states')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
