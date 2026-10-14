const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const vue = require('vue')

function mount(page) {
  const source = fs.readFileSync(path.resolve(__dirname, `../src/pages/orders/${page}.vue`), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const dependencies = {
    vue, '@dcloudio/uni-app': { onShow() {}, onLoad() {} },
    '@/services/training': {}, '@/services/session': {}, '@/services/orders': {},
    '@/utils/orderFulfillment': {},
    '@/utils/formatters': { formatBusinessDateTime: value => value },
  }
  const context = { exports: {}, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`)
    return dependencies[name]
  } }
  const extra = page === 'detail' ? ', order, timeline, showActionBar' : ', nextStepTitle'
  vm.runInNewContext(ts.transpileModule(script + `\nexports.api = { statusLabel, statusTone, nextStepCopy, actionLabel${extra} };`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return { ...context.exports.api, template: source.split('</template>')[0] }
}

const list = mount('index'), detail = mount('detail')
const order = {
  status: 'pending_confirmation', fulfillment_review_required: true,
  created_at: '2026-10-14T00:00:00Z', service_started_at: '2026-10-14T02:00:00Z',
  completion_submitted_at: '2026-10-14T03:00:00Z', completion_longitude: 114,
  confirmation_expires_at: '2026-10-15T03:00:00Z',
}
const snapshot = JSON.stringify(order)
for (const page of [list, detail]) {
  assert.equal(page.statusLabel(order.status, true), '待客服审核')
  assert.equal(page.statusTone(order.status, true), 'orange')
  assert.equal(page.statusLabel(order.status, false), '等待用户确认')
  assert.equal(page.statusTone(order.status, false), 'cyan')
  assert.doesNotMatch(page.nextStepCopy(order), /暂停|等待用户|已提交/)
  assert.equal(page.actionLabel(order), '')
  for (const [status, action] of [['pending_service', '确认出发'], ['departed', '上传集合照'], ['in_service', '提交完成']]) {
    const active = { ...order, status }
    assert.equal(page.actionLabel(active), action, 'review display must not remove existing fulfillment actions')
    assert.equal(page.statusLabel(status, true), page.statusLabel(status, false))
    if (page === detail) {
      detail.order.value = active
      assert.equal(detail.showActionBar.value, true)
    }
  }
}
assert.match(list.template, /v-if="order.status !== 'pending_confirmation' \|\| !order.fulfillment_review_required" class="card-footer"/,
  'hide the redundant completed/waiting footer only while completion is under review')
assert.doesNotMatch(list.template, /自动确认与分账已暂停/)
detail.order.value = order
assert.equal(detail.showActionBar.value, false)
assert.equal(detail.timeline.value.filter(row => row.current).length, 1)
const review = detail.timeline.value.find(row => row.current)
assert.equal(review.label, '履约异常 · 待客服审核')
assert.equal(review.copy, undefined)
assert.equal(review.danger, true)
assert.ok(detail.timeline.value.some(row => row.label === '服务已开始'), 'keep earlier fulfillment history')
assert.ok(detail.timeline.value.every(row => !/提交完成|提交服务完成|等待用户确认|自动确认/.test(row.label)))
assert.equal(JSON.stringify(order), snapshot, 'presentation must not change review flags or recorded evidence')

// Clearing review reactively restores the ordinary milestone and confirmation deadline.
detail.order.value.fulfillment_review_required = false
assert.ok(detail.timeline.value.some(row => row.label === '已提交完成并留存位置' && row.time === order.completion_submitted_at))
assert.ok(detail.timeline.value.some(row => row.label === '等待用户确认' && row.copy.includes(order.confirmation_expires_at)))
assert.equal(list.nextStepTitle(detail.order.value), '已提交服务完成')
assert.match(list.nextStepCopy(detail.order.value), /等待用户/)
detail.order.value.completion_longitude = null
assert.ok(detail.timeline.value.some(row => row.label === '已提交服务完成'), 'legacy records without GPS remain supported')
detail.order.value.fulfillment_review_required = true
assert.ok(detail.timeline.value.every(row => !/提交服务完成/.test(row.label)))
console.log('PASS review presentation: list/detail, hidden duplicate completion, restored normal flow, unchanged fulfillment actions and records')
