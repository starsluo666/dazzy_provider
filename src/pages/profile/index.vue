<template>
  <view class="dz-page dz-page--tabbed profile-page">
    <view class="profile-glow" aria-hidden="true" />
    <view class="dz-safe-top" />
    <main class="dz-container profile-dashboard">
      <header class="profile-title">
        <strong class="strong-text">我的</strong>
        <button class="head-action dz-tappable" hover-class="dz-pressed" @tap="signOut">退出</button>
      </header>

      <section class="identity-panel">
        <view class="avatar">
          <image v-if="data?.avatar_url" :src="data.avatar_url" mode="aspectFill" />
          <text v-else>{{ (data?.nickname || '达').slice(0, 1) }}</text>
        </view>
        <view class="identity-copy">
          <view class="name-line">
            <strong class="strong-text">{{ data?.nickname || '达人' }}</strong>
            <text class="rating-chip">{{ data ? (Number(data.rating) > 0 ? `★ ${Number(data.rating).toFixed(2)}` : '暂无评分') : '评分加载中' }}</text>
            <text class="accept-chip">{{ data?.can_accept_orders ? '可接单' : '待完善' }}</text>
          </view>
          <view class="identity-meta">
            <text>{{ data?.identity_status_label || '未认证' }}</text>
            <i />
            <text>{{ data?.service_city_name || '服务城市未设置' }}</text>
          </view>
          <view class="online-line"><i :class="{ online: data?.is_online }" /><text>{{ data?.is_online ? '当前在线接单' : '当前离线' }}</text></view>
        </view>
        <button class="profile-edit dz-tappable" hover-class="dz-pressed" aria-label="编辑达人资料" @tap="open('/pages/provider-profile/index')">›</button>
      </section>

      <button class="income-overview dz-tappable" hover-class="dz-pressed" @tap="open('/pages/income/index')">
        <view class="income-stat">
          <text>本月收入</text>
          <view class="income-value-row"><strong class="strong-text">¥{{ formatAmount(data?.month_income_amount || 0) }}</strong></view>
        </view>
        <i />
        <view class="income-stat">
          <text>本月订单</text>
          <view class="income-value-row">
            <strong class="strong-text">{{ data?.month_order_count || 0 }}</strong>
            <text class="income-unit">单</text>
          </view>
        </view>
        <b>›</b>
      </button>

      <section class="order-panel">
        <header class="section-head">
          <strong class="strong-text">我的订单</strong>
          <button class="dz-tappable" hover-class="dz-pressed" @tap="openOrders">查看全部 ›</button>
        </header>
        <view class="order-grid">
          <button class="order-entry dz-tappable" hover-class="dz-pressed" @tap="openOrders">
            <view class="order-icon orange"><image :src="icons.orders" mode="aspectFit" /></view><text>待接单</text>
            <i v-if="data?.pending_acceptance_order_count">{{ data.pending_acceptance_order_count }}</i>
          </button>
          <button class="order-entry dz-tappable" hover-class="dz-pressed" @tap="openOrders">
            <view class="order-icon blue"><image :src="icons.calendar" mode="aspectFit" /></view><text>待服务</text>
          </button>
          <button class="order-entry dz-tappable" hover-class="dz-pressed" @tap="openOrders">
            <view class="order-icon cyan"><image :src="icons.service" mode="aspectFit" /></view><text>履约中</text>
          </button>
          <button class="order-entry dz-tappable" hover-class="dz-pressed" @tap="openOrders">
            <view class="order-icon green"><image :src="icons.check" mode="aspectFit" /></view><text>已完成</text>
          </button>
        </view>
      </section>

      <section class="feature-grid">
        <button class="feature-card location-feature dz-tappable" hover-class="dz-pressed" @tap="openWorkbench">
          <view class="feature-orb" aria-hidden="true" />
          <view class="feature-topline">
            <view class="feature-icon-shell"><image :src="icons.featureStatus" mode="aspectFit" /></view>
            <view class="online-chip" :class="{ offline: !data?.is_online }"><view class="online-dot" /><text>{{ data?.is_online ? '在线' : '离线' }}</text></view>
          </view>
          <view class="feature-copy"><text class="feature-title">接单状态</text><text class="feature-description">{{ data?.is_online ? '在线服务中' : '点击前往开启' }}</text></view>
        </button>
        <button class="feature-card schedule-feature dz-tappable" hover-class="dz-pressed" @tap="open('/pages/schedule/index')">
          <view class="feature-orb" aria-hidden="true" />
          <view class="feature-topline"><view class="feature-icon-shell"><image :src="icons.featureSchedule" mode="aspectFit" /></view></view>
          <view class="feature-copy"><text class="feature-title">服务时间</text><text class="feature-description">管理可接档期</text></view>
        </button>
        <button class="feature-card service-feature dz-tappable" hover-class="dz-pressed" @tap="open('/pages/services/index')">
          <view class="feature-orb" aria-hidden="true" />
          <view class="feature-topline"><view class="feature-icon-shell"><image :src="icons.featureService" mode="aspectFit" /></view></view>
          <view class="feature-copy"><text class="feature-title">服务管理</text><text class="feature-description">{{ data?.service_count || 0 }} 项服务</text></view>
        </button>
      </section>

      <section class="tools-panel">
        <header class="section-head"><strong class="strong-text">常用功能</strong></header>
        <view class="tools-grid">
          <button v-for="entry in entries" :key="entry.path" class="tool-entry dz-tappable" hover-class="dz-pressed" @tap="open(entry.path)">
            <view class="tool-icon"><image :src="entry.icon" mode="aspectFit" /></view><text>{{ entry.label }}</text>
          </button>
        </view>
      </section>
    </main>
    <ProviderTabBar active="profile" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ProviderTabBar from '@/components/ProviderTabBar.vue'
