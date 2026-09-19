<template>
  <view class="dz-page dz-page--tabbed workbench-page">
    <view class="ambient ambient-one" aria-hidden="true" />
    <view class="ambient ambient-two" aria-hidden="true" />
    <view class="dz-safe-top" />

    <main class="dz-container workbench-content">
      <NetworkState v-if="loading" loading message="正在加载工作台…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />

      <template v-else-if="data">
        <header class="identity-head">
          <view class="avatar">
            <image v-if="avatarUrl" :src="avatarUrl" mode="aspectFill" />
            <text v-else>{{ (data.nickname || '达').slice(0, 1) }}</text>
          </view>
          <view class="identity-copy">
            <view class="identity-name-row">
              <strong class="strong-text">{{ data.nickname || '达人' }}</strong>
              <view class="identity-badge"><image src="/static/icons/check.svg" mode="aspectFit" /><text>{{ data.identity_status_label }}</text></view>
            </view>
            <text class="identity-meta">达人工作台 · 今日状态已同步</text>
          </view>
        </header>

        <section v-if="!data.can_accept_orders" class="onboarding-card">
          <view class="onboarding-head"><view><text>接单准备</text><strong class="strong-text">还差 {{ data.onboarding_blockers.length }} 项</strong></view><text>{{ onboardingProgress }}</text></view>
          <view class="onboarding-steps">
            <button class="dz-tappable" :class="{done:data.identity_status==='verified'}" hover-class="dz-pressed" @tap="openIdentity"><i>{{data.identity_status==='verified'?'✓':'1'}}</i><view><strong>实名认证</strong><text>{{identityStepCopy}}</text></view><b>›</b></button>
            <button class="dz-tappable" :class="{done:data.is_profile_complete}" hover-class="dz-pressed" @tap="openProviderProfile"><i>{{data.is_profile_complete?'✓':'2'}}</i><view><strong>完善达人资料</strong><text>生活照、简介和服务城市</text></view><b>›</b></button>
            <button class="dz-tappable" :class="{done:!data.onboarding_blockers.some(item=>item.includes('服务'))}" hover-class="dz-pressed" @tap="openServices"><i>{{!data.onboarding_blockers.some(item=>item.includes('服务'))?'✓':'3'}}</i><view><strong>配置服务</strong><text>至少添加并启用一项服务</text></view><b>›</b></button>
          </view>
        </section>

        <section class="online-hero" :class="{ offline: !data.is_online }">
          <view class="online-main">
            <view class="online-check">
              <image v-if="data.is_online" src="/static/icons/feature-status.svg" mode="aspectFit" />
              <image v-else class="offline-art" src="/static/icons/status-offline.svg" mode="aspectFit" aria-hidden="true" />
            </view>
            <view class="online-copy">
              <strong class="strong-text">{{ data.is_online ? '在线接单中' : '当前已离线' }}</strong>
              <text class="online-helper">{{ onlineHelper }}</text>
            </view>
            <switch
              class="online-switch"
              :checked="data.is_online"
              :disabled="toggling || !data.can_accept_orders"
              color="#11C1C4"
              aria-label="在线接单开关"
              @change="toggleOnline"
            />
          </view>
          <view class="location-line">
            <view class="location-pulse" aria-hidden="true" />
            <text>{{ locationStatus }}</text>
          </view>
          <view v-if="locationWarning" class="location-warning" role="status">{{ locationWarning }}</view>
        </section>

        <section class="business-card">
          <view class="business-head"><h2>本月经营</h2><text>近 7 日趋势</text></view>
          <view class="metrics-grid">
            <view class="metric revenue">
              <view class="metric-head"><text>本月营业额</text><view class="metric-icon"><image src="/static/icons/income.svg" mode="aspectFit" /></view></view>
              <strong class="strong-text">¥{{ formatAmount(data.month_income_amount) }}</strong>
              <ServiceTrendChart compact :items="trendItems" />
            </view>
            <view class="metric order-metric">
              <view class="metric-head"><text>月订单数</text><view class="metric-icon"><image src="/static/icons/orders.svg" mode="aspectFit" /></view></view>
              <view class="metric-value-row">
                <strong class="strong-text">{{ data.month_order_count }}</strong>
                <text class="metric-unit">单</text>
              </view>
            </view>
            <view class="metric hours-metric">
              <view class="metric-head"><text>服务小时数</text><view class="metric-icon"><image src="/static/icons/service.svg" mode="aspectFit" /></view></view>
              <view class="metric-value-row">
                <strong class="strong-text">{{ formatHours(data.month_service_hours) }}</strong>
                <text class="metric-unit">小时</text>
              </view>
            </view>
          </view>
        </section>

        <section class="next-order dz-tappable" role="button" aria-label="查看下一单" hover-class="dz-pressed" @tap="openUpcomingOrder">
          <view v-if="data.upcoming_order" class="next-copy">
            <view class="next-head">
              <view class="section-label"><strong class="strong-text">下一单</strong></view>
              <view class="next-time">{{ orderDateLabel(data.upcoming_order.starts_at) }} {{ timeRange(data.upcoming_order.starts_at, data.upcoming_order.ends_at) }}</view>
            </view>
            <view class="next-main">
              <view class="travel-shell"><image class="travel-art" src="/static/icons/feature-service.svg" mode="aspectFit" aria-hidden="true" /></view>
              <view class="order-summary">
                <h2>{{ data.upcoming_order.service_name }} · {{ customerLabel }}</h2>
                <text>订单服务即将开始</text>
              </view>
              <button class="order-button" @tap.stop="openUpcomingOrder"><text>查看</text><b aria-hidden="true">›</b></button>
            </view>
            <view class="order-meta"><image src="/static/icons/location.svg" mode="aspectFit" /><text>集合地点：{{ data.upcoming_order.meeting_location_name }}</text></view>
          </view>
          <view v-else class="next-copy empty-next">
            <view class="section-label"><strong class="strong-text">下一单</strong></view>
            <h2>暂无待服务订单</h2>
            <text>保持在线，新的预约会及时出现在这里。</text>
          </view>
        </section>

        <button class="pending-row" @tap="openPending">
          <view class="bell" aria-hidden="true" />
          <text>待处理：<strong class="strong-text">{{ data.pending_acceptance_order_count }}</strong> 个待接订单、<strong class="strong-text">{{ unreadCount }}</strong> 条未读消息</text>
          <b aria-hidden="true">›</b>
        </button>
      </template>
    </main>

    <FloatingAlarm v-if="data" compact :disabled="alarming" @alarm="confirmAlarm" />
    <ProviderTabBar active="workbench" />
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import FloatingAlarm from '@/components/FloatingAlarm.vue'
import ProviderTabBar from '@/components/ProviderTabBar.vue'
import ServiceTrendChart from '@/components/ServiceTrendChart.vue'
import {
  getCurrentProviderLocation,
  isReportingSession,
  refreshLocationReporting,
  startLocationReporting,
  stopLocationReporting,
} from '@/services/locationReporter'
import { getNotificationSummary } from '@/services/notifications'
import {
  getProviderWorkbench,
  startProviderOnline,
  stopProviderOnline,
  updateProviderOnlineLocation,
} from '@/services/providers'
import { guardCurrentPage } from '@/services/session'
import type { ProviderOnlineSession, ProviderWorkbench } from '@/types/api'
import { formatAmount, getErrorMessage } from '@/utils/formatters'
import { businessClock, businessDateKey, businessTimeParts } from '@/utils/businessTime'

