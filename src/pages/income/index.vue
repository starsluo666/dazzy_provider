<template>
  <view class="dz-page income-page">
    <view class="dz-safe-top" />
    <header class="dz-page-head dz-container"><button @tap="goBack">‹</button><strong class="strong-text">收入明细</strong><view /></header>
    <main class="dz-container">
      <NetworkState v-if="loading" loading message="正在加载收入…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <section class="income-hero">
          <text>本月预计收入</text><strong class="strong-text">¥{{ formatAmount(data.summary.month_income_amount) }}</strong>
          <view><span>{{ data.summary.month_order_count }} 笔结算</span><span>服务完成后生成</span></view>
        </section>
        <section class="balance-row">
          <view><text>冻结中</text><strong class="strong-text">¥{{ formatAmount(data.summary.pending_amount) }}</strong></view>
          <i />
          <view><text>累计账务结算</text><strong class="strong-text">¥{{ formatAmount(data.summary.settled_amount) }}</strong></view>
        </section>
        <button class="receiving-entry" hover-class="dz-pressed" @tap="openReceivingAccount">
          <view class="receiving-copy"><text class="receiving-title">收款账户</text><text class="receiving-note">管理本人银行卡 · 查看渠道开通状态</text></view>
          <text class="receiving-arrow">›</text>
        </button>
        <text class="ledger-note">以上为平台账务记录，不代表渠道已分账或银行卡已到账。</text>
        <h2 class="section-title">结算记录</h2>
        <section v-if="data.items.length" class="income-list">
          <button v-for="item in data.items" :key="item.settlement_no">
            <view class="record-head"><view><strong class="strong-text">{{ item.service_name }}</strong><text>{{ item.order_no }}</text></view><strong class="amount">+¥{{ formatAmount(item.settlement_amount) }}</strong></view>
            <view class="record-foot"><text :class="`status ${item.status}`">{{ item.status_label }}</text><text>{{ item.settled_at ? `账务结算 ${formatDate(item.settled_at)}` : `预计 ${formatDate(item.freeze_until)} 账务结算` }}</text></view>
            <view class="breakdown"><text>服务收入 ¥{{ formatAmount(item.service_income_amount) }}</text><text>交通及其他 ¥{{ formatAmount(item.transport_income_amount + item.other_income_amount) }}</text></view>
          </button>
        </section>
        <section v-else class="empty-income"><strong class="strong-text">暂无结算记录</strong><text>服务完成并经用户确认后，收入会在这里展示。</text></section>
      </template>
    </main>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { getProviderIncome } from '@/services/providers'
import type { ProviderIncomeData } from '@/types/api'
import { formatAmount, formatBusinessShortDate, getErrorMessage } from '@/utils/formatters'

const data = ref<ProviderIncomeData | null>(null)
const loading = ref(true)
const error = ref('')
function goBack() { uni.navigateBack() }
function openReceivingAccount() { uni.navigateTo({ url: '/pages/receiving-account/index' }) }
const formatDate = formatBusinessShortDate
async function load() {
  loading.value = true
  error.value = ''
  try { data.value = (await getProviderIncome()).data }
  catch (reason) { error.value = getErrorMessage(reason) }
  finally { loading.value = false }
}
onShow(load)
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.receiving-entry{display:flex;min-height:104rpx;width:100%;align-items:center;justify-content:space-between;margin:22rpx 0 0;padding:20rpx 26rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;text-align:left;line-height:1.5}.receiving-entry::after{border:0}.receiving-copy{display:flex;gap:6rpx;flex-direction:column}.receiving-title{font-size:28rpx;font-weight:600}.receiving-note,.ledger-note{font-size:23rpx;color:$dz-text-secondary}.receiving-arrow{font-size:36rpx;color:$dz-text-tertiary}.ledger-note{display:block;margin:16rpx 8rpx;line-height:1.6}
.income-page{background:linear-gradient(180deg,#edfbfb,#fff 380rpx,#f7f9fa 100%)}.dz-page-head>view{width:80rpx}.income-hero{padding:36rpx 32rpx;border-radius:30rpx;color:#fff;background:linear-gradient(135deg,#21d1cd,#08a9b1);box-shadow:0 18rpx 38rpx rgba(8,169,177,.2)}.income-hero>text{font-size:21rpx}.income-hero>.strong-text{display:block;margin-top:12rpx;font-size:56rpx}.income-hero>view{display:flex;gap:20rpx;margin-top:27rpx}.income-hero span{padding:10rpx 18rpx;border-radius:22rpx;background:rgba(255,255,255,.17);font-size:19rpx}.balance-row{display:grid;grid-template-columns:1fr 1rpx 1fr;align-items:center;margin-top:20rpx;padding:25rpx;border:1rpx solid $dz-border;border-radius:25rpx;background:#fff;box-shadow:$dz-shadow-soft}.balance-row>view{display:flex;align-items:center;flex-direction:column;gap:8rpx}.balance-row text{color:$dz-text-secondary;font-size:18rpx}.balance-row .strong-text{color:$dz-brand-deep;font-size:28rpx}.balance-row i{height:55rpx;background:$dz-border}.section-title{margin:32rpx 4rpx 18rpx;font-size:27rpx}.income-list{display:flex;gap:16rpx;flex-direction:column}.income-list button{display:block;width:100%;margin:0;padding:25rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;text-align:left;box-shadow:$dz-shadow-soft}.income-list button::after{display:none}.record-head,.record-foot,.breakdown{display:flex;align-items:center;justify-content:space-between}.record-head>view{display:flex;gap:6rpx;flex-direction:column}.record-head .strong-text{font-size:23rpx}.record-head text{color:$dz-text-tertiary;font-size:16rpx}.record-head>.amount{color:$dz-brand-deep;font-size:27rpx}.record-foot{margin-top:17rpx;padding-top:15rpx;border-top:1rpx solid $dz-border;color:$dz-text-secondary;font-size:17rpx}.status{color:#db8a2e}.status.settled{color:$dz-online}.status.dispute_frozen{color:$dz-danger}.status.cancelled{color:$dz-text-tertiary}.breakdown{margin-top:12rpx;color:$dz-text-tertiary;font-size:15rpx}.empty-income{display:flex;align-items:center;gap:10rpx;padding:70rpx 20rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;flex-direction:column}.empty-income .strong-text{font-size:23rpx}.empty-income text{color:$dz-text-secondary;font-size:18rpx}
</style>