import { logout } from '@/services/auth'
import { stopLocationReporting } from '@/services/locationReporter'
import { getProviderWorkbench, stopProviderOnline } from '@/services/providers'
import type { ProviderWorkbench } from '@/types/api'
import { formatAmount } from '@/utils/formatters'

const data = ref<ProviderWorkbench | null>(null)
const icons = {
  orders: '/static/icons/orders.svg',
  calendar: '/static/icons/calendar.svg',
  service: '/static/icons/service.svg',
  check: '/static/icons/check.svg',
  featureStatus: '/static/icons/feature-status.svg',
  featureSchedule: '/static/icons/feature-schedule.svg',
  featureService: '/static/icons/feature-service.svg',
} as const
const entries = [
  { label: '消息中心', path: '/pages/messages/index', icon: '/static/tabbar/message.svg' },
  { label: '实名认证', path: '/pages/identity/index', icon: '/static/icons/check.svg' },
  { label: '达人资料', path: '/pages/provider-profile/index', icon: '/static/tabbar/profile.svg' },
  { label: '服务管理', path: '/pages/services/index', icon: '/static/icons/service.svg' },
  { label: '档期管理', path: '/pages/schedule/index', icon: '/static/icons/schedule.svg' },
  { label: '收入明细', path: '/pages/income/index', icon: '/static/icons/income.svg' },
  { label: '收款账户', path: '/pages/receiving-account/index', icon: '/static/icons/security.svg' },
  { label: '达人订单', path: '/pages/orders/index', icon: '/static/icons/orders.svg' },
  { label: '账号设置', path: '/pages/security/index', icon: '/static/icons/security.svg' },
]

function open(path: string) { uni.navigateTo({ url: path }) }
function openOrders() { uni.navigateTo({ url: '/pages/orders/index' }) }
function openWorkbench() { uni.reLaunch({ url: '/pages/workbench/index' }) }
async function signOut() {
  uni.showModal({
    title: '退出登录',
    content: data.value?.is_online ? '退出后将同时停止在线接单，确定继续吗？' : '确定退出达人工作端吗？',
    success: async (result) => {
      if (!result.confirm) return
      try { if (data.value?.is_online) await stopProviderOnline() } catch {}
      stopLocationReporting()
      await logout()
      uni.reLaunch({ url: '/pages/auth/login' })
    },
  })
}

