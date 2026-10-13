const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const messages = require('./userMessages.fixture.cjs')
const { publicErrorText, responseErrorText, requestFailureText, networkErrorText } = messages
const fallback = '操作未完成，请稍后重试'
for (const text of ['余额不足，请充值后重试', '验证码错误或已过期。', '订单已关闭', '当前账号不能领取用户活动优惠券。', '请先联系用户确认订单', '图片不能超过8MB']) {
  assert.equal(publicErrorText(text), text)
}
for (const text of ['TypeError: undefined', '<html>服务故障</html>', 'SQL 查询失败', '签名密钥未配置', 'https://private.invalid/private?secret=synthetic', '请求失败（404）']) {
  assert.equal(publicErrorText(text, fallback), fallback)
}
assert.match(publicErrorText('uploadFile:fail url not in domain list'), /服务暂时不可用/)
assert.match(publicErrorText('request:fail timeout'), /勿重复提交/)
assert.match(publicErrorText('getLocation:fail auth deny'), /权限/)
assert.match(publicErrorText('chooseImage:fail cancel'), /已取消/)
assert.equal(responseErrorText({ code: 'huifu_payment_closed', detail: '订单已关闭' }, fallback), '订单已关闭')
assert.equal(responseErrorText({ code: ['验证码错误'], trace_id: 'synthetic' }, fallback), '验证码错误')
assert.equal(responseErrorText({ detail: 'TypeError: crash', errors: { phone: ['请输入手机号'] } }, fallback), '请输入手机号')
assert.equal(responseErrorText(JSON.stringify({ detail: '请输入姓名' }), fallback), '请输入姓名')
assert.equal(responseErrorText('<html>error</html>', fallback), fallback)
for (const endpoint of ['/orders/123/payment/', '/wallet/recharges/', '/providers/me/income/withdrawals/', '/orders/123/refunds/']) {
  assert.match(requestFailureText(endpoint, 503), /勿重复/)
  assert.match(networkErrorText({ errMsg: 'request:fail timeout' }, endpoint), /勿重复/)
}
const filename = path.resolve(__dirname, '../src/services/http.ts')
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
let reply = {}, count = 0
const respond = options => { count++; reply.fail ? options.fail({ errMsg: reply.fail }) : options.success({ statusCode: reply.status, data: reply.body }) }
const context = { exports: {}, Error,
  require: name => name.endsWith('userMessages') ? messages : { getAccessToken: () => '' },
  uni: { request: respond, uploadFile: respond },
}
vm.runInNewContext(code, context)
async function main() {
  const http = context.exports
  reply = { status: 404, body: '<html>Not found</html>' }
  await assert.rejects(http.request('/providers/me/identity/verify/', { method: 'POST', skipAuth: true }), error => {
    assert.equal(error.status, 404); assert.match(error.message, /服务暂时不可用/); return true
  })
  reply = { status: 409, body: { code: 'huifu_payment_pending_confirmation', detail: '原支付结果尚未确认，请勿重复支付' } }
  await assert.rejects(http.request('/orders/123/payment/', { method: 'POST', skipAuth: true }), error => {
    assert.equal(error.status, 409); assert.match(error.message, /尚未确认/)
    if (http.ApiError) assert.equal(error.code, reply.body.code)
    return true
  })
  reply = { fail: 'request:fail timeout' }
  await assert.rejects(http.request('/providers/me/income/withdrawals/', { method: 'POST', skipAuth: true }), /勿重复申请/)
  reply = { fail: 'uploadFile:fail url not in domain list' }
  await assert.rejects(http.uploadFile('/media/avatars/', '/synthetic.jpg'), /服务暂时不可用/)
  reply = { status: 400, body: JSON.stringify({ file: ['请上传不超过10秒的视频'] }) }
  await assert.rejects(http.uploadFile('/media/provider-videos/', '/synthetic.mp4'), /不超过10秒/)
  assert.equal(count, 5, 'no added request retries')
  console.log('PASS user-facing errors: business reasons, status/code preservation, no raw diagnostics, uncertain money outcomes and no added retries')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
