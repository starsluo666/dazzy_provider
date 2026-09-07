const BUSINESS_OFFSET_MS = 8 * 60 * 60 * 1000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export interface BusinessTimeParts {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function validDate(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError(`无效时间：${String(value)}`)
  return date
}

export function businessTimeParts(value: string | number | Date): BusinessTimeParts {
  const shifted = new Date(validDate(value).getTime() + BUSINESS_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

export function businessDateKey(value: string | number | Date = Date.now()) {
  const parts = businessTimeParts(value)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function businessClock(value: string | number | Date) {
  const parts = businessTimeParts(value)
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

export function shiftBusinessDateKey(dateKey: string, days: number) {
  const match = DATE_PATTERN.exec(dateKey)
  if (!match) throw new RangeError(`无效日期：${dateKey}`)
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export function businessDateKeyParts(dateKey: string) {
  const match = DATE_PATTERN.exec(dateKey)
  if (!match) throw new RangeError(`无效日期：${dateKey}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new RangeError(`无效日期：${dateKey}`)
  }
  return { year, month, day, weekday: date.getUTCDay() }
}
