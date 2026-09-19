<template>
  <view class="dz-page messages-page">
    <view class="dz-safe-top" />
    <header class="page-head dz-container">
      <button aria-label="返回" hover-class="dz-pressed" @tap="goBack">‹</button>
      <strong class="strong-text">消息中心</strong>
      <button class="read-all" :disabled="markingAll || !currentUnread" @tap="markAll">
        {{ markingAll ? '处理中' : '全部已读' }}
      </button>
    </header>

    <scroll-view scroll-x class="category-tabs" :show-scrollbar="false">
      <view class="tab-row">
        <button
          v-for="tab in categoryTabs"
          :key="tab.value"
          :class="{ active: activeCategory === tab.value }"
          @tap="selectCategory(tab.value)"
        >
          {{ tab.label }}<i v-if="tab.value && summary.category_unread[tab.value]" />
        </button>
      </view>
    </scroll-view>

    <main class="dz-container message-content">
      <NetworkState v-if="loading" message="正在加载消息…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load(true)" />
      <section v-else-if="!items.length" class="empty-state">
        <view class="bubble"><i /><i /><i /></view>
        <strong class="strong-text">暂无{{ activeCategoryLabel }}消息</strong>
        <text>新订单、履约进度和平台通知会集中展示。</text>
      </section>
      <section v-else class="message-list">
        <button
          v-for="item in items"
          :key="item.public_id"
          class="message-row dz-tappable"
          :class="{ unread: !item.is_read }"
          hover-class="dz-pressed"
          @tap="openNotification(item)"
        >
          <view class="message-icon"><image src="/static/tabbar/message-active.svg" mode="aspectFit" /></view>
          <view class="message-copy">
            <view><strong class="strong-text">{{ item.title }}</strong><time>{{ formatTime(item.created_at) }}</time></view>
            <small v-if="item.target_title">{{ item.target_title }}</small>
            <text>{{ item.content }}</text>
            <b v-if="item.action_text">{{ item.action_text }} ›</b>
          </view>
          <i class="unread-dot" />
        </button>
        <text class="load-state">{{ loadingMore ? '正在加载更多…' : items.length >= total ? '没有更多消息了' : '' }}</text>
      </section>
    </main>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications'
import { guardCurrentPage } from '@/services/session'
import type { NotificationCategory, NotificationSummary, UserNotification } from '@/types/api'
import { businessClock, businessDateKey, shiftBusinessDateKey } from '@/utils/businessTime'
import { getErrorMessage } from '@/utils/formatters'

type CategoryFilter = '' | NotificationCategory

const categoryTabs: Array<{ label: string; value: CategoryFilter }> = [
  { label: '全部', value: '' },
  { label: '订单', value: 'order' },
  { label: '客服', value: 'support' },
  { label: '活动', value: 'activity' },
  { label: '系统', value: 'system' },
]
const emptySummary = (): NotificationSummary => ({
  total: 0,
  unread: 0,
  category_unread: { support: 0, order: 0, activity: 0, system: 0 },
})

const items = ref<UserNotification[]>([])
const summary = ref(emptySummary())
const activeCategory = ref<CategoryFilter>('')
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const markingAll = ref(false)
const error = ref('')
const currentUnread = computed(() => activeCategory.value
  ? summary.value.category_unread[activeCategory.value]
  : summary.value.unread)
const activeCategoryLabel = computed(() => categoryTabs.find(tab => tab.value === activeCategory.value)?.label || '')

function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/workbench/index' }) }) }
function formatTime(value: string) {
  if (businessDateKey(value) === businessDateKey()) return businessClock(value)
  if (businessDateKey(value) === shiftBusinessDateKey(businessDateKey(), -1)) return `昨天 ${businessClock(value)}`
  return `${businessDateKey(value).slice(5)} ${businessClock(value)}`
}
async function load(reset = false) {
  if (reset) {
    page.value = 1
    loading.value = true
    error.value = ''
  } else if (loadingMore.value || items.value.length >= total.value) return
  loadingMore.value = !reset
  try {
    const response = await getNotifications({
      category: activeCategory.value || undefined,
      page: page.value,
      pageSize: 20,
    })
    items.value = reset ? response.data.items : [...items.value, ...response.data.items]
    summary.value = response.data.summary
    total.value = response.data.pagination.total
    if (items.value.length < total.value) page.value += 1
  } catch (reason) {
    if (reset) error.value = getErrorMessage(reason, '消息加载失败')
    else uni.showToast({ title: getErrorMessage(reason, '加载更多失败'), icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}
function selectCategory(category: CategoryFilter) {
  if (activeCategory.value === category) return
  activeCategory.value = category
  items.value = []
  total.value = 0
  void load(true)
}
async function markAll() {
  if (!currentUnread.value || markingAll.value) return
  markingAll.value = true
  try {
    const category = activeCategory.value || undefined
    await markAllNotificationsRead(category)
    items.value = items.value.map(item => category && item.category !== category
      ? item
      : { ...item, is_read: true, read_at: new Date().toISOString() })
    if (category) summary.value.category_unread[category] = 0
    else Object.keys(summary.value.category_unread).forEach((key) => { summary.value.category_unread[key as NotificationCategory] = 0 })
    summary.value.unread = Object.values(summary.value.category_unread).reduce((sum, count) => sum + count, 0)
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '操作失败'), icon: 'none' })
  } finally { markingAll.value = false }
}
async function openNotification(item: UserNotification) {
  if (!item.is_read) {
    try {
      const response = await markNotificationRead(item.public_id)
      const index = items.value.findIndex(candidate => candidate.public_id === item.public_id)
      if (index >= 0) items.value[index] = response.data
      summary.value.unread = Math.max(0, summary.value.unread - 1)
      summary.value.category_unread[item.category] = Math.max(0, summary.value.category_unread[item.category] - 1)
    } catch (reason) {
      uni.showToast({ title: getErrorMessage(reason, '标记已读失败'), icon: 'none' })
      return
    }
  }
  if (item.action_url.startsWith('/pages/')) uni.navigateTo({ url: item.action_url })
}

