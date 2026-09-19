import type {
  DataResponse,
  NotificationCategory,
  NotificationListResponse,
  NotificationSummary,
  UserNotification,
} from '@/types/api'

import { request } from './http'

export function getNotifications(options: {
  category?: NotificationCategory
  page?: number
  pageSize?: number
} = {}) {
  return request<NotificationListResponse>('/notifications/', {
    query: {
      category: options.category,
      page: options.page || 1,
      page_size: options.pageSize || 20,
    },
  })
}

export function getNotificationSummary() {
  return request<DataResponse<NotificationSummary>>('/notifications/summary/')
}

export function markNotificationRead(publicId: string) {
  return request<DataResponse<UserNotification>>(
    `/notifications/${encodeURIComponent(publicId)}/read/`,
    { method: 'POST' },
  )
}

export function markAllNotificationsRead(category?: NotificationCategory) {
  return request<DataResponse<{ updated: number; unread: number }>>(
    '/notifications/read-all/',
    { method: 'POST', data: category ? { category } : {} },
  )
}
