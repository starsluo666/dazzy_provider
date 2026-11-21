// Run after build:mp-weixin; catch page registration and unsupported native styles.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const { baseParse } = require('@vue/compiler-dom')
const postcss = require('postcss')
const selectorParser = require('postcss-selector-parser')
const build = path.resolve(__dirname, '../dist/build/mp-weixin')
const pagePath = 'pages/receiving-account/index'
assert.ok(JSON.parse(fs.readFileSync(path.join(build, 'app.json'), 'utf8')).pages.includes(pagePath))
const wxss = fs.readFileSync(path.join(build, `${pagePath}.wxss`), 'utf8')
postcss.parse(wxss).walkRules(rule => {
  selectorParser(selectors => {
    selectors.walk(node => assert.ok(!['tag', 'id', 'attribute'].includes(node.type), `unsupported WXSS selector: ${rule.selector}`))
  }).processSync(rule.selector)
})
const wxml = fs.readFileSync(path.join(build, `${pagePath}.wxml`), 'utf8')
const assets = require(path.join(build, 'common/assets.js'))
const js = fs.readFileSync(path.join(build, `${pagePath}.js`), 'utf8')
const imageBinding = wxml.match(/<image[^>]*src="\{\{(\w+)\}\}"/)?.[1]
assert.ok(imageBinding)
const assetName = js.match(new RegExp(`\\b${imageBinding}:\\w+\\.([\\w$]+)`))?.[1]
assert.equal(assets[assetName], '/static/ui-icons/bank.svg')
assert.ok(fs.existsSync(path.join(build, assets[assetName].slice(1))), 'bank icon must be included in the mini-program package')
assert.ok(wxml.includes('<input'))
assert.ok(wxml.includes('<picker'))
assert.equal((wxml.match(/\bsave-button\b/g) || []).length, 1, 'only one primary save or apply button')
assert.ok(wxml.includes('channel-checks'), 'submitted accounts show separate verification checks')
assert.ok(wxml.includes('本人提现卡'))
assert.ok(wxml.includes('提现账户'))
assert.ok(!wxml.includes('手动提现配置'))
assert.ok(!wxml.includes('自动结算'))
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/receiving-account/index.vue'), 'utf8')
assert.ok(!/setStorage|localStorage|sessionStorage/.test(source), 'private form must not be persisted on device')
assert.ok(source.includes('onUnload(clearSensitiveInputs)'))
assert.ok(source.includes("['attention', 'rejected'].includes(account.channel_status) ? '需处理' : '待确认'"))
assert.ok(source.includes('是否可提现请查看收入页'))
assert.ok(!source.includes('已核验关闭'), 'omitted settlement configuration is a platform policy, not channel confirmation')
assert.ok(!source.includes('资料已提交渠道，如需换卡、更正或注销，请联系客服。'), 'use server copy instead of assuming every locked form has been submitted')
console.log('PASS receiving account native route, styles, controls, image URL and no local form persistence')

const attr = (node, name) => node.props?.find(prop => prop.name === name)?.value?.content || ''
function findByClass(node, name) {
  if (new RegExp(`\\b${name}\\b`).test(attr(node, 'class'))) return node
  for (const child of node.children || []) {
    const match = findByClass(child, name)
    if (match) return match
  }
}
const tree = baseParse(wxml)
const card = findByClass(tree, 'channel-card')
const action = findByClass(card, 'save-button')
const heading = findByClass(card, 'section-title')
const error = findByClass(card, 'form-error')
const evaluate = (binding, data) => data[binding.replace(/[{}]/g, '').trim()]
const text = (node, data) => node.children.map(child => child.type === 5
  ? evaluate(child.content.content, data) : child.content).join('')

async function checkBindings() {
  let page, load
  let account = {
    identity_verified: true, collection_enabled: true, can_edit: true,
    materials_saved: true, can_submit: true, onboarding_enabled: true, can_refresh: false,
    channel_status: 'not_connected', status_label: '资料已保存，待申请开户',
    channel_notice: '请继续申请开户', collection_notice: '收款资料说明', onboarding_notice: '开户授权说明',
  }
  const vendor = {
    ...vue, defineComponent: value => value, _export_sfc: value => value,
    e: (...values) => Object.assign({}, ...values), t: value => String(value ?? ''),
    p: value => value, o: handler => handler,
    onLoad: fn => { load = fn }, onShow: () => {}, onUnload: () => {},
  }
  vm.runInNewContext(js, {
    require(name) {
      if (name.endsWith('/vendor.js')) return vendor
      if (name.endsWith('/assets.js')) return assets
      return {
        getProviderReceivingAccount: async () => ({ data: account }),
        getReceivingBankRegions: async () => ({ data: [] }),
      }
    },
    wx: { createPage: value => { page = value } },
  })
  const render = page.setup({})
  await load()
  const data = render({})
  assert.equal(text(heading, data), '申请收款账户')
  assert.equal(text(action, data), '申请开户')
  assert.equal(evaluate(attr(action, 'loading'), data), false)
  assert.equal(evaluate(attr(action, 'disabled'), data), true)
  assert.equal(Boolean(evaluate(attr(error, 'wx:if'), data)), false)

  account = { ...account, materials_saved: false, can_submit: false }
  await load()
  assert.equal(text(action, render({})), '保存并申请开户')
  console.log('PASS compiled receiving account labels and button states use matching JS and WXML')
}
checkBindings().catch(error => { console.error(error); process.exitCode = 1 })
