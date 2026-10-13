const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/coverCrop.ts'), 'utf8')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
const { createCrop, panCrop, zoomCrop, minimumScale, cropRectangle } = context.exports
for (const [w, h] of [[400, 1800], [1800, 400], [800, 800], [1000, 800]]) {
  for (const frame of [248, 303, 358]) {
    let state = createCrop(w, h, frame)
    for (const scale of [0, .01, 1, 2, 10000]) {
      state = zoomCrop(state, scale)
      assert.ok(state.scale >= minimumScale(state) && state.scale <= minimumScale(state) * 3)
      for (const [dx, dy] of [[10000, -10000], [-10000, 10000], [17, 38]]) {
        state = panCrop(state, dx, dy)
        const crop = cropRectangle(state)
        assert.ok(crop.x >= 0 && crop.y >= 0)
        assert.ok(crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001)
        assert.ok(Math.abs(crop.width * w / (crop.height * h) - 1.25) < 1e-9)
      }
    }
  }
}
const portrait = createCrop(500, 1500, 300)
assert.equal(portrait.x, 0)
assert.equal(portrait.y, -180)
assert.equal(panCrop(portrait, 0, 330).y, 0)
assert.throws(() => createCrop(0, 500, 300))
assert.throws(() => createCrop(Infinity, 500, 300))
console.log('PASS cover geometry: portrait/landscape/square, drag bounds, zoom bounds, normalized 5:4 rectangles')
