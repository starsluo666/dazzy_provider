import type {
  DataResponse,
  ProviderLocationPayload,
  ProviderManagedService,
  ProviderOnlineSession,
  ProviderScheduleDay,
  ProviderWorkbench,
  ProviderIncomeData,
  ProviderIdentity,
  ProviderProfileData,
  ServiceCategory,
} from '@/types/api'
import { request, uploadFile } from './http'

export const getProviderWorkbench = () =>
  request<DataResponse<ProviderWorkbench>>('/providers/me/workbench/')

export const getProviderIncome = () =>
  request<DataResponse<ProviderIncomeData>>('/providers/me/income/')

export const getProviderIdentity = () =>
  request<DataResponse<ProviderIdentity>>('/providers/me/identity/')

export const saveProviderIdentity = (data: Record<string, unknown>) =>
  request<DataResponse<ProviderIdentity>>('/providers/me/identity/', { method: 'PATCH', data })

export const submitProviderIdentity = () =>
  request<DataResponse<ProviderIdentity>>('/providers/me/identity/submit/', { method: 'POST', data: {} })

export const uploadProviderIdentityPhoto = (filePath: string, file?: unknown) =>
  uploadFile<DataResponse<{ id: string; url: string }>>(
    '/media/provider-identities/', filePath, 'file', file,
  )

export const getProviderProfile = () =>
  request<DataResponse<ProviderProfileData>>('/providers/me/profile/')

export const saveProviderProfile = (data: Record<string, unknown>) =>
  request<DataResponse<ProviderProfileData>>('/providers/me/profile/', { method: 'PATCH', data })

export const uploadProviderLifestylePhoto = (filePath: string, file?: unknown) =>
  uploadFile<DataResponse<{ id: string; url: string }>>(
    '/media/provider-lifestyle-photos/', filePath, 'file', file,
  )

export const startProviderOnline = (location: ProviderLocationPayload) =>
  request<DataResponse<ProviderOnlineSession>>('/providers/me/online/start/', {
    method: 'POST', data: location as unknown as Record<string, unknown>,
  })

export const updateProviderOnlineLocation = (sessionId: string, location: ProviderLocationPayload) =>
  request<DataResponse<ProviderOnlineSession>>('/providers/me/online/location/', {
    method: 'PUT', data: { session_id: sessionId, ...location },
  })

export const stopProviderOnline = () =>
  request<DataResponse<ProviderOnlineSession>>('/providers/me/online/stop/', { method: 'POST', data: {} })

export const getServiceCategories = () =>
  request<{ data: { items: ServiceCategory[] } }>('/service-categories/', { skipAuth: true })
export const getMyProviderServices = () =>
  request<{ data: { items: ProviderManagedService[] } }>('/providers/me/services/')
export const createMyProviderService = (data: Record<string, unknown>) =>
  request<DataResponse<ProviderManagedService>>('/providers/me/services/', { method: 'POST', data })
export const updateMyProviderService = (id: number, data: Record<string, unknown>) =>
  request<DataResponse<ProviderManagedService>>(`/providers/me/services/${id}/`, { method: 'PATCH', data })
export const disableMyProviderService = (id: number) =>
  request<void>(`/providers/me/services/${id}/`, { method: 'DELETE' })

export const getProviderSchedule = (startDate: string, days = 7) =>
  request<DataResponse<{ start_date: string; days: ProviderScheduleDay[] }>>('/providers/me/schedule/', {
    query: { start_date: startDate, days },
  })
export const addProviderSchedulePeriod = (data: Record<string, unknown>) =>
  request<DataResponse<{ ids: string[] }>>('/providers/me/schedule/', { method: 'POST', data })
export const deleteProviderSchedulePeriod = (id: string) =>
  request<void>(`/providers/me/schedule/periods/${id}/`, { method: 'DELETE' })
export const setProviderScheduleDayClosed = (date: string, isClosed: boolean) =>
  request<DataResponse<{ date: string; is_closed: boolean }>>(`/providers/me/schedule/days/${date}/`, {
    method: 'PUT', data: { is_closed: isClosed },
  })
