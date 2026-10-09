const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/components/TerminationRequestForm.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const code = ts.transpileModule(script + '\nexports.form = { submit, reason, images, saving, endDate, endTime, error };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const posts = [], events = []
let modal
const sandbox = {
  exports: {},
  defineProps: () => ({ orderNo: 'OFFLINE-TERMINATION' }),
  defineEmits: () => event => events.push(event),
  require: name => {
    if (name === 'vue') return { ref: value => ({ value }) }
    if (name.includes('/services/orders')) return { createTerminationRequest: async (orderNo, body) => posts.push({ orderNo, body }) }
    if (name.includes('/utils/formatters')) return { getErrorMessage: (error, fallback) => error.message || fallback }
    throw new Error('Unexpected module: ' + name)
  },
  uni: { showModal: options => { modal = options }, showToast: () => {} },
}
vm.runInNewContext(code, sandbox)
const form = sandbox.exports.form

;(async () => {
  await form.submit()
  assert.equal(posts.length, 0)
  assert.match(form.error.value, /至少/)
  form.reason.value = '服务中途离开，请客服核定退款'
  form.images.value = [{ id: 'offline-evidence-id', url: 'private-preview-url' }]
  const pending = form.submit()
  assert.equal(form.saving.value, true)
  await form.submit()
  assert.equal(posts.length, 0, 'Confirmation is required, rapid taps cannot submit twice')
  modal.success({ confirm: false })
  await pending
  assert.equal(posts.length, 0)
  assert.equal(form.saving.value, false)
  const confirmed = form.submit()
  modal.success({ confirm: true })
  await confirmed
  assert.equal(posts.length, 1)
  assert.equal(posts[0].orderNo, 'OFFLINE-TERMINATION')
  assert.equal(posts[0].body.evidence_asset_ids[0], 'offline-evidence-id')
  assert.equal(JSON.stringify(posts[0]).includes('private-preview-url'), false)
  assert.deepEqual(events, ['submitted'])
  form.endDate.value = '2999-12-31'
  await form.submit()
  assert.equal(posts.length, 1, 'Future end time rejected before POST')
  assert.match(form.error.value, /当前时间/)
  const wxmlPath = path.join(root, 'dist/build/mp-weixin/components/TerminationRequestForm.wxml')
  if (fs.existsSync(wxmlPath)) {
    const wxml = fs.readFileSync(wxmlPath, 'utf8')
    assert(!/<(?:section|main|strong|label|footer)\b/.test(wxml))
    for (const value of ['termination-time', 'termination-reason', 'termination-submit']) assert(wxml.includes(value))
  }
  console.log('PASS termination form validation, cancellation, double-click guard, evidence IDs, future time and mini-program markup')
})().catch(error => { console.error(error); process.exitCode = 1 })
