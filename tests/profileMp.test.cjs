// Run after build:mp-weixin. Resolve the emitted WXML against its matching JS,
// including loop-local bindings; an image source must never be a menu object/array.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const { baseParse } = require('@vue/compiler-dom')

const build = path.resolve(__dirname, '../dist/build/mp-weixin')
const pageFile = extension => fs.readFileSync(path.join(build, `pages/profile/index.${extension}`), 'utf8')
const calls = [], modals = []
let page, show, online = true
const services = {
  getProviderWorkbench: async () => ({ data: {
    nickname: '测试达人', avatar_url: 'https://example.invalid/avatar.jpg',
    rating: '4.80', is_online: online, can_accept_orders: true,
    service_city_name: '邯郸市', pending_acceptance_order_count: 1,
  } }),
  stopProviderOnline: async () => { calls.push('offline') },
  stopLocationReporting: () => { calls.push('stop-location') },
  logout: async () => { calls.push('logout') },
  formatAmount: value => (value / 100).toFixed(2),
}
const vendor = {
  ...vue, defineComponent: value => value, _export_sfc: value => value,
  onShow: callback => { show = callback },
  e: (...values) => Object.assign({}, ...values), t: value => String(value ?? ''),
  f: (items, callback) => items.map((item, index) => callback(item, index, index)),
  o: handler => handler, p: value => value,
  index: {
    navigateTo: options => calls.push(options.url),
    reLaunch: options => calls.push(options.url),
    showModal: options => modals.push(options),
  },
}
vm.runInNewContext(pageFile('js'), {
  wx: { createPage: value => { page = value } },
  require(name) {
    if (name.endsWith('/vendor.js')) return vendor
    if (name.endsWith('/assets.js')) return require(path.join(build, 'common/assets.js'))
    return services
  },
})
const render = page.setup({})
const tree = baseParse(pageFile('wxml'))
const attr = (node, name) => node.props.find(prop => prop.name === name)
function value(attribute, scope) {
  const text = attribute?.value?.content || ''
  const expression = text.match(/^\{\{([\s\S]*)\}\}$/)
  return expression ? vm.runInNewContext(`(${expression[1]})`, scope) : text
}
const hasClass = (node, name) => (attr(node, 'class')?.value?.content || '').split(/\s+/).includes(name)
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
    const condition = attr(node, 'wx:if'), alternative = attr(node, 'wx:elif'), fallback = attr(node, 'wx:else')
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
const nodesFor = snapshot => visibleNodes(tree.children, snapshot)
function checkImages(nodes) {
  const sources = nodes.filter(({ node }) => node.tag === 'image').map(({ node, scope }) => value(attr(node, 'src'), scope))
  for (const source of sources) {
    assert.equal(typeof source, 'string', 'image src must be a string, never a menu object or array')
    assert.ok(source.startsWith('/static/') || source.startsWith('https://'), `invalid image URL: ${source}`)
    if (source.startsWith('/static/')) assert.ok(fs.existsSync(path.join(build, source.slice(1))), `missing icon: ${source}`)
  }
  return sources
}

;(async () => {
  checkImages(nodesFor(render({}))) // Native page initially attaches before profile data arrives.
  await show()
  const snapshot = render({}), nodes = nodesFor(snapshot)
  checkImages(nodes)
  const title = nodes.find(({ node }) => hasClass(node, 'profile-title'))
  assert.ok(title)
  assert.equal(visibleNodes(title.node.children, title.scope).filter(({ node }) => node.tag === 'button').length, 0)
  const tools = nodes.filter(({ node }) => node.tag === 'button' && hasClass(node, 'tool-entry'))
  assert.equal(tools.length, 12, 'eleven navigation tools plus logout')
  const logout = tools.at(-1)
  const logoutImage = visibleNodes(logout.node.children, logout.scope).find(({ node }) => node.tag === 'image')
  assert.equal(value(attr(logoutImage.node, 'src'), logoutImage.scope), '/static/ui-icons/logout.svg')

  // This recreates the reported stale-JS/new-WXML failure: the image alias receives
  // the old menu array, which the native image component stringifies as [object Object],...
  const menuLoop = tools[0].scope
  assert.ok(menuLoop.entry)
  const loopNode = tree.children.flatMap(function collect(node) {
    return node.type === 1 ? [node, ...node.children.flatMap(collect)] : []
  }).find(node => hasClass(node, 'tool-entry') && attr(node, 'wx:for'))
  const menu = value(attr(loopNode, 'wx:for'), snapshot)
  const imageAlias = attr(logoutImage.node, 'src').value.content.match(/^\{\{(\w+)\}\}$/)[1]
  assert.throws(() => checkImages(nodesFor({ ...snapshot, [imageAlias]: menu })), /image src must be a string/)

  for (const { node, scope } of tools.slice(0, -1)) value(attr(node, 'bindtap'), scope)()
  assert.equal(calls.length, 11)
  assert.equal(new Set(calls).size, 11)
  assert.ok(calls.every(url => url.startsWith('/pages/')))
  calls.length = 0
  const tapLogout = () => value(attr(logout.node, 'bindtap'), logout.scope)()
  tapLogout()
  assert.equal(modals.at(-1).title, '退出登录')
  assert.ok(modals.at(-1).content.includes('停止在线接单'))
  await modals.at(-1).success({ confirm: false })
  assert.deepEqual(calls, [])
  tapLogout()
  await modals.at(-1).success({ confirm: true })
  assert.deepEqual(calls.splice(0), ['offline', 'stop-location', 'logout', '/pages/auth/login'])
  online = false
  await show()
  checkImages(nodesFor(render({})))
  tapLogout()
  await modals.at(-1).success({ confirm: true })
  assert.deepEqual(calls, ['stop-location', 'logout', '/pages/auth/login'])
  console.log('PASS native profile: image URL strings, packaged icons, stale-binding detection, tool navigation and logout confirmation')
})().catch(error => { console.error(error); process.exitCode = 1 })
