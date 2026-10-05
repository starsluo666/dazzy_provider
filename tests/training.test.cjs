const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')
const read = name => fs.readFileSync(path.resolve(__dirname, '../src', name), 'utf8')
function execute(source, dependencies, globals) {
  const context = { exports: {}, ...globals, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, context)
  return context.exports
}
async function main() {
  let required = true, fail = false, confirm = true
  const calls = [], navigation = [], messages = []
  const training = execute(read('services/training.ts'), {
    './http': { request: async (url, options) => {
      calls.push({ url, options })
      if (fail) throw new Error('测试网络失败')
      return { data: { required } }
    } },
    '@/utils/formatters': { getErrorMessage: error => error.message },
  }, { uni: {
    showModal: options => options.success({ confirm }),
    navigateTo: options => navigation.push(options.url),
    showToast: options => messages.push(options.title),
  } })
  assert.equal(await training.ensureFirstOrderTraining(), false)
  assert.equal(navigation.pop(), '/pages/training/index')
  confirm = false
  assert.equal(await training.ensureFirstOrderTraining(), false)
  assert.equal(navigation.length, 0)
  required = false
  assert.equal(await training.ensureFirstOrderTraining(), true)
  fail = true
  assert.equal(await training.ensureFirstOrderTraining(), false)
  assert.equal(messages.pop(), '测试网络失败')
  fail = false
  await training.completeTrainingLesson(7, 'lesson-id')
  assert.equal(calls.at(-1).options.data.version_id, 7)
  assert.equal(calls.at(-1).url, '/providers/me/training/lessons/lesson-id/complete/')
  await training.submitTraining(7, { 'question-id': 1 })
  assert.equal(calls.at(-1).options.data.answers['question-id'], 1)
  for (const page of ['pages/orders/index.vue', 'pages/orders/detail.vue']) {
    assert.match(read(page), /if \(!await ensureFirstOrderTraining\(\)\) return/)
  }
  assert.ok(JSON.parse(read('pages.json')).pages.some(item => item.path === 'pages/training/index'))

  // Execute the actual gallery handlers with native picker callbacks, not just text assertions.
  let picker, pickerCalls = 0, uploads = 0
  const source = read('pages/provider-profile/index.vue').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const gallery = execute(source + '\nexports.state = { media, uploading, chooseVideo };', {
    vue, '@dcloudio/uni-app': { onLoad() {}, onHide() {}, onUnload() {} },
    '@/components/NetworkState.vue': {},
    '@/services/providers': { uploadProviderVideo: async () => ({ data: { id: `video-${++uploads}`, url: '/synthetic.mp4' } }) },
    '@/utils/formatters': { getErrorMessage: error => error.message },
  }, { uni: { chooseVideo: options => { picker = options; pickerCalls++ }, showToast: options => messages.push(options.title) } }).state
  gallery.media.value = [{ id: 'cover', type: 'image', url: '/synthetic.jpg' }]
  gallery.chooseVideo()
  assert.equal(picker.maxDuration, 10)
  await picker.success({ tempFilePath: '/long.mov', duration: 10.1, size: 100 })
  assert.equal(uploads, 0)
  assert.equal(gallery.uploading.value, false)
  assert.match(messages.pop(), /不能超过10秒/)
  for (let i = 0; i < 2; i++) {
    gallery.chooseVideo()
    await picker.success({ tempFilePath: '/valid.mov', duration: 10, size: 100 })
  }
  assert.equal(uploads, 2)
  const before = pickerCalls
  gallery.chooseVideo()
  assert.equal(pickerCalls, before, 'third video cannot open picker')
  gallery.media.value.pop()
  gallery.chooseVideo()
  picker.fail({ errMsg: 'chooseVideo:fail cancel' })
  assert.equal(gallery.uploading.value, false, 'cancel restores upload button')
  console.log('PASS training guards, versioned requests, gallery 2-video/10-second boundaries and cancellation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
