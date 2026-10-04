const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const selectorParser = require('postcss-selector-parser')
const root = path.resolve(__dirname, '../dist/build/mp-weixin')
const wxss = fs.readFileSync(path.join(root, 'pages/orders/index.wxss'), 'utf8')
postcss.parse(wxss).walkRules(rule => {
  selectorParser(selectors => selectors.walk(node => {
    assert.ok(!['tag', 'id', 'attribute'].includes(node.type), `unsupported native selector: ${rule.selector}`)
  })).processSync(rule.selector)
})
const wxml = fs.readFileSync(path.join(root, 'pages/orders/index.wxml'), 'utf8')
for (const name of ['card-header', 'card-footer', 'primary-button', 'contact-button', 'contact-phone-group', 'contact-button-label', 'evidence-copy', 'risk-notice']) {
  assert.ok(wxml.includes(name), name)
  assert.ok(wxss.includes('.' + name), name)
}
const js = fs.readFileSync(path.join(root, 'pages/orders/index.js'), 'utf8')
assert.ok(wxml.includes('联系用户'), 'compact contact control retains its accessible label')
assert.ok(wxss.includes('align-items:center'))
assert.ok(wxss.includes('justify-content:center'))
assert.ok(!/<(?:header|footer|section|main|b|small)\b/.test(wxml))
console.log('PASS provider orders WXML/WXSS controls and native class selectors')
