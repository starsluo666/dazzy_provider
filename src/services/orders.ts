import type { DataResponse, ProviderManagedOrder } from '@/types/api'
import { request, uploadFile } from './http'

export function getManagedProviderOrders(status = '') {
  return request<{ data: { items: ProviderManagedOrder[] } }>('/providers/me/orders/', {
    query: { status: status || undefined },
  })
}
export function getManagedProviderOrder(orderNo: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/`)
}
export function acceptManagedProviderOrder(orderNo: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/accept/`, { method: 'POST' })
}
export function rejectManagedProviderOrder(orderNo: string, reason: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/reject/`, {
    method: 'POST', data: { reason },
  })
}
export function departManagedProviderOrder(orderNo: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/depart/`, { method: 'POST' })
}
export function uploadManagedOrderEvidence(filePath: string, file?: unknown) {
  return uploadFile<DataResponse<{ id: string; url: string }>>('/media/order-evidence/', filePath, 'file', file)
}
export function attachManagedOrderArrivalEvidence(
  orderNo: string,
  evidence: { photo_id: string; longitude: number; latitude: number; accuracy_m?: number },
) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/arrival-evidence/`, {
    method: 'POST', data: evidence,
  })
}
export function startManagedProviderOrder(orderNo: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/start/`, { method: 'POST' })
}
export function completeManagedProviderOrder(orderNo: string) {
  return request<DataResponse<ProviderManagedOrder>>(`/providers/me/orders/${orderNo}/complete/`, { method: 'POST' })
}
