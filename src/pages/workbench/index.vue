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
            <image v-if="data.avatar_url" :src="data.avatar_url" mode="aspectFill" />
            <text v-else>{{ (data.nickname || '达').slice(0, 1) }}</text>
          </view>
          <view class="identity-copy">
            <strong class="strong-text">{{ data.nickname || '达人' }}</strong>
            <view><image src="/static/icons/check.svg" mode="aspectFit" /><text>{{ data.identity_status_label }}</text></view>
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
              <image v-if="data.is_online" src="/static/icons/check.svg" mode="aspectFit" />
              <view v-else class="pause-mark" aria-hidden="true"><i /><i /></view>
            </view>
            <view class="online-copy">
              <strong class="strong-text">{{ data.is_online ? '在线接单中' : '当前已离线' }}</strong>
              <view class="location-line">
                <image src="/static/icons/location.svg" mode="aspectFit" />
                <text>{{ locationStatus }}</text>
              </view>
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
          <text class="online-helper">{{ onlineHelper }}</text>
          <view v-if="locationWarning" class="location-warning" role="status">{{ locationWarning }}</view>
        </section>

        <section class="business-card">
          <h2>本月经营</h2>
          <view class="metrics-row">
            <view class="metric revenue">
              <text>本月营业额</text>
              <strong class="strong-text">¥{{ formatAmount(data.month_income_amount) }}</strong>
            </view>
            <view class="metric">
              <text>月订单数</text>
              <strong class="strong-text">{{ data.month_order_count }}<small>单</small></strong>
            </view>
            <view class="metric">
              <text>服务小时数</text>
              <strong class="strong-text">{{ formatHours(data.month_service_hours) }}<small>小时</small></strong>
            </view>
          </view>

          <view class="chart-head">
            <strong class="strong-text">近7日服务趋势</strong>
            <text>单位：小时</text>
          </view>
          <view class="chart" aria-label="近7日服务趋势柱状图">
            <view class="grid-lines" aria-hidden="true"><i /><i /><i /></view>
            <view v-for="item in trendItems" :key="item.date" class="bar-column">
              <text class="bar-value">{{ formatHours(item.service_hours) }}</text>
              <view class="bar-track"><view class="bar" :style="{ height: barHeight(item.service_hours) }" /></view>
              <text class="bar-label">{{ item.label }}</text>
            </view>
          </view>
        </section>

        <section class="next-order dz-tappable" role="button" aria-label="查看下一单" hover-class="dz-pressed" @tap="openUpcomingOrder">
          <view v-if="data.upcoming_order" class="next-copy">
            <view class="section-label"><image src="/static/icons/calendar.svg" mode="aspectFit" /><strong class="strong-text">下一单</strong></view>
            <view class="next-time">{{ orderDateLabel(data.upcoming_order.starts_at) }} <strong class="strong-text">{{ timeRange(data.upcoming_order.starts_at, data.upcoming_order.ends_at) }}</strong></view>
            <h2>{{ data.upcoming_order.service_name }}</h2>
            <view class="order-meta"><text>{{ customerLabel }}</text><text>{{ data.upcoming_order.meeting_location_name }}</text></view>
          </view>
          <view v-else class="next-copy empty-next">
            <view class="section-label"><image src="/static/icons/calendar.svg" mode="aspectFit" /><strong class="strong-text">下一单</strong></view>
            <h2>暂无待服务订单</h2>
            <text>保持在线，新的预约会及时出现在这里。</text>
          </view>
          <image class="travel-art" src="/static/next-order-backpack.webp" mode="aspectFit" aria-hidden="true" />
          <button v-if="data.upcoming_order" class="order-button" @tap.stop="openUpcomingOrder">查看订单</button>
        </section>

        <button class="alarm-card dz-tappable" :disabled="alarming" hover-class="dz-pressed" @tap="confirmAlarm">
          <image src="/static/icons/alarm.svg" mode="aspectFit" />
          <view><strong class="strong-text">一键报警</strong><text>危险时同步当前位置 · 点击后需二次确认</text></view>
          <b aria-hidden="true">›</b>
        </button>

        <button class="pending-row" @tap="openPending">
          <view class="bell" aria-hidden="true" />
          <text>待处理：<strong class="strong-text">{{ data.pending_acceptance_order_count }}</strong> 个待接订单、<strong class="strong-text">0</strong> 条未读消息</text>
          <b aria-hidden="true">›</b>
        </button>
      </template>
    </main>

    <ProviderTabBar active="workbench" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import ProviderTabBar from '@/components/ProviderTabBar.vue'
