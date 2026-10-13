// Presentation only: keep business messages, hide transport internals and diagnostics.
// Keep this helper in sync across the independently deployed customer/provider apps.
export function publicErrorText(value: unknown, fallback = '操作未完成，请稍后重试'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const text = value.trim()
  if (/(?:request|uploadFile|downloadFile|getLocation|chooseImage|requestPayment):fail/i.test(text)) {
    if (/cancel/i.test(text)) return '操作已取消'
    if (/auth|permission|deny/i.test(text)) return '未获得所需权限，请在设置中允许后重试'
    if (/domain list|not in domain|certificate|ssl/i.test(text)) return '服务暂时不可用，请稍后重试或联系客服'
    if (/timeout/i.test(text)) return '等待时间较长，请先确认操作结果，勿重复提交'
    return '连接未完成，请检查网络后重试'
  }
  if (!/[\u3400-\u9fff]/.test(text) || text.length > 300
      || /https?:\/\/|<\/?(?:html|body|script)|Traceback|\b(?:TypeError|ReferenceError|SyntaxError)\b|\bat \S+.*:\d+/.test(text)) return fallback
  if (/请求失败[（(]\d{3}|上传失败[（(]\d{3}|登录状态刷新失败[（(]\d{3}/.test(text)) return fallback
  if (/配置|接口|签名|密钥|幂等|跨渠道|白名单|回调|\b(?:token|JSON|SDK|SQL)\b/i.test(text)) {
    if (/提现/.test(text)) return '提现暂不可用，请查看提现记录或联系客服核实'
    if (/收款|开户/.test(text)) return '收款账户暂不可用，请联系客服核实'
    if (/支付|扣款/.test(text)) return '支付暂不可用，请先查看订单状态，勿重复支付'
    if (/登录|授权/.test(text)) return '暂时无法完成登录或授权，请稍后重试'
    return fallback
  }
  return text
}

export function responseErrorText(body: unknown, fallback: string): string {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return publicErrorText(body, fallback) }
  }
  const visit = (value: unknown, depth = 0): string => {
    if (depth > 6 || value === null) return ''
    if (typeof value === 'string') return publicErrorText(value, '')
    if (Array.isArray(value)) {
      for (const item of value) { const message = visit(item, depth + 1); if (message) return message }
    } else if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      // "code" can be an SMS validation field, so inspect it last rather than drop it.
      const keys = ['detail', 'message', ...Object.keys(record).filter(key => !['detail', 'message', 'code', 'request_id', 'trace_id', 'status'].includes(key)), 'code']
      for (const key of keys) { const message = visit(record[key], depth + 1); if (message) return message }
    }
    return ''
  }
  return visit(body) || fallback
}

export function requestFailureText(path: string, status?: number, upload = false): string {
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 403) return '暂时无法进行此操作，请确认账号状态或联系客服'
  if (status === 429) return '操作较频繁，请稍后再试'
  if (status === 413) return '文件过大，请压缩后重新上传'
  // An interrupted financial request may have reached the server. Never invite a blind retry.
  if (/withdrawals/.test(path)) return '提现结果暂未确认，请查看提现记录，勿重复申请'
  if (/refund/.test(path)) return '退款结果暂未确认，请查看订单或联系客服，勿重复申请'
  if (/payment|recharge/.test(path)) return '支付结果暂未确认，请查看订单或账单，勿重复支付'
  if (upload) return '上传暂未完成，请稍后重试或联系客服'
  if (status === 404 || (status && status >= 500)) return '服务暂时不可用，请稍后重试或联系客服'
  if (status === 409) return '信息已更新，请刷新后重试'
  return '操作未完成，请检查填写内容或稍后重试'
}

export function networkErrorText(reason: { errMsg?: string }, path: string, upload = false): string {
  const fallback = requestFailureText(path, undefined, upload)
  if (/withdrawals|refund|payment|recharge/.test(path)) return fallback
  return publicErrorText(reason.errMsg, fallback)
}
