import type { AuthSession, DataResponse } from '@/types/api'
import { request } from './http'
import { clearSession, getRefreshToken, saveSession } from './session'

export async function loginWithPassword(phone: string, password: string) {
  const response = await request<DataResponse<AuthSession>>('/auth/login/password/', {
    method: 'POST', data: { phone, password }, skipAuth: true,
  })
  saveSession(response.data)
  return response.data
}

export async function logout() {
  const refresh = getRefreshToken()
  try {
    if (refresh) await request<void>('/auth/logout/', { method: 'POST', data: { refresh } })
  } finally {
    clearSession()
  }
}
