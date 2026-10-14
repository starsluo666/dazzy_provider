const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
function execute(source, imports = {}, globals = {}) {
  const context = { exports: {}, Error, setTimeout, clearTimeout, ...globals, require: name => {
    if (!(name in imports)) throw new Error('Unexpected import: ' + name)
    return imports[name]
  } }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return context.exports
}
const read = file => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8')
const selection = execute(read('utils/serviceCities.ts'))
module.exports = { execute, read, selection }