import {
  getCurrentProviderLocation,
  isReportingSession,
  refreshLocationReporting,
  startLocationReporting,
  stopLocationReporting,
} from '@/services/locationReporter'
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

const onboardingProgress = computed(() => data.value?.identity_status === 'verified' ? '继续完善即可开启接单' : '完成后开放在线接单')
const identityStepCopy = computed(() => {
  if (data.value?.identity_status === 'pending') return '资料审核中'
  if (data.value?.identity_status === 'rejected') return '未通过，请修改后重试'
  return data.value?.identity_status === 'verified' ? '身份核验已通过' : '提交实名信息与认证材料'
})

const trendItems = computed(() => data.value?.last_7_days_service_trend || [])
const maxTrend = computed(() => Math.max(1, ...trendItems.value.map(item => item.service_hours)))
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
function barHeight(value: number) {
  const percentage = value ? Math.max(18, Math.round((value / maxTrend.value) * 100)) : 5
  return `${percentage}%`
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
function openPending() { uni.navigateTo({ url: '/pages/orders/index' }) }
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

onShow(() => { if (guardCurrentPage()) void load() })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.workbench-page{position:relative;overflow:hidden;background:linear-gradient(180deg,#f4fcfc 0,#fff 290rpx,#f8fbfb 100%)}.workbench-content{position:relative;z-index:1;padding-top:26rpx}.ambient{position:absolute;border-radius:50%;background:rgba(104,222,220,.12);filter:blur(1rpx);pointer-events:none}.ambient-one{top:40rpx;right:-105rpx;width:390rpx;height:390rpx}.ambient-two{top:170rpx;right:35rpx;width:180rpx;height:180rpx;border:36rpx solid rgba(255,255,255,.32);background:transparent}
.identity-head{display:flex;align-items:center;min-height:150rpx;padding:10rpx 12rpx}.avatar{display:flex;overflow:hidden;width:112rpx;height:112rpx;align-items:center;justify-content:center;border:5rpx solid rgba(255,255,255,.9);border-radius:50%;color:$dz-brand-deep;background:$dz-brand-soft;box-shadow:$dz-shadow-soft;font-size:38rpx;font-weight:750}.avatar image{width:100%;height:100%}.identity-copy{display:flex;gap:11rpx;margin-left:22rpx;flex-direction:column}.identity-copy>.strong-text{font-size:38rpx;line-height:1.1}.identity-copy>view{display:flex;align-items:center;color:$dz-brand-deep;font-size:22rpx}.identity-copy image{width:34rpx;height:34rpx;margin-right:8rpx}
.onboarding-card{margin:14rpx 0 24rpx;padding:25rpx;border:1rpx solid #bdeae8;border-radius:29rpx;background:#fff;box-shadow:$dz-shadow-soft}.onboarding-head{display:flex;align-items:flex-end;justify-content:space-between}.onboarding-head>view{display:flex;gap:6rpx;flex-direction:column}.onboarding-head>view>text{color:$dz-brand;font-size:19rpx;font-weight:700}.onboarding-head strong{font-size:28rpx}.onboarding-head>text{color:$dz-text-tertiary;font-size:18rpx}.onboarding-steps{margin-top:18rpx}.onboarding-steps button{display:flex;width:100%;min-height:94rpx;align-items:center;margin:0;padding:12rpx 0;border:0;border-top:1rpx solid $dz-border;background:#fff;text-align:left}.onboarding-steps i{display:flex;width:44rpx;height:44rpx;flex:none;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:#aebabb;font-size:19rpx;font-style:normal}.onboarding-steps button.done i{background:$dz-brand}.onboarding-steps button>view{display:flex;gap:5rpx;margin-left:15rpx;flex:1;flex-direction:column}.onboarding-steps strong{font-size:22rpx}.onboarding-steps button.done strong{color:$dz-brand-deep}.onboarding-steps text{color:$dz-text-secondary;font-size:18rpx}.onboarding-steps b{color:$dz-text-tertiary;font-size:34rpx;font-weight:400}
.online-hero{position:relative;margin-top:14rpx;padding:34rpx 30rpx 30rpx;border:2rpx solid rgba(17,193,196,.7);border-radius:30rpx;background:linear-gradient(135deg,#f7ffff 0,#e6fbfb 55%,#c9f5f3 100%);box-shadow:0 15rpx 36rpx rgba(8,169,177,.11)}.online-main{display:flex;align-items:center}.online-check{display:flex;width:92rpx;height:92rpx;flex:0 0 92rpx;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(145deg,#0ec6c8,#08a9b1);box-shadow:0 12rpx 28rpx rgba(8,169,177,.22)}.online-check image{width:70rpx;height:70rpx}.online-copy{min-width:0;margin-left:24rpx;flex:1}.online-copy>.strong-text{display:block;color:$dz-brand-deep;font-size:42rpx;line-height:1.2}.location-line{display:flex;align-items:center;margin-top:14rpx;color:$dz-text-secondary;font-size:22rpx}.location-line image{width:31rpx;height:31rpx;margin-right:7rpx}.online-switch{display:flex;min-width:108rpx;min-height:88rpx;align-items:center;justify-content:center;margin-left:16rpx;transform:scale(1.08)}.online-helper{display:block;margin-top:26rpx;color:$dz-text-secondary;font-size:22rpx;line-height:1.5}.online-hero.offline{border-color:$dz-border;background:linear-gradient(135deg,#fff,#f3f7f7)}.offline .online-check{background:#a8b5b8;box-shadow:none}.offline .online-copy>.strong-text{color:$dz-text-primary}.pause-mark{display:flex;gap:10rpx}.pause-mark i{width:10rpx;height:36rpx;border-radius:5rpx;background:#fff}.location-warning{margin-top:18rpx;padding:13rpx 17rpx;border-radius:14rpx;color:#a2541e;background:#fff0e4;font-size:19rpx;line-height:1.4}
.business-card{margin-top:24rpx;padding:28rpx 22rpx 24rpx;border:1rpx solid $dz-border;border-radius:30rpx;background:#fff;box-shadow:$dz-shadow}.business-card h2{margin:0 4rpx 25rpx;font-size:29rpx}.metrics-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}.metric{display:flex;min-width:0;align-items:center;justify-content:center;padding:4rpx 12rpx 17rpx;border-left:1rpx solid $dz-border;text-align:center;flex-direction:column}.metric:first-child{border-left:0}.metric text{color:$dz-text-secondary;font-size:19rpx;white-space:nowrap}.metric .strong-text{margin-top:12rpx;font-size:33rpx;line-height:1;white-space:nowrap}.metric.revenue .strong-text{color:$dz-brand;font-size:36rpx}.metric small{margin-left:5rpx;color:$dz-text-secondary;font-size:17rpx;font-weight:500}.chart-head{display:flex;align-items:center;justify-content:space-between;margin:12rpx 5rpx 0;padding-top:24rpx;border-top:1rpx dashed $dz-border}.chart-head .strong-text{font-size:24rpx}.chart-head text{color:$dz-text-tertiary;font-size:17rpx}.chart{position:relative;display:grid;height:260rpx;margin-top:14rpx;padding:22rpx 0 0;grid-template-columns:repeat(7,1fr)}.grid-lines{position:absolute;top:42rpx;right:4rpx;bottom:38rpx;left:4rpx;display:flex;justify-content:space-between;flex-direction:column}.grid-lines i{width:100%;border-top:1rpx dashed #e8eeee}.bar-column{position:relative;z-index:1;display:flex;min-width:0;align-items:center;justify-content:flex-end;flex-direction:column}.bar-value{height:27rpx;color:$dz-text-secondary;font-size:17rpx}.bar-track{display:flex;width:100%;height:160rpx;align-items:flex-end;justify-content:center}.bar{width:24rpx;min-height:8rpx;border-radius:12rpx 12rpx 2rpx 2rpx;background:linear-gradient(180deg,#11c1c4,#a7efec);box-shadow:0 6rpx 12rpx rgba(17,193,196,.13)}.bar-label{height:31rpx;margin-top:8rpx;color:$dz-text-secondary;font-size:18rpx}
.next-order{position:relative;min-height:300rpx;margin-top:24rpx;padding:28rpx;border:2rpx solid rgba(17,193,196,.65);border-radius:30rpx;background:#fff;box-shadow:$dz-shadow-soft}.next-copy{position:relative;z-index:2;width:61%}.section-label{display:flex;align-items:center;color:$dz-brand;font-size:25rpx}.section-label image{width:38rpx;height:38rpx;margin-right:12rpx}.next-time{margin-top:24rpx;font-size:30rpx;font-weight:700;white-space:nowrap}.next-time .strong-text{margin-left:10rpx;color:$dz-orange}.next-order h2{margin:18rpx 0 0;font-size:33rpx}.order-meta{display:flex;gap:10rpx;margin-top:18rpx;color:$dz-text-secondary;font-size:20rpx;flex-direction:column}.order-meta text::before{display:inline-block;width:9rpx;height:9rpx;margin-right:9rpx;border:3rpx solid $dz-brand;border-radius:50%;content:''}.travel-art{position:absolute;z-index:1;top:30rpx;right:12rpx;width:43%;height:205rpx}.order-button{position:absolute;z-index:3;right:25rpx;bottom:22rpx;width:195rpx;height:70rpx;margin:0;border:0;border-radius:36rpx;color:#fff;background:linear-gradient(135deg,#18d0cd,#08afb8);font-size:23rpx;font-weight:650;line-height:70rpx;box-shadow:0 10rpx 22rpx rgba(8,169,177,.2)}.empty-next>h2{margin-top:28rpx;font-size:29rpx}.empty-next>text{display:block;margin-top:12rpx;color:$dz-text-secondary;font-size:20rpx;line-height:1.5}
.alarm-card,.pending-row{display:flex;width:100%;align-items:center;margin:24rpx 0 0;padding:0;border:0;text-align:left}.alarm-card{min-height:124rpx;padding:20rpx 24rpx;border:1rpx solid #ffd4d6;border-radius:28rpx;background:$dz-danger-soft;box-shadow:0 8rpx 22rpx rgba(255,62,70,.06)}.alarm-card>image{width:72rpx;height:72rpx;flex:0 0 72rpx}.alarm-card>view{display:flex;min-width:0;gap:5rpx;margin-left:20rpx;flex:1;flex-direction:column}.alarm-card .strong-text{color:$dz-danger;font-size:27rpx}.alarm-card text{color:#5f6874;font-size:18rpx;line-height:1.4}.alarm-card b{color:$dz-danger;font-size:42rpx;font-weight:400}.alarm-card[disabled]{opacity:.65}.pending-row{min-height:84rpx;margin-bottom:28rpx;padding:0 20rpx;border:1rpx solid $dz-border;border-radius:22rpx;color:$dz-text-primary;background:#fff;box-shadow:$dz-shadow-soft}.bell{position:relative;width:34rpx;height:31rpx;margin-right:17rpx;border-radius:18rpx 18rpx 7rpx 7rpx;background:$dz-brand}.bell::after{position:absolute;right:11rpx;bottom:-7rpx;width:12rpx;height:7rpx;border-radius:0 0 8rpx 8rpx;background:$dz-brand-deep;content:''}.pending-row text{flex:1;font-size:21rpx}.pending-row .strong-text{color:$dz-orange;font-size:25rpx}.pending-row b{color:$dz-text-tertiary;font-size:35rpx;font-weight:400}
@media screen and (max-width:360px){.online-copy>.strong-text{font-size:36rpx}.metric{padding-right:7rpx;padding-left:7rpx}.metric text{font-size:17rpx}.metric .strong-text,.metric.revenue .strong-text{font-size:29rpx}.next-copy{width:65%}.travel-art{right:0;width:40%}}
@media screen and (min-width:480px){.workbench-content{padding-top:8px}.identity-head{min-height:90px;padding:4px 8px}.avatar{width:72px;height:72px;border-width:3px;font-size:24px}.identity-copy{gap:6px;margin-left:14px}.identity-copy>.strong-text{font-size:26px}.identity-copy>view{font-size:14px}.identity-copy image{width:22px;height:22px;margin-right:5px}.online-hero{margin-top:8px;padding:18px 20px;border-radius:20px}.online-check{width:60px;height:60px;flex-basis:60px}.online-check image{width:46px;height:46px}.online-copy{margin-left:16px}.online-copy>.strong-text{font-size:27px}.location-line{margin-top:7px;font-size:14px}.location-line image{width:20px;height:20px}.online-switch{min-width:58px;min-height:48px;margin-left:10px;transform:none}.online-helper{margin-top:12px;font-size:14px}}
</style>
