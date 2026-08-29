import { clearSession, getAccessToken, getRefreshToken, updateTokens } from './session'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

interface RequestOptions {
  query?: Record<string, string | number | undefined>
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  data?: Record<string, unknown> | string | ArrayBuffer
  skipAuth?: boolean
}

let refreshPromise: Promise<boolean> | null = null

function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve(false)
  refreshPromise = new Promise((resolve) => {
    uni.request({
      url: `${API_BASE_URL}/auth/token/refresh/`,
      method: 'POST',
      data: { refresh },
      header: { 'Content-Type': 'application/json' },
      success: (response) => {
        const body = response.data as { access?: string; refresh?: string }
        if (response.statusCode === 200 && body.access) {
          updateTokens(body.access, body.refresh)
          resolve(true)
        } else {
          clearSession()
          resolve(false)
        }
      },
      fail: () => resolve(false),
      complete: () => { refreshPromise = null },
    })
  })
  return refreshPromise
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  for (const value of Object.values(body as Record<string, unknown>)) {
    if (typeof value === 'string') return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    if (value && typeof value === 'object') return errorMessage(value, fallback)
  }
  return fallback
}

export function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const query = Object.entries(options.query || {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const url = `${API_BASE_URL}${path}${query ? `?${query}` : ''}`

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (options.method || 'GET') as UniApp.RequestOptions['method'],
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(!options.skipAuth && getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : import.meta.env.VITE_DEMO_USER_PUBLIC_ID
            ? { 'X-Dazzy-Demo-User': import.meta.env.VITE_DEMO_USER_PUBLIC_ID }
            : {}),
      },
      timeout: 12000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        if (response.statusCode === 401 && !options.skipAuth && !retried) {
          refreshAccessToken().then((refreshed) => {
            if (refreshed) request<T>(path, options, true).then(resolve).catch(reject)
            else reject(new Error('登录已过期，请重新登录。'))
          })
          return
        }
        reject(new Error(errorMessage(response.data, `请求失败（${response.statusCode}）`)))
      },
      fail: (error) => reject(new Error(error.errMsg || '网络连接失败')),
    })
  })
}

export function uploadFile<T>(path: string, filePath: string, name = 'file', file?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}${path}`,
      filePath,
      file,
      name,
      header: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      timeout: 30000,
      success: (response) => {
        let body: unknown
        try { body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data } catch { body = null }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(body as T)
        else reject(new Error(errorMessage(body, `上传失败（${response.statusCode}）`)))
      },
      fail: (error) => reject(new Error(error.errMsg || '文件上传失败')),
    } as UniApp.UploadFileOption)
  })
}