const data = ref<ProviderWorkbench | null>(null)
const loading = ref(true)
const error = ref('')
const toggling = ref(false)
const alarming = ref(false)
const locationWarning = ref('')
const unreadCount = ref(0)
let observedOrderUnread: number | null = null
let notificationTimer: ReturnType<typeof setInterval> | null = null

const avatarUrl = computed(() => typeof data.value?.avatar_url === 'string' ? data.value.avatar_url : '')
const onboardingProgress = computed(() => data.value?.identity_status === 'verified' ? '继续完善即可开启接单' : '完成后开放在线接单')
const identityStepCopy = computed(() => {
  if (data.value?.identity_status === 'pending') return '资料审核中'
  if (data.value?.identity_status === 'rejected') return '未通过，请修改后重试'
  return data.value?.identity_status === 'verified' ? '身份核验已通过' : '提交实名信息与认证材料'
})

const trendItems = computed(() => data.value?.last_7_days_service_trend || [])
const customerLabel = computed(() => {
  const order = data.value?.upcoming_order
  if (!order) return ''
  return `${order.customer_name || '预约用户'}${order.customer_gender_label || ''}`
})
const onlineHelper = computed(() => {
  if (!data.value?.can_accept_orders) return data.value?.onboarding_blockers[0] || '请先完成接单准备'
  if (data.value?.admin_order_restricted) return data.value.admin_restriction_reason || '平台当前限制接单，请联系客服处理'
  if (data.value?.is_online && data.value.online_timeout_minutes === 0) return '保持在线，系统使用最近一次位置；停止接单时请手动下线'
  return data.value?.is_online ? '保持在线，系统将为您推荐附近订单' : '开启后将获取定位并推荐附近订单'
})
const locationStatus = computed(() => {
  if (!data.value?.location_updated_at) return data.value?.is_online ? '正在获取定位' : '定位未开启'
  const state = data.value.is_online
    ? data.value.online_timeout_minutes === 0 ? '使用最近位置' : '定位正常'
    : '定位已失效'
  return `${state} · ${relativeTime(data.value.location_updated_at)}`
})

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return '刚刚更新'
  if (minutes < 60) return `${minutes}分钟前更新`
  return `${Math.floor(minutes / 60)}小时前更新`
}
function timeRange(startsAt: string, endsAt: string) {
  return `${businessClock(startsAt)}–${businessClock(endsAt)}`
}
function orderDateLabel(value: string) {
  const date = businessTimeParts(value)
  return businessDateKey(value) === businessDateKey() ? '今天' : `${date.month}月${date.day}日`
}

function applySession(session: ProviderOnlineSession) {
  if (!data.value) return
  Object.assign(data.value, session)
}

function reporterCallbacks() {
  return {
    onError: (message: string) => { locationWarning.value = message },
    onReported: () => {
      locationWarning.value = ''
      if (data.value) data.value.location_updated_at = new Date().toISOString()
    },
  }
}

async function beginReporter(session: ProviderOnlineSession, initialLocation: Awaited<ReturnType<typeof getCurrentProviderLocation>>) {
  if (!session.session_id) throw new Error('接单会话创建失败，请重试')
  const mode = await startLocationReporting({
    sessionId: session.session_id,
    intervalSeconds: session.recommended_report_interval_seconds,
    initialLocation,
    ...reporterCallbacks(),
  })
  if (mode === 'foreground') {
    locationWarning.value = session.online_timeout_minutes === 0
      ? '当前为前台定位，离开小程序后位置将停止更新；停止接单时请手动下线'
      : '当前为前台定位，离开小程序后可能自动离线'
  }
  if (mode === 'polling') locationWarning.value = '当前设备不支持持续定位，将按间隔刷新位置'
}

