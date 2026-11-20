<template>
  <view class="dz-page">
    <view class="dz-safe-top" />
    <view class="store-heading dz-container">门店工作台</view>
    <view class="dz-container store-content">
      <NetworkState v-if="loading" loading message="正在加载门店信息…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <view class="store-card">
          <text class="store-name">{{ data.source.name }}</text>
          <button class="entry" @tap="open('/pages/identity/index')">
            <text>实名认证</text><text class="muted">{{ identityLabels[data.identity_status] || '未认证' }} ›</text>
          </button>
          <button class="entry" @tap="open('/pages/receiving-account/index')">
            <text>收款账户</text><text class="muted">{{ receivingLabel }} ›</text>
          </button>
          <button class="entry" @tap="open('/pages/income/index')">
            <text>余额与提现</text><text class="muted">¥{{ formatAmount(available) }} ›</text>
          </button>
        </view>
        <view v-if="data.enabled" class="store-card invite-card">
          <text class="section-title">门店邀请</text>
          <image class="qr" :src="data.qr_data" mode="aspectFit" :show-menu-by-longpress="true" />
          <text class="muted">邀请码 {{ data.source.code }}</text>
          <button class="secondary" @tap="copyLink">复制邀请链接</button>
        </view>
        <view class="store-card">
          <text class="section-title">邀请奖励</text>
          <text v-if="!data.items.length" class="empty muted">暂无奖励记录</text>
          <view v-for="item in data.items" :key="item.public_id" class="reward-row">
            <view>
              <text>{{ item.reward_kind_label }} · {{ item.invitee_phone_masked }}</text>
              <text v-if="item.order_no" class="detail muted">{{ item.order_no }}</text>
              <text class="detail muted">{{ formatBusinessShortDate(item.order_completed_at || item.created_at) }}</text>
            </view>
            <view class="amount">
              <text>¥{{ formatAmount(item.amount) }}</text><text class="detail muted">{{ item.status_label }}</text>
            </view>
          </view>
          <view v-if="data.pagination.total > 20" class="pagination">
            <button class="secondary" :disabled="page <= 1" @tap="turn(-1)">上一页</button>
            <text>{{ page }}</text>
            <button class="secondary" :disabled="page * 20 >= data.pagination.total" @tap="turn(1)">下一页</button>
          </view>
        </view>
        <button class="log-out" @tap="signOut">退出登录</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { request } from '@/services/http'
import { logout } from '@/services/auth'
import { getProviderIncome } from '@/services/providers'
import { guardCurrentPage } from '@/services/session'
import { formatAmount, formatBusinessShortDate, getErrorMessage } from '@/utils/formatters'

interface StoreOverview {
  source: { name: string; code: string; invite_url: string }
  enabled: boolean
  qr_data: string
  identity_status: string
  receiving_status: string
  items: Array<{
    public_id: string; reward_kind_label: string; invitee_phone_masked: string
    order_no: string | null; order_completed_at: string | null; amount: number
    status_label: string; created_at: string
  }>
  pagination: { total: number }
}

const data = ref<StoreOverview | null>(null)
const loading = ref(true), error = ref(''), page = ref(1), available = ref(0)
const identityLabels: Record<string, string> = {
  unverified: '未认证', pending: '审核中', verified: '已认证', rejected: '未通过',
}
const receivingLabel = computed(() => {
  const status = data.value?.receiving_status
  if (!status || status === 'not_connected') return '未开通'
  return status === 'active' ? '已开通' : '查看进度'
})

async function load() {
  if (!guardCurrentPage()) return
  loading.value = true
  error.value = ''
  try {
    const [store, income] = await Promise.all([
      request<{ data: StoreOverview }>('/growth/provider-invites/store/me/', { query: { page: page.value } }),
      getProviderIncome(),
    ])
    data.value = store.data
    available.value = income.data.wallet?.available_amount || 0
  } catch (reason) {
    error.value = getErrorMessage(reason, '门店信息加载失败')
  } finally { loading.value = false }
}

function open(url: string) { uni.navigateTo({ url }) }
function turn(offset: number) { page.value += offset; void load() }
function copyLink() {
  if (data.value?.enabled) uni.setClipboardData({ data: data.value.source.invite_url })
}
async function signOut() {
  try { await logout() }
  finally { uni.reLaunch({ url: '/pages/auth/login' }) }
}
onShow(load)
</script>

<style scoped>
.store-heading { min-height: 96rpx; display: flex; align-items: center; font-size: 34rpx; font-weight: 700; }
.store-content { padding-bottom: calc(36rpx + env(safe-area-inset-bottom)); }
.store-card { padding: 28rpx; margin: 0 0 20rpx; background: #fff; border: 1px solid #e1ebee; border-radius: 24rpx; }
.store-name { display: block; font-size: 39rpx; font-weight: 700; margin-bottom: 14rpx; overflow-wrap: anywhere; }
.entry { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; width: 100%; min-height: 92rpx; padding: 0; border-top: 1px solid #edf2f3; background: transparent; text-align: left; font-size: 27rpx; line-height: 1.45; }
.entry::after, .secondary::after, .log-out::after { border: 0; }
.muted { color: #65747a; font-size: 24rpx; }
.invite-card { display: flex; flex-direction: column; align-items: center; gap: 14rpx; }
.section-title { font-size: 31rpx; font-weight: 650; }
.qr { width: 340rpx; height: 340rpx; }
.secondary, .log-out { min-height: 76rpx; padding: 0 22rpx; border-radius: 14rpx; color: #08787e; background: #eaf8f7; font-size: 25rpx; }
.log-out { width: 100%; color: #a9442d; background: white; }
.reward-row { display: flex; justify-content: space-between; gap: 16rpx; padding: 20rpx 0; border-bottom: 1px solid #edf2f3; font-size: 26rpx; }
.detail, .empty { display: block; margin-top: 10rpx; }
.amount { flex: none; text-align: right; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-top: 18rpx; }
</style>
