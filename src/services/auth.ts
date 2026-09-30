import type { AccountClosureSubmission, AccountSecurity, AuthSession, DataResponse } from '@/types/api'
import { request } from './http'
import { clearSession, getRefreshToken, saveSession } from './session'

export async function loginWithPassword(phone: string, password: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/login/password/', {
    method: 'POST', data: { phone, password }, skipAuth: true,
  })
  saveSession(response.data)
  return response.data
}

export async function loginWithWechatMiniProgram(loginCode: string, phoneCode?: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/login/wechat-mini-program/', {
    method: 'POST',
    data: { client_type: 'provider', login_code: loginCode, ...(phoneCode ? { phone_code: phoneCode } : {}) },
    skipAuth: true,
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

export function sendInitialPasswordCode() {
  return request<DataResponse<{ expires_in: number; retry_after: number; debug_code?: string }>>(
    '/auth/password/initial/code/', { method: 'POST' },
  )
}

export async function setInitialPassword(code: string, newPassword: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/password/initial/', {
    method: 'POST', data: { code, new_password: newPassword },
  })
  saveSession(response.data)
  return response.data
}

export function sendPhoneChangeCode(target: 'current' | 'new', newPhone?: string) {
  return request<DataResponse<{ expires_in: number; retry_after: number; destination_masked: string; debug_code?: string }>>(
    '/auth/phone/change/code/',
    { method: 'POST', data: { target, ...(newPhone ? { new_phone: newPhone } : {}) } },
  )
}

export async function changePhone(currentCode: string, newPhone: string, newCode: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/phone/change/', {
    method: 'POST',
    data: { current_code: currentCode, new_phone: newPhone, new_code: newCode },
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
  return request<DataResponse<AccountClosureSubmission>>('/auth/account/close/', {
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
