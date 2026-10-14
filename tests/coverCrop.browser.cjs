// Run after build:h5. API/media are local fixtures; never writes live profiles.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = path.resolve(__dirname, '../dist/build/h5')
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#c9dfd6"/><circle cx="500" cy="250" r="130" fill="#b38b70"/><rect x="280" y="410" width="440" height="390" rx="90" fill="#7f9c9e"/></svg>'
async function main() {
  const server = http.createServer((req, res) => {
    const target = path.resolve(base, '.' + new URL(req.url, 'http://localhost').pathname)
    if (target !== base && !target.startsWith(base + path.sep)) return res.writeHead(403).end()
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(base, 'index.html')
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true })
      await context.addInitScript(() => localStorage.setItem('dazzy.provider.accessToken', JSON.stringify({ type: 'string', data: 'local-test-token' })))
      const page = await context.newPage()
      const preview = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 500; c.height = 1400
        const g = c.getContext('2d'); g.fillStyle = '#d0e3d9'; g.fillRect(0, 0, 500, 1400)
        g.fillStyle = '#ac8670'; g.beginPath(); g.arc(250, 430, 90, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#829d9f'; g.fillRect(115, 550, 270, 700)
        return c.toDataURL('image/jpeg').split(',')[1]
      })
      const errors = [], crops = [], previews = [], saves = [], unexpected = []
      const photos = new Map(['first', 'second'].map(id => [id, { id, type: 'image', url: `${origin}/${id}.svg`, cropped: false }]))
      let failCrop = true, sequence = 0
      let profile = { display_name: '测试达人', bio: '这是一段用于测试逐张裁剪的达人介绍。', lifestyle_photo_id: 'first', lifestyle_photo_url: `${origin}/first.svg`, media: [...photos.values()], service_city_code: '130400', service_city_name: '邯郸市', max_service_radius_km: 20, review_status: 'approved', is_profile_complete: true }
      page.on('pageerror', e => errors.push(e.message))
      await context.route('**/*', async route => {
        const url = new URL(route.request().url()), req = route.request()
        if (url.pathname.endsWith('.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: svg })
        const body = () => (req.headers()['content-type'] || '').includes('application/json') ? req.postDataJSON() : req.postData()
        if (url.pathname.endsWith('/media/provider-photos/preview/')) { previews.push(body()); return route.fulfill({ json: { data: { preview_base64: preview, width: 500, height: 1400 } } }) }
        if (url.pathname.endsWith('/media/provider-photos/crop/')) {
          crops.push(body())
          if (failCrop) { failCrop = false; return route.fulfill({ status: 400, json: { file: ['测试保存失败，请重试'] } }) }
          const id = `cropped-${++sequence}`, photo = { id, url: `${origin}/${id}.svg`, cropped: true, type: 'image' }; photos.set(id, photo)
          return route.fulfill({ json: { data: photo } })
        }
        if (url.pathname.endsWith('/providers/me/profile/')) {
          if (req.method() === 'PATCH') { const payload = req.postDataJSON(); saves.push(payload); profile = { ...profile, media: payload.media_ids.map(id => photos.get(id)), lifestyle_photo_id: payload.media_ids[0], lifestyle_photo_url: photos.get(payload.media_ids[0]).url, review_status: 'pending' } }
          return route.fulfill({ json: { data: profile } })
        }
        if (url.pathname.endsWith('/locations/cities/')) return route.fulfill({ json: { data: { items: [{ city_code: '130400', city_name: '邯郸市' }] } } })
        if (url.pathname.includes('/media/')) unexpected.push(url.pathname)
        if (url.pathname.includes('/api/')) return route.fulfill({ json: { data: { items: [] } } })
        return url.origin === origin ? route.continue() : route.abort()
      })
      await page.goto(`${origin}/#/pages/provider-profile/index`)
      await page.locator('.crop-photo').first().waitFor()
      assert.equal(await page.locator('.gallery-tip').innerText(), '第一张作为封面，最多9个素材，其中视频最多2个（每个不超过10秒）。')
      assert.equal(await page.locator('.gallery-warning').innerText(), '存在尺寸不合适的照片，请裁剪。')
      assert.deepEqual(await page.locator('.crop-photo').allTextContents(), ['裁剪', '裁剪'])
      await page.locator('.save-bar .save').click(); assert.equal(saves.length, 0)
      await page.locator('.crop-photo').first().click(); await page.locator('.crop-grid').waitFor()
      const frame = await page.locator('.crop-frame').boundingBox(), cdp = await context.newCDPSession(page)
      assert.ok(Math.abs(frame.width / frame.height - 1.25) < .01)
      const before = await page.locator('.crop-image').evaluate(el => el.style.top)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 + 50 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      assert.notEqual(await page.locator('.crop-image').evaluate(el => el.style.top), before)
      const slider = await page.locator('.crop-slider').boundingBox()
      await page.mouse.click(slider.x + slider.width * .65, slider.y + slider.height / 2)
      await page.waitForFunction(() => Number(document.querySelector('.zoom-label').textContent.match(/(\d+)%/)[1]) > 100)
      await page.locator('.crop-reset').click()
      await page.locator('.crop-confirm').click(); await page.locator('.crop-error').waitFor()
      await page.locator('.crop-confirm').click(); await page.locator('.crop-overlay').waitFor({ state: 'hidden' })
      assert.equal(crops[0].source_id, 'first'); assert.equal(await page.locator('.gallery-item').count(), 2)
      assert.equal(await page.locator('.gallery-warning').innerText(), '存在尺寸不合适的照片，请裁剪。')
      await page.locator('.crop-photo').nth(1).click(); await page.locator('.crop-grid').waitFor(); await page.locator('.crop-cancel').click()
      assert.ok((await page.locator('.gallery-item img').nth(1).getAttribute('src')).includes('second.svg'))
      await page.locator('.crop-photo').nth(1).click(); await page.locator('.crop-grid').waitFor(); await page.locator('.crop-confirm').click()
      await page.locator('.crop-overlay').waitFor({ state: 'hidden' }); await page.locator('.gallery-warning').waitFor({ state: 'hidden' })
      await page.locator('.gallery-item uni-image').first().click(); await page.locator('#u-a-p > div').waitFor()
      assert.ok((await page.locator('#u-a-p img').first().getAttribute('src')).includes('cropped-1.svg'))
      await page.locator('#u-a-p > div').click({ position: { x: width - 24, y: 20 } }); await page.locator('#u-a-p > div').waitFor({ state: 'hidden' })
      await page.locator('.save-bar .save').click(); await page.waitForFunction(() => document.querySelector('.save-bar .save').textContent.includes('资料审核中'))
      assert.deepEqual(saves[0].media_ids, ['cropped-1', 'cropped-2']); assert.equal('cover_photo_id' in saves[0], false)
      assert.notEqual(await page.locator('.crop-photo').first().getAttribute('disabled'), null)
      profile.review_status = 'approved'; await page.reload(); await page.locator('.crop-photo').first().waitFor()
      const chooser = page.waitForEvent('filechooser'); await page.locator('.gallery-buttons uni-button').first().click()
      await (await chooser).setFiles(['one', 'two', 'three'].map(name => ({ name: `${name}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(preview, 'base64') })))
      await page.locator('.crop-grid').waitFor(); assert.match(await page.locator('.crop-title').innerText(), /1\/3/)
      assert.equal(await page.locator('.gallery-item').count(), 2, 'uncropped selections are not in gallery')
      await page.locator('.crop-confirm').click(); await page.waitForFunction(() => document.querySelector('.crop-title')?.textContent.includes('2/3'))
      await page.locator('.crop-grid').waitFor()
      if (process.env.TEST_SCREENSHOT_DIR) { fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, `photo-crop-${width}.png`) }) }
      await page.locator('.crop-cancel').click(); assert.equal(await page.locator('.gallery-item').count(), 3, 'cancel batch keeps completed crops only')
      await page.locator('.gallery-item').first().getByText('后移', { exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.gallery-item img')?.getAttribute('src')?.includes('cropped-2.svg'))
      await page.locator('.save-bar .save').click(); await page.waitForFunction(() => document.querySelector('.save-bar .save').textContent.includes('资料审核中'))
      assert.deepEqual(saves[1].media_ids, ['cropped-2', 'cropped-1', 'cropped-3']); assert.equal(saves[1].lifestyle_photo_id, 'cropped-2')
      assert.equal(typeof previews.at(-1), 'string'); assert.equal(typeof crops.at(-1), 'string'); assert.deepEqual(unexpected, []); assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: all-photo crop, legacy guard, drag/zoom/retry/cancel, cropped preview, review lock, multi-pick queue, reorder`)
      await context.close()
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
