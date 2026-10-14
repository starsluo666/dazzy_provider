const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const vue = require('vue')
const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/training/index.vue'), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const course = (version = 1) => ({ version_id: version, title: '接单规范', pass_score: 100,
  lessons: [{ id: `lesson-${version}`, title: '出发前联系用户', content: '请核实订单情况。' }],
  questions: [{ id: `question-${version}`, title: '出发前应该做什么？', options: ['联系用户', '不联系'] }] })
function mount({ required = false, exempt = false, published = true } = {}) {
  let value = { required, exempt, passed: !required && !exempt, passed_at: !required && !exempt ? '2026-10-01' : null,
    course: published ? course() : null, completed_lesson_ids: required || exempt ? [] : ['lesson-1'], last_result: null }
  let writes = 0, fail = false
  const dependencies = { vue, '@dcloudio/uni-app': { onShow() {} }, '@/services/session': { guardCurrentPage: () => true },
    '@/utils/formatters': { getErrorMessage: e => e.message },
    '@/services/training': {
      getTraining: async () => { if (fail) throw new Error('测试加载失败'); return { data: structuredClone(value) } },
      completeTrainingLesson: async (_version, id) => { writes++; value.completed_lesson_ids.push(id); return { data: structuredClone(value) } },
      submitTraining: async () => { writes++; value = { ...value, required: false, passed: true, passed_at: '2026-10-14' }; return { data: structuredClone(value) } },
    } }
  const context = { exports: {}, uni: { pageScrollTo() {}, showToast() {} }, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(script + '\nexports.api = { data, reviewing, openLesson, answers, load, apply, startReview, finishReview, completeLesson, submit, error };',
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return { ...context.exports.api, writes: () => writes, update: patch => { value = { ...value, ...patch } }, fail: () => { fail = true } }
}
async function main() {
  assert.match(source, /再次学习/)
  assert.doesNotMatch(source, /class="result-title">[^\n]*无需重复考核/)
  assert.match(source, /v-if="!reviewing"[^>]+@tap="completeLesson/)
  for (const exempt of [false, true]) {
    const page = mount({ exempt })
    await page.load()
    const before = JSON.stringify(page.data.value)
    page.startReview()
    assert.equal(page.reviewing.value, true)
    assert.equal(page.openLesson.value, 'lesson-1', 'reopen first lesson even when all lessons were completed')
    await page.completeLesson('lesson-1')
    page.answers['question-1'] = 0
    await page.submit()
    assert.equal(page.writes(), 0, 'review is read-only, including direct handler calls')
    assert.equal(JSON.stringify(page.data.value), before, 'existing exemption/pass/progress remains intact')
    page.finishReview()
    page.startReview()
    assert.equal(page.reviewing.value, true, 'review is repeatable')
    page.update({ course: course(2), completed_lesson_ids: [] })
    await page.load()
    assert.equal(page.reviewing.value, true)
    assert.equal(page.openLesson.value, 'lesson-2')
    assert.equal(Object.keys(page.answers).length, 0, 'old answers never carry to a new published course')
    page.update({ course: null })
    await page.load()
    assert.equal(page.reviewing.value, false)
  }
  const first = mount({ required: true })
  await first.load()
  first.startReview()
  assert.equal(first.reviewing.value, false, 'first-order requirements cannot be bypassed via review')
  first.answers['question-1'] = 0
  await first.submit()
  assert.equal(first.writes(), 0, 'all lessons still required for first exam')
  await first.completeLesson('lesson-1')
  await first.submit()
  assert.equal(first.writes(), 2)
  assert.equal(first.data.value.passed, true)
  first.startReview()
  assert.equal(first.reviewing.value, true)
  first.apply({ ...first.data.value, required: true, passed: false, passed_at: null })
  assert.equal(first.reviewing.value, false, 'server requirements always win')
  const empty = mount({ published: false })
  await empty.load()
  empty.startReview()
  assert.equal(empty.reviewing.value, false)
  const failed = mount()
  await failed.load()
  failed.fail()
  await failed.load()
  failed.startReview()
  assert.equal(failed.reviewing.value, false, 'failed refresh must not open stale data')
  console.log('PASS training review: passed/exempt, repeatable read-only lessons, updates, missing course, failures and first-exam guard')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
