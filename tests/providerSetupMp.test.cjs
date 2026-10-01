// Run after build:mp-weixin. Execute the emitted component and resolve its WXML
// bindings so an H5-only test cannot hide broken native props or image sources.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const { baseParse } = require('@vue/compiler-dom')
const postcss = require('postcss')
const selectorParser = require('postcss-selector-parser')
const build = path.resolve(__dirname, '../dist/build/mp-weixin')
const file = extension => fs.readFileSync(path.join(build, `components/ProviderSetupCard.${extension}`), 'utf8')
const vendor = {
  computed: vue.computed, defineComponent: value => value, _export_sfc: value => value,
  e: (...values) => Object.assign({}, ...values), t: value => String(value ?? ''),
  f: (items, callback) => items.map((item, index) => callback(item, index, index)),
  n: vue.normalizeClass, o: handler => handler,
}
let component
vm.runInNewContext(file('js'), {
  require(name) {
    if (name === '../common/vendor.js') return vendor
    return require(path.resolve(build, 'components', name))
  },
  wx: { createComponent: value => { component = value } },
})
assert.equal(component.props.data.default, null)
const props = vue.reactive({ data: undefined })
const emitted = []
const render = component.setup(props, { emit: event => emitted.push(event) })
const tree = baseParse(file('wxml'))
const attr = (node, name) => node.props.find(prop => prop.name === name)
function value(attribute, scope) {
  const text = attribute?.value?.content || ''
  const expression = text.match(/^\{\{([\s\S]*)\}\}$/)
  return expression ? vm.runInNewContext(`(${expression[1]})`, scope) : text
}
function visibleNodes(nodes, scope, output = []) {
  let branchMatched = false
  for (const node of nodes) {
    if (node.type !== 1) continue
    const loop = attr(node, 'wx:for')
    if (loop) {
      const itemName = attr(node, 'wx:for-item')?.value?.content || 'item'
      for (const item of value(loop, scope) || []) {
        visibleNodes([{ ...node, props: node.props.filter(prop => prop !== loop) }], { ...scope, [itemName]: item }, output)
      }
      continue
    }
    const condition = attr(node, 'wx:if')
    const alternative = attr(node, 'wx:elif')
    const fallback = attr(node, 'wx:else')
    if (condition) {
      branchMatched = Boolean(value(condition, scope))
      if (!branchMatched) continue
    } else if (alternative || fallback) {
      if (branchMatched || (alternative && !value(alternative, scope))) continue
      branchMatched = true
    } else branchMatched = false
    output.push({ node, scope })
    visibleNodes(node.children, scope, output)
  }
  return output
}
const currentNodes = () => visibleNodes(tree.children, render({}))
assert.equal(currentNodes().length, 0, 'attached before props must render nothing without throwing')
props.data = null
assert.equal(currentNodes().length, 0)

const initial = {
  identity_status: 'unverified', profile_review_status: 'not_submitted',
  is_profile_complete: false, pending_service_revision_count: 0,
  onboarding_status: 'incomplete', onboarding_rejection_reason: '',
  onboarding_blockers: ['请先添加并启用至少一项服务'],
}
const images = nodes => nodes.filter(({ node }) => node.tag === 'image').map(({ node, scope }) => value(attr(node, 'src'), scope))
props.data = initial
assert.deepEqual(images(currentNodes()), ['/static/icons/security.svg', '/static/icons/orders.svg', '/static/icons/service.svg'])
for (const identity_status of ['pending', 'verified', 'rejected']) {
  props.data = { ...initial, identity_status }
  const nodes = currentNodes()
  assert.deepEqual(images(nodes), ['/static/icons/orders.svg', '/static/icons/service.svg'])
  for (const { node, scope } of nodes.filter(({ node }) => attr(node, 'bindtap'))) {
    value(attr(node, 'bindtap'), scope)()
  }
  assert.deepEqual(emitted.splice(0), ['identity', 'profile', 'services'])
}
props.data = { ...initial, identity_status: 'verified', profile_review_status: 'pending', pending_service_revision_count: 1 }
assert.deepEqual(images(currentNodes()), [])
// Simulate loss of props followed by another native update.
props.data = undefined
assert.equal(currentNodes().length, 0)
props.data = initial
assert.equal(images(currentNodes()).length, 3)

// With an explicit v-if on the component the compiler omitted its u-p guard.
const page = fs.readFileSync(path.join(build, 'pages/workbench/index.wxml'), 'utf8')
const nativeTag = page.match(/<provider-setup-card\b[^>]*>/)?.[0]
assert.ok(nativeTag)
assert.equal(nativeTag.match(/wx:if="([^"]+)"/)?.[1], nativeTag.match(/u-p="([^"]+)"/)?.[1])
postcss.parse(file('wxss')).walkRules(rule => {
  selectorParser(selectors => {
    selectors.walk(node => assert.ok(!['tag', 'id', 'attribute'].includes(node.type), `unsupported WXSS selector: ${rule.selector}`))
  }).processSync(rule.selector)
})
console.log('PASS compiled mini-program: absent/late props, status transitions, WXML image URLs, tap events, u-p mount guard and WXSS selectors')
