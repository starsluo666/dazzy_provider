<template>
  <view v-if="info?.policy?.version" class="wait-card">
    <text class="wait-card__title">到场与取消规则</text>
    <text class="wait-card__note">下单出行方式：{{ info.transport_mode_label }}。路费按本单已支付往返交通费核算；空单补偿及违约金按原订单比例分成。</text>
    <template v-if="info.decision?.rule">
      <text class="wait-card__note">{{ info.decision.label }} · 应退 ¥{{ ((info.decision.refund_amount || 0) / 100).toFixed(2) }}</text>
      <text class="wait-card__notice">{{ info.finance_notice || '无剩余款需要结算。' }}</text>
    </template>
    <template v-else-if="status === 'departed' && info.arrived_at">
      <text v-if="info.wait_state === 'waiting'" class="wait-card__notice">等待至 {{ formatBusinessDateTime(info.wait_deadline_at || '') }}。联系上用户后请立即结束等待，不要继续记为空单。</text>
      <button v-if="info.wait_state === 'waiting'" class="wait-card__button" :disabled="busy" @tap="act('respond')">已联系上用户 · 结束等待</button>
      <button v-else-if="!info.wait_state" class="wait-card__button" :disabled="busy" @tap="askWait">联系不上用户 · 发起等待</button>
      <text v-else class="wait-card__notice">{{ info.wait_state === 'review' ? '等待已转客服核查，请联系客服。' : '本次等待已结束；如仍无法服务，请联系客服。' }}</text>
    </template>
    <text v-else-if="status === 'departed'" class="wait-card__note">上传集合照并通过当前定位核验后记录首次到场。到场后请再次点击联系，再确认是否需要等待。</text>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { ProviderManagedOrder } from '@/types/api'
import { request } from '@/services/http'
import { formatBusinessDateTime, getErrorMessage } from '@/utils/formatters'
const props = defineProps<{ orderNo: string; status: string; info?: ProviderManagedOrder['cancellation'] }>()
const emit = defineEmits<{ changed: [] }>()
const busy = ref(false)
function askWait() {
  if (busy.value) return
  uni.showModal({ title: '确认联系不上用户？', content: '请先到场并再次拨打用户电话。仅点击联系不代表实际接通；虚假到场或联系记录会交客服核查。等待不早于预约开始计时，系统将通知用户。', confirmText: '确认失联', success: (r) => { if (r.confirm) void act('start') } })
}
async function act(action: 'start' | 'respond') {
  if (busy.value) return
  busy.value = true
  try { await request(`/providers/me/orders/${encodeURIComponent(props.orderNo)}/customer-wait/`, { method: 'POST', data: { action, unreachable_confirmed: action === 'start' } }); emit('changed') }
  catch (e) { uni.showToast({ title: getErrorMessage(e, '操作失败，请刷新后重试'), icon: 'none' }) }
  finally { busy.value = false }
}
</script>
<style scoped>
.wait-card { padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid #e4eded; border-radius: 26rpx; background: #fff; }
.wait-card__title { display: block; font-size: 30rpx; font-weight: 600; color: #182230; }
.wait-card__note { display: block; margin-top: 16rpx; font-size: 25rpx; color: #667085; line-height: 1.7; }
.wait-card__notice { display: block; margin-top: 18rpx; background: #fff7ed; color: #9a5825; padding: 20rpx; font-size: 26rpx; line-height: 1.6; border-radius: 18rpx; }
.wait-card__button { margin: 22rpx 0 0; padding: 22rpx 12rpx; font-size: 27rpx; line-height: 1.5; color: #007e86; background: #e7f7f7; border-radius: 18rpx; font-weight: 600; }
.wait-card__button::after { border: 0; }
</style>
