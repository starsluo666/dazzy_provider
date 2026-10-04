const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/orderFulfillment.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function mount({ dialFails = false, locationFails = false, confirmed = true } = {}) {
  const records = [], modals = []
  let locationCalls = 0
  const context = { exports: {}, require: () => ({ recordManagedOrderContact: async number => { records.push(number); return { data: { order_no: number } } } }), uni: {
    showModal: opts => { modals.push(opts); opts.success?.({ confirm: confirmed }); opts.complete?.() },
    makePhoneCall: opts => dialFails ? opts.fail() : opts.success(),
    getLocation: opts => { locationCalls++; locationFails ? opts.fail() : opts.success({ longitude: 114.123456789, latitude: 36.123456789, accuracy: 8.126 }) },
  } }
  vm.runInNewContext(compiled, context)
  return { ...context.exports, records, modals, locationCalls: () => locationCalls }
}
async function main() {
  const order = { order_no: 'TEST-ONLY', status: 'pending_service', contact_phone_display: '13900000000', provider_contact_initiated_at: null }
  const actions = mount()
  assert.equal(await actions.confirmOrderDeparture(order), false)
  assert.equal(actions.modals[0].showCancel, false)
  await actions.contactOrderCustomer(order)
  assert.deepEqual(actions.records, ['TEST-ONLY'])
  assert.equal(await actions.confirmOrderDeparture({ ...order, provider_contact_initiated_at: 'test' }), true)
  assert.match(actions.modals[1].content, /未接通/)
  assert.ok(actions.modals.every(modal => (modal.confirmText || '').length <= 4), 'native modal action labels fit WeChat limits')
  assert.equal(await actions.confirmOrderDeparture({ ...order, order_no: 'OTHER' }), false, 'contact state is per order, not device-wide')
  const failed = mount({ dialFails: true })
  await assert.rejects(() => failed.contactOrderCustomer(order))
  assert.deepEqual(failed.records, [])
  assert.equal(actions.canContactOrder({ ...order, status: 'pending_acceptance' }), false)
  assert.equal(actions.canContactOrder({ ...order, contact_phone_display: '139****0000' }), false)
  const cancelled = mount({ confirmed: false })
  assert.equal(await cancelled.confirmOrderDeparture({ ...order, provider_contact_initiated_at: 'test' }), false)
  for (let i = 0; i < 2; i++) {
    const location = await actions.getFulfillmentLocation()
    assert.equal(location.longitude, 114.1234568)
    assert.equal(location.accuracy_m, 8.13)
  }
  assert.equal(actions.locationCalls(), 2, 'completion must not reuse arrival coordinates')
  await assert.rejects(() => mount({ locationFails: true }).getFulfillmentLocation())
  for (const page of ['index', 'detail']) {
    const text = fs.readFileSync(path.resolve(__dirname, `../src/pages/orders/${page}.vue`), 'utf8')
    assert.match(text, /confirmOrderDeparture\(/)
    assert.match(text, /contactOrderCustomer\(/)
    assert.match(text, /completeManagedProviderOrder\([^\n]+await getCurrentLocation\(\)/)
  }
  console.log('PASS per-order contact, explicit confirmation, cancelled dial, fresh completion location and shared list/detail flow')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
