<template>
  <view class="dz-page dz-page--tabbed provider-orders-page">
    <view class="dz-safe-top" />
    <header class="page-head dz-container">
      <view class="head-spacer" aria-hidden="true" />
      <strong class="strong-text">订单</strong>
      <button class="refresh" aria-label="刷新订单" :disabled="loading" @tap="load">
        <image src="/static/icons/refresh.svg" mode="aspectFit" aria-hidden="true" />
      </button>
    </header>

    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view class="tab-row">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :aria-label="`${tab.label}${tab.count ? `，${tab.count}单` : ''}`"
          :class="{ active: activeTab === tab.key }"
          @tap="activeTab = tab.key"
        >
          {{ tab.label }}<text v-if="tab.count">{{ tab.count }}</text>
        </button>
      </view>
    </scroll-view>

    <main class="dz-container order-content">
      <NetworkState v-if="loading" message="正在加载达人订单…" />
      <NetworkState
        v-else-if="error"
        :message="error"
        action-text="重新加载"
        @action="load"
      />
      <section v-else-if="!visibleOrders.length" class="empty-state">
        <view class="empty-icon" aria-hidden="true">
          <image src="/static/tabbar/order-active.svg" mode="aspectFit" />
        </view>
        <strong class="strong-text">暂无{{ activeLabel }}订单</strong>
        <text>新的订单和履约进度会出现在这里。</text>
      </section>
      <template v-else>
        <section v-for="order in visibleOrders" :key="order.order_no" class="order-card" @tap="openDetail(order)">
          <header>
            <view class="order-status"><i :class="statusTone(order.status)" />{{ statusLabel(order.status) }}</view>
            <view class="order-number">
              <text>{{ order.order_no }}</text>
              <button aria-label="查看订单详情" @tap.stop="openDetail(order)">详情 ›</button>
            </view>
          </header>

          <view class="order-main">
            <view class="customer-avatar">{{ (order.customer_name || '用户').slice(0, 1) }}</view>
            <view class="order-copy">
              <strong class="strong-text">{{ order.customer_name || '预约用户' }} · {{ order.service_name }}</strong>
              <text>◷ {{ timeRange(order.starts_at, order.ends_at) }}</text>
              <text>● {{ addressLabel(order) }}</text>
              <text>☎ {{ order.contact_name }}{{ order.contact_gender_label }} {{ order.contact_phone_display }}</text>
            </view>
            <view class="amount">
              <small>订单金额</small>
              <strong class="strong-text">¥{{ money(order.payable_amount) }}</strong>
            </view>
          </view>

          <view v-if="order.note" class="note">备注：{{ order.note }}</view>
          <button
            v-if="order.arrival_photo_url"
            class="evidence"
            aria-label="查看集合地点照片"
            @tap.stop="previewEvidence(order.arrival_photo_url)"
          >
            <image :src="order.arrival_photo_url" mode="aspectFill" />
            <view>
              <strong class="strong-text">集合地点照片</strong>
              <text>{{ evidenceTime(order) }}</text>
            </view>
            <b>查看 ›</b>
          </button>

          <footer>
            <view class="progress-copy">
              <strong class="strong-text">{{ nextStepTitle(order) }}</strong>
              <text :class="{ expired: isExpired(order) }">{{ nextStepCopy(order) }}</text>
            </view>
            <button
              v-if="actionLabel(order)"
              :class="{ outline: order.status === 'departed' && !order.arrival_photo_url }"
              :disabled="isActionDisabled(order)"
              @tap.stop="performAction(order)"
            >
              {{ busyOrderNo === order.order_no ? busyLabel : actionLabel(order) }}
            </button>
          </footer>
        </section>
      </template>
    </main>

    <ProviderTabBar active="orders" />
  </view>
</template>

<script setup lang="ts">
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

type OrderTab = 'pending_acceptance' | 'pending_service' | 'in_progress' | 'support' | 'completed' | 'all'
type LocationEvidence = { longitude: number; latitude: number; accuracy_m?: number }
type SelectedPhoto = { path: string; file?: unknown }

