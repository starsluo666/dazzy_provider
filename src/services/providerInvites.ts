import { request, uploadFile } from './http'
import { saveSession } from './session'
import type { AuthSession, DataResponse } from '@/types/api'

export interface ProviderInvite {
  code: string
  name: string
  kind: 'store' | 'provider'
  cities: Array<{ code: string; name: string }>
}

export const getProviderInvite = (code: string) => request<DataResponse<ProviderInvite>>(
  `/growth/provider-invites/${encodeURIComponent(code)}/`, { skipAuth: true },
)

export async function registerInvitedProvider(filePath: string, file: unknown, formData: Record<string, string>) {
  const response = await uploadFile<DataResponse<AuthSession>>(
    '/growth/provider-invites/register/', filePath, 'file', file, 90000, formData, { skipAuth: true },
  )
  saveSession(response.data)
  return response.data
}
