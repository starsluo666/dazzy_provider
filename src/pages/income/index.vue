<template>
  <view class="dz-page income-page">
    <view class="dz-safe-top" />
    <header class="dz-page-head dz-container"><button @tap="goBack">‹</button><strong class="strong-text">收入明细</strong><view /></header>
    <main class="dz-container">
      <NetworkState v-if="loading" loading message="正在加载收入…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <section class="income-hero">
          <text>{{ data.wallet ? '可提现余额' : '本月预计收入' }}</text><strong class="strong-text">¥{{ formatAmount(data.wallet ? data.wallet.available_amount : data.summary.month_income_amount) }}</strong>
          <view><span>本月预计 ¥{{ formatAmount(data.summary.month_income_amount) }}</span><span>{{ data.summary.month_order_count }} 笔结算</span></view>
          <button v-if="data.wallet" class="withdraw-button" :class="{ 'is-disabled': busy || (!data.wallet.can_withdraw && !pendingRequest) }" :disabled="busy || (!data.wallet.can_withdraw && !pendingRequest)" @tap="openWithdrawal">{{ pendingRequest ? '核实上次提现申请' : '提现到本人银行卡' }}</button>
        </section>
        <text v-if="data.wallet?.unavailable_reason" class="ledger-note">{{ data.wallet.unavailable_reason }}</text>
        <view v-if="data.wallet" class="cash-summary"><text>提现中 ¥{{ formatAmount(data.wallet.reserved_amount) }}</text><text>已提现 ¥{{ formatAmount(data.wallet.paid_amount) }}</text></view>
        <view v-if="showWithdrawal" class="withdraw-form">
          <text class="withdraw-title">提现金额</text>
          <view class="amount-field"><text>¥</text><input v-model="withdrawAmount" class="amount-input" type="digit" :disabled="busy || !!pendingRequest" placeholder="输入提现金额" aria-label="提现金额" /></view>
          <text class="ledger-note">手续费由平台承担，仅转入已核验的本人银行卡。T1 为下一工作日，D1 为下一自然日；实际以渠道处理结果为准。</text>
          <text v-if="pendingRequest" class="ledger-note">上次申请未收到明确响应，将使用原申请标识核实，不会重复发起。</text>
          <view class="withdraw-actions"><button class="cash-secondary" :disabled="busy" @tap="showWithdrawal = false">收起</button><button class="cash-primary" :disabled="busy" :loading="busy" @tap="confirmWithdrawal">{{ pendingRequest ? '核实原申请' : '确认提现' }}</button></view>
          <text v-if="cashError" class="cash-error">{{ cashError }}</text>
        </view>
        <section class="balance-row">
          <view><text>冻结中</text><strong class="strong-text">¥{{ formatAmount(data.summary.pending_amount) }}</strong></view>
          <i />
          <view><text>累计账务结算</text><strong class="strong-text">¥{{ formatAmount(data.summary.settled_amount) }}</strong></view>
        </section>
        <button class="receiving-entry" hover-class="dz-pressed" @tap="openReceivingAccount">
          <view class="receiving-copy"><text class="receiving-title">收款账户</text><text class="receiving-note">管理本人银行卡 · 查看渠道开通状态</text></view>
          <text class="receiving-arrow">›</text>
        </button>
        <text class="ledger-note">订单完成并满足结算条件、渠道分账核验成功后才计入可提现余额。下方账务结算记录不等于余额或银行卡到账。</text>
        <template v-if="data.wallet?.withdrawals.length">
          <h2 class="section-title">提现记录</h2>
          <view class="withdraw-record" v-for="item in data.wallet.withdrawals" :key="item.withdrawal_no">
            <view class="cash-record-head"><text class="withdraw-title">¥{{ formatAmount(item.amount) }}</text><text class="cash-state">{{ item.status_label }}</text></view>
            <text class="cash-record-note">{{ item.bank_name }} {{ item.bank_card_masked }} · {{ formatDate(item.created_at) }}</text>
            <button v-if="['submitting', 'processing', 'unknown'].includes(item.status)" class="cash-secondary" :disabled="busy" @tap="refreshWithdrawal(item.withdrawal_no)">刷新到账状态</button>
          </view>
        </template>
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
import { getProviderIncome, createProviderWithdrawal, refreshProviderWithdrawal } from '@/services/providers'
import { getStoredUser } from '@/services/session'
import type { ProviderIncomeData } from '@/types/api'
import { formatAmount, formatBusinessShortDate, getErrorMessage } from '@/utils/formatters'

