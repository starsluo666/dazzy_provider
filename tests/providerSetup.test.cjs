const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/providerSetup.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { providerSetup } = context.exports
const missingService = '请先添加并启用至少一项服务'
const initial = {
  identity_status: 'unverified', profile_review_status: 'not_submitted',
  is_profile_complete: false, pending_service_revision_count: 0,
  onboarding_status: 'incomplete', onboarding_rejection_reason: '',
  onboarding_blockers: ['请等待达人开通审核通过', '请先完成实名认证', '请先完善达人资料', missingService],
}
const presentation = changes => providerSetup({ ...initial, ...changes })
const states = result => Array.from(result.steps, step => step.state)

// 小程序组件可能先 attached，再收到父组件 props；此时不能读取空对象或假报进度。
assert.equal(providerSetup(), null)
assert.equal(providerSetup(undefined), null)
assert.equal(providerSetup(null), null)
assert.deepEqual(states(presentation({})), ['todo', 'todo', 'todo'])
assert.equal(presentation({}).progress, '已提交 0/3')
// 截图中的场景：实名认证待审核不能显示绿色完成对勾。
const identityPending = presentation({ identity_status: 'pending' })
assert.deepEqual(states(identityPending), ['pending', 'todo', 'todo'])
assert.equal(identityPending.progress, '已提交 1/3')
assert.equal(identityPending.caption, '下一步：完善达人资料')
assert.equal(identityPending.steps[0].action, '审核中')
// 入驻申请里已有照片简介，不等于完成本轮资料提交。
assert.equal(presentation({ is_profile_complete: true }).steps[1].state, 'todo')
assert.equal(presentation({ is_profile_complete: true, profile_review_status: 'pending' }).steps[1].state, 'pending')
assert.equal(presentation({ is_profile_complete: true, profile_review_status: 'rejected' }).steps[1].state, 'rejected')

const review = presentation({ identity_status: 'pending', profile_review_status: 'pending', pending_service_revision_count: 1, onboarding_status: 'pending_review' })
assert.deepEqual(states(review), ['pending', 'pending', 'pending'])
assert.equal(review.progress, '已提交 3/3')
assert.equal(review.title, '开通审核中')
assert.equal(review.showSubmissionHint, false)

const rejected = presentation({ identity_status: 'rejected', profile_review_status: 'rejected', onboarding_status: 'rejected' })
assert.deepEqual(states(rejected), ['rejected', 'rejected', 'rejected'])
assert.equal(rejected.progress, '已提交 0/3')
// 综合驳回不能撤销历史已通过的身份认证；重提后该项恢复审核中。
assert.equal(presentation({ identity_status: 'verified', onboarding_status: 'rejected' }).steps[0].state, 'done')
assert.equal(presentation({ pending_service_revision_count: 1, onboarding_status: 'rejected' }).steps[2].state, 'pending')

const ready = presentation({ identity_status: 'verified', profile_review_status: 'approved', is_profile_complete: true, onboarding_status: 'approved', onboarding_blockers: ['因服务投诉暂停接单'] })
assert.deepEqual(states(ready), ['done', 'done', 'done'])
assert.equal(ready.progress, '已就绪 3/3')
assert.equal(ready.caption, '因服务投诉暂停接单')
assert.equal(presentation({ onboarding_status: 'approved', is_profile_complete: true }).steps[1].state, 'done')
assert.equal(presentation({ onboarding_blockers: [missingService], onboarding_status: 'approved' }).steps[2].state, 'todo')
assert.equal(presentation({ onboarding_blockers: undefined }).steps[2].state, 'todo')
console.log('PASS provider setup: pending vs approved, next step, combined rejection/resubmission, legacy profiles and service restrictions')
