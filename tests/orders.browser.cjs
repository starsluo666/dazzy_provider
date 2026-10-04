// Local UI only. All APIs are intercepted and all other external URLs blocked.
// Set PLAYWRIGHT_MODULE, CHROME_EXECUTABLE and optional PROVIDER_TEST_URL / TEST_SCREENSHOT_DIR.
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const baseUrl = process.env.PROVIDER_TEST_URL || 'http://127.0.0.1:5195'
const baseOrder = {
  order_no: 'TEST-202610040001', customer_name: '测试用户', service_name: '桌球', status_label: '待服务',
  starts_at: '2026-10-05T05:00:00Z', ends_at: '2026-10-05T07:00:00Z', created_at: '2026-10-04T04:00:00Z',
  meeting_location_name: '测试集合点', meeting_address: '测试街道一号门口，请在服务开始前确认地点',
  contact_name: '测试用户', contact_gender_label: '先生', contact_phone_display: '13900000000',
  payable_amount: 522, acceptance_expires_at: new Date(Date.now() + 15 * 60000).toISOString(), accepted_at: '2026-10-04T04:05:00Z',
  provider_contact_initiated_at: null, arrival_photo_url: null, arrival_photo_uploaded_at: null,
  note: '', fulfillment_review_required: false,
}
const cases = [
  { key: 'accept', status: 'pending_acceptance', tab: '待接单', button: '接受订单' },
  { key: 'depart', status: 'pending_service', tab: '待服务', button: '确认出发' },
  { key: 'arrival', status: 'departed', tab: '履约中', button: '上传集合照' },
  { key: 'evidence', status: 'departed', tab: '履约中', button: '开始服务', evidence: true },
  { key: 'complete', status: 'in_service', tab: '履约中', button: '提交完成' },
  { key: 'held', status: 'pending_confirmation', tab: '履约中', held: true },
]
async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
  try {
    for (const width of [320, 390, 430]) {
      for (const scenario of cases) {
        const errors = [], writes = []
        const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1 })
        await context.addInitScript(() => localStorage.setItem('dazzy.provider.accessToken', 'offline-ui-only'))
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url())
          if (url.pathname.startsWith('/api/v1/')) {
            if (request.method() !== 'GET') writes.push(request.url())
            const data = url.pathname.endsWith('/providers/me/orders/')
              ? { items: [{ ...baseOrder, status: scenario.status, fulfillment_review_required: !!scenario.held,
                  ...(scenario.evidence ? { arrival_photo_url: '/static/next-order-backpack.webp', arrival_photo_uploaded_at: '2026-10-05T04:55:00Z' } : {}),
                }] }
              : { unread: 0, category_unread: { order: 0 } }
            return route.fulfill({ json: { data } })
          }
          return url.origin === new URL(baseUrl).origin ? route.continue() : route.abort()
        })
        const page = await context.newPage()
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(baseUrl + '/#/pages/orders/index')
        await page.locator('.tab-button').filter({ hasText: scenario.tab }).click()
        await page.locator('.order-card').waitFor()
        if (scenario.button) assert.equal((await page.locator('.primary-button').innerText()).trim(), scenario.button)
        assert.equal(await page.locator('.card-footer .contact-button').count(), 0, 'contact is secondary, not a footer action')
        if (scenario.status !== 'pending_acceptance') {
          assert.equal(await page.locator('.contact-phone-group .contact-button').count(), 1)
          assert.equal((await page.locator('.contact-button').innerText()).trim(), '联系')
          const contactLayout = await page.locator('.contact-phone-group').evaluate(element => {
            const number = element.querySelector('.contact-number').getBoundingClientRect()
            const button = element.querySelector('.contact-button').getBoundingClientRect()
            const pill = element.querySelector('.contact-button-label').getBoundingClientRect()
            return { beside: button.left >= number.right, centered: Math.abs((number.top + number.bottom) / 2 - (pill.top + pill.bottom) / 2) < 1,
              touchHeight: button.height, visibleHeight: pill.height, width: pill.width,
              overflow: element.scrollWidth > element.clientWidth + 1 }
          })
          assert.equal(contactLayout.beside && contactLayout.centered, true, 'contact sits immediately after the phone number')
          assert.equal(contactLayout.overflow, false)
          assert.ok(contactLayout.touchHeight >= 44 && contactLayout.visibleHeight <= 30 && contactLayout.width <= 56, 'small pill with a comfortable touch target')
        }
        const badButtons = await page.locator('.order-button').evaluateAll(elements => elements.filter(element => {
          const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
          return rect.height < 43.5 || element.scrollWidth > element.clientWidth + 1 || css.display !== 'flex' || css.alignItems !== 'center' || css.justifyContent !== 'center'
        }).map(element => element.className))
        assert.deepEqual(badButtons, [], `${width}px ${scenario.key} action layout`)
        const overflow = await page.locator('.order-card').evaluate(element => element.scrollWidth > element.clientWidth + 1)
        assert.equal(overflow, false, `${width}px ${scenario.key} card overflow`)
        if (scenario.held) assert.match(await page.locator('.risk-notice').innerText(), /暂停/)
        if (scenario.evidence) {
          assert.match(await page.locator('.evidence').innerText(), /集合照已留存/)
          assert.equal(await page.locator('.evidence').evaluate(element => element.scrollWidth > element.clientWidth + 1), false)
        }
        if (process.env.TEST_SCREENSHOT_DIR && width === 390) {
          fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true })
          await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, `${scenario.key}.png`), fullPage: true })
        }
        if (scenario.key === 'depart') {
          await page.locator('.primary-button').click()
          await page.getByText('请先联系用户', { exact: true }).waitFor()
          assert.deepEqual(writes, [], 'missing contact must not submit departure')
        }
        assert.deepEqual(errors, [])
        console.log(`PASS ${width}px ${scenario.key}`)
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