const data = ref<ProviderIncomeData | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const showWithdrawal = ref(false)
const withdrawAmount = ref('')
const cashError = ref('')
const pendingRequest = ref<{ amount: number; request_key: string } | null>(null)
const pendingStorageKey = () => `provider-withdrawal:${getStoredUser()?.public_id || 'unknown'}`
function openWithdrawal() {
  cashError.value = ''
  withdrawAmount.value = pendingRequest.value ? (pendingRequest.value.amount / 100).toFixed(2) : ''
  showWithdrawal.value = true
}
function confirmWithdrawal() {
  if (busy.value) return
  if (pendingRequest.value) { void sendWithdrawal(); return }
  if (!/^\d+(\.\d{1,2})?$/.test(withdrawAmount.value)) { cashError.value = '请输入有效金额，最多两位小数'; return }
  const amount = Math.round(Number(withdrawAmount.value) * 100)
  const wallet = data.value?.wallet
  if (!wallet || !wallet.can_withdraw || !Number.isSafeInteger(amount) || amount <= 0 || amount > Math.min(wallet.available_amount, wallet.max_withdrawal_amount)) {
    cashError.value = '金额须大于零且不超过可提现余额和单笔限额'; return
  }
  busy.value = true
  uni.showModal({ title: '确认提现', content: `提现 ¥${formatAmount(amount)} 至本人已绑定银行卡，手续费由平台承担。`,
    success: (result) => {
      if (result.confirm) {
        const request_key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => { const value = Math.floor(Math.random() * 16); return (char === 'x' ? value : (value & 3) | 8).toString(16) })
        pendingRequest.value = { amount, request_key }
        // Persist before sending so app reloads and network retries reuse the same ID.
        try { uni.setStorageSync(pendingStorageKey(), pendingRequest.value) }
        catch {
          pendingRequest.value = null
          busy.value = false
          cashError.value = '无法保存提现申请标识，尚未发起提现，请检查设备存储后重试'
          return
        }
        void sendWithdrawal(true)
      } else { busy.value = false }
    }, fail: () => { busy.value = false },
  })
}
async function sendWithdrawal(initialAttempt = false) {
  const pending = pendingRequest.value
  const storageKey = pendingStorageKey()
  if (!pending) return
  busy.value = true
  cashError.value = ''
  try {
    const result = await createProviderWithdrawal(pending.amount, pending.request_key)
    pendingRequest.value = null
    uni.removeStorageSync(storageKey)
    showWithdrawal.value = false
    uni.showToast({ title: result.data.status_label, icon: 'none' })
    await load()
  } catch (reason) {
    cashError.value = getErrorMessage(reason)
    const status = (reason as { status?: number }).status
    // A retry can fail preflight while the first timed-out request is still running.
    // Only a definitive rejection of the ORIGINAL attempt can discard its key.
    if (initialAttempt && (status === 400 || status === 403 || status === 422)) {
      pendingRequest.value = null
      uni.removeStorageSync(storageKey)
    }
  } finally { busy.value = false }
}
async function refreshWithdrawal(withdrawalNo: string) {
  if (busy.value) return
  busy.value = true
  try { const result = await refreshProviderWithdrawal(withdrawalNo); uni.showToast({ title: result.data.status_label, icon: 'none' }); await load() }
  catch (reason) { uni.showToast({ title: getErrorMessage(reason), icon: 'none' }) }
  finally { busy.value = false }
}
function goBack() { uni.navigateBack() }
function openReceivingAccount() { uni.navigateTo({ url: '/pages/receiving-account/index' }) }
const formatDate = formatBusinessShortDate
async function load() {
  pendingRequest.value = uni.getStorageSync(pendingStorageKey()) || null
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
.withdraw-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:88rpx;margin-top:28rpx;padding:18rpx 24rpx;line-height:1.4;font-size:28rpx;font-weight:600;color:#087f86;background:#fff;border-radius:20rpx}
.withdraw-button::after,.cash-primary::after,.cash-secondary::after{border:0}
.withdraw-button.is-disabled{color:#5e777b;background:#e3eeee}
.cash-summary{display:flex;justify-content:space-between;gap:16rpx;margin:20rpx 8rpx;font-size:25rpx;color:$dz-text-secondary}
.withdraw-form,.withdraw-record{padding:26rpx;margin-top:20rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff}
.withdraw-title{font-size:29rpx;font-weight:600}
.amount-field{display:flex;align-items:center;gap:16rpx;margin-top:20rpx;padding:0 22rpx;border:1rpx solid $dz-border;border-radius:18rpx;background:#f7fafa}
.amount-input{flex:1;min-width:0;height:92rpx;line-height:92rpx;font-size:32rpx}
.withdraw-actions{display:flex;gap:16rpx}
.cash-primary,.cash-secondary{display:flex;align-items:center;justify-content:center;flex:1;min-height:88rpx;padding:18rpx 22rpx;margin:0;line-height:1.4;font-size:28rpx;font-weight:600;border-radius:18rpx}
.cash-primary{color:#fff;background:#087f86}.cash-secondary{color:#087f86;background:#e9f6f6}
.cash-error{display:block;margin-top:16rpx;color:$dz-danger;font-size:25rpx;line-height:1.5}
.cash-record-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}
.cash-state,.cash-record-note{font-size:24rpx;color:$dz-text-secondary}
.cash-record-note{display:block;margin:16rpx 0;line-height:1.5}
.receiving-entry{display:flex;min-height:104rpx;width:100%;align-items:center;justify-content:space-between;margin:22rpx 0 0;padding:20rpx 26rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;text-align:left;line-height:1.5}.receiving-entry::after{border:0}.receiving-copy{display:flex;gap:6rpx;flex-direction:column}.receiving-title{font-size:28rpx;font-weight:600}.receiving-note,.ledger-note{font-size:23rpx;color:$dz-text-secondary}.receiving-arrow{font-size:36rpx;color:$dz-text-tertiary}.ledger-note{display:block;margin:16rpx 8rpx;line-height:1.6}
.income-page{background:linear-gradient(180deg,#edfbfb,#fff 380rpx,#f7f9fa 100%)}.dz-page-head>view{width:80rpx}.income-hero{padding:36rpx 32rpx;border-radius:30rpx;color:#fff;background:linear-gradient(135deg,#21d1cd,#08a9b1);box-shadow:0 18rpx 38rpx rgba(8,169,177,.2)}.income-hero>text{font-size:21rpx}.income-hero>.strong-text{display:block;margin-top:12rpx;font-size:56rpx}.income-hero>view{display:flex;gap:20rpx;margin-top:27rpx}.income-hero span{padding:10rpx 18rpx;border-radius:22rpx;background:rgba(255,255,255,.17);font-size:19rpx}.balance-row{display:grid;grid-template-columns:1fr 1rpx 1fr;align-items:center;margin-top:20rpx;padding:25rpx;border:1rpx solid $dz-border;border-radius:25rpx;background:#fff;box-shadow:$dz-shadow-soft}.balance-row>view{display:flex;align-items:center;flex-direction:column;gap:8rpx}.balance-row text{color:$dz-text-secondary;font-size:18rpx}.balance-row .strong-text{color:$dz-brand-deep;font-size:28rpx}.balance-row i{height:55rpx;background:$dz-border}.section-title{margin:32rpx 4rpx 18rpx;font-size:27rpx}.income-list{display:flex;gap:16rpx;flex-direction:column}.income-list button{display:block;width:100%;margin:0;padding:25rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;text-align:left;box-shadow:$dz-shadow-soft}.income-list button::after{display:none}.record-head,.record-foot,.breakdown{display:flex;align-items:center;justify-content:space-between}.record-head>view{display:flex;gap:6rpx;flex-direction:column}.record-head .strong-text{font-size:23rpx}.record-head text{color:$dz-text-tertiary;font-size:16rpx}.record-head>.amount{color:$dz-brand-deep;font-size:27rpx}.record-foot{margin-top:17rpx;padding-top:15rpx;border-top:1rpx solid $dz-border;color:$dz-text-secondary;font-size:17rpx}.status{color:#db8a2e}.status.settled{color:$dz-online}.status.dispute_frozen{color:$dz-danger}.status.cancelled{color:$dz-text-tertiary}.breakdown{margin-top:12rpx;color:$dz-text-tertiary;font-size:15rpx}.empty-income{display:flex;align-items:center;gap:10rpx;padding:70rpx 20rpx;border:1rpx solid $dz-border;border-radius:24rpx;background:#fff;flex-direction:column}.empty-income .strong-text{font-size:23rpx}.empty-income text{color:$dz-text-secondary;font-size:18rpx}
</style>
