const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/photoPreview.ts'), 'utf8')
const writes = [], removed = []
const context = { exports: {}, wx: { env: { USER_DATA_PATH: '/sandbox' } }, uni: { getFileSystemManager: () => ({ writeFile: args => { writes.push(args); args.success() }, unlink: args => removed.push(args.filePath) }) } }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
async function main() {
  const first = await context.exports.photoPreview('fixture-base64')
  const second = await context.exports.photoPreview('fixture-base64-2')
  assert.notEqual(first.url, second.url)
  assert.match(first.url, /^\/sandbox\/dazzy-crop-[\w-]+\.jpg$/)
  assert.equal(writes[0].data, 'fixture-base64'); assert.equal(writes[0].encoding, 'base64')
  first.dispose(); assert.deepEqual(removed, [first.url])
  second.dispose(); assert.deepEqual(removed, [first.url, second.url])
  console.log('PASS mini-program preview: isolated temporary filenames, base64 write, exact-file cleanup')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
