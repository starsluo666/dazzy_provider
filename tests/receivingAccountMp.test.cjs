// Run after build:mp-weixin; catch page registration and unsupported native styles.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
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
assert.equal(assets[assetName], '/static/icons/income.svg')
assert.ok(wxml.includes('<input'))
assert.ok(wxml.includes('<picker'))
assert.ok(wxml.includes('save-button'))
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/receiving-account/index.vue'), 'utf8')
assert.ok(!/setStorage|localStorage|sessionStorage/.test(source), 'private form must not be persisted on device')
assert.ok(source.includes('onUnload(clearSensitiveInputs)'))
console.log('PASS receiving account native route, styles, controls, image URL and no local form persistence')
