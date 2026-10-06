<template>
  <view class="dz-page dz-page--tabbed dz-management-page provider-orders-page">
    <view class="dz-sticky-head">
      <view class="dz-safe-top" />
      <view class="page-head dz-container">
        <view class="head-spacer" />
        <text class="page-title">达人订单</text>
        <button class="refresh" aria-label="刷新订单" :disabled="loading || !!busyOrderNo" hover-class="dz-pressed" @tap="load">
          <image class="refresh-icon" src="/static/icons/refresh.svg" mode="aspectFit" />
        </button>
      </view>
    </view>
    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view class="tab-row">
        <button v-for="tab in tabs" :key="tab.key" class="tab-button"
          :class="{ 'tab-active': activeTab === tab.key }" :aria-label="`${tab.label}，${tab.count}单`"
          hover-class="dz-pressed" @tap="activeTab = tab.key">
          <text>{{ tab.label }}</text><text v-if="tab.count" class="tab-count">{{ tab.count }}</text>
        </button>
      </view>
    </scroll-view>
    <view class="dz-container order-content">
      <view v-if="!loading && !error" class="list-context">
        <text class="list-title">{{ activeLabel }}</text><text class="list-count">{{ visibleOrders.length }} 笔订单</text>
      </view>
      <NetworkState v-if="loading" message="正在加载达人订单…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <view v-else-if="!visibleOrders.length" class="empty-state">
        <view class="empty-icon"><image class="empty-image" src="/static/tabbar/order-active.svg" mode="aspectFit" /></view>
        <text class="empty-title">暂无{{ activeLabel }}订单</text>
        <text class="empty-copy">新的订单和履约进度会出现在这里。</text>
      </view>
      <view v-for="order in (loading || error ? [] : visibleOrders)" :key="order.order_no" class="order-card">
        <view class="card-header">
          <text class="order-status" :class="'tone-' + statusTone(order.status)">{{ statusLabel(order.status) }}</text>
          <button class="detail-link" aria-label="查看订单详情" hover-class="dz-pressed" @tap="openDetail(order)">订单详情 ›</button>
        </view>
        <view class="customer-row" @tap="openDetail(order)">
          <view class="customer-avatar">{{ (order.customer_name || '用户').slice(0, 1) }}</view>
          <view class="customer-info">
            <text class="service-name">{{ order.service_name }}</text>
            <text class="customer-name">{{ order.customer_name || '预约用户' }}</text>
          </view>
          <view class="amount">
            <text class="amount-caption">订单金额</text><text class="amount-value">¥{{ money(order.payable_amount) }}</text>
          </view>
        </view>
        <view class="order-meta">
          <view class="meta-line"><image class="meta-icon" src="/static/icons/calendar.svg" mode="aspectFit" /><text class="meta-text meta-time">{{ timeRange(order.starts_at, order.ends_at) }}</text></view>
          <view class="meta-line"><image class="meta-icon" src="/static/icons/location.svg" mode="aspectFit" /><text class="meta-text">{{ addressLabel(order) }}</text></view>
          <view class="meta-line contact-line">
            <image class="meta-icon" src="/static/icons/phone.svg" mode="aspectFit" />
            <view class="contact-info">
              <text class="contact-person">{{ order.contact_name }}{{ order.contact_gender_label }} ·</text>
              <view class="contact-phone-group">
                <text class="contact-number">{{ order.contact_phone_display }}</text>
                <button v-if="canContactOrder(order)" class="contact-button" aria-label="联系用户" :disabled="!!busyOrderNo"
                  :class="{ 'button-disabled': !!busyOrderNo }" hover-class="dz-pressed" @tap="contactCustomer(order)">
                  <text class="contact-button-label">{{ contacting && busyOrderNo === order.order_no ? '联系中' : '联系' }}</text>
                </button>
              </view>
            </view>
          </view>
        </view>
        <view v-if="order.note" class="note">备注：{{ order.note }}</view>
        <button v-if="order.arrival_photo_url" class="evidence" hover-class="dz-pressed" aria-label="查看集合照与记录"
          @tap="previewEvidence(order.arrival_photo_url)">
          <image class="evidence-photo" :src="order.arrival_photo_url" mode="aspectFill" />
          <view class="evidence-copy"><text class="evidence-title">集合照已留存</text><text class="evidence-time">{{ evidenceTime(order) }}</text></view>
          <text class="evidence-link">查看 ›</text>
        </button>
        <view v-else-if="order.status === 'departed'" class="evidence-placeholder">
          <text class="evidence-title">到场后上传集合照</text><text class="evidence-time">需包含本人及现场环境，同时记录当前位置</text>
        </view>
        <view v-if="order.fulfillment_review_required" class="risk-notice">
          <text class="risk-title">履约异常 · 待客服审核</text>
          <text class="risk-copy">自动确认与分账已暂停，审核通过后恢复。</text>
        </view>
        <view class="card-footer">
          <view class="progress-copy"><text class="progress-title">{{ nextStepTitle(order) }}</text><text class="progress-detail" :class="{ 'copy-warning': order.status === 'pending_acceptance' && isExpired(order) }">{{ nextStepCopy(order) }}</text></view>
          <view v-if="actionLabel(order)" class="action-row">
            <button class="order-button primary-button" :class="{ 'button-disabled': isActionDisabled(order) }"
              :disabled="isActionDisabled(order)" hover-class="dz-pressed" @tap="performAction(order)">
              {{ !contacting && busyOrderNo === order.order_no ? busyLabel : actionLabel(order) }}
            </button>
          </view>
        </view>
        <text class="order-number">{{ order.order_no }}</text>
      </view>
    </view>
    <ProviderTabBar active="orders" />
  </view>
