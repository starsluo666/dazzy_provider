import type { ProviderManagedOrder } from '@/types/api'
import { recordManagedOrderContact } from '@/services/orders'

export function confirmOrderAction(title: string, content: string, confirmText = '确认') {
  return new Promise<boolean>((resolve) => {
    uni.showModal({ title, content, confirmText, success: (result) => resolve(result.confirm), fail: () => resolve(false) })
  })
}

export function canContactOrder(order: ProviderManagedOrder) {
  return ['pending_service', 'departed', 'in_service', 'pending_confirmation'].includes(order.status)
    && Boolean(order.contact_phone_display && !order.contact_phone_display.includes('*'))
}

export async function contactOrderCustomer(order: ProviderManagedOrder) {
  if (!canContactOrder(order)) throw new Error('接单后可联系用户。')
  await new Promise<void>((resolve, reject) => {
    uni.makePhoneCall({
      phoneNumber: order.contact_phone_display,
      success: () => resolve(),
      fail: () => reject(new Error('未能发起拨号，请重试或联系客服。')),
    })
  })
  // Dial launch is not proof of a connected call. The separate departure modal
  // asks the provider to attest they actually checked the order with the user.
  return recordManagedOrderContact(order.order_no)
}

export async function confirmOrderDeparture(order: ProviderManagedOrder) {
  if (!order.provider_contact_initiated_at) {
    await new Promise<void>((resolve) => uni.showModal({
      title: '请先联系用户', content: '请先点击“联系用户”，核实服务时间、集合地点和订单情况，再确认出发。',
      showCancel: false, confirmText: '我知道了', complete: () => resolve(),
    }))
    return false
  }
  return confirmOrderAction('已联系用户并核实订单？',
    '请确认已与用户取得联系，核实服务时间、集合地点及订单情况。仅拨号未接通时，请继续联系，不要确认出发。', '确认出发')
}

export function getFulfillmentLocation() {
  return new Promise<{ longitude: number; latitude: number; accuracy_m?: number }>((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: (result) => {
        const longitude = Number(result.longitude), latitude = Number(result.latitude)
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
          reject(new Error('未获取到有效位置，请重新定位。'))
          return
        }
        resolve({
          longitude: Number(longitude.toFixed(7)), latitude: Number(latitude.toFixed(7)),
          ...(Number.isFinite(result.accuracy) && result.accuracy >= 0 && result.accuracy < 1000000
            ? { accuracy_m: Number(result.accuracy.toFixed(2)) } : {}),
        })
      },
      fail: () => reject(new Error('需要开启定位权限，才能记录本次到场或完成位置。请授权后重试。')),
    })
  })
}
