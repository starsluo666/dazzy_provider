import { businessTimeParts } from './businessTime'

const pad = (value: number) => String(value).padStart(2, '0')

export function formatAmount(value: number) {
  return (value / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatBusinessDateTime(value: string) {
  const parts = businessTimeParts(value)
  return `${parts.month}月${parts.day}日 ${pad(parts.hour)}:${pad(parts.minute)}`
}

export function formatBusinessMonthDay(value: string) {
  const parts = businessTimeParts(value)
  return `${parts.month}月${parts.day}日`
}

export function formatBusinessShortDate(value: string) {
  const parts = businessTimeParts(value)
  return `${pad(parts.month)}-${pad(parts.day)}`
}

export function formatOrderTimeRange(startsAt: string, endsAt: string, includeYear = false) {
  const start = businessTimeParts(startsAt)
  const end = businessTimeParts(endsAt)
  const prefix = includeYear ? `${start.year}年` : ''
  return `${prefix}${start.month}月${start.day}日 ${pad(start.hour)}:${pad(start.minute)}–${pad(end.hour)}:${pad(end.minute)}`
}

export function getErrorMessage(reason: unknown, fallback = '操作失败，请稍后重试') {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
