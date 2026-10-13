const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript')
function load(relative, dependencies = {}, globals = {}) {
  let source = fs.readFileSync(path.resolve(__dirname, '../src', relative), 'utf8')
  if (relative.endsWith('.vue')) source = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const js = ts.transpileModule(source.replaceAll('import.meta.env', '__env'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const context = { exports: {}, __env: { DEV: false }, ...globals, require: key => {
    if (key.endsWith('userMessages')) return require('./userMessages.fixture.cjs')
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`)
    return dependencies[key]
  } }
  vm.runInNewContext(js, context)
  return context.exports
}
async function main() {
  const storage = new Map(), navigation = [], interceptors = {}
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), reLaunch: args => navigation.push(args.url),
    addInterceptor: (key, options) => { interceptors[key] = options },
  }
  const session = load('services/session.ts', {}, { uni, getCurrentPages: () => [], setTimeout: fn => fn() })
  const pages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/pages.json'), 'utf8')).pages
  assert.equal(pages.some(page => page.path === 'pages/invitations/provider-register'), false, 'signup is hosted by the customer H5 only')
  assert.equal(session.isProtectedRoute('/pages/invitations/application'), true)
  assert.equal(session.isProtectedRoute('/pages/invitations/index'), true)
  const hooks = {}
  load('App.vue', {
    '@dcloudio/uni-app': { onLaunch: fn => { hooks.launch = fn }, onShow: fn => { hooks.show = fn } },
    '@/services/session': session,
  }, { setTimeout: fn => fn() })
  hooks.launch()
  hooks.show({ path: 'pages/legal/document', query: { key: 'privacy-policy' } })
  assert.equal(navigation.length, 0, 'cold-start public page is not mistaken for workbench')
  const args = { url: '/pages/invitations/application' }
  interceptors.navigateTo.invoke(args)
  assert.equal(args.url, '/pages/auth/login?redirect=%2Fpages%2Finvitations%2Fapplication')

  let state = null, fail = false, returnedTo = ''
  const application = load('services/providerApplication.ts', {
    './http': { request: async () => { if (fail) throw new Error('offline'); return { data: state } } },
    './session': { returnAfterAuthentication: url => { returnedTo = url } },
  }, { uni })
  for (const status of [null, 'draft', 'pending', 'rejected', 'suspended']) {
    state = status ? { status } : null
    navigation.length = 0
    await application.enterProviderApp('/pages/orders/index')
    assert.equal(navigation[0], '/pages/invitations/application')
    assert.equal(returnedTo, '', 'an unapproved account cannot resume a business page')
  }
  state = { status: 'approved' }
  await application.enterProviderApp('/pages/orders/index')
  assert.equal(returnedTo, '/pages/orders/index')
  navigation.length = 0; fail = true
  await assert.rejects(application.enterProviderApp(), /offline/)
  assert.equal(navigation.length, 0, 'network failure is not interpreted as approval or rejection')

  const uploads = [], requests = []
  const http = load('services/http.ts', { './session': {
    getAccessToken: () => 'existing-account-token', getRefreshToken: () => 'existing-refresh',
    handleSessionExpired: () => assert.fail('public errors must not clear an existing session'),
  } }, { __env: { DEV: true, VITE_DEMO_USER_PUBLIC_ID: 'demo' }, uni: {
    uploadFile: args => { uploads.push(args); args.success({ statusCode: 401, data: '{"detail":"短信校验失败"}' }) },
    request: args => { requests.push(args); args.success({ statusCode: 200, data: {} }) },
  } })
  await http.request('/growth/provider-invites/ABCDEF123456/', { skipAuth: true })
  assert.equal(requests[0].header.Authorization, undefined)
  assert.equal(requests[0].header['X-Dazzy-Demo-User'], undefined)
  await assert.rejects(http.uploadFile('/growth/provider-invites/register/', '/test.jpg', 'file', {}, 90000, { source_code: 'ABCDEF123456' }, { skipAuth: true }), /短信校验失败/)
  assert.equal(uploads.length, 1)
  assert.equal(uploads[0].header.Authorization, undefined)
  assert.equal(uploads[0].header['X-Dazzy-Demo-User'], undefined)
  assert.equal(uploads[0].timeout, 90000)
  assert.equal(requests.length, 1, 'public 401 must not trigger token refresh or re-upload')
  console.log('PASS provider public cold-start, protected progress, fresh approval routing, public upload isolation')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