</template>

<script setup lang="ts">
import { ensureFirstOrderTraining } from '@/services/training'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import ProviderTabBar from '@/components/ProviderTabBar.vue'
import {
  acceptManagedProviderOrder,
  attachManagedOrderArrivalEvidence,
  completeManagedProviderOrder,
  departManagedProviderOrder,
  getManagedProviderOrders,
  startManagedProviderOrder,
  uploadManagedOrderEvidence,
} from '@/services/orders'
import { guardCurrentPage } from '@/services/session'
import type { ProviderManagedOrder } from '@/types/api'
import { formatAmount, formatBusinessDateTime, formatBusinessMonthDay, formatOrderTimeRange, getErrorMessage } from '@/utils/formatters'

import { canContactOrder, contactOrderCustomer, confirmOrderDeparture, getFulfillmentLocation as getCurrentLocation } from '@/utils/orderFulfillment'

type OrderTab = 'pending_acceptance' | 'pending_service' | 'in_progress' | 'support' | 'completed' | 'all'
type SelectedPhoto = { path: string; file?: unknown }

const orders = ref<ProviderManagedOrder[]>([])
const activeTab = ref<OrderTab>('pending_acceptance')
const loading = ref(true)
const error = ref('')
const busyOrderNo = ref('')
const busyLabel = ref('处理中…')
const contacting = ref(false)
const money = formatAmount
function addressLabel(order: ProviderManagedOrder) {
  return [order.meeting_location_name, order.meeting_address]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join('，')
}

function inTab(status: string, tab: OrderTab) {
  if (tab === 'all') return true
  if (tab === 'in_progress') return ['departed', 'in_service', 'pending_confirmation'].includes(status)
  if (tab === 'support') return ['pending_support', 'after_sales', 'refunded'].includes(status)
  if (tab === 'completed') return ['pending_review', 'completed', 'cancelled'].includes(status)
  return status === tab
}

const tabs = computed(() => [
  { key: 'pending_acceptance' as const, label: '待接单', count: orders.value.filter((item) => inTab(item.status, 'pending_acceptance')).length },
  { key: 'pending_service' as const, label: '待服务', count: orders.value.filter((item) => inTab(item.status, 'pending_service')).length },
  { key: 'in_progress' as const, label: '履约中', count: orders.value.filter((item) => inTab(item.status, 'in_progress')).length },
  { key: 'support' as const, label: '需处理', count: orders.value.filter((item) => inTab(item.status, 'support')).length },
  { key: 'completed' as const, label: '已结束', count: orders.value.filter((item) => inTab(item.status, 'completed')).length },
  { key: 'all' as const, label: '全部', count: orders.value.length },
])
const visibleOrders = computed(() => orders.value.filter((item) => inTab(item.status, activeTab.value)))
const activeLabel = computed(() => tabs.value.find((item) => item.key === activeTab.value)?.label || '')