const orders = ref<ProviderManagedOrder[]>([])
const activeTab = ref<OrderTab>('pending_acceptance')
const loading = ref(true)
const error = ref('')
const busyOrderNo = ref('')
const busyLabel = ref('处理中…')
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
  if (status === 'pending_acceptance') return 'orange'
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
  if (order.status === 'pending_acceptance') return acceptanceCopy(order)
  if (order.status === 'pending_service') return `服务时间 ${shortDate(order.starts_at)}`
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
  return Boolean(busyOrderNo.value || (order.status === 'pending_acceptance' && isExpired(order)))
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
function getCurrentLocation() {
  return new Promise<LocationEvidence>((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: (result) => resolve({
        longitude: Number(result.longitude),
        latitude: Number(result.latitude),
        ...(typeof result.accuracy === 'number' ? { accuracy_m: result.accuracy } : {}),
      }),
      fail: () => reject(new Error('需要开启定位权限，才能留存集合照的上传位置。')),
    })
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
  const confirmed = await confirmAction(
    '确认接受订单',
    `接受后请于 ${timeRange(order.starts_at, order.ends_at)} 按时提供服务。`,
  )
  if (!confirmed) return
  if (await runUpdate(order, '接单中…', () => acceptManagedProviderOrder(order.order_no))) {
    activeTab.value = 'pending_service'
  }
}
async function depart(order: ProviderManagedOrder) {
  const confirmed = await confirmAction('确认出发', '确认后用户将看到“达人已出发”，请按约定前往集合地点。')
  if (!confirmed) return
  if (await runUpdate(order, '更新中…', () => departManagedProviderOrder(order.order_no))) {
    activeTab.value = 'in_progress'
  }
}
async function uploadEvidence(order: ProviderManagedOrder) {
  if (busyOrderNo.value) return
  busyOrderNo.value = order.order_no
  busyLabel.value = '选择照片…'
  try {
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
  const confirmed = await confirmAction('开始服务', '请确认已与用户会合。开始后订单将进入服务中。')
  if (!confirmed) return
  await runUpdate(order, '开始中…', () => startManagedProviderOrder(order.order_no))
}
async function complete(order: ProviderManagedOrder) {
  const confirmed = await confirmAction('提交服务完成', '提交后将等待用户确认，请确保约定服务已经完成。')
  if (!confirmed) return
  await runUpdate(order, '提交中…', () => completeManagedProviderOrder(order.order_no))
}
function performAction(order: ProviderManagedOrder) {
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
.provider-orders-page{min-height:100vh;background:$dz-surface-page}.page-head{position:sticky;z-index:10;top:0;display:flex;align-items:center;justify-content:space-between;height:92rpx;background:#fff}.head-spacer,.page-head>button{width:88rpx;height:88rpx;flex:0 0 88rpx}.page-head>button{display:flex;align-items:center;justify-content:center;margin:0;padding:0;border:0;background:transparent}.page-head button::after,.tabs button::after,.order-card button::after{display:none}.page-head .strong-text{font-size:31rpx}.page-head .refresh image{width:38rpx;height:38rpx}.tabs{position:sticky;z-index:9;top:calc(92rpx + env(safe-area-inset-top));height:88rpx;border-top:1rpx solid $dz-border-subtle;background:#fff;white-space:nowrap}.tab-row{display:flex;min-width:860rpx;height:88rpx}.tab-row button{position:relative;min-width:140rpx;height:88rpx;margin:0;padding:0;border:0;background:#fff;color:$dz-text-secondary;font-size:21rpx;line-height:88rpx}.tab-row button.active{color:$dz-text-primary;font-weight:750}.tab-row button.active::after{position:absolute;right:42rpx;bottom:0;left:42rpx;height:6rpx;border-radius:3rpx;background:$dz-brand-primary;content:''}.tab-row text{display:inline-block;min-width:28rpx;margin-left:5rpx;border-radius:14rpx;color:#fff;background:#ff6d32;font-size:16rpx;line-height:28rpx}.order-content{padding-top:20rpx;padding-bottom:50rpx}.empty-state{display:flex;min-height:600rpx;flex-direction:column;align-items:center;justify-content:center;color:$dz-text-secondary;text-align:center}.empty-icon{display:flex;align-items:center;justify-content:center;width:108rpx;height:108rpx;border-radius:34rpx;background:$dz-brand-soft}.empty-icon image{width:60rpx;height:60rpx}.empty-state .strong-text{margin-top:24rpx;color:$dz-text-primary;font-size:28rpx}.empty-state text{margin-top:10rpx;font-size:20rpx}.order-card{margin-bottom:18rpx;padding:0 22rpx;border-radius:24rpx;background:#fff;box-shadow:$dz-shadow-card}.order-card>header{display:flex;align-items:center;justify-content:space-between;height:72rpx;border-bottom:1rpx solid $dz-border-subtle}.order-status{display:flex;align-items:center;font-size:22rpx;font-weight:750}.order-card>header i{width:14rpx;height:14rpx;margin-right:9rpx;border-radius:50%}.order-card>header i.orange{background:#ff7438}.order-card>header i.cyan{background:$dz-brand-primary}.order-card>header i.green{background:#4fbd70}.order-card>header i.gray{background:$dz-text-tertiary}.order-number{display:flex;align-items:center;gap:10rpx}.order-number>text{color:$dz-text-tertiary;font-size:16rpx}.order-number>button{height:46rpx;margin:0;padding:0 8rpx;border:0;color:$dz-brand-deep;background:transparent;font-size:18rpx;line-height:46rpx}.order-main{display:flex;align-items:flex-start;padding:22rpx 0}.customer-avatar{display:flex;align-items:center;justify-content:center;width:88rpx;height:88rpx;flex:none;border-radius:20rpx;color:$dz-brand-deep;background:$dz-brand-soft;font-size:31rpx}.order-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:8rpx;margin-left:16rpx}.order-copy .strong-text{font-size:23rpx}.order-copy text{overflow:hidden;color:$dz-text-secondary;font-size:18rpx;text-overflow:ellipsis;white-space:nowrap}.amount{display:flex;flex-direction:column;align-items:flex-end;gap:8rpx;margin-left:10rpx}.amount small{color:$dz-text-tertiary;font-size:16rpx}.amount .strong-text{color:$dz-price-primary;font-size:28rpx}.note{margin-bottom:18rpx;padding:13rpx 16rpx;border-radius:12rpx;color:$dz-text-secondary;background:#f7f9fa;font-size:18rpx}.evidence{display:flex;align-items:center;width:100%;min-height:90rpx;margin:0 0 16rpx;padding:12rpx;border:0;border-radius:16rpx;background:#f1fbfa;text-align:left}.evidence image{width:70rpx;height:70rpx;flex:none;border-radius:12rpx}.evidence view{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx;margin-left:14rpx}.evidence .strong-text{font-size:20rpx}.evidence text{color:$dz-text-secondary;font-size:17rpx}.evidence b{color:$dz-brand-deep;font-size:18rpx;font-weight:650}.order-card>footer{display:flex;align-items:center;justify-content:space-between;min-height:120rpx;border-top:1rpx solid $dz-border-subtle}.progress-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx;padding:12rpx 10rpx 12rpx 0}.progress-copy .strong-text{font-size:19rpx}.progress-copy text{color:$dz-text-secondary;font-size:17rpx}.progress-copy text.expired{color:#e7653d}.order-card>footer button{min-width:176rpx;height:88rpx;margin:0;padding:0 24rpx;border:0;border-radius:44rpx;color:#fff;background:$dz-gradient-brand;font-size:20rpx;line-height:88rpx}.order-card>footer button:active{opacity:.78;transform:scale(.98)}.order-card>footer button[disabled]{opacity:.45}.order-card>footer button.outline{border:1rpx solid $dz-brand-primary;color:$dz-brand-deep;background:#fff}
</style>
