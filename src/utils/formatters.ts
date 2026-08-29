export function formatAmount(value: number) {
  return (value / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function getErrorMessage(reason: unknown, fallback = '操作失败，请稍后重试') {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
