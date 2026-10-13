// Run after build:h5. All API calls are intercepted; only synthetic photos are used.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = path.resolve(__dirname, '../dist/build/h5')
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="500" height="320" fill="#d7eded"/><circle cx="130" cy="130" r="55" fill="#76b1b2"/><path d="M235 90h190M235 140h150M235 190h170" stroke="#76b1b2" stroke-width="14"/></svg>'
async function main() {
  const server = http.createServer((req, res) => {
    const target = path.resolve(base, '.' + new URL(req.url, 'http://localhost').pathname)
    if (target !== base && !target.startsWith(base + path.sep)) return res.writeHead(403).end()
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(base, 'index.html')
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true })
      await context.addInitScript(() => localStorage.setItem('dazzy.provider.accessToken', JSON.stringify({ type: 'string', data: 'local-test-token' })))
      const page = await context.newPage(), errors = [], saves = [], checks = [], submits = [], uploads = []
      const photo = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 320
        const g = canvas.getContext('2d'); g.fillStyle = '#d7eded'; g.fillRect(0, 0, 500, 320)
        return canvas.toDataURL('image/jpeg').split(',')[1]
      })
      let data = {
        identity_status: 'unverified', identity_real_name: '', identity_number_masked: '',
        identity_front_photo_id: null, identity_back_photo_id: null, identity_face_photo_id: null,
        identity_front_photo_url: '', identity_back_photo_url: '', identity_face_photo_url: '',
        identity_verification: { enabled: true, required: false, status: 'not_checked',
          consent_version: 'tencent-id-card-photo-v2', notice: '这是合成测试授权说明，不会上传真实证件或调用腾讯服务。' },
      }
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url())
        if (url.pathname.startsWith('/synthetic-')) return route.fulfill({ contentType: 'image/svg+xml', body: svg })
        if (url.pathname.endsWith('/media/provider-identities/')) {
          const kind = req.postData().match(/name="kind"\r?\n\r?\n([^\r\n]+)/)?.[1]
          assert.ok(['identity_front_photo', 'identity_back_photo', 'identity_face_photo'].includes(kind))
          uploads.push(kind)
          return route.fulfill({ json: { data: { id: `photo-${uploads.length}`, url: `${origin}/synthetic-${uploads.length}.svg` } } })
        }
        if (url.pathname.endsWith('/providers/me/identity/verify/')) {
          const payload = req.postDataJSON(); checks.push(payload)
          assert.deepEqual(payload, { identity_front_photo_id: data.identity_front_photo_id, consent_version: data.identity_verification.consent_version })
          data = { ...data, identity_real_name: '测试姓名', identity_number_masked: '1101**********0015',
            identity_verification: { ...data.identity_verification, status: 'passed', required: true } }
          return route.fulfill({ json: { data } })
        }
        if (url.pathname.endsWith('/providers/me/identity/submit/')) {
          submits.push(req.postDataJSON())
          assert.deepEqual(submits.at(-1), { recognition_mode: 'photo', verification_mode: 'preverified' })
          assert.ok(data.identity_front_photo_id && data.identity_back_photo_id && data.identity_face_photo_id)
          assert.equal(data.identity_verification.status, 'passed')
          data = { ...data, identity_status: 'pending' }
          return route.fulfill({ json: { data } })
        }
        if (url.pathname.endsWith('/providers/me/identity/')) {
          if (req.method() === 'PATCH') {
            const payload = req.postDataJSON(); saves.push(payload)
            assert.equal(payload.recognition_mode, 'photo'); assert.equal(Object.keys(payload).length, 2)
            const key = Object.keys(payload).find(key => key.endsWith('_id'))
            data = { ...data, [key]: payload[key], [key.replace(/_id$/, '_url')]: `${origin}/synthetic-${uploads.length}.svg` }
          }
          return route.fulfill({ json: { data } })
        }
        if (url.pathname.includes('/api/')) return route.fulfill({ json: { data: { items: [] } } })
        return url.origin === origin ? route.continue() : route.abort()
      })
      await page.goto(`${origin}/#/pages/identity/index`)
      await page.locator('.materials-card').waitFor()
      assert.equal(await page.locator('.status-heading').innerText(), '请上传身份证照片')
      assert.equal(await page.locator('.verification-card, .verification-action').count(), 0)
      assert.equal(await page.getByText('重新验真', { exact: true }).count(), 0)
      assert.equal(await page.locator('.identity-footer uni-button').count(), 1)
      assert.equal(await page.getByText('保存资料', { exact: true }).count(), 0)
      const materials = await page.locator('.materials-card').boundingBox(), fields = await page.locator('.form-card').boundingBox()
      assert.ok(fields.y >= materials.y + materials.height)
      const pick = async index => {
        const chooser = page.waitForEvent('filechooser')
        await page.locator('.material-row').nth(index).click()
        await (await chooser).setFiles({ name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') })
      }
      await pick(0)
      await page.getByText('同意验真', { exact: true }).waitFor()
      assert.equal(saves.length, 1); assert.equal(checks.length, 0); assert.equal(submits.length, 0)
      await page.getByText('暂不验真', { exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('.identity-footer uni-button[disabled]'))
      assert.equal(checks.length, 0); assert.equal(uploads.length, 1)
      await pick(0)
      await page.getByText('同意验真', { exact: true }).click()
      await page.getByText('测试姓名', { exact: true }).waitFor()
      assert.equal(await page.locator('.identity-number').innerText(), '1101**********0015')
      assert.equal(data.identity_status, 'unverified'); assert.equal(checks.length, 1); assert.equal(submits.length, 0)
      await pick(1)
      await page.waitForFunction(() => document.querySelectorAll('.material-action')[1]?.textContent.includes('更换'))
      await pick(2)
      await page.waitForFunction(() => document.querySelectorAll('.material-action')[2]?.textContent.includes('更换'))
      assert.equal(saves.length, 4); assert.equal(checks.length, 1)
      assert.equal(await page.locator('.form-card input').count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      if (process.env.TEST_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true })
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, `identity-${width}.png`), fullPage: true })
      }
      await page.locator('.identity-footer .primary-button').click()
      await page.locator('.locked-note').waitFor()
      assert.equal(submits.length, 1); assert.equal(checks.length, 1)
      assert.equal(await page.locator('.material-action').count(), 0)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: auto-save, consent/cancel/retry, read-only results below photos, no repeat checks for back/selfie, review-only submit`)
      await context.close()
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
