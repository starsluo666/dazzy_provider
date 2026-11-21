// Run after build:mp-weixin to check the compiled income script and template together.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const { baseParse } = require('@vue/compiler-dom')

const prefix = path.resolve(__dirname, '../dist/build/mp-weixin/pages/income/index')
const read = extension => fs.readFileSync(`${prefix}.${extension}`, 'utf8')
const readPageData = {
  store_mode: false,
  wallet: {
    available_amount: 123456, reserved_amount: 12300, paid_amount: 45600,
    max_withdrawal_amount: 1000000, can_withdraw: false, withdrawals: [],
    withdrawal_cash_type: 'T1', unavailable_reason: '提现尚未就绪，请检查收款账户或联系平台。',
  },
  summary: { month_income_amount: 78900, month_order_count: 1, pending_amount: 2300, settled_amount: 89000 },
  items: [],
}
let nativePage, show
const vendor = {
  ...vue,
  defineComponent: value => value, _export_sfc: value => value,
  e: (...objects) => Object.assign({}, ...objects), t: value => String(value ?? ''),
  o: (_handler, key) => `event_${key}`, p: value => value,
  onShow: callback => { show = callback },
  index: { getStorageSync: () => null },
}
vm.runInNewContext(read('js'), {
  require(name) {
    if (name.endsWith('/vendor.js')) return vendor
    return {
      getProviderIncome: async () => ({ data: readPageData }),
      getStoredUser: () => ({ public_id: 'fixture' }),
      formatAmount: cents => (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
    }
  },
  wx: { createPage: component => { nativePage = component } },
})

const render = nativePage.setup({})
const tree = baseParse(read('wxml'))
const attr = (node, name) => node.props?.find(prop => prop.name === name)?.value?.content || ''
function findByClass(node, name) {
  if (attr(node, 'class').split(/\s+/).includes(name)) return node
  for (const child of node.children || []) {
    const match = findByClass(child, name)
    if (match) return match
  }
}
function displayText(node, bindings) {
  if (node.type === 2) return node.content
  if (node.type === 5) return String(bindings[node.content.content.trim()] ?? '')
  return (node.children || []).map(child => displayText(child, bindings)).join('')
}

async function main() {
  await show()
  const bindings = render({})
  const text = name => displayText(findByClass(tree, name), bindings)
  assert.ok(text('income-hero').includes('¥1,234.56'))
  assert.ok(text('withdraw-rules').includes('下一工作日到账，以实际到账为准'))
  assert.equal(text('ledger-note'), readPageData.wallet.unavailable_reason)
  assert.equal(text('cash-summary'), '提现中 ¥123已提现 ¥456')
  assert.equal(text('balance-row'), '冻结中¥23累计账务结算¥890')

  readPageData.store_mode = true
  readPageData.wallet.withdrawal_cash_type = 'D1'
  readPageData.wallet.unavailable_reason = ''
  await show()
  const next = render({})
  const isVisible = name => Boolean(next[attr(findByClass(tree, name), 'wx:if').replace(/[{}]/g, '')])
  assert.equal(displayText(findByClass(tree, 'dz-page-title'), next), '余额与提现')
  assert.ok(displayText(findByClass(tree, 'withdraw-rules'), next).includes('下一自然日到账，以实际到账为准'))
  assert.equal(isVisible('ledger-note'), false)
  assert.equal(isVisible('balance-row'), false)
  console.log('PASS mini-program income template and script agree on money, status and arrival text')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