async function resumeReporter() {
  if (!data.value?.is_online || !data.value.session_id) return
  try {
    if (isReportingSession(data.value.session_id)) {
      await refreshLocationReporting(data.value.session_id)
      return
    }
    const location = await getCurrentProviderLocation()
    const session = (await updateProviderOnlineLocation(data.value.session_id, location)).data
    applySession(session)
    await beginReporter(session, location)
  } catch (reason) {
    const fallback = data.value.online_timeout_minutes === 0
      ? '定位恢复失败，当前继续使用最近一次位置；请尽快恢复定位或手动下线'
      : `定位恢复失败，${data.value.online_timeout_minutes}分钟未更新将自动离线`
    locationWarning.value = getErrorMessage(reason, fallback)
  }
}

async function toggleOnline(event: Event) {
  if (!data.value || toggling.value) return
  const enabled = Boolean((event as CustomEvent<{ value: boolean }>).detail.value)
  toggling.value = true
  locationWarning.value = ''
  try {
    if (enabled) {
      const location = await getCurrentProviderLocation()
      const session = (await startProviderOnline(location)).data
      applySession(session)
      await beginReporter(session, location)
      uni.showToast({ title: '已开启在线接单', icon: 'success' })
    } else {
      const session = (await stopProviderOnline()).data
      stopLocationReporting()
      applySession(session)
      uni.showToast({ title: '已停止接单', icon: 'none' })
    }
  } catch (reason) {
    await load(false)
    uni.showToast({ title: getErrorMessage(reason), icon: 'none' })
  } finally {
    toggling.value = false
  }
}

function openUpcomingOrder() {
  if (!data.value?.upcoming_order) return
  uni.navigateTo({ url: `/pages/orders/index?orderNo=${encodeURIComponent(data.value.upcoming_order.order_no)}` })
}
function openPending() {
  if (data.value?.pending_acceptance_order_count) {
    uni.navigateTo({ url: '/pages/orders/index' })
    return
  }
  uni.navigateTo({ url: '/pages/messages/index' })
}
function openIdentity(){ uni.navigateTo({url:'/pages/identity/index'}) }
function openProviderProfile(){ uni.navigateTo({url:'/pages/provider-profile/index'}) }
function openServices(){ uni.navigateTo({url:'/pages/services/index'}) }

function confirmAlarm() {
  if (alarming.value) return
  uni.showModal({
    title: '确认紧急报警？',
    content: '系统会先刷新并同步当前位置，然后拨打 110。非紧急情况请勿使用。',
    confirmText: '确认报警',
    confirmColor: '#FF3E46',
    success: async (result) => {
      if (!result.confirm) return
      alarming.value = true
      uni.showLoading({ title: '正在同步位置' })
      try {
        const location = await getCurrentProviderLocation()
        if (data.value?.session_id) await updateProviderOnlineLocation(data.value.session_id, location)
      } catch {
        uni.showToast({ title: '位置同步失败，将继续拨打报警电话', icon: 'none' })
      } finally {
        uni.hideLoading()
        alarming.value = false
        uni.makePhoneCall({ phoneNumber: '110' })
      }
    },
  })
}

async function load(showLoading = true) {
  if (showLoading) loading.value = true
  error.value = ''
  try {
    data.value = (await getProviderWorkbench()).data
    await resumeReporter()
  } catch (reason) {
    error.value = getErrorMessage(reason, '工作台加载失败')
  } finally {
    loading.value = false
  }
}

async function refreshNotificationSummary(announce = false) {
  try {
    const summary = (await getNotificationSummary()).data
    const orderUnread = summary.category_unread.order || 0
    if (announce && observedOrderUnread !== null && orderUnread > observedOrderUnread) {
      uni.showToast({ title: '收到新的待接订单', icon: 'none', duration: 2500 })
      void load(false)
    }
    observedOrderUnread = orderUnread
    unreadCount.value = summary.unread
  } catch {}
}

function startNotificationPolling() {
  if (notificationTimer) clearInterval(notificationTimer)
  notificationTimer = setInterval(() => { void refreshNotificationSummary(true) }, 30000)
}

function stopNotificationPolling() {
  if (!notificationTimer) return
  clearInterval(notificationTimer)
  notificationTimer = null
}

