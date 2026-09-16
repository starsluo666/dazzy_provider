import type { AccountSecurity, AuthSession, DataResponse } from '@/types/api'
import { request } from './http'
import { clearSession, getRefreshToken, saveSession } from './session'

export async function loginWithPassword(phone: string, password: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/login/password/', {
    method: 'POST', data: { phone, password }, skipAuth: true,
  })
  saveSession(response.data)
  return response.data
}

export function getAccountSecurity() {
  return request<DataResponse<AccountSecurity>>('/auth/security/')
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/password/change/', {
    method: 'POST',
    data: { current_password: currentPassword, new_password: newPassword },
  })
  saveSession(response.data)
  return response.data
}

export async function logoutOtherSessions(currentPassword: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/sessions/logout-others/', {
    method: 'POST',
    data: { current_password: currentPassword },
  })
  saveSession(response.data)
  return response.data
}

export function closeAccount(currentPassword: string) {
  return request<DataResponse<{ closed: boolean }>>('/auth/account/close/', {
    method: 'POST',
    data: { current_password: currentPassword },
  })
}

export async function logout() {
  const refresh = getRefreshToken()
  try {
    if (refresh) await request<void>('/auth/logout/', { method: 'POST', data: { refresh } })
  } finally {
    clearSession()
  }
}