onShow(async () => {
  try { data.value = (await getProviderWorkbench()).data } catch {}
})
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.name-line{flex-wrap:wrap}.name-line>.strong-text{max-width:100%;overflow-wrap:anywhere}.rating-chip{flex-shrink:0;color:#a55e08;font-size:23rpx}
.profile-page{position:relative;overflow:hidden;background:radial-gradient(circle at 15% 1%,rgba(72,218,218,.22),transparent 330rpx),linear-gradient(180deg,#eafafa 0,#f8fbfb 410rpx,#f3f7f7 100%);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif}.profile-glow{position:absolute;top:-120rpx;right:-130rpx;width:420rpx;height:420rpx;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none}.profile-dashboard{position:relative;z-index:1;padding-top:4rpx;padding-bottom:8rpx}.profile-title{display:flex;height:76rpx;align-items:center;justify-content:space-between;padding:0 3rpx}.profile-title>.strong-text{font-size:34rpx;line-height:1.08;letter-spacing:-.025em}.head-action{height:54rpx;margin:0;padding:0 18rpx;border:1rpx solid rgba(255,255,255,.82);border-radius:999rpx;color:$dz-text-secondary;background:rgba(255,255,255,.68);font-size:17rpx;line-height:54rpx}.head-action::after,.profile-edit::after,.income-overview::after,.section-head button::after,.order-entry::after,.feature-card::after,.tool-entry::after{display:none}
.identity-panel{display:flex;height:116rpx;align-items:center;padding:0 4rpx}.avatar{display:flex;overflow:hidden;width:94rpx;height:94rpx;flex:none;align-items:center;justify-content:center;border:4rpx solid rgba(255,255,255,.96);border-radius:50%;color:$dz-brand-deep;background:$dz-brand-soft;box-shadow:0 10rpx 28rpx rgba(31,76,82,.13);font-size:34rpx;font-weight:700}.avatar image{width:100%;height:100%}.identity-copy{display:flex;min-width:0;gap:7rpx;margin-left:18rpx;flex:1;flex-direction:column}.name-line{display:flex;align-items:center;gap:10rpx}.name-line>.strong-text{font-size:29rpx;line-height:1.1;letter-spacing:-.015em}.accept-chip{padding:5rpx 10rpx;border-radius:999rpx;color:$dz-brand-deep;background:rgba(221,248,247,.9);font-size:15rpx;font-weight:700}.identity-meta{display:flex;align-items:center;color:$dz-text-secondary;font-size:16rpx}.identity-meta i{width:5rpx;height:5rpx;margin:0 8rpx;border-radius:50%;background:$dz-text-tertiary}.online-line{display:flex;align-items:center;color:$dz-text-secondary;font-size:16rpx}.online-line i{width:10rpx;height:10rpx;margin-right:7rpx;border-radius:50%;background:#aab6b8}.online-line i.online{background:$dz-online;box-shadow:0 0 0 5rpx rgba(32,184,108,.1)}.profile-edit{width:58rpx;height:58rpx;margin:0;padding:0;border:0;border-radius:50%;color:$dz-text-secondary;background:rgba(255,255,255,.72);font-size:36rpx;line-height:56rpx}
.income-overview{position:relative;display:grid;width:100%;height:132rpx;grid-template-columns:1fr 1rpx 1fr 28rpx;align-items:center;margin:8rpx 0 0;padding:16rpx 19rpx;border:1rpx solid rgba(255,255,255,.72);border-radius:28rpx;color:#fff;background:linear-gradient(135deg,#2bcbd0 0,#36bce5 55%,#77bdf3 100%);box-shadow:0 17rpx 38rpx rgba(26,154,176,.18);text-align:left}.income-overview>view{display:flex;align-items:center;justify-content:center;gap:9rpx;flex-direction:column}.income-overview view>text{color:rgba(255,255,255,.78);font-size:16rpx}.income-overview .strong-text{font-size:31rpx;line-height:1;font-variant-numeric:tabular-nums}.income-overview small{font-size:16rpx;font-weight:500}.income-overview>i{height:62rpx;background:rgba(255,255,255,.24)}.income-overview>b{font-size:31rpx;font-weight:400;text-align:right}
.order-panel,.tools-panel{margin-top:14rpx;padding:17rpx 19rpx;border:1rpx solid rgba(218,229,230,.88);border-radius:28rpx;background:rgba(255,255,255,.95);box-shadow:$dz-shadow-soft}.section-head{display:flex;align-items:center;justify-content:space-between}.section-head>.strong-text{font-size:23rpx;letter-spacing:-.01em}.section-head button{height:42rpx;margin:0;padding:0;border:0;color:$dz-text-tertiary;background:transparent;font-size:15rpx;line-height:42rpx}.order-grid{display:grid;margin-top:9rpx;grid-template-columns:repeat(4,1fr)}.order-entry{position:relative;display:flex;height:101rpx;align-items:center;justify-content:center;gap:7rpx;margin:0;padding:0;border:0;background:transparent;flex-direction:column}.order-icon{display:flex;width:47rpx;height:47rpx;align-items:center;justify-content:center;border-radius:15rpx}.order-icon image{width:31rpx;height:31rpx}.order-icon.orange{background:#fff0e8}.order-icon.blue{background:#eef3ff}.order-icon.cyan{background:$dz-brand-pale}.order-icon.green{background:#eaf8ef}.order-entry>text{font-size:16rpx}.order-entry>i{position:absolute;top:1rpx;right:15rpx;display:flex;min-width:29rpx;height:29rpx;align-items:center;justify-content:center;padding:0 5rpx;border:3rpx solid #fff;border-radius:999rpx;color:#fff;background:#ff4a42;font-size:14rpx;font-style:normal;box-sizing:border-box}
.feature-grid{display:grid;margin-top:14rpx;grid-template-columns:repeat(3,1fr);gap:10rpx}.feature-card{position:relative;display:flex;overflow:hidden;height:112rpx;align-items:flex-start;margin:0;padding:14rpx;border:1rpx solid rgba(213,229,230,.78);border-radius:22rpx;background:#edfafa;text-align:left;box-shadow:0 7rpx 18rpx rgba(31,76,82,.045)}.feature-card>view{position:relative;z-index:1;display:flex;gap:4rpx;flex-direction:column}.feature-card .strong-text{font-size:18rpx;white-space:nowrap}.feature-card text{color:$dz-text-secondary;font-size:13rpx;white-space:nowrap}.feature-card image{position:absolute;right:7rpx;bottom:1rpx;width:55rpx;height:55rpx;opacity:.55}.schedule-feature{background:#fff8ec}.service-feature{background:#f1f5ff}
.tools-panel{padding-bottom:13rpx}.tools-grid{display:grid;margin-top:8rpx;grid-template-columns:repeat(4,1fr)}.tool-entry{display:flex;height:82rpx;align-items:center;justify-content:center;gap:5rpx;margin:0;padding:0;border:0;background:transparent;flex-direction:column}.tool-icon{display:flex;width:42rpx;height:42rpx;align-items:center;justify-content:center;border-radius:14rpx;background:#f2f7f7}.tool-icon image{width:29rpx;height:29rpx}.tool-entry>text{font-size:14rpx;white-space:nowrap}
@media screen and (max-height:700px){.profile-title{height:66rpx}.identity-panel{height:105rpx}.income-overview{height:118rpx}.order-panel,.tools-panel,.feature-grid{margin-top:10rpx}.order-entry{height:92rpx}.feature-card{height:101rpx}.tool-entry{height:74rpx}}

/* Readability pass: comfortable type and 44px-class touch targets. */
.profile-dashboard{padding-top:6rpx;padding-bottom:14rpx}.profile-title{height:84rpx;padding:0 4rpx}.profile-title>.strong-text{font-size:40rpx;line-height:1.06;letter-spacing:-.025em}.head-action{height:64rpx;padding:0 22rpx;font-size:21rpx;font-weight:600;line-height:64rpx}
.identity-panel{height:136rpx;padding:0 5rpx}.avatar{width:108rpx;height:108rpx;font-size:40rpx}.identity-copy{gap:9rpx;margin-left:22rpx}.name-line{gap:12rpx}.name-line>.strong-text{font-size:36rpx;line-height:1.08;letter-spacing:-.018em}.accept-chip{padding:7rpx 13rpx;font-size:20rpx;line-height:1.2}.identity-meta,.online-line{font-size:22rpx;line-height:1.32}.identity-meta i{width:6rpx;height:6rpx;margin:0 10rpx}.online-line i{width:12rpx;height:12rpx;margin-right:9rpx}.online-line i.online{box-shadow:0 0 0 6rpx rgba(32,184,108,.1)}.profile-edit{width:68rpx;height:68rpx;font-size:42rpx;line-height:66rpx}
.income-overview{height:148rpx;grid-template-columns:minmax(0,1fr) 1rpx minmax(0,1fr) 30rpx;margin-top:10rpx;padding:18rpx 18rpx;border-radius:30rpx;line-height:1.2}.income-overview>.income-stat{display:flex;min-width:0;align-items:center;justify-content:center;gap:12rpx;flex-direction:column}.income-overview>.income-stat>text{color:rgba(255,255,255,.84);font-size:22rpx;font-weight:550;line-height:1.2;white-space:nowrap}.income-value-row{display:flex;max-width:100%;align-items:baseline;justify-content:center;gap:6rpx;line-height:1;white-space:nowrap}.income-value-row .strong-text{min-width:0;font-size:40rpx;line-height:1;letter-spacing:-.025em;white-space:nowrap;font-variant-numeric:tabular-nums}.income-unit{flex:none;color:rgba(255,255,255,.9);font-size:22rpx;font-weight:600;line-height:1}.income-overview>i{height:72rpx}.income-overview>b{font-size:38rpx;line-height:1;text-align:right}
.order-panel,.tools-panel{margin-top:16rpx;padding:20rpx 21rpx}.section-head{min-height:48rpx}.section-head>.strong-text{font-size:29rpx;line-height:1.15;letter-spacing:-.012em}.section-head button{height:56rpx;padding:0 2rpx 0 18rpx;font-size:21rpx;font-weight:550;line-height:56rpx}.order-grid{margin-top:10rpx}.order-entry{height:118rpx;gap:10rpx}.order-icon{width:58rpx;height:58rpx;border-radius:18rpx}.order-icon image{width:38rpx;height:38rpx}.order-entry>text{font-size:22rpx;font-weight:550;line-height:1.2}.order-entry>i{top:0;right:11rpx;min-width:34rpx;height:34rpx;padding:0 7rpx;font-size:18rpx;font-weight:700}
.feature-grid{margin-top:16rpx;gap:12rpx}.feature-card{height:130rpx;padding:17rpx 15rpx;border-radius:24rpx}.feature-card>view{gap:7rpx}.feature-card .strong-text{font-size:23rpx;line-height:1.15;letter-spacing:-.01em}.feature-card text{font-size:19rpx;line-height:1.25}.feature-card image{width:66rpx;height:66rpx}
.tools-panel{padding-bottom:17rpx}.tools-grid{margin-top:10rpx}.tool-entry{height:auto;min-height:98rpx;gap:8rpx;padding:4rpx 0}.tool-icon{width:56rpx;height:56rpx;border-radius:17rpx}.tool-icon image{width:37rpx;height:37rpx}.tool-entry>text{font-size:21rpx;font-weight:550;line-height:1.25}
@media screen and (max-height:700px){.profile-title{height:76rpx}.identity-panel{height:126rpx}.income-overview{height:138rpx}.order-panel,.tools-panel,.feature-grid{margin-top:12rpx}.order-entry{height:110rpx}.feature-card{height:122rpx}.tool-entry{height:auto;min-height:92rpx}}

/* 彩色功能卡：高光材质承载状态，图标与文字保持明确的上下阅读顺序。 */
.feature-grid{margin-top:16rpx;gap:12rpx}
.feature-card{
  position:relative;
  display:flex;
  overflow:hidden;
  height:196rpx;
  align-items:stretch;
  justify-content:space-between;
  box-sizing:border-box;
  margin:0;
  padding:18rpx;
  border:1rpx solid rgba(255,255,255,.5);
  border-radius:30rpx;
  color:#fff;
  text-align:left;
  box-shadow:inset 0 2rpx 1rpx rgba(255,255,255,.28),0 18rpx 38rpx rgba(32,82,91,.16);
  flex-direction:column;
}
.feature-card.location-feature{
  background:radial-gradient(circle at 18% 8%,rgba(255,255,255,.42),transparent 27%),linear-gradient(150deg,#38d1d1 0,#19bec7 54%,#11a9be 100%);
  box-shadow:inset 0 2rpx 1rpx rgba(255,255,255,.3),0 20rpx 38rpx rgba(9,165,179,.25);
}
.feature-card.schedule-feature{
  background:radial-gradient(circle at 22% 7%,rgba(255,255,255,.43),transparent 28%),linear-gradient(150deg,#ffba68 0,#ff9b52 52%,#ff8050 100%);
  box-shadow:inset 0 2rpx 1rpx rgba(255,255,255,.3),0 20rpx 38rpx rgba(231,120,53,.24);
}
.feature-card.service-feature{
  background:radial-gradient(circle at 22% 7%,rgba(255,255,255,.4),transparent 28%),linear-gradient(150deg,#91b3ff 0,#7297f2 50%,#587be2 100%);
  box-shadow:inset 0 2rpx 1rpx rgba(255,255,255,.3),0 20rpx 38rpx rgba(78,111,211,.25);
}
.feature-card>.feature-orb{
  position:absolute;
  z-index:0;
  right:-38rpx;
  bottom:-64rpx;
  display:block;
  width:176rpx;
  height:176rpx;
  border:1rpx solid rgba(255,255,255,.08);
  border-radius:50%;
  background:rgba(255,255,255,.13);
}
.feature-card>.feature-topline{
  position:relative;
  z-index:2;
  display:flex;
  width:100%;
  align-items:center;
  justify-content:space-between;
  gap:0;
  flex-direction:row;
}
.feature-icon-shell{
  display:flex;
  width:66rpx;
  height:66rpx;
  flex:0 0 66rpx;
  align-items:center;
  justify-content:center;
  border:1rpx solid rgba(255,255,255,.48);
  border-radius:20rpx;
  background:rgba(255,255,255,.15);
  box-shadow:inset 0 1rpx 1rpx rgba(255,255,255,.24);
}
.feature-icon-shell image{
  position:static;
  width:40rpx;
  height:40rpx;
  opacity:1;
}
.online-chip{
  display:flex;
  height:40rpx;
  align-items:center;
  padding:0 12rpx;
  border:1rpx solid rgba(255,255,255,.42);
  border-radius:999rpx;
  background:rgba(255,255,255,.18);
  box-shadow:inset 0 1rpx 1rpx rgba(255,255,255,.2);
}
.online-dot{width:11rpx;height:11rpx;margin-right:7rpx;border:2rpx solid rgba(255,255,255,.55);border-radius:50%;background:#d9ff86;box-shadow:0 0 0 5rpx rgba(222,255,155,.12)}
.online-chip.offline{background:rgba(15,55,63,.12)}
.online-chip.offline .online-dot{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.72);box-shadow:none}
.online-chip text{color:#fff;font-size:18rpx;font-weight:750;line-height:1;white-space:nowrap}
.feature-card>.feature-copy{
  position:relative;
  z-index:2;
  display:flex;
  min-width:0;
  gap:6rpx;
  flex-direction:column;
}
.feature-card .feature-title{color:#fff;font-size:29rpx;font-weight:750;line-height:1.08;letter-spacing:-.018em;white-space:nowrap}
.feature-card .feature-description{overflow:hidden;color:rgba(255,255,255,.92);font-size:20rpx;font-weight:550;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
@media screen and (max-height:700px){.feature-card{height:180rpx;padding:16rpx;border-radius:27rpx}.feature-icon-shell{width:60rpx;height:60rpx;flex-basis:60rpx;border-radius:18rpx}.feature-icon-shell image{width:37rpx;height:37rpx}.feature-card .feature-title{font-size:27rpx}.feature-card .feature-description{font-size:19rpx}}
/* #ifdef H5 */
.head-action,.order-panel,.tools-panel{-webkit-backdrop-filter:saturate(155%) blur(18px);backdrop-filter:saturate(155%) blur(18px)}
/* #endif */
</style>