onShow(() => {
  if (!guardCurrentPage()) return
  void load()
  void refreshNotificationSummary(false)
  startNotificationPolling()
})
onHide(stopNotificationPolling)
onUnmounted(stopNotificationPolling)
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.workbench-page{position:relative;overflow:hidden;background:linear-gradient(180deg,#effafa 0,#f8fbfb 360rpx,#f4f8f8 100%)}.workbench-content{position:relative;z-index:1;padding-top:22rpx;padding-bottom:32rpx;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif}.ambient{position:absolute;border-radius:50%;background:rgba(104,222,220,.1);filter:blur(1rpx);pointer-events:none}.ambient-one{top:20rpx;right:-120rpx;width:390rpx;height:390rpx}.ambient-two{top:155rpx;right:26rpx;width:180rpx;height:180rpx;border:32rpx solid rgba(255,255,255,.38);background:transparent}
.identity-head{display:flex;align-items:center;min-height:148rpx;padding:8rpx 10rpx}.avatar{display:flex;overflow:hidden;width:100rpx;height:116rpx;align-items:center;justify-content:center;border:3rpx solid rgba(255,255,255,.92);border-radius:25rpx;color:$dz-brand-deep;background:$dz-brand-soft;box-shadow:0 10rpx 28rpx rgba(31,76,82,.1);font-size:38rpx;font-weight:750}.avatar image{width:100%;height:100%}.identity-copy{display:flex;gap:10rpx;margin-left:22rpx;flex-direction:column}.identity-copy>.strong-text{font-size:38rpx;line-height:1.08;letter-spacing:-.02em}.identity-copy>view{display:flex;align-items:center;color:$dz-brand-deep;font-size:22rpx;font-weight:550}.identity-copy image{width:32rpx;height:32rpx;margin-right:8rpx}
.onboarding-card{margin:14rpx 0 24rpx;padding:25rpx;border:1rpx solid #bdeae8;border-radius:29rpx;background:rgba(255,255,255,.94);box-shadow:$dz-shadow-soft}.onboarding-head{display:flex;align-items:flex-end;justify-content:space-between}.onboarding-head>view{display:flex;gap:6rpx;flex-direction:column}.onboarding-head>view>text{color:$dz-brand;font-size:19rpx;font-weight:700}.onboarding-head strong{font-size:28rpx}.onboarding-head>text{color:$dz-text-tertiary;font-size:18rpx}.onboarding-steps{margin-top:18rpx}.onboarding-steps button{display:flex;width:100%;min-height:94rpx;align-items:center;margin:0;padding:12rpx 0;border:0;border-top:1rpx solid $dz-border;background:transparent;text-align:left}.onboarding-steps button::after,.order-button::after,.pending-row::after{display:none}.onboarding-steps i{display:flex;width:44rpx;height:44rpx;flex:none;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:#aebabb;font-size:19rpx;font-style:normal}.onboarding-steps button.done i{background:$dz-brand}.onboarding-steps button>view{display:flex;gap:5rpx;margin-left:15rpx;flex:1;flex-direction:column}.onboarding-steps strong{font-size:22rpx}.onboarding-steps button.done strong{color:$dz-brand-deep}.onboarding-steps text{color:$dz-text-secondary;font-size:18rpx}.onboarding-steps b{color:$dz-text-tertiary;font-size:34rpx;font-weight:400}
.online-hero{position:relative;margin-top:12rpx;padding:32rpx 30rpx 28rpx;border:1rpx solid rgba(17,193,196,.38);border-radius:30rpx;background:rgba(245,254,254,.94);box-shadow:0 8rpx 20rpx rgba(8,71,76,.06),0 28rpx 68rpx rgba(8,91,96,.1)}.online-main{display:flex;align-items:center}.online-check{display:flex;width:88rpx;height:88rpx;flex:0 0 88rpx;align-items:center;justify-content:center;border-radius:50%;background:$dz-brand;box-shadow:0 8rpx 22rpx rgba(8,84,88,.14)}.online-check image{width:66rpx;height:66rpx}.online-copy{min-width:0;margin-left:23rpx;flex:1}.online-copy>.strong-text{display:block;color:$dz-brand-deep;font-size:40rpx;line-height:1.16;letter-spacing:-.02em}.location-line{display:flex;align-items:center;margin-top:12rpx;color:$dz-text-secondary;font-size:22rpx}.location-line image{width:30rpx;height:30rpx;margin-right:7rpx}.online-switch{display:flex;min-width:108rpx;min-height:88rpx;align-items:center;justify-content:center;margin-left:14rpx;transform:scale(1.04)}.online-helper{display:block;margin-top:24rpx;color:$dz-text-secondary;font-size:22rpx;line-height:1.5}.online-hero.offline{border-color:$dz-border;background:rgba(255,255,255,.95);box-shadow:$dz-shadow-soft}.offline .online-check{background:#a8b5b8;box-shadow:none}.offline .online-copy>.strong-text{color:$dz-text-primary}.pause-mark{display:flex;gap:10rpx}.pause-mark i{width:10rpx;height:36rpx;border-radius:5rpx;background:#fff}.location-warning{margin-top:18rpx;padding:13rpx 17rpx;border-radius:14rpx;color:#934b1f;background:#fff0e4;font-size:19rpx;line-height:1.4}
.business-card{margin-top:24rpx;padding:28rpx 22rpx 24rpx;border:1rpx solid rgba(215,228,229,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}.business-card h2{margin:0 4rpx 25rpx;font-size:29rpx}.metrics-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}.metric{display:flex;min-width:0;align-items:center;justify-content:center;padding:4rpx 8rpx 17rpx;border-left:1rpx solid $dz-border;text-align:center;flex-direction:column}.metric:first-child{border-left:0}.metric>text{color:$dz-text-secondary;font-size:19rpx;white-space:nowrap}.metric .strong-text{margin-top:12rpx;font-size:33rpx;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}.metric.revenue .strong-text{color:$dz-brand;font-size:36rpx}.metric-value-row{display:flex;min-width:0;align-items:baseline;justify-content:center;gap:5rpx;margin-top:12rpx;line-height:1;white-space:nowrap}.metric-value-row .strong-text{margin-top:0;flex:none}.metric-value-row .metric-unit{flex:none;color:$dz-text-secondary;font-size:17rpx;font-weight:500;line-height:1;white-space:nowrap}
.next-order{position:relative;min-height:300rpx;margin-top:24rpx;padding:28rpx;border:1rpx solid rgba(17,193,196,.5);border-radius:30rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}.next-copy{position:relative;z-index:2;width:61%}.section-label{display:flex;align-items:center;color:$dz-brand;font-size:25rpx}.section-label image{width:38rpx;height:38rpx;margin-right:12rpx}.next-time{margin-top:24rpx;font-size:30rpx;font-weight:700;white-space:nowrap}.next-time .strong-text{margin-left:10rpx;color:$dz-orange}.next-order h2{margin:18rpx 0 0;font-size:33rpx}.order-meta{display:flex;gap:10rpx;margin-top:18rpx;color:$dz-text-secondary;font-size:20rpx;flex-direction:column}.order-meta text::before{display:inline-block;width:9rpx;height:9rpx;margin-right:9rpx;border:3rpx solid $dz-brand;border-radius:50%;content:''}.travel-art{position:absolute;z-index:1;top:30rpx;right:12rpx;width:43%;height:205rpx}.order-button{position:absolute;z-index:3;right:25rpx;bottom:22rpx;width:195rpx;height:70rpx;margin:0;border:0;border-radius:36rpx;color:#fff;background:linear-gradient(135deg,#18d0cd,#08afb8);font-size:23rpx;font-weight:650;line-height:70rpx;box-shadow:0 10rpx 22rpx rgba(8,169,177,.2)}.empty-next>h2{margin-top:28rpx;font-size:29rpx}.empty-next>text{display:block;margin-top:12rpx;color:$dz-text-secondary;font-size:20rpx;line-height:1.5}
.pending-row{display:flex;width:100%;min-height:84rpx;align-items:center;margin:24rpx 0 28rpx;padding:0 20rpx;border:1rpx solid $dz-border;border-radius:22rpx;color:$dz-text-primary;background:rgba(255,255,255,.94);box-shadow:$dz-shadow-soft;text-align:left}.bell{position:relative;width:34rpx;height:31rpx;margin-right:17rpx;border-radius:18rpx 18rpx 7rpx 7rpx;background:$dz-brand}.bell::after{position:absolute;right:11rpx;bottom:-7rpx;width:12rpx;height:7rpx;border-radius:0 0 8rpx 8rpx;background:$dz-brand-deep;content:''}.pending-row text{flex:1;font-size:21rpx}.pending-row .strong-text{color:$dz-orange;font-size:25rpx}.pending-row b{color:$dz-text-tertiary;font-size:35rpx;font-weight:400}
@media screen and (max-width:360px){.online-copy>.strong-text{font-size:36rpx}.metric{padding-right:7rpx;padding-left:7rpx}.metric text{font-size:17rpx}.metric .strong-text,.metric.revenue .strong-text{font-size:29rpx}.next-copy{width:65%}.travel-art{right:0;width:40%}}
@media screen and (min-width:480px){.workbench-content{padding-top:8px}.identity-head{min-height:90px;padding:4px 8px}.avatar{width:64px;height:74px;border-width:2px;border-radius:16px;font-size:24px}.identity-copy{gap:6px;margin-left:14px}.identity-copy>.strong-text{font-size:26px}.identity-copy>view{font-size:14px}.identity-copy image{width:22px;height:22px;margin-right:5px}.online-hero{margin-top:8px;padding:18px 20px;border-radius:20px}.online-check{width:60px;height:60px;flex-basis:60px}.online-check image{width:46px;height:46px}.online-copy{margin-left:16px}.online-copy>.strong-text{font-size:27px}.location-line{margin-top:7px;font-size:14px}.location-line image{width:20px;height:20px}.online-switch{min-width:58px;min-height:48px;margin-left:10px;transform:none}.online-helper{margin-top:12px;font-size:14px}}
/* #ifdef H5 */
.onboarding-card,.online-hero,.business-card,.next-order,.pending-row{-webkit-backdrop-filter:saturate(155%) blur(18px);backdrop-filter:saturate(155%) blur(18px)}
/* #endif */
</style>

<style lang="scss" scoped>
/* Optical type and icon pass: keep the bento cards crisp at compact widths. */
.workbench-page,
.workbench-page .workbench-content,
.workbench-page .workbench-content text,
.workbench-page .workbench-content button {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
}
.identity-name-row > .strong-text,
.business-head h2,
.section-label { font-weight: 700; letter-spacing: -0.025em; }
.identity-meta,
.online-helper,
.location-line,
.business-head > text,
.metric-head > text,
.order-summary > text,
.order-meta,
.pending-row > text { letter-spacing: 0.01em; }
.identity-meta { font-size: 22rpx; }
.online-helper { font-size: 23rpx; line-height: 1.4; }
.location-line { font-size: 22rpx; }
.business-head > text { font-size: 21rpx; font-weight: 600; }
.metric-head > text { font-size: 22rpx; font-weight: 600; }
.metric-value-row .metric-unit { font-size: 20rpx; font-weight: 600; }
.order-summary > text,
.order-meta,
.pending-row > text { font-size: 20rpx; }
.metric > .strong-text,
.metric-value-row > .strong-text {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Helvetica Neue", Arial, sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.035em;
}
.online-check image { width: 52rpx; height: 52rpx; }
.metric-icon { width: 50rpx; height: 50rpx; }
.metric-icon image { width: 30rpx; height: 30rpx; }
.travel-art { width: 48rpx; height: 48rpx; }
.location-pulse { width: 13rpx; height: 13rpx; }
.pending-row .bell { background: rgba(255, 238, 228, 0.92); }
@media screen and (min-width: 480px) {
  .identity-meta,
  .online-helper,
  .location-line { font-size: 14px; }
  .metric-head > text { font-size: 14px; }
  .metric-value-row .metric-unit { font-size: 13px; }
  .order-summary > text,
  .order-meta,
  .pending-row > text { font-size: 13px; }
}
</style>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

/* 方案 3：轻盈展台。保留业务结构，仅重建页面材质、比例和视觉层级。 */
.workbench-page{
  overflow:hidden;
  background:
    radial-gradient(circle at 102% 2%,rgba(68,211,208,.24),transparent 27%),
    radial-gradient(circle at -8% 47%,rgba(111,145,235,.1),transparent 25%),
    linear-gradient(155deg,#edfafa 0%,#f8fbfb 43%,#eaf2f3 100%);
}
.workbench-content{padding-top:12rpx;padding-bottom:20rpx}
.ambient{filter:none;pointer-events:none}
.ambient-one{top:-130rpx;right:-180rpx;width:430rpx;height:430rpx;background:rgba(89,220,216,.14)}
.ambient-two{top:240rpx;right:-120rpx;width:270rpx;height:270rpx;border:42rpx solid rgba(255,255,255,.36);background:transparent}

.identity-head{display:flex;min-height:116rpx;align-items:center;padding:8rpx 6rpx}
.avatar{width:88rpx;height:88rpx;flex:0 0 88rpx;border:2rpx solid rgba(255,255,255,.96);border-radius:28rpx;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(162,229,225,.86));box-shadow:0 12rpx 28rpx rgba(30,99,104,.14);font-size:34rpx;font-weight:750}
.identity-copy{display:flex;min-width:0;gap:8rpx;margin-left:20rpx;flex:1;flex-direction:column}
.identity-name-row{display:flex;min-width:0;align-items:center;gap:12rpx}
.identity-name-row>.strong-text{overflow:hidden;font-size:34rpx;line-height:1.15;letter-spacing:-.02em;text-overflow:ellipsis;white-space:nowrap}
.identity-badge{display:flex;min-height:38rpx;align-items:center;padding:3rpx 10rpx 3rpx 6rpx;border:1rpx solid rgba(17,193,196,.14);border-radius:999rpx;color:$dz-brand-deep;background:rgba(226,249,247,.8);font-size:18rpx;font-weight:650;white-space:nowrap}
.identity-badge image{width:28rpx;height:28rpx;margin-right:4rpx}
.identity-meta{color:#70868b;font-size:20rpx;line-height:1.3}

.onboarding-card{margin:8rpx 0 20rpx;padding:24rpx;border:1rpx solid rgba(255,255,255,.92);border-radius:34rpx;background:rgba(255,255,255,.84);box-shadow:0 22rpx 48rpx rgba(31,79,84,.09),inset 0 1rpx 0 rgba(255,255,255,.92)}
.onboarding-head strong{font-size:27rpx}
.onboarding-steps button{min-height:86rpx;background:transparent}

.online-hero{position:relative;overflow:hidden;margin-top:2rpx;padding:28rpx 28rpx 23rpx;border:1rpx solid rgba(255,255,255,.94);border-radius:38rpx;background:rgba(255,255,255,.82);box-shadow:0 22rpx 52rpx rgba(31,79,84,.105),inset 0 1rpx 0 rgba(255,255,255,.96)}
.online-hero::after{position:absolute;top:-92rpx;right:-92rpx;width:250rpx;height:250rpx;border:38rpx solid rgba(17,193,196,.075);border-radius:50%;content:'';pointer-events:none}
.online-main{position:relative;z-index:1;display:flex;align-items:center}
.online-check{display:flex;width:86rpx;height:86rpx;flex:0 0 86rpx;align-items:center;justify-content:center;border:0;border-radius:29rpx;background:linear-gradient(145deg,#10cbc8,#079aa5);box-shadow:0 15rpx 30rpx rgba(7,164,170,.24),inset 0 1rpx 0 rgba(255,255,255,.4)}
.online-check image{width:62rpx;height:62rpx}
.online-copy{min-width:0;margin-left:22rpx;flex:1}
.online-copy>.strong-text{display:block;color:#102127;font-size:36rpx;line-height:1.15;letter-spacing:-.02em}
.online-helper{display:-webkit-box;overflow:hidden;margin-top:8rpx;color:#647a80;font-size:21rpx;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.online-switch{position:relative;z-index:2;display:flex;min-width:100rpx;min-height:78rpx;align-items:center;justify-content:center;margin-left:10rpx;transform:scale(1.02)}
.location-line{position:relative;z-index:1;display:flex;align-items:center;margin-top:21rpx;padding-top:18rpx;border-top:1rpx solid rgba(214,230,230,.82);color:#6b8085;font-size:20rpx;line-height:1.3}
.location-line image{display:none}
.location-pulse{width:12rpx;height:12rpx;flex:0 0 12rpx;margin:0 14rpx 0 4rpx;border-radius:50%;background:$dz-brand;box-shadow:0 0 0 9rpx rgba(17,193,196,.12)}
.online-hero.offline{border-color:rgba(255,255,255,.94);background:rgba(255,255,255,.84);box-shadow:0 18rpx 45rpx rgba(41,72,77,.08),inset 0 1rpx 0 rgba(255,255,255,.95)}
.offline .online-check{background:linear-gradient(145deg,#aebabc,#87979a);box-shadow:0 13rpx 26rpx rgba(56,72,76,.14)}
.offline .online-copy>.strong-text{color:#28373c}
.pause-mark{display:flex;gap:9rpx}.pause-mark i{width:9rpx;height:34rpx;border-radius:5rpx;background:#fff}
.location-warning{margin-top:16rpx;padding:13rpx 16rpx;border:1rpx solid rgba(255,138,66,.15);border-radius:16rpx;color:#934b1f;background:rgba(255,240,228,.9);font-size:19rpx;line-height:1.4}

.business-card{margin-top:22rpx;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
.business-head{display:flex;align-items:center;justify-content:space-between;margin:0 7rpx 14rpx}
.business-head h2{margin:0;color:#102127;font-size:30rpx;line-height:1.2;letter-spacing:-.01em}
.business-head>text{color:#75898e;font-size:20rpx}
.metrics-grid{display:grid;height:276rpx;grid-template-columns:1.12fr .88fr;grid-template-rows:132rpx 132rpx;gap:12rpx}
.metric{position:relative;display:flex;overflow:hidden;min-width:0;align-items:stretch;justify-content:flex-start;padding:20rpx 22rpx;border:1rpx solid rgba(255,255,255,.92);border-radius:32rpx;background:rgba(255,255,255,.72);box-shadow:0 17rpx 38rpx rgba(31,79,84,.085),inset 0 1rpx 0 rgba(255,255,255,.96);text-align:left;flex-direction:column}
.metric.revenue{grid-row:1/3;background:linear-gradient(150deg,rgba(255,255,255,.9),rgba(218,249,246,.8))}
.metric.order-metric{background:linear-gradient(150deg,rgba(255,255,255,.88),rgba(255,236,215,.82))}
.metric.hours-metric{background:linear-gradient(150deg,rgba(255,255,255,.88),rgba(224,232,255,.82))}
.metric-head{display:flex;width:100%;align-items:center;justify-content:space-between}
.metric-head>text{color:#6d8187;font-size:20rpx;font-weight:650;line-height:1.2;white-space:nowrap}
.metric-icon{display:flex;width:46rpx;height:46rpx;align-items:center;justify-content:center;border:1rpx solid rgba(255,255,255,.9);border-radius:50%;background:rgba(255,255,255,.72)}
.metric-icon image{width:29rpx;height:29rpx}
.metric>.strong-text{margin-top:17rpx;color:$dz-brand-deep;font-size:41rpx;line-height:1;letter-spacing:-.035em;white-space:nowrap;font-variant-numeric:tabular-nums}
.metric-value-row{display:flex;min-width:0;align-items:baseline;justify-content:flex-start;gap:5rpx;margin-top:13rpx;line-height:1;white-space:nowrap}
.metric-value-row .strong-text{margin:0;flex:0 0 auto;font-size:35rpx;line-height:1;letter-spacing:-.025em;white-space:nowrap;font-variant-numeric:tabular-nums}
.order-metric .metric-value-row .strong-text{color:#dd722f}
.hours-metric .metric-value-row .strong-text{color:#5774cf}
.metric-value-row .metric-unit{flex:0 0 auto;color:#62787e;font-size:18rpx;font-weight:600;line-height:1;white-space:nowrap}

.next-order{position:relative;overflow:hidden;min-height:0;margin-top:22rpx;padding:23rpx 24rpx 20rpx;border:1rpx solid rgba(255,255,255,.94);border-radius:36rpx;background:rgba(255,255,255,.82);box-shadow:0 20rpx 46rpx rgba(31,79,84,.095),inset 0 1rpx 0 rgba(255,255,255,.96)}
.next-order::after{position:absolute;right:-105rpx;bottom:-125rpx;width:280rpx;height:280rpx;border-radius:50%;background:rgba(17,193,196,.075);content:'';pointer-events:none}
.next-copy{position:relative;z-index:2;width:100%}
.next-head{display:flex;align-items:center;justify-content:space-between}
.section-label{display:flex;align-items:center;color:#102127;font-size:29rpx;line-height:1.2}
.section-label image{display:none}
.next-time{margin:0;padding:9rpx 15rpx;border-radius:999rpx;color:$dz-brand-deep;background:rgba(221,248,247,.9);font-size:18rpx;font-weight:700;line-height:1.2;white-space:nowrap}
.next-time .strong-text{margin:0;color:inherit}
.next-main{display:grid;align-items:center;margin-top:17rpx;grid-template-columns:88rpx minmax(0,1fr) auto;gap:16rpx}
.travel-shell{display:flex;width:88rpx;height:88rpx;align-items:center;justify-content:center;border-radius:27rpx;background:linear-gradient(145deg,#12292e,#245c62);box-shadow:0 14rpx 28rpx rgba(18,48,53,.18)}
.travel-art{position:static;width:76rpx;height:76rpx}
.order-summary{min-width:0}
.next-order h2{overflow:hidden;margin:0;color:#15272c;font-size:26rpx;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.order-summary>text{display:block;margin-top:7rpx;color:#6c8085;font-size:19rpx;line-height:1.25}
.order-button{position:static;display:flex;width:126rpx;height:72rpx;align-items:center;justify-content:center;gap:8rpx;margin:0;padding:0;border:0;border-radius:999rpx;color:#fff;background:linear-gradient(145deg,#14cbc8,#08a7b0);box-shadow:0 13rpx 25rpx rgba(7,156,162,.22);font-size:21rpx;font-weight:700;line-height:72rpx}
.order-button text{font-size:20rpx;line-height:1}.order-button b{font-size:32rpx;font-weight:400;line-height:1}
.order-meta{display:flex;align-items:center;gap:8rpx;margin-top:17rpx;padding-top:15rpx;border-top:1rpx solid rgba(216,230,230,.82);color:#6b7f84;font-size:19rpx;line-height:1.3;flex-direction:row}
.order-meta image{width:27rpx;height:27rpx;flex:0 0 27rpx}
.order-meta text::before{display:none}
.empty-next{min-height:132rpx}.empty-next>h2{margin-top:22rpx;font-size:27rpx}.empty-next>text{display:block;margin-top:10rpx;color:$dz-text-secondary;font-size:20rpx;line-height:1.45}

.pending-row{display:flex;width:100%;min-height:82rpx;align-items:center;margin:18rpx 0 20rpx;padding:0 18rpx;border:1rpx solid rgba(255,255,255,.94);border-radius:27rpx;color:$dz-text-primary;background:rgba(255,255,255,.79);box-shadow:0 15rpx 34rpx rgba(31,79,84,.075),inset 0 1rpx 0 rgba(255,255,255,.95);text-align:left}
.pending-row .bell{width:43rpx;height:43rpx;flex:0 0 43rpx;margin-right:15rpx;border-radius:15rpx;background:#fff0e8}
.pending-row .bell::before{position:absolute;top:11rpx;left:12rpx;width:18rpx;height:18rpx;border:3rpx solid #e86d38;border-radius:5rpx;content:''}
.pending-row .bell::after{display:none}
.pending-row>text{overflow:hidden;flex:1;color:#6d7f84;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}
.pending-row .strong-text{color:#de6434;font-size:23rpx}
.pending-row>b{color:#849398;font-size:33rpx;font-weight:400}

/* #ifdef H5 */
.onboarding-card,.online-hero,.metric,.next-order,.pending-row{-webkit-backdrop-filter:saturate(160%) blur(18px);backdrop-filter:saturate(160%) blur(18px)}
/* #endif */

@media screen and (max-width:360px){
  .online-copy>.strong-text{font-size:33rpx}
  .online-helper{font-size:19rpx}
  .metrics-grid{grid-template-columns:1.08fr .92fr}
  .metric{padding-right:17rpx;padding-left:17rpx}
  .metric>.strong-text{font-size:37rpx}
  .metric-value-row .strong-text{font-size:31rpx}
  .next-main{grid-template-columns:82rpx minmax(0,1fr) auto;gap:12rpx}
  .travel-shell{width:82rpx;height:82rpx}
  .order-button{width:106rpx}
}

@media screen and (min-width:480px){
  .workbench-content{padding-top:8px;padding-bottom:12px}
  .identity-head{min-height:70px;padding:4px}
  .avatar{width:54px;height:54px;flex-basis:54px;border-radius:17px;font-size:21px}
  .identity-copy{gap:5px;margin-left:13px}
  .identity-name-row>.strong-text{font-size:22px}
  .identity-badge{min-height:24px;padding:2px 7px 2px 4px;font-size:12px}
  .identity-badge image{width:18px;height:18px}
  .identity-meta{font-size:13px}
  .online-hero{padding:18px;border-radius:24px}
  .online-check{width:54px;height:54px;flex-basis:54px;border-radius:18px}
  .online-check image{width:40px;height:40px}
  .online-copy{margin-left:14px}
  .online-copy>.strong-text{font-size:23px}
  .online-helper{margin-top:5px;font-size:13px}
  .online-switch{min-width:62px;min-height:48px;margin-left:8px;transform:none}
  .location-line{margin-top:13px;padding-top:11px;font-size:13px}
  .business-card,.next-order{margin-top:14px}
  .business-head{margin:0 4px 9px}.business-head h2{font-size:19px}.business-head>text{font-size:13px}
  .metrics-grid{height:177px;grid-template-rows:84px 84px;gap:9px}
  .metric{padding:13px 14px;border-radius:20px}.metric-head>text{font-size:13px}.metric-icon{width:30px;height:30px}.metric-icon image{width:19px;height:19px}
  .metric>.strong-text{margin-top:11px;font-size:27px}.metric-value-row{margin-top:8px}.metric-value-row .strong-text{font-size:23px}.metric-value-row .metric-unit{font-size:12px}
  .next-order{padding:15px;border-radius:23px}.section-label{font-size:19px}.next-time{padding:6px 10px;font-size:12px}.next-main{margin-top:11px;grid-template-columns:56px minmax(0,1fr) auto;gap:10px}.travel-shell{width:56px;height:56px;border-radius:17px}.travel-art{width:48px;height:48px}.next-order h2{font-size:17px}.order-summary>text{margin-top:4px;font-size:12px}.order-button{width:82px;height:46px;font-size:13px;line-height:46px}.order-button text{font-size:13px}.order-button b{font-size:21px}.order-meta{gap:5px;margin-top:11px;padding-top:10px;font-size:12px}.order-meta image{width:18px;height:18px;flex-basis:18px}
  .pending-row{min-height:52px;margin:12px 0;padding:0 12px;border-radius:17px}.pending-row .bell{width:28px;height:28px;flex-basis:28px;margin-right:10px;border-radius:9px}.pending-row>text{font-size:12px}.pending-row .strong-text{font-size:15px}
}
</style>

<style lang="scss" scoped>
.workbench-page,
.workbench-page .workbench-content,
.workbench-page .workbench-content text,
.workbench-page .workbench-content button { font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif; }
.identity-name-row>.strong-text,.business-head h2,.section-label { font-weight:700; letter-spacing:-.025em; }
.identity-meta,.online-helper,.location-line,.business-head>text,.metric-head>text,.order-summary>text,.order-meta,.pending-row>text { letter-spacing:.01em; }
.identity-meta { font-size:22rpx; }.online-helper { font-size:23rpx; line-height:1.4; }.location-line { font-size:22rpx; }.business-head>text { font-size:21rpx; font-weight:600; }.metric-head>text { font-size:22rpx; font-weight:600; }.metric-value-row .metric-unit { font-size:20rpx; font-weight:600; }.order-summary>text,.order-meta,.pending-row>text { font-size:20rpx; }
.metric>.strong-text,.metric-value-row>.strong-text { font-family:-apple-system,BlinkMacSystemFont,"SF Pro Rounded","Helvetica Neue",Arial,sans-serif; font-variant-numeric:tabular-nums; letter-spacing:-.035em; }
.online-check image { width:52rpx; height:52rpx; }.offline-art { width:54rpx; height:54rpx; }.metric-icon { width:50rpx; height:50rpx; }.metric-icon image { width:30rpx; height:30rpx; }.travel-art { width:48rpx; height:48rpx; }.location-pulse { width:13rpx; height:13rpx; }.pending-row .bell { background:rgba(255,238,228,.92); }
@media screen and (min-width:480px){.identity-meta,.online-helper,.location-line{font-size:14px}.metric-head>text{font-size:14px}.metric-value-row .metric-unit{font-size:13px}.order-summary>text,.order-meta,.pending-row>text{font-size:13px}}
</style>
