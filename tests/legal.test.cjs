const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto')
const ts = require('typescript'), vue = require('vue')
const contentRoot = path.resolve(__dirname, '../src/content/legal')
const documents = Object.fromEntries(['service', 'privacy', 'closure'].map(kind => [kind, require(path.join(contentRoot, `${kind}.json`))]))
const navigation = []
const uni = { navigateTo: options => navigation.push(options) }
function transpile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
}
const exportsObject = {}
vm.runInNewContext(transpile(fs.readFileSync(path.join(contentRoot, 'index.ts'), 'utf8')), {
  exports: exportsObject, uni, require: file => require(path.resolve(contentRoot, file)),
})
function bodyText(document) {
  return document.blocks.map(block => block.kind === 'heading' ? block.text : block.kind === 'paragraph' ? block.runs.map(run => run.text).join('') : block.rows.flat().join('\n')).join('\n')
}
for (const [kind, expectedSections, expectedTables] of [['service', 12, 0], ['privacy', 14, 5], ['closure', 4, 0]]) {
  const document = exportsObject.getLegalDocument(kind)
  assert.equal(document.id, kind)
  assert.ok(document.title.startsWith('乐搭伴用户'))
  assert.ok(!JSON.stringify(document).includes('往约'), 'published agreements must not reference the old brand')
  for (const legacy of ['无锡', '滨湖', '推拿', 'spa套餐']) assert.ok(!JSON.stringify(document).includes(legacy), `legacy template reference removed: ${legacy}`)
  assert.equal(document.blocks.filter(block => block.kind === 'heading').length, expectedSections)
  assert.equal(document.blocks.filter(block => block.kind === 'table').length, expectedTables)
  assert.equal(new Set(document.blocks.map(block => block.id)).size, document.blocks.length)
  for (const block of document.blocks) {
    assert.ok(block.id.startsWith(`${kind}-block-`))
    if (block.kind === 'paragraph') assert.ok(block.runs.every(run => typeof run.text === 'string' && run.text.length))
    if (block.kind === 'table') assert.ok(block.rows.every(row => row.length === block.rows[0].length))
  }
  // Supplied DOCX files live outside the app submodule. Verify provenance when available locally.
  const sourceFile = path.resolve(__dirname, '../../', document.sourceFile)
  if (fs.existsSync(sourceFile)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'), document.sourceSha256)
  exportsObject.openLegalDocument(kind)
  assert.equal(navigation.at(-1).url, `/pages/legal/document?type=${kind}`)
  console.log(`PASS ${kind}: full body, sections, tables, source fingerprint and navigation`)
}
assert.equal(documents.service.effectiveLabel, '生效时间：2025年7月29日')
assert.equal(documents.privacy.effectiveLabel, '生效日期：2026年04月15日')
assert.equal(documents.closure.effectiveLabel, '', 'never invent an effective date')
assert.ok(bodyText(documents.service).includes('【可分性】'))
assert.ok(bodyText(documents.privacy).includes('十四、 如何联系我们'))
assert.ok(bodyText(documents.privacy).includes('全功能版视立方SDK'))
assert.ok(bodyText(documents.privacy).includes('15102670626'))
assert.ok(bodyText(documents.closure).includes('5个工作日'))
assert.ok(bodyText(documents.closure).includes('提交当日不计入'))
assert.ok(bodyText(documents.closure).includes('中国法定节假日、调休安排'))
assert.ok(bodyText(documents.closure).includes('登录失败或仅获取验证码不构成撤销'))
assert.ok(documents.closure.blocks[0].runs[0].bold)
for (const invalid of [undefined, '', 'unknown', 'constructor', '__proto__', ['privacy'], 'https://example.invalid']) assert.equal(exportsObject.getLegalDocument(invalid), undefined)

const session = {}
vm.runInNewContext(transpile(fs.readFileSync(path.resolve(__dirname, '../src/services/session.ts'), 'utf8').replaceAll('import.meta.env', '({ DEV: false })')), { exports: session, uni })
for (const kind of Object.keys(documents)) assert.equal(session.isProtectedRoute(exportsObject.legalDocumentUrl(kind)), false, 'agreements are readable before login')

const hooks = {}, context = { exports: {}, uni, require(name) {
  if (name === 'vue') return vue
  if (name === '@dcloudio/uni-app') return { onLoad: cb => { hooks.load = cb }, onPageScroll: cb => { hooks.scroll = cb } }
  if (name === '@/content/legal') return exportsObject
  return {}
} }
const pageScript = fs.readFileSync(path.resolve(__dirname, '../src/pages/legal/document.vue'), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
vm.runInNewContext(transpile(pageScript + '\nglobalThis.page = { document, headings, relatedLinks, contentsExpanded };'), context)
hooks.load({ type: 'privacy' })
assert.equal(context.page.headings.value.length, 14, 'TOC is generated from body, not outdated manual contents')
assert.equal(context.page.relatedLinks.value.length, 2)
assert.equal(context.page.contentsExpanded.value, false)
hooks.load({ type: '__proto__' })
assert.equal(context.page.document.value, undefined, 'unknown documents show a safe empty state')
assert.equal(context.page.headings.value.length, 0)
console.log('PASS public reader, original dates, bold clauses, generated contents and invalid routes')
for (const kind of Object.keys(documents)) {
  const canonical = path.resolve(__dirname, '../../dazzy_app/src/content/legal', kind + '.json')
  if (fs.existsSync(canonical)) assert.deepEqual(documents[kind], JSON.parse(fs.readFileSync(canonical, 'utf8')), 'legal content must match the user app')
}
