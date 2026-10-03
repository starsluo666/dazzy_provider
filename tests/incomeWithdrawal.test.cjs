// Offline page logic: no network, no real storage and no money movement.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/income/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script + '\nexports.page = { load, openWithdrawal, confirmWithdrawal, sendWithdrawal, data, pendingRequest, busy, cashError, withdrawAmount };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const tick = () => new Promise(resolve => setImmediate(resolve))

function mount({ store = new Map(), user = 'provider-a', submit, storageFails = false } = {}) {
  const calls = []
  const modules = {
    vue: { ref: value => ({ value }) },
    '@dcloudio/uni-app': { onShow: () => {} },
    '@/services/session': { getStoredUser: () => ({ public_id: user }) },
    '@/services/providers': {
      getProviderIncome: async () => ({ data: { wallet: { available_amount: 7000, max_withdrawal_amount: 10000, can_withdraw: true } } }),
      createProviderWithdrawal: async (amount, request_key) => {
        assert.equal(store.get(`provider-withdrawal:${user}`).request_key, request_key, 'persist before request')
        calls.push({ amount, request_key })
        return submit ? submit(amount, request_key) : { data: { status_label: '银行处理中' } }
      },
    },
    '@/utils/formatters': { formatAmount: amount => (amount / 100).toFixed(2), getErrorMessage: error => error.message },
  }
  const context = {
    exports: {}, require: name => modules[name] || {},
    uni: {
      getStorageSync: key => store.get(key),
      setStorageSync: (key, value) => { if (storageFails) throw Error('storage full'); store.set(key, value) },
      removeStorageSync: key => store.delete(key), showToast: () => {},
      showModal: options => options.success({ confirm: true }),
    },
  }
  vm.runInNewContext(compiled, context)
  return { ...context.exports.page, calls, store }
}

async function main() {
  const first = mount()
  await first.load()
  for (const amount of ['0', '-1', '0.001', '71', '1e2', 'NaN']) {
    first.withdrawAmount.value = amount
    first.confirmWithdrawal()
    assert.equal(first.calls.length, 0, `reject invalid amount ${amount}`)
  }
  first.withdrawAmount.value = '20.01'
  first.confirmWithdrawal()
  first.confirmWithdrawal() // Busy guard prevents a second confirmation/send.
  await tick()
  assert.equal(first.calls.length, 1)
  assert.equal(first.calls[0].amount, 2001)
  assert.equal(first.pendingRequest.value, null)
  assert.equal(first.store.size, 0)

  const timeout = mount({ submit: async () => { throw Error('timeout') } })
  await timeout.load()
  timeout.withdrawAmount.value = '20'
  timeout.confirmWithdrawal()
  await tick()
  const key = timeout.calls[0].request_key
  assert.equal(timeout.pendingRequest.value.request_key, key)
  const rejectedRetry = mount({ store: timeout.store, submit: async () => { throw Object.assign(Error('account query still running'), { status: 400 }) } })
  await rejectedRetry.load()
  rejectedRetry.confirmWithdrawal()
  await tick()
  assert.equal(rejectedRetry.pendingRequest.value.request_key, key, 'a rejected retry does not prove the original request failed')
  const reloaded = mount({ store: timeout.store })
  await reloaded.load()
  reloaded.confirmWithdrawal()
  await tick()
  assert.equal(reloaded.calls[0].request_key, key, 'reuse same key after app reload')

  const denied = mount({ submit: async () => { throw Object.assign(Error('not ready'), { status: 400 }) } })
  await denied.load()
  denied.withdrawAmount.value = '20'
  denied.confirmWithdrawal()
  await tick()
  assert.equal(denied.pendingRequest.value, null)
  assert.equal(denied.store.size, 0)

  const storage = mount({ storageFails: true })
  await storage.load()
  storage.withdrawAmount.value = '20'
  storage.confirmWithdrawal()
  await tick()
  assert.equal(storage.calls.length, 0, 'do not send without durable idempotency key')
  assert.equal(storage.busy.value, false)

  const other = mount({ user: 'provider-b', store: new Map([['provider-withdrawal:provider-a', { amount: 100, request_key: key }]]) })
  await other.load()
  assert.equal(other.pendingRequest.value, null, 'another account cannot reuse a pending request')
  console.log('PASS withdrawal amount validation, single submit, durable replay, error handling and per-user isolation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
