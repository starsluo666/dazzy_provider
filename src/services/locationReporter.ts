import type { ProviderLocationPayload } from '@/types/api'
import { updateProviderOnlineLocation } from './providers'

type LocationResult = {
  longitude: number
  latitude: number
  accuracy?: number
  horizontalAccuracy?: number
  speed?: number | null
}

type WeixinLocationApi = {
  startLocationUpdate?: (options: Record<string, unknown>) => void
  startLocationUpdateBackground?: (options: Record<string, unknown>) => void
  stopLocationUpdate?: (options?: Record<string, unknown>) => void
  onLocationChange?: (listener: (result: LocationResult) => void) => void
  offLocationChange?: (listener: (result: LocationResult) => void) => void
  onLocationChangeError?: (listener: (error: { errCode?: number }) => void) => void
  offLocationChangeError?: (listener: (error: { errCode?: number }) => void) => void
}

let sessionId = ''
let intervalMs = 300000
let lastReportedAt = 0
let latestLocation: ProviderLocationPayload | null = null
let timer: ReturnType<typeof setInterval> | null = null
let reporting = false
let nativeListening = false
let pollingMode = false
let errorCallback: ((message: string) => void) | undefined
let reportedCallback: ((location: ProviderLocationPayload) => void) | undefined

function toPayload(result: LocationResult): ProviderLocationPayload {
  // 微信在无法获取速度时会返回 -1；后端约定未知速度应省略，而不是上传负值。
  const speed = typeof result.speed === 'number' && Number.isFinite(result.speed)
    && result.speed >= 0 && result.speed <= 100
    ? result.speed
    : undefined
  return {
    longitude: result.longitude,
    latitude: result.latitude,
    accuracy_m: Number(result.accuracy || result.horizontalAccuracy || 0),
    located_at: new Date().toISOString(),
    ...(speed === undefined ? {} : { speed_mps: speed }),
  }
}

export function getCurrentProviderLocation(): Promise<ProviderLocationPayload> {
  const browserFallback = () => new Promise<ProviderLocationPayload>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('当前设备不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(toPayload({
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
      })),
      error => reject(new Error(error.message || '无法获取当前位置')),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    )
  })
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: (result) => resolve(toPayload(result)),
      fail: (error) => {
        browserFallback().then(resolve).catch(() => reject(new Error(error.errMsg || '无法获取当前位置')))
      },
    })
  })
}

function wxLocationApi(): WeixinLocationApi | null {
  return (globalThis as unknown as { wx?: WeixinLocationApi }).wx || null
}

async function sendLatest(force = false) {
  if (!sessionId || reporting) return
  if (!force && Date.now() - lastReportedAt < intervalMs) return
  reporting = true
  try {
    if (pollingMode || !latestLocation) {
      latestLocation = await getCurrentProviderLocation()
    }
    await updateProviderOnlineLocation(sessionId, latestLocation)
    lastReportedAt = Date.now()
    reportedCallback?.(latestLocation)
  } catch (reason) {
    errorCallback?.((reason as Error).message || '位置上报失败')
  } finally {
    reporting = false
  }
}

const locationListener = (result: LocationResult) => {
  latestLocation = toPayload(result)
  void sendLatest(false)
}
const locationErrorListener = () => errorCallback?.('持续定位暂时失败，平台将在恢复后自动重试')

function startNativeUpdates(): Promise<'background' | 'foreground' | 'polling'> {
  const api = wxLocationApi()
  if (!api?.onLocationChange) return Promise.resolve('polling')
  if (!nativeListening) {
    api.onLocationChange(locationListener)
    api.onLocationChangeError?.(locationErrorListener)
    nativeListening = true
  }
  const invoke = (method?: (options: Record<string, unknown>) => void) => new Promise<void>((resolve, reject) => {
    if (!method) { reject(new Error('当前微信版本不支持持续定位')); return }
    method({ type: 'gcj02', success: resolve, fail: reject })
  })
  return invoke(api.startLocationUpdateBackground)
    .then(() => 'background' as const)
    .catch(() => invoke(api.startLocationUpdate).then(() => 'foreground' as const))
    .catch(() => 'polling' as const)
}

export async function startLocationReporting(options: {
  sessionId: string
  intervalSeconds: number
  initialLocation: ProviderLocationPayload
  onError?: (message: string) => void
  onReported?: (location: ProviderLocationPayload) => void
}) {
  stopLocationReporting(false)
  sessionId = options.sessionId
  intervalMs = Math.max(60000, options.intervalSeconds * 1000)
  latestLocation = options.initialLocation
  lastReportedAt = Date.now()
  errorCallback = options.onError
  reportedCallback = options.onReported
  const mode = await startNativeUpdates()
  pollingMode = mode === 'polling'
  timer = setInterval(() => { void sendLatest(true) }, intervalMs)
  return mode
}

export function isReportingSession(value: string | null) {
  return Boolean(value && value === sessionId && timer)
}

export async function refreshLocationReporting(value: string) {
  if (!value || value !== sessionId || !timer) {
    throw new Error('定位上报会话已变化，请重新开启接单')
  }
  while (reporting) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (value !== sessionId || !timer) {
    throw new Error('定位上报会话已变化，请重新开启接单')
  }
  reporting = true
  try {
    latestLocation = await getCurrentProviderLocation()
    await updateProviderOnlineLocation(sessionId, latestLocation)
    lastReportedAt = Date.now()
    reportedCallback?.(latestLocation)
  } catch (reason) {
    const message = (reason as Error).message || '位置上报失败'
    errorCallback?.(message)
    throw new Error(message)
  } finally {
    reporting = false
  }
}

export function stopLocationReporting(stopNative = true) {
  if (timer) clearInterval(timer)
  timer = null
  sessionId = ''
  latestLocation = null
  lastReportedAt = 0
  pollingMode = false
  if (!stopNative) return
  const api = wxLocationApi()
  if (nativeListening) {
    api?.offLocationChange?.(locationListener)
    api?.offLocationChangeError?.(locationErrorListener)
    nativeListening = false
  }
  api?.stopLocationUpdate?.({})
}
