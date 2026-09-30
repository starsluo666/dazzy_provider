import type { AuthSession, CurrentUser } from '@/types/api'

const ACCESS_TOKEN_KEY = 'dazzy.provider.accessToken'
const REFRESH_TOKEN_KEY = 'dazzy.provider.refreshToken'
const USER_KEY = 'dazzy.provider.currentUser'

export function getAccessToken(): string { return uni.getStorageSync(ACCESS_TOKEN_KEY) || '' }
export function getRefreshToken(): string { return uni.getStorageSync(REFRESH_TOKEN_KEY) || '' }
export function getStoredUser(): CurrentUser | null { return uni.getStorageSync(USER_KEY) || null }

export function saveSession(session: AuthSession) {
  uni.setStorageSync(ACCESS_TOKEN_KEY, session.access)
  uni.setStorageSync(REFRESH_TOKEN_KEY, session.refresh)
  uni.setStorageSync(USER_KEY, session.user)
}

export function updateTokens(access: string, refresh?: string) {
  uni.setStorageSync(ACCESS_TOKEN_KEY, access)
  if (refresh) uni.setStorageSync(REFRESH_TOKEN_KEY, refresh)
}

export function clearSession() {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(
    getAccessToken()
    || (import.meta.env.DEV && import.meta.env.VITE_DEMO_USER_PUBLIC_ID),
  )
}

const publicRoutes = ['/pages/auth/login', '/pages/legal/document']
export function isProtectedRoute(url: string): boolean {
  const path = (url.startsWith('/') ? url : `/${url}`).split('?')[0]
  return !publicRoutes.includes(path)
}

export function currentPageUrl(): string {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as { route?: string; options?: Record<string, unknown> } | undefined
  if (!page?.route) return '/pages/workbench/index'
  const query = Object.entries(page.options || {})
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `/${page.route}${query ? `?${query}` : ''}`
}

let redirecting = false
export function handleSessionExpired() {
  const returnUrl = currentPageUrl()
  clearSession()
  if (returnUrl.startsWith('/pages/auth/') || redirecting) return
  redirecting = true
  uni.reLaunch({
    url: `/pages/auth/login?redirect=${encodeURIComponent(returnUrl)}`,
    complete: () => setTimeout(() => { redirecting = false }, 300),
  })
}
export function requireAuthentication(returnUrl = currentPageUrl()): boolean {
  if (isAuthenticated()) return true
  if (!redirecting) {
    redirecting = true
    uni.reLaunch({
      url: `/pages/auth/login?redirect=${encodeURIComponent(returnUrl)}`,
      complete: () => setTimeout(() => { redirecting = false }, 300),
    })
  }
  return false
}

function safeReturnUrl(value?: string): string {
  if (!value || !value.startsWith('/pages/') || value.includes('://') || value.startsWith('/pages/auth/')) {
    return '/pages/workbench/index'
  }
  return value
}

export function returnAfterAuthentication(returnUrl?: string) {
  uni.reLaunch({ url: safeReturnUrl(returnUrl) })
}

export function guardCurrentPage(): boolean {
  const url = currentPageUrl()
  return !isProtectedRoute(url) || requireAuthentication(url)
}

export function installAuthenticationGuards() {
  const guard = (args: { url?: string }) => {
    if (!args.url || !isProtectedRoute(args.url) || isAuthenticated()) return true
    args.url = `/pages/auth/login?redirect=${encodeURIComponent(args.url)}`
    return true
  }
  uni.addInterceptor('navigateTo', { invoke: guard })
  uni.addInterceptor('redirectTo', { invoke: guard })
  uni.addInterceptor('reLaunch', { invoke: guard })
}
