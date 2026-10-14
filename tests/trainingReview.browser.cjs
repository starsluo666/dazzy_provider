// Run after build:h5. All API responses are synthetic; no live requests or writes.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = path.resolve(__dirname, '../dist/build/h5')
async function main() {
  const server = http.createServer((req, res) => {
    const target = path.resolve(base, '.' + new URL(req.url, 'http://localhost').pathname)
    if (target !== base && !target.startsWith(base + path.sep)) return res.writeHead(403).end()
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(base, 'index.html')
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
    for (const state of ['passed', 'exempt', 'first', 'unpublished', 'first-unpublished']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      await context.addInitScript(() => localStorage.setItem('dazzy.provider.accessToken', JSON.stringify({ type: 'string', data: 'local-test-token' })))
      const page = await context.newPage(), errors = [], writes = []
      const data = { required: state.startsWith('first'), exempt: state === 'exempt', passed: state === 'passed',
        passed_at: state === 'passed' ? '2026-10-01' : null, completed_lesson_ids: state === 'passed' ? ['one', 'two'] : [], last_result: null,
        course: state.includes('unpublished') ? null : { version_id: 1, title: '接单服务规范', pass_score: 100,
          lessons: [{ id: 'one', title: '出发前联系用户', content: '请联系用户核实订单情况。' }, { id: 'two', title: '服务完成', content: '请上传完成定位并提交服务完成。' }],
          questions: [{ id: 'q1', title: '出发前应该怎么做？', options: ['先联系用户', '直接出发'] }] } }
      page.on('pageerror', e => errors.push(e.message))
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/providers/me/training/')) {
          if (route.request().method() !== 'GET') writes.push(url.pathname)
          return route.fulfill({ json: { data } })
        }
        if (url.pathname.includes('/api/')) { writes.push(url.pathname); return route.abort() }
        return url.origin === origin ? route.continue() : route.abort()
      })
      await page.goto(`${origin}/#/pages/training/index`)
      if (state === 'passed' || state === 'exempt') {
        const review = page.locator('uni-button').filter({ hasText: /^再次学习$/ })
        await review.waitFor()
        await review.click()
        await page.getByText('请联系用户核实订单情况。', { exact: true }).waitFor()
        assert.equal(await page.locator('.lesson-card').count(), 2)
        assert.equal(await page.locator('.question-card, .submit-button, .lesson-detail .secondary-button').count(), 0)
        await page.locator('.lesson-toggle').filter({ hasText: '服务完成' }).click()
        await page.getByText('请上传完成定位并提交服务完成。', { exact: true }).waitFor()
        await page.locator('uni-button').filter({ hasText: /^返回学习首页$/ }).click()
        await review.click()
        await page.getByText('请联系用户核实订单情况。', { exact: true }).waitFor()
      } else if (state === 'first') {
        await page.locator('.locked-card').waitFor()
        assert.equal(await page.getByText('再次学习', { exact: true }).count(), 0)
        assert.equal(await page.getByText('我已阅读并完成学习', { exact: true }).count(), 1)
      } else {
        await page.getByText(state === 'unpublished' ? '刷新学习资料' : '刷新资料', { exact: true }).waitFor()
        assert.equal(await page.getByText('再次学习', { exact: true }).count(), 0)
      }
      assert.deepEqual(writes, [], 'viewing and reviewing never mutates learning or qualification')
      assert.deepEqual(errors, [])
      console.log(`PASS training page ${state}: rendered actions, lessons and qualification boundaries`)
      await context.close()
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