function timeRange(startsAt: string, endsAt: string) {
  return formatOrderTimeRange(startsAt, endsAt)
}
function shortDate(value: string) {
  return formatBusinessMonthDay(value)
}
function dateTime(value: string) {
  return formatBusinessDateTime(value)
}
function statusLabel(status: string) {
  return {
    pending_acceptance: '等待接单', pending_service: '等待服务', departed: '已出发',
    in_service: '服务中', pending_confirmation: '等待用户确认', pending_review: '等待评价',
    completed: '已完成', cancelled: '已取消', refunded: '已退款', pending_support: '客服处理中',
    after_sales: '售后处理中',
  }[status] || '处理中'
}
function statusTone(status: string) {
  if (['pending_acceptance', 'pending_support', 'after_sales'].includes(status)) return 'orange'
  if (['completed', 'pending_review'].includes(status)) return 'green'
  if (['cancelled', 'refunded'].includes(status)) return 'gray'
  return 'cyan'
}
function isExpired(order: ProviderManagedOrder) {
  return Boolean(order.acceptance_expires_at && new Date(order.acceptance_expires_at).getTime() <= Date.now())
}
function acceptanceCopy(order: ProviderManagedOrder) {
  if (!order.acceptance_expires_at) return '请尽快确认订单'
  const minutes = Math.max(0, Math.ceil((new Date(order.acceptance_expires_at).getTime() - Date.now()) / 60000))
  return minutes ? `剩余约 ${minutes} 分钟确认` : '接单时限已到，请联系客服'
}
function actionLabel(order: ProviderManagedOrder) {
  if (order.status === 'pending_acceptance') return '接受订单'
  if (order.status === 'pending_service') return '确认出发'
  if (order.status === 'departed') return order.arrival_photo_url ? '开始服务' : '上传集合照'
  if (order.status === 'in_service') return '提交完成'
  return ''
}
function nextStepTitle(order: ProviderManagedOrder) {
  if (order.status === 'pending_acceptance') return '等待你确认'
  if (order.status === 'pending_service') return '下一步：确认出发'
  if (order.status === 'departed' && !order.arrival_photo_url) return '下一步：到场拍照'
  if (order.status === 'departed') return '集合照已留存'
  if (order.status === 'in_service') return '服务正在进行'
  if (order.status === 'pending_confirmation') return '已提交服务完成'
  if (order.status === 'pending_review') return '用户待评价'
  return '订单履约记录'
}
function nextStepCopy(order: ProviderManagedOrder) {
  if (order.fulfillment_review_required) return '履约时间需客服核实，自动确认和分账已暂停'
  if (order.status === 'pending_acceptance') return acceptanceCopy(order)
  if (order.status === 'pending_service') return order.provider_contact_initiated_at ? '出发前请确认已与用户核实订单' : '请先联系用户，核实订单情况'
  if (order.status === 'departed' && !order.arrival_photo_url) return '抵达集合地点后上传现场照片'
  if (order.status === 'departed') return '可与用户核对后开始服务'
  if (order.status === 'in_service') return '服务结束后提交完成，等待用户确认'
  if (order.status === 'pending_confirmation') return '等待用户在订单中确认完成'
  if (order.accepted_at) return `接单于 ${dateTime(order.accepted_at)}`
  return `服务时间 ${shortDate(order.starts_at)}`
}
function evidenceTime(order: ProviderManagedOrder) {
  return order.arrival_photo_uploaded_at
    ? `${dateTime(order.arrival_photo_uploaded_at)} 已留存位置`
    : '已留存照片与上传位置'
}
function isActionDisabled(order: ProviderManagedOrder) {
  return Boolean(busyOrderNo.value || (order.status === 'pending_acceptance' && isExpired(order))
    || (order.status === 'pending_service' && !order.provider_contact_initiated_at))
}
function updateOrder(updated: ProviderManagedOrder) {
  const index = orders.value.findIndex((item) => item.order_no === updated.order_no)
  if (index >= 0) orders.value[index] = updated
}
function confirmAction(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({ title, content, success: (result) => resolve(result.confirm), fail: () => resolve(false) })
  })
}
function chooseEvidencePhoto() {
  return new Promise<SelectedPhoto>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: ({ tempFilePaths, tempFiles }) => {
        const file = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
        if (file?.size && file.size > 8 * 1024 * 1024) {
          reject(new Error('集合照大小不能超过8MB。'))
          return
        }
        if (!tempFilePaths[0]) {
          reject(new Error('没有选择照片。'))
          return
        }
        resolve({ path: tempFilePaths[0], file })
      },
      fail: (result) => reject(new Error(result.errMsg.includes('cancel') ? '' : '无法选择照片，请重试。')),
    })
  })
}
async function runUpdate(order: ProviderManagedOrder, label: string, task: () => Promise<{ data: ProviderManagedOrder }>) {
  if (busyOrderNo.value) return false
  busyOrderNo.value = order.order_no
  busyLabel.value = label
  try {
    updateOrder((await task()).data)
    uni.showToast({ title: '订单进度已更新', icon: 'success' })
    return true
  } catch (reason) {
    const message = getErrorMessage(reason, '操作失败')
    if (message) uni.showToast({ title: message, icon: 'none' })
    return false
  } finally {
    busyOrderNo.value = ''
  }
}
async function accept(order: ProviderManagedOrder) {
  if (!await ensureFirstOrderTraining()) return
  const confirmed = await confirmAction(
    '确认接受订单',
    `必须由账号实名认证本人接单并提供服务，禁止代接、转单或由他人替代。确认由本人于 ${timeRange(order.starts_at, order.ends_at)} 按时提供服务吗？`,
  )
  if (!confirmed) return
  if (await runUpdate(order, '接单中…', () => acceptManagedProviderOrder(order.order_no))) {
    activeTab.value = 'pending_service'
  }
}
async function depart(order: ProviderManagedOrder) {
  const confirmed = await confirmOrderDeparture(order)
  if (!confirmed) return
  if (await runUpdate(order, '更新中…', () => departManagedProviderOrder(order.order_no, true))) {
    activeTab.value = 'in_progress'
  }
}
async function uploadEvidence(order: ProviderManagedOrder) {
  if (busyOrderNo.value) return
  busyOrderNo.value = order.order_no
  busyLabel.value = '选择照片…'
  try {
    if (!await confirmAction('上传包含本人的到场照片', '开始服务前必须上传到场照片。照片须清晰包含实名认证本人及到场环境，请勿使用他人照片或仅拍摄场地。')) return
    const selected = await chooseEvidencePhoto()
    busyLabel.value = '定位中…'
    const location = await getCurrentLocation()
    busyLabel.value = '上传中…'
    const uploaded = await uploadManagedOrderEvidence(selected.path, selected.file)
    updateOrder((await attachManagedOrderArrivalEvidence(order.order_no, {
      photo_id: uploaded.data.id,
      ...location,
    })).data)
    uni.showToast({ title: '集合照已留存', icon: 'success' })
  } catch (reason) {
    const message = getErrorMessage(reason, '上传失败')
    if (message) uni.showToast({ title: message, icon: 'none' })
  } finally {
    busyOrderNo.value = ''
  }
}
async function start(order: ProviderManagedOrder) {
  const confirmed = await confirmAction('开始服务', '请确认本人已与用户会合，且已上传清晰包含本人的到场照片。开始后订单将进入服务中。')
  if (!confirmed) return
  await runUpdate(order, '开始中…', () => startManagedProviderOrder(order.order_no))
}
async function complete(order: ProviderManagedOrder) {
  const confirmed = await confirmAction('提交服务完成', '将获取并保存当前定位，核对订单时间。时间异常时会暂停自动确认与分账，由客服审核。请确认约定服务已完成。')
  if (!confirmed) return
  await runUpdate(order, '定位并提交…', async () => completeManagedProviderOrder(order.order_no, await getCurrentLocation()))
}
async function contactCustomer(order: ProviderManagedOrder) {
  if (busyOrderNo.value) return
  busyOrderNo.value = order.order_no
  contacting.value = true
  try {
    updateOrder((await contactOrderCustomer(order)).data)
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '联系操作未完成，请重试'), icon: 'none' })
  } finally {
    contacting.value = false
    busyOrderNo.value = ''
  }
}
function performAction(order: ProviderManagedOrder) {
  if (busyOrderNo.value) return
  if (order.status === 'pending_acceptance') return accept(order)
  if (order.status === 'pending_service') return depart(order)
  if (order.status === 'departed' && !order.arrival_photo_url) return uploadEvidence(order)
  if (order.status === 'departed') return start(order)
  if (order.status === 'in_service') return complete(order)
}
function previewEvidence(url: string) { uni.previewImage({ current: url, urls: [url] }) }
function openDetail(order: ProviderManagedOrder) {
  uni.navigateTo({ url: `/pages/orders/detail?order_no=${encodeURIComponent(order.order_no)}` })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    orders.value = (await getManagedProviderOrders()).data.items
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

onShow(() => { if (guardCurrentPage()) load() })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.provider-orders-page { min-height: 100vh; background: #f3f7f7; color: $dz-text-primary; }
.page-head { display: flex; align-items: center; justify-content: space-between; height: 100rpx; background: #f7fbfb; }
.head-spacer, .refresh { width: 88rpx; height: 88rpx; flex: 0 0 88rpx; }
.page-title { font-size: 34rpx; font-weight: 700; }
.refresh { display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; background: transparent; }
.refresh-icon { width: 40rpx; height: 40rpx; }
.refresh::after, .tab-button::after, .detail-link::after, .evidence::after, .order-button::after, .contact-button::after { border: 0; }
.tabs { position: sticky; z-index: 9; top: calc(100rpx + env(safe-area-inset-top)); background: #f7fbfb; border-bottom: 1rpx solid #e3eded; white-space: nowrap; }
.tab-row { display: flex; align-items: center; padding: 8rpx 18rpx 12rpx; gap: 4rpx; }
.tab-button { display: flex; align-items: center; justify-content: center; flex: 1; min-width: 112rpx; height: 80rpx; margin: 0; padding: 0 4rpx; border-radius: 20rpx; background: transparent; color: $dz-text-secondary; font-size: 22rpx; font-weight: 500; line-height: 1.3; }
.tab-active { color: $dz-brand-deep; background: $dz-brand-soft; font-weight: 700; }
.tab-count { min-width: 24rpx; margin-left: 5rpx; padding: 2rpx 3rpx; border-radius: 10rpx; background: #e7eeee; color: #55686a; font-size: 17rpx; line-height: 1.2; }
.tab-active .tab-count { background: #fff; color: $dz-brand-deep; }
.order-content { padding-top: 26rpx; padding-bottom: 48rpx; }
.list-context { display: flex; align-items: center; justify-content: space-between; margin: 0 4rpx 20rpx; }
.list-title { font-size: 30rpx; font-weight: 700; }
.list-count { color: $dz-text-secondary; font-size: 23rpx; }
.order-card { overflow: hidden; margin-bottom: 24rpx; padding: 0 26rpx; border: 1rpx solid #e0e9e9; border-radius: 28rpx; background: #fff; box-shadow: 0 6rpx 20rpx rgba(22,57,62,.035); }
.card-header { display: flex; align-items: center; justify-content: space-between; min-height: 88rpx; border-bottom: 1rpx solid #edf2f2; }
.order-status { padding: 8rpx 14rpx; border-radius: 12rpx; font-size: 23rpx; font-weight: 600; line-height: 1.3; }
.tone-orange { color: #aa5425; background: #fff2e8; }
.tone-cyan { color: $dz-brand-deep; background: #e7f8f7; }
.tone-green { color: #287b52; background: #eaf6ef; }
.tone-gray { color: #687678; background: #f0f4f4; }
.detail-link { display: flex; align-items: center; justify-content: flex-end; height: 88rpx; min-width: 150rpx; margin: 0; padding: 0; background: transparent; color: $dz-text-secondary; font-size: 23rpx; line-height: 1.3; }
.customer-row { display: flex; align-items: center; gap: 18rpx; padding: 26rpx 0; }
.customer-avatar { display: flex; align-items: center; justify-content: center; flex: none; width: 80rpx; height: 80rpx; border-radius: 24rpx; background: $dz-brand-soft; color: $dz-brand-deep; font-size: 32rpx; font-weight: 600; }
.customer-info { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 6rpx; }
.service-name { font-size: 30rpx; font-weight: 650; line-height: 1.4; }
.customer-name { color: $dz-text-secondary; font-size: 23rpx; overflow-wrap: anywhere; }
.amount { display: flex; flex-direction: column; align-items: flex-end; gap: 6rpx; flex-shrink: 0; }
.amount-caption { color: $dz-text-secondary; font-size: 21rpx; }
.amount-value { color: $dz-text-primary; font-size: 36rpx; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.25; }
.order-meta { display: flex; flex-direction: column; gap: 16rpx; padding-bottom: 24rpx; }
.meta-line { display: flex; align-items: flex-start; gap: 12rpx; }
.meta-icon { width: 28rpx; height: 32rpx; flex: none; opacity: .8; }
.meta-text { flex: 1; min-width: 0; font-size: 24rpx; line-height: 1.5; color: #5c6d73; overflow-wrap: anywhere; }
.meta-time { color: #253a3e; font-weight: 500; }
.contact-line { align-items: center; }
.contact-info { display: flex; flex: 1; min-width: 0; align-items: center; flex-wrap: wrap; column-gap: 8rpx; color: #5c6d73; font-size: 24rpx; line-height: 1.5; }
.contact-person { min-width: 0; overflow-wrap: anywhere; }
.contact-phone-group { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.contact-number { white-space: nowrap; }
/* Compact visible pill, with a larger transparent touch target. */
.contact-button { display: flex; flex: none; align-items: center; justify-content: center; width: 52px; height: 44px; margin: -8px 0; padding: 0; background: transparent; line-height: 1; }
.contact-button-label { display: flex; align-items: center; justify-content: center; width: 100%; height: 28px; border-radius: 8px; background: #e9f6f6; color: #087e87; font-size: 12px; font-weight: 600; white-space: nowrap; }
.note { padding: 16rpx 18rpx; margin-bottom: 20rpx; border-radius: 16rpx; background: #f5f8f8; color: $dz-text-secondary; font-size: 23rpx; line-height: 1.5; }
.evidence { display: flex; align-items: center; width: 100%; min-height: 110rpx; margin: 0 0 22rpx; padding: 14rpx; border-radius: 18rpx; background: #f2f8f7; text-align: left; line-height: 1.4; }
.evidence-photo { width: 80rpx; height: 80rpx; border-radius: 12rpx; flex: none; }
.evidence-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 7rpx; margin: 0 14rpx; }
.evidence-title { color: #23383c; font-size: 24rpx; font-weight: 600; }
.evidence-time { color: $dz-text-secondary; font-size: 21rpx; line-height: 1.5; }
.evidence-link { color: $dz-brand-deep; font-size: 23rpx; white-space: nowrap; }
.evidence-placeholder { display: flex; flex-direction: column; gap: 8rpx; margin-bottom: 22rpx; padding: 20rpx; border-radius: 18rpx; background: #f2f8f7; }
.risk-notice { display: flex; flex-direction: column; gap: 8rpx; padding: 18rpx; margin-bottom: 22rpx; border-radius: 16rpx; background: #fff5e8; }
.risk-title { color: #985b19; font-size: 24rpx; font-weight: 600; }
.risk-copy { color: #8e672f; font-size: 22rpx; line-height: 1.5; }
.card-footer { padding: 22rpx 0 0; border-top: 1rpx solid #edf2f2; }
.progress-copy { display: flex; flex-direction: column; gap: 8rpx; }
.progress-title { font-size: 24rpx; font-weight: 600; line-height: 1.4; }
.progress-detail { color: $dz-text-secondary; font-size: 22rpx; line-height: 1.5; }
.copy-warning { color: #b45c30; }
.action-row { display: flex; gap: 16rpx; margin-top: 22rpx; }
.order-button { display: flex; flex: 1; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 18rpx 14rpx; border-radius: 20rpx; font-size: 15px; font-weight: 600; line-height: 1.4; box-sizing: border-box; }
.primary-button { background: #079caa; color: #fff; }
.button-disabled { opacity: .45; }
.order-number { display: block; padding: 18rpx 0 22rpx; color: #8b989e; font-size: 19rpx; line-height: 1.4; }
.empty-state { display: flex; min-height: 600rpx; flex-direction: column; align-items: center; justify-content: center; }
.empty-icon { display: flex; align-items: center; justify-content: center; width: 108rpx; height: 108rpx; border-radius: 30rpx; background: $dz-brand-soft; }
.empty-image { width: 60rpx; height: 60rpx; }
.empty-title { margin-top: 24rpx; font-size: 30rpx; font-weight: 600; }
.empty-copy { margin-top: 12rpx; color: $dz-text-secondary; font-size: 23rpx; }
</style>
