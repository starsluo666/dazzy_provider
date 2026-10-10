import type { DataResponse } from '@/types/api'
import { request } from './http'
import { returnAfterAuthentication } from './session'

export interface ProviderApplication {
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
  application_real_name: string
  service_city_name: string
  invitation_code: string
  submitted_at: string | null
  rejection_reason: string
}
export const APPLICATION_PAGE = '/pages/invitations/application'
export const getProviderApplication = () => request<DataResponse<ProviderApplication | null>>('/providers/me/application/')

// Always use the current server state: a saved login does not imply approval.
export async function redirectToApplicationIfNeeded(): Promise<boolean> {
  const { data } = await getProviderApplication()
  if (data?.status === 'approved') return false
  uni.reLaunch({ url: APPLICATION_PAGE })
  return true
}

export async function enterProviderApp(returnUrl?: string) {
  if (await redirectToApplicationIfNeeded()) return
  returnAfterAuthentication(returnUrl)
}
