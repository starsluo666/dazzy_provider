<template>
  <view class="dz-page dz-page--tabbed dz-management-page provider-orders-page">
    <view class="dz-sticky-head">
      <view class="dz-safe-top" />
      <header class="page-head dz-container">
        <view class="head-spacer" aria-hidden="true" />
        <strong class="strong-text">达人订单</strong>
        <button class="refresh" aria-label="刷新订单" :disabled="loading" hover-class="dz-pressed" @tap="load">
          <image src="/static/icons/refresh.svg" mode="aspectFit" aria-hidden="true" />
        </button>
      </header>
    </view>

    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view class="tab-row">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :aria-label="`${tab.label}${tab.count ? `，${tab.count}单` : ''}`"
          :class="{ active: activeTab === tab.key }"
          class="dz-tappable"
          hover-class="dz-pressed"
          @tap="activeTab = tab.key"
        >
          {{ tab.label }}<text v-if="tab.count">{{ tab.count }}</text>
        </button>
      </view>
    </scroll-view>

    <main class="dz-container order-content">
      <view v-if="!loading && !error" class="list-context">
        <view>
          <text>当前视图</text>
          <strong class="strong-text">{{ activeLabel }}</strong>
        </view>
        <text>{{ visibleOrders.length }} 笔订单</text>
      </view>
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
        <section v-for="order in visibleOrders" :key="order.order_no" class="order-card dz-tappable" hover-class="dz-pressed" @tap="openDetail(order)">
          <header>
            <view class="order-status" :class="statusTone(order.status)"><i :class="statusTone(order.status)" />{{ statusLabel(order.status) }}</view>
            <view class="order-number">
              <text>{{ order.order_no }}</text>
              <button aria-label="查看订单详情" @tap.stop="openDetail(order)">详情 ›</button>
            </view>
          </header>

          <view class="order-main">
            <view class="customer-avatar">{{ (order.customer_name || '用户').slice(0, 1) }}</view>
            <view class="order-copy">
              <strong class="strong-text">{{ order.customer_name || '预约用户' }} · {{ order.service_name }}</strong>
              <view class="meta-line"><image src="/static/icons/calendar.svg" mode="aspectFit" /><text>{{ timeRange(order.starts_at, order.ends_at) }}</text></view>
              <view class="meta-line"><image src="/static/icons/location.svg" mode="aspectFit" /><text>{{ addressLabel(order) }}</text></view>
              <view class="meta-line"><image src="/static/icons/phone.svg" mode="aspectFit" /><text>{{ order.contact_name }}{{ order.contact_gender_label }} {{ order.contact_phone_display }}</text></view>
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
              hover-class="dz-pressed"
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
    `必须由账号实名认证本人接单并提供服务，禁止代接、转单或由他人替代。确认由本人于 ${timeRange(order.starts_at, order.ends_at)} 按时提供服务吗？`,
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
.provider-orders-page{min-height:100vh;background:linear-gradient(180deg,#f7fbfb 0,#f1f6f6 100%)}.page-head{position:sticky;z-index:10;top:0;display:flex;align-items:center;justify-content:space-between;height:92rpx;background:$dz-surface-glass-strong}.head-spacer,.page-head>button{width:88rpx;height:88rpx;flex:0 0 88rpx}.page-head>button{display:flex;align-items:center;justify-content:center;margin:0;padding:0;border:0;background:transparent}.page-head button::after,.tabs button::after,.order-card button::after{display:none}.page-head .strong-text{font-size:31rpx;letter-spacing:-.015em}.page-head .refresh image{width:38rpx;height:38rpx}.tabs{position:sticky;z-index:9;top:calc(92rpx + env(safe-area-inset-top));height:84rpx;background:$dz-surface-glass-strong;white-space:nowrap}.tab-row{display:flex;min-width:846rpx;height:84rpx;align-items:center;gap:8rpx;padding:8rpx 24rpx 12rpx}.tab-row button{min-width:126rpx;height:58rpx;margin:0;padding:0 14rpx;border:0;border-radius:29rpx;color:$dz-text-secondary;background:transparent;font-size:20rpx;line-height:58rpx}.tab-row button.active{color:$dz-brand-deep;background:$dz-brand-soft;font-weight:750}.tab-row text{display:inline-block;min-width:28rpx;margin-left:6rpx;border-radius:14rpx;color:#fff;background:$dz-orange;font-size:16rpx;line-height:28rpx}.order-content{padding-top:22rpx;padding-bottom:50rpx}.empty-state{display:flex;min-height:600rpx;flex-direction:column;align-items:center;justify-content:center;color:$dz-text-secondary;text-align:center}.empty-icon{display:flex;align-items:center;justify-content:center;width:108rpx;height:108rpx;border-radius:30rpx;background:$dz-brand-soft}.empty-icon image{width:60rpx;height:60rpx}.empty-state .strong-text{margin-top:24rpx;color:$dz-text-primary;font-size:28rpx}.empty-state text{margin-top:10rpx;font-size:20rpx}.order-card{overflow:hidden;margin-bottom:20rpx;padding:0 22rpx;border:1rpx solid rgba(218,229,230,.92);border-radius:26rpx;background:rgba(255,255,255,.97);box-shadow:$dz-shadow-soft}.order-card>header{display:flex;align-items:center;justify-content:space-between;height:74rpx;border-bottom:1rpx solid $dz-border-subtle}.order-status{display:flex;align-items:center;font-size:22rpx;font-weight:750}.order-card>header i{width:14rpx;height:14rpx;margin-right:9rpx;border-radius:50%}.order-card>header i.orange{background:#ff7438}.order-card>header i.cyan{background:$dz-brand-primary}.order-card>header i.green{background:#4fbd70}.order-card>header i.gray{background:$dz-text-tertiary}.order-number{display:flex;align-items:center;gap:10rpx}.order-number>text{color:$dz-text-tertiary;font-size:16rpx}.order-number>button{height:46rpx;margin:0;padding:0 8rpx;border:0;color:$dz-brand-deep;background:transparent;font-size:18rpx;line-height:46rpx}.order-main{display:flex;align-items:flex-start;padding:24rpx 0 22rpx}.customer-avatar{display:flex;width:84rpx;height:96rpx;flex:none;align-items:center;justify-content:center;border-radius:19rpx;color:$dz-brand-deep;background:$dz-brand-soft;font-size:31rpx;font-weight:700}.order-copy{display:flex;min-width:0;gap:8rpx;margin-left:16rpx;flex:1;flex-direction:column}.order-copy .strong-text{font-size:23rpx;letter-spacing:-.01em}.meta-line{display:flex;min-width:0;align-items:center}.meta-line image{width:24rpx;height:24rpx;flex:none;margin-right:7rpx;opacity:.82}.meta-line text{overflow:hidden;color:$dz-text-secondary;font-size:18rpx;text-overflow:ellipsis;white-space:nowrap}.amount{display:flex;align-items:flex-end;gap:8rpx;margin-left:10rpx;flex-direction:column}.amount small{color:$dz-text-tertiary;font-size:16rpx}.amount .strong-text{color:$dz-price-primary;font-size:28rpx;letter-spacing:-.02em}.note{margin-bottom:18rpx;padding:13rpx 16rpx;border-radius:12rpx;color:$dz-text-secondary;background:#f7f9fa;font-size:18rpx}.evidence{display:flex;align-items:center;width:100%;min-height:90rpx;margin:0 0 16rpx;padding:12rpx;border:0;border-radius:16rpx;background:#f1fbfa;text-align:left}.evidence image{width:70rpx;height:70rpx;flex:none;border-radius:12rpx}.evidence view{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx;margin-left:14rpx}.evidence .strong-text{font-size:20rpx}.evidence text{color:$dz-text-secondary;font-size:17rpx}.evidence b{color:$dz-brand-deep;font-size:18rpx;font-weight:650}.order-card>footer{display:flex;align-items:center;justify-content:space-between;min-height:116rpx;border-top:1rpx solid $dz-border-subtle}.progress-copy{display:flex;min-width:0;gap:5rpx;padding:12rpx 10rpx 12rpx 0;flex:1;flex-direction:column}.progress-copy .strong-text{font-size:19rpx}.progress-copy text{color:$dz-text-secondary;font-size:17rpx}.progress-copy text.expired{color:#e7653d}.order-card>footer button{min-width:176rpx;height:76rpx;margin:0;padding:0 24rpx;border:0;border-radius:$dz-radius-control;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control;font-size:20rpx;line-height:76rpx;transition:transform $dz-duration-fast $dz-ease-out,opacity $dz-duration-fast ease}.order-card>footer button:active{opacity:.78;transform:scale(.97)}.order-card>footer button[disabled]{opacity:.45;box-shadow:none}.order-card>footer button.outline{border:1rpx solid $dz-brand-primary;color:$dz-brand-deep;background:#fff;box-shadow:none}

.provider-orders-page { background: radial-gradient(circle at 90% 0, rgba(81,220,216,.15) 0, rgba(81,220,216,0) 330rpx), linear-gradient(180deg,#f6fbfb 0,#f1f6f6 100%); }
.page-head { border-bottom: 1rpx solid rgba(214,230,231,.55); }
.tabs { border-bottom: 1rpx solid rgba(210,226,227,.72); box-shadow: 0 9rpx 24rpx rgba(29,70,74,.04); }
.tab-row { gap: 10rpx; }
.tab-row button { border: 1rpx solid transparent; transition: color $dz-duration-fast ease, background $dz-duration-fast ease, transform $dz-duration-fast $dz-ease-out; }
.tab-row button.active { border-color: rgba(17,193,196,.14); background: rgba(255,255,255,.92); box-shadow: 0 6rpx 18rpx rgba(25,75,79,.07); }
.list-context { display: flex; align-items: flex-end; justify-content: space-between; margin: 2rpx 4rpx 18rpx; }
.list-context>view { display: flex; gap: 4rpx; flex-direction: column; }
.list-context view>text { color: $dz-text-tertiary; font-size: 16rpx; }
.list-context .strong-text { font-size: 27rpx; letter-spacing: -.015em; }
.list-context>text { padding: 8rpx 13rpx; border: 1rpx solid rgba(17,193,196,.1); border-radius: 999rpx; color: $dz-brand-deep; background: rgba(230,249,248,.72); font-size: 17rpx; }
.order-card { margin-bottom: 22rpx; border-color: rgba(214,226,227,.9); border-radius: 31rpx; background: #fff; box-shadow: 0 2rpx 2rpx rgba(23,57,61,.025), 0 16rpx 42rpx rgba(27,71,75,.075); }
.order-card>header { height: 78rpx; }
.order-status { padding: 8rpx 13rpx; border-radius: 999rpx; font-size: 19rpx; }
.order-status.orange { color: #b95725; background: #fff1e8; }
.order-status.cyan { color: $dz-brand-deep; background: $dz-brand-pale; }
.order-status.green { color: #287a4b; background: #eaf8ef; }
.order-status.gray { color: #697679; background: #f0f4f4; }
.order-card>header i { width: 11rpx; height: 11rpx; margin-right: 8rpx; }
.customer-avatar { border: 2rpx solid rgba(255,255,255,.92); border-radius: 23rpx; box-shadow: 0 9rpx 23rpx rgba(24,83,87,.09); }
.order-copy .strong-text { font-size: 24rpx; }
.amount { min-width: 112rpx; padding: 10rpx 12rpx; border-radius: 17rpx; background: #fff7ef; }
.amount .strong-text { font-size: 27rpx; }
.note { border: 1rpx solid rgba(220,228,229,.7); border-radius: 16rpx; background: #f8fafa; }
.evidence { border: 1rpx solid rgba(17,193,196,.11); border-radius: 19rpx; }
.order-card>footer { margin: 0 -22rpx; padding: 0 22rpx; border-top-color: rgba(218,229,230,.75); background: #fbfdfd; }
.order-card>footer button { border-radius: 999rpx; background: $dz-gradient-brand; }
.order-card>footer button.outline { background: #fff; }
.provider-orders-page { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif; }
.page-head .strong-text { font-size: 32rpx; line-height: 1.15; }
.tab-row button { font-size: 21rpx; font-weight: 560; }
.tab-row text { font-variant-numeric: tabular-nums; font-weight: 700; }
.list-context view>text { font-size: 17rpx; letter-spacing: .02em; }
.list-context .strong-text { font-size: 28rpx; line-height: 1.15; }
.list-context>text { font-variant-numeric: tabular-nums; }
.order-status { font-size: 20rpx; font-weight: 700; line-height: 1.2; }
.order-number>text { font-size: 17rpx; letter-spacing: .015em; }
.order-number>button { font-size: 19rpx; }
.order-copy .strong-text { font-size: 25rpx; line-height: 1.28; }
.meta-line text { font-size: 19rpx; line-height: 1.35; }
.amount small { font-size: 17rpx; }
.amount .strong-text { font-size: 30rpx; line-height: 1; font-variant-numeric: tabular-nums; }
.progress-copy .strong-text { font-size: 20rpx; line-height: 1.25; }
.progress-copy text { font-size: 18rpx; line-height: 1.45; }
.order-card>footer button { font-size: 21rpx; font-weight: 700; }
/* #ifdef H5 */
.page-head,.tabs{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
@media (prefers-reduced-motion: reduce) {
  .tab-row button, .order-card>footer button { transition: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .page-head, .tabs { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
/* #endif */

/* 达人订单重设计：完整展示全部筛选，放大任务信息，收敛装饰层。 */
.provider-orders-page{background:linear-gradient(180deg,#edfafa 0,#f5f9f9 350rpx,#f2f6f6 100%)}
.page-head{height:100rpx;border-bottom:0;background:rgba(248,252,252,.95)}.head-spacer,.page-head>button{width:92rpx;height:84rpx;flex-basis:92rpx}.page-head .strong-text{font-size:34rpx;letter-spacing:0}.page-head .refresh image{width:42rpx;height:42rpx}
.tabs{top:calc(100rpx + env(safe-area-inset-top));height:94rpx;border-bottom:1rpx solid rgba(214,230,231,.58);background:rgba(248,252,252,.95);box-shadow:0 10rpx 26rpx rgba(29,70,74,.045)}.tab-row{display:grid;width:100%;min-width:0;height:94rpx;gap:4rpx;padding:9rpx 18rpx 11rpx;grid-template-columns:repeat(6,minmax(0,1fr))}.tab-row button{min-width:0;width:100%;height:70rpx;padding:0 2rpx;border:0;border-radius:18rpx;font-size:21rpx;font-weight:600;line-height:70rpx}.tab-row button.active{border:0;color:$dz-brand-deep;background:rgba(221,248,247,.92);box-shadow:none}.tab-row text{min-width:25rpx;height:25rpx;margin-left:4rpx;border-radius:13rpx;font-size:15rpx;line-height:25rpx;vertical-align:2rpx}
.order-content{padding-top:24rpx;padding-bottom:58rpx}.list-context{align-items:center;margin:0 4rpx 18rpx}.list-context>view{gap:0}.list-context view>text{display:none}.list-context .strong-text{font-size:30rpx}.list-context>text{padding:0;border:0;background:transparent;font-size:21rpx;font-variant-numeric:tabular-nums}
.order-card{margin-bottom:22rpx;padding:0 24rpx;border:1rpx solid rgba(218,229,230,.88);border-radius:28rpx;background:rgba(255,255,255,.97);box-shadow:$dz-shadow}.order-card>header{height:82rpx}.order-status{padding:6rpx 12rpx;font-size:22rpx}.order-number{gap:8rpx}.order-number>text{font-size:18rpx}.order-number>button{height:58rpx;padding:0 6rpx;font-size:22rpx;line-height:58rpx}
.order-main{padding:26rpx 0 24rpx}.customer-avatar{width:92rpx;height:104rpx;border:0;border-radius:24rpx;font-size:34rpx;box-shadow:none}.order-copy{gap:10rpx;margin-left:18rpx}.order-copy .strong-text{font-size:27rpx;line-height:1.35}.meta-line image{width:28rpx;height:28rpx;margin-right:8rpx}.meta-line text{font-size:21rpx;line-height:1.45}.amount{min-width:120rpx;gap:8rpx;margin-left:10rpx;padding:12rpx 14rpx;border-radius:20rpx;background:#fff5ed}.amount small{font-size:18rpx}.amount .strong-text{font-size:32rpx;line-height:1;white-space:nowrap}
.note{margin-bottom:20rpx;padding:16rpx 18rpx;border:0;border-radius:18rpx;background:#f3f7f7;font-size:21rpx;line-height:1.5}.evidence{min-height:104rpx;margin-bottom:18rpx;padding:14rpx;border-radius:20rpx}.evidence image{width:78rpx;height:78rpx;border-radius:15rpx}.evidence view{gap:6rpx;margin-left:16rpx}.evidence .strong-text{font-size:23rpx}.evidence text,.evidence b{font-size:20rpx}
.order-card>footer{min-height:130rpx;margin:0 -24rpx;padding:0 24rpx;background:#fbfdfd}.progress-copy{gap:7rpx;padding-right:14rpx}.progress-copy .strong-text{font-size:23rpx}.progress-copy text{font-size:20rpx;line-height:1.45}.order-card>footer button{min-width:184rpx;height:82rpx;padding:0 24rpx;border-radius:24rpx;background:$dz-brand;font-size:23rpx;line-height:82rpx}
.empty-state .strong-text{font-size:31rpx}.empty-state text{font-size:23rpx}
</style>