onShow(() => { if (guardCurrentPage()) void load(true) })
onReachBottom(() => { void load(false) })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.messages-page{min-height:100vh;background:linear-gradient(180deg,#e9fafa 0,$dz-surface-page 360rpx)}
.page-head{position:relative;display:flex;height:96rpx;align-items:center;justify-content:center}.page-head>button{position:absolute;height:66rpx;margin:0;padding:0;border:0;background:transparent;line-height:66rpx}.page-head>button::after,.category-tabs button::after,.message-row::after{display:none}.page-head>button:first-child{left:0;width:66rpx;font-size:48rpx}.page-head .read-all{right:0;color:$dz-brand-deep;font-size:21rpx}.page-head .read-all[disabled]{color:$dz-text-tertiary}.page-head .strong-text{font-size:34rpx}
.category-tabs{background:rgba(255,255,255,.78);white-space:nowrap}.tab-row{display:flex;max-width:750px;margin:auto;padding:0 24rpx}.category-tabs button{position:relative;flex:1;height:76rpx;margin:0;padding:0 18rpx;border:0;color:$dz-text-secondary;background:transparent;font-size:22rpx}.category-tabs button.active{color:$dz-brand-deep;font-weight:700}.category-tabs button.active::before{position:absolute;right:24rpx;bottom:0;left:24rpx;height:5rpx;border-radius:5rpx;background:$dz-brand;content:''}.category-tabs button i{position:absolute;top:18rpx;right:17rpx;width:12rpx;height:12rpx;border:2rpx solid #fff;border-radius:50%;background:$dz-danger}
.message-content{padding-top:22rpx;padding-bottom:40rpx}.message-list{overflow:hidden;border:1rpx solid $dz-border-material;border-radius:28rpx;background:$dz-surface-card;box-shadow:$dz-shadow-soft}.message-row{position:relative;display:flex;width:100%;min-height:170rpx;align-items:flex-start;margin:0;padding:25rpx 24rpx;border:0;border-bottom:1rpx solid $dz-border-subtle;background:$dz-surface-card;text-align:left}.message-row.unread{background:#f2fcfc}.message-icon{display:flex;flex:0 0 66rpx;width:66rpx;height:66rpx;align-items:center;justify-content:center;border-radius:20rpx;background:$dz-brand-soft}.message-icon image{width:42rpx;height:42rpx}.message-copy{display:flex;min-width:0;gap:8rpx;margin-left:18rpx;flex:1;flex-direction:column}.message-copy>view{display:flex;align-items:center;justify-content:space-between;gap:12rpx}.message-copy strong{font-size:24rpx}.message-copy time,.message-copy small{color:$dz-text-tertiary;font-size:18rpx}.message-copy>text{color:$dz-text-secondary;font-size:21rpx;line-height:1.55}.message-copy b{color:$dz-brand-deep;font-size:20rpx}.unread-dot{display:none;position:absolute;top:29rpx;right:16rpx;width:12rpx;height:12rpx;border-radius:50%;background:$dz-danger}.unread .unread-dot{display:block}.load-state{display:block;height:70rpx;color:$dz-text-tertiary;font-size:19rpx;line-height:70rpx;text-align:center}
.empty-state{display:flex;min-height:650rpx;align-items:center;justify-content:center;text-align:center;flex-direction:column}.bubble{display:flex;width:126rpx;height:96rpx;align-items:center;justify-content:center;gap:10rpx;border:4rpx solid #8edddb;border-radius:45rpx 45rpx 45rpx 15rpx}.bubble i{width:11rpx;height:11rpx;border-radius:50%;background:$dz-brand}.empty-state .strong-text{margin-top:30rpx;font-size:28rpx}.empty-state>text{margin-top:12rpx;color:$dz-text-secondary;font-size:20rpx}
</style>
