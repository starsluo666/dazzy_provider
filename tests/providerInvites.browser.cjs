// Build provider H5 and the admin first. All APIs mocked, no real accounts/payments.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = path.resolve(__dirname, '../..')
function serve(folder) {
  const base = path.join(root, folder)
  const server = http.createServer((req, res) => {
    const target = path.resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
    if (target !== base && !target.startsWith(base + path.sep)) return res.writeHead(403).end()
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(base, 'index.html')
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })))
}
const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQAAAABUY/ToAAAD+ElEQVR4nO1cbWrzMAyWlUJ/prAD9CjJzcZulhxlBxikPwcuepEt5WMQ7Bq6Lq/1MEo+9LAahPRIsusIyjBiIRHAmClg0mIPxkwBkxZ7MGYKmLTYgzFTwKTFHoyZAiYt9mDM/5HpBCdwvd7CeIF4C+Pl7lx/U6v+sOssARaxKmR2xJgAaAD+aD0/vTv6uPDF7czSuwlGdOR1FgBLSFUybxpfOPoA3CQiATuSe6fgUiFAnf7Ct30cWMCJMGYKpx/3jv+om958jD7d55lgdAAEtyOvE435i8zWg3PXb+f6kNBavmLn6p/4P3OB2ZY/YcznM1uiIIWgmxqOPidWRncXVdDQigoi0qx21HU+DizgVMkcQ8GlUih4jutvZ/44gXv/DM/usSx7/bctAJaQAoyZp4doeTBev6OX0Hj18SMkNNpYHW6daMynMSGW61zbQzdJla+prZF6f5XBOKuFRsBwrHWiMZ/sQzTMDhIQXSp6k2eNpG878so41jrRmE/OZQ7aCWDsTx7ilWu4tn/zBHCPhjT2Dmh0jfUYc4GVMCFGFQrVmAYZyWWtl441vwgRSVObxaEcYF3M8QJAH44LsfgglPUAoTgLV0RcnC0ztGOuswBYQqpVD1FsA4Xoo50i4sAjmN9aHMoD1pfLKArruRrjugxYTsttnMPK4NV8KA2shAniEUt8War32SbWZfEq6CbzoRxgXXVZ93kmbUBz+XX54hdNLM4ctKyJbhd+AdxtfNW3RWP+7TgEq6HZKiL5uTiz/tBjwNr61F4SFSseEdbLpHWp6NnNzIfygJUwYdUQkk2KYVCv+nlYKrQQgqw/lA+srC4jcRqt6DeORFrly5X5UBawyrrMqyjaCqCBDWO6U5czH0oDK4xD3SYEyfxjYqNl8Lp43bHWicb8JT3kRUkvA7JBX6xkt/WH8oD11WU0N6tV+8AqGMk4JEgm86EsYIV70EBFtG5Ja+aGkAglm3U8AqxtXgYSc9ZHEZvVwGNV1psP5QErnLkytC5b965BijOp/C2XZQIr09SwOSYdBZDuAllMFob5UBpYCRNoC81lyz4PL3rI5mWPAiv93Y+AeMXByPGZM+ccb2bUg2cHXmcJsIhVaV1GIopkUL/KYJ2qILm1OJQFrPR3P1wMRuGIK2+qjrN81kh8FDaYSq12zHU+Dizg1BmHpvUGatFGejxR24u65driUB6wXmbDp+z5d9CuFI95uPeJn6kUsjiUCaxVDw26J193o9GskSReWV2WCayECZvmz7KP8cfow0tWC85luSwPWOnvftDmg/TZyrle+W3RmAlgymAXxkwBkxZ7MGYKmLTYgzFTwKTFHoyZAiYt9mDMFF6hqf8BBxGj1+sRTcYAAAAASUVORK5CYII='
const source = { public_id: 'test-source', code: 'ABCDEF123456', kind: 'store', name: '测试合作门店', active: true, revision: 0, invite_url: 'https://h5.example.test/#/pages/invitations/provider-register?code=ABCDEF123456', qr_data: tiny }
const reward = { public_id: 'test-reward', source, source_name_snapshot: source.name, code_snapshot: source.code, amount: 5000, real_name: '测试新人', invitee_phone_masked: '138****9002', service_city_name: '邯郸市', application_status: 'pending', status: 'pending', status_label: '待财务审核', revision: 0, created_at: '2026-10-10T10:00:00Z', review_note: '', paid_at: null }
async function shot(page, name) {
  if (!process.env.TEST_SCREENSHOT_DIR) return
  fs.mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, name), fullPage: true })
}
async function main() {
  const servers = await Promise.all(['dazzy_provider/dist/build/h5', 'dazzy_admin/dist', 'dazzy_provider/dist/build/h5'].map(serve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
    const errors = [], actions = [], registrations = [], denied = []
    let currentReward = { ...reward }, permissions = ['*'], applicationStatus = 'pending', workbenchCalls = 0
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    context.setDefaultTimeout(12000)
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url())
      if (!url.pathname.includes('/api/v1/')) {
        if (servers.some(s => s.url === url.origin)) return route.continue()
        // uni H5's built-in picker shadow. Keep tests fully offline.
        if (url.href === 'https://cdn.dcloud.net.cn/img/shadow-grey.png') return route.fulfill({
          contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'),
        })
        denied.push(req.url()); return route.abort()
      }
      let data = { items: [], pagination: { total: 0 }, counters: {} }
      if (url.pathname.endsWith('/auth/refresh/')) data = { access: 'mock-only' }
      else if (url.pathname.endsWith('/admin/me/')) data = { user: { nickname: '测试财务', phone: '' }, organization: null, role_name: '测试', permissions, data_scope: 'all', city_codes: [] }
      else if (url.pathname.endsWith('/provider-invites/register/')) {
        assert.equal(req.headers().authorization, undefined, 'public registration must not send an existing account token')
        registrations.push(req.postData()); data = { access: 'test-access', refresh: 'test-refresh', user: { phone: '13800009002', nickname: '测试新人' } }
      }
      else if (url.pathname.endsWith('/auth/sms-codes/')) data = { expires_in: 300, retry_after: 60 }
      else if (url.pathname.endsWith('/auth/login/password/')) data = { access: 'test-access', refresh: 'test-refresh', user: { phone: '13800009002', nickname: '测试新人' } }
      else if (url.pathname.endsWith('/providers/me/application/')) data = { status: applicationStatus, application_real_name: '测试新人', service_city_name: '邯郸市', invitation_code: source.code, rejection_reason: '照片不够清晰，请联系客服核对', submitted_at: '2026-10-10T10:00:00Z' }
      else if (url.pathname.endsWith('/providers/me/workbench/')) { workbenchCalls++; return route.fulfill({ status: 503, json: { detail: '测试工作台占位' } }) }
      else if (url.pathname.endsWith('/provider-invites/ABCDEF123456/')) data = { ...source, cities: [{ code: '130400', name: '邯郸市' }] }
      else if (url.pathname.endsWith('/provider-invites/config/')) data = { enabled: true, store_reward_amount: 5000, provider_reward_amount: 3000, revision: 1 }
      else if (url.pathname.endsWith('/provider-invites/sources/')) data = { items: [source], pagination: { total: 1, page: 1, page_size: 20 } }
      else if (url.pathname.endsWith('/provider-invites/sources/test-source/')) data = source
      else if (url.pathname.endsWith('/provider-invites/rewards/')) data = { items: [currentReward], pagination: { total: 1, page: 1, page_size: 20 }, summary: [{ status: currentReward.status, count: 1, amount: 5000 }] }
      else if (url.pathname.endsWith('/provider-invites/rewards/test-reward/action/')) {
        const body = req.postDataJSON(); actions.push(body)
        currentReward = { ...currentReward, status: body.action === 'approve' ? 'approved' : 'paid', status_label: body.action === 'approve' ? '待人工打款' : '已人工打款', revision: currentReward.revision + 1 }; data = currentReward
      }
      else if (url.pathname.endsWith('/provider-invites/me/')) data = { source: { ...source, kind: 'provider' }, enabled: true, reward_amount: 3000, qr_data: tiny, summary: [{ status: 'paid', count: 1, amount: 5000 }], items: [{ ...currentReward, invitee_phone_masked: '138****9002' }], pagination: { total: 1 } }
      else if (url.pathname.includes('/growth/provider-invites/')) return route.fulfill({ status: 404, json: { detail: '邀请已停用或不存在' } })
      return route.fulfill({ json: { data } })
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`${servers[0].url}/#/pages/invitations/provider-register?code=${source.code}`)
      try { await page.getByText('注册账号', { exact: true }).waitFor() }
      catch (e) { console.error({ url: page.url(), errors, body: await page.locator('body').innerText() }); throw e }
      assert.equal(await page.getByText('已有账号', { exact: false }).count(), 0)
      assert.equal(await page.locator('.source-name').innerText(), source.name)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`)
      assert.ok(await page.locator('.input').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height >= 44)))
      await shot(page, `invite-register-${width}.png`)
    }
    await page.locator('.primary').click()
    assert.match(await page.locator('.error').innerText(), /手机号/)
    await page.locator('.field input').nth(0).fill('13800009002')
    await page.getByText('获取验证码', { exact: true }).click()
    await page.getByText('60s 后重发', { exact: true }).waitFor()
    await page.locator('.field input').nth(1).fill('123456')
    await page.locator('.field input').nth(2).fill('test-password')
    await page.locator('.field input').nth(3).fill('test-password')
    await page.locator('.field input').nth(4).fill('测试新人')
    await page.locator('.gender').last().click()
    await page.getByText('请选择日期', { exact: true }).click()
    await page.locator('.uni-picker-action-confirm:visible').last().click()
    await page.locator('.picker-input').last().click()
    await page.locator('.uni-picker-action-confirm:visible').last().click()
    const chooser = page.waitForEvent('filechooser')
    await page.locator('.photo-picker').click()
    await (await chooser).setFiles({ name: 'recent.png', mimeType: 'image/png', buffer: Buffer.from(tiny.split(',')[1], 'base64') })
    await page.getByText('已选择生活照', { exact: true }).waitFor()
    await page.locator('.consent-toggle').click()
    await page.locator('.intent-consent').click()
    await page.locator('.primary').click()
    await page.getByText('入驻意向已提交', { exact: true }).waitFor()
    assert.equal(registrations.length, 1)
    assert.match(registrations[0], /ABCDEF123456/)
    assert.match(registrations[0], /service_city_code/)
    assert.match(registrations[0], /application_birth_date/)
    console.log('PASS registration: full form, SMS, photo, consent and multipart payload')
    await page.reload()
    await page.getByText('当前已有登录账号', { exact: true }).waitFor()
    assert.equal(await page.locator('.field input').count(), 0, 'refreshing after registration must not offer duplicate signup')
    await page.getByText('查看申请进度', { exact: true }).click()
    await page.getByText('入驻意向审核中', { exact: true }).waitFor()
    assert.ok(page.url().includes('/pages/invitations/application'))
    assert.equal(workbenchCalls, 0)
    await page.reload()
    await page.getByText('入驻意向审核中', { exact: true }).waitFor()
    await shot(page, 'provider-application-pending.png')
    // A pending account reopening the workbench must be sent to progress, without a 403 request.
    await page.goto(`${servers[0].url}/#/pages/workbench/index`)
    await page.getByText('入驻意向审核中', { exact: true }).waitFor()
    assert.equal(workbenchCalls, 0)
    // An expired/missing session preserves the progress destination through password login.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByText('欢迎回来', { exact: true }).waitFor()
    await page.locator('.auth-field input').nth(0).fill('13800009002')
    await page.locator('.auth-field input').nth(1).fill('test-password')
    await page.locator('.consent-toggle').click()
    await page.locator('.auth-primary').click()
    await page.getByText('入驻意向审核中', { exact: true }).waitFor()
    assert.equal(workbenchCalls, 0)
    await page.waitForTimeout(1600) // Let the login toast disappear before state screenshots.
    applicationStatus = 'rejected'
    await page.getByText('刷新审核进度', { exact: true }).click()
    await page.getByText('入驻意向未通过', { exact: true }).waitFor()
    await page.getByText('审核说明：照片不够清晰，请联系客服核对', { exact: true }).waitFor()
    applicationStatus = 'approved'
    await page.getByText('刷新审核进度', { exact: true }).click()
    await page.getByText('入驻初审已通过', { exact: true }).waitFor()
    await shot(page, 'provider-application-approved.png')
    await page.getByText('进入达人工作台', { exact: true }).click()
    await page.getByText('测试工作台占位', { exact: true }).waitFor()
    assert.match(page.url(), /\/#\/(?:pages\/workbench\/index)?(?:\?|$)/)
    assert.equal(workbenchCalls, 1)
    applicationStatus = 'pending'
    console.log('PASS provider progress: registered session, reload, pending workbench guard, re-login, rejection, approval')
    await page.goto(`${servers[0].url}/#/pages/invitations/provider-register?code=NOTVALID`)
    await page.reload()
    await page.getByText('邀请链接无效，请重新扫描邀请人提供的二维码。', { exact: true }).waitFor()
    assert.equal(await page.locator('.primary').count(), 0)

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${servers[1].url}/#/provider-invites`)
    await page.getByRole('button', { name: '审核通过', exact: true }).click()
    await page.locator('.el-dialog textarea').fill('测试核验：真实新注册资料及邀请来源无误')
    await page.locator('.el-dialog .el-checkbox').click()
    await page.locator('.el-dialog').getByRole('button', { name: '审核通过', exact: true }).click()
    await page.getByRole('button', { name: '登记已打款', exact: true }).waitFor()
    await page.locator('.el-dialog').waitFor({ state: 'hidden' })
    assert.equal(actions.length, 1); assert.equal(actions[0].action, 'approve')
    await shot(page, 'invite-admin-rewards.png')
    await page.getByRole('tab', { name: '邀请来源 / 门店二维码' }).click()
    await page.getByRole('button', { name: '二维码', exact: true }).click()
    await page.getByText('扫码注册成为达人', { exact: true }).waitFor()
    assert.equal(await page.locator('.qr a').getAttribute('download'), `乐搭伴-${source.code}.png`)
    await page.keyboard.press('Escape')
    permissions = ['provider_invite.view']
    await page.reload()
    await page.getByRole('tab', { name: '奖励台账' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '登记已打款', exact: true }).count(), 0)
    await page.getByRole('tab', { name: '奖励规则' }).click()
    assert.equal(await page.getByRole('button', { name: '保存规则', exact: true }).count(), 0)
    permissions = ['*']
    await page.reload()
    await page.getByRole('button', { name: '登记已打款', exact: true }).click()
    await page.locator('.el-dialog .el-input__inner').nth(0).fill('test-bank-receipt-001')
    await page.locator('.el-dialog .el-input__inner').nth(1).fill('2026-10-10 20:00:00')
    await page.locator('.el-dialog textarea').fill('测试收款人已核验，外部模拟流水已核对')
    await page.locator('.el-dialog .el-checkbox').click()
    await page.locator('.el-dialog').getByRole('button', { name: '确认登记已打款', exact: true }).click()
    await page.locator('.el-dialog').waitFor({ state: 'hidden' })
    assert.equal(actions.length, 2)
    assert.equal(actions[1].action, 'paid')
    assert.equal(actions[1].transfer_reference, 'test-bank-receipt-001')
    assert.equal(actions[1].revision, 1)
    assert.ok(actions[1].paid_at.endsWith('Z'))
    await context.addInitScript(() => {
      localStorage.setItem('dazzy.provider.accessToken', JSON.stringify({ type: 'string', data: 'test-only' }))
      localStorage.setItem('dazzy.provider.refreshToken', JSON.stringify({ type: 'string', data: 'test-only' }))
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${servers[2].url}/#/pages/invitations/index`)
    await page.getByText('一起成为乐搭伴达人', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await shot(page, 'provider-invites.png')
    assert.deepEqual(errors, [])
    assert.deepEqual(denied, [])
    console.log('PASS: 320/390/430 layouts, validation, SMS cooldown, photo, consent, multipart registration, invalid invitation, admin approval/QR/permissions, provider summary; no real API calls.')
  } finally {
    if (browser) await browser.close()
    await Promise.all(servers.map(({ server }) => new Promise(resolve => server.close(resolve))))
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
