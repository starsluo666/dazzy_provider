const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

function notification(id, category = 'order') {
  return { public_id: String(id), category, is_read: false, action_url: '' }
}

function response(items, total = items.length, all = items) {
  const category_unread = { support: 0, order: 0, activity: 0, system: 0 }
  for (const item of all) if (!item.is_read) category_unread[item.category] += 1
  return { data: {
    items: items.map(item => ({ ...item })),
    pagination: { total },
    summary: { total: all.length, unread: Object.values(category_unread).reduce((a, b) => a + b, 0), category_unread },
  } }
}

// Execute the real page script with mocked HTTP and platform hooks.
function mount(api, platform = {}) {
  const file = path.resolve(__dirname, '../src/pages/messages/index.vue')
  const script = fs.readFileSync(file, 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const output = ts.transpileModule(script + '\nglobalThis.pageUnderTest = { load, markAll, openNotification, items, total, loading, error, activeStatus, activeCategory };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const context = {
    exports: {},
    require(name) {
      if (name === 'vue') return { ref: value => ({ value }), computed: get => ({ get value() { return get() } }) }
      if (name === '@dcloudio/uni-app') return { onShow() {}, onReachBottom() {} }
      if (name === '@/services/notifications') return api
      if (name === '@/utils/formatters') return { getErrorMessage: (_reason, fallback) => fallback }
      return {}
    },
    uni: { showToast: platform.showToast || (() => {}), navigateTo: platform.navigateTo || (() => {}) },
  }
  vm.runInNewContext(output, context, { filename: file })
  return context.pageUnderTest
}

async function staleResponsesCannotOverwriteCurrentFilter() {
  const first = deferred(), second = deferred()
  let calls = 0
  const page = mount({ getNotifications: () => (++calls === 1 ? first : second).promise })
  page.activeStatus.value = 'unread'
  const oldRequest = page.load(true)
  page.activeStatus.value = 'read'
  const newRequest = page.load(true)
  second.resolve(response([{ ...notification('read'), is_read: true }]))
  await newRequest
  first.resolve(response([notification('unread')]))
  await oldRequest
  assert.equal(page.items.value[0].public_id, 'read')
  assert.equal(page.total.value, 1)
}

async function staleFailureCannotEndCurrentLoading() {
  const first = deferred(), second = deferred()
  let calls = 0
  const page = mount({ getNotifications: () => (++calls === 1 ? first : second).promise })
  const oldRequest = page.load(true)
  page.activeStatus.value = 'read'
  const newRequest = page.load(true)
  first.reject(new Error('old request failed'))
  await oldRequest
  assert.equal(page.loading.value, true)
  assert.equal(page.error.value, '')
  second.resolve(response([]))
  await newRequest
  assert.equal(page.loading.value, false)
}

function server(records) {
  return {
    async getNotifications({ category, isRead, page, pageSize }) {
      const filtered = records.filter(item => (!category || item.category === category)
        && (isRead === undefined || item.is_read === isRead))
      return response(filtered.slice((page - 1) * pageSize, page * pageSize), filtered.length, records)
    },
    async markNotificationRead(id) {
      const item = records.find(item => item.public_id === id)
      item.is_read = true
      return { data: { ...item } }
    },
  }
}

async function readThenPaginateDoesNotSkipMessages() {
  const records = Array.from({ length: 45 }, (_, index) => notification(index + 1))
  const api = server(records)
  const page = mount(api)
  page.activeStatus.value = 'unread'
  await page.load(true)
  await page.openNotification(page.items.value[0])
  while (page.items.value.length < page.total.value) await page.load()
  assert.equal(page.items.value.length, 44)
  assert.deepEqual(Array.from(page.items.value, item => item.public_id), records.slice(1).map(item => item.public_id))
}

async function markAllRespectsFilterChangesWhileSaving() {
  const records = [notification('order'), notification('support', 'support')]
  const save = deferred()
  const api = server(records)
  api.markAllNotificationsRead = async category => {
    await save.promise
    for (const item of records) if (!category || item.category === category) item.is_read = true
  }
  const page = mount(api)
  page.activeStatus.value = 'unread'
  page.activeCategory.value = 'order'
  await page.load(true)
  const marking = page.markAll()
  page.activeCategory.value = 'support'
  await page.load(true)
  save.resolve()
  await marking
  assert.equal(page.items.value[0].public_id, 'support')
  assert.equal(page.total.value, 1)
}

async function providerMessagesOnlyOpenProviderPages() {
  const routes = [], toasts = []
  const page = mount({}, {
    navigateTo: ({ url }) => routes.push(url),
    showToast: ({ title }) => toasts.push(title),
  })
  const application = {
    ...notification('application', 'system'), is_read: true,
    event_type: 'provider_application_result', action_url: '/pages/providers/apply',
  }
  await page.openNotification({ ...application, title: '达人申请审核通过' })
  assert.deepEqual(routes, ['/pages/identity/index'])

  await page.openNotification({ ...application, title: '达人申请审核未通过' })
  assert.deepEqual(routes, ['/pages/identity/index'])
  assert.deepEqual(toasts, ['请在用户端查看这条消息'])

  await page.openNotification({ ...application, action_url: '/pages/orders/index' })
  assert.deepEqual(routes, ['/pages/identity/index', '/pages/orders/index'])
}

async function main() {
  for (const test of [
    staleResponsesCannotOverwriteCurrentFilter,
    staleFailureCannotEndCurrentLoading,
    readThenPaginateDoesNotSkipMessages,
    markAllRespectsFilterChangesWhileSaving,
    providerMessagesOnlyOpenProviderPages,
  ]) {
    await test()
    console.log('PASS ' + test.name)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
