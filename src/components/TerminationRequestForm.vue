<template>
  <view class="termination-card">
    <button v-if="!expanded" class="termination-entry" @tap="expanded = true">服务无法继续？申请提前终止 <text>›</text></button>
    <template v-else>
      <text class="termination-title">申请提前终止服务</text>
      <text class="termination-help">提交后暂停自动确认和分账，由客服核定责任及退款。请如实填写实际结束时间，不按时长自动折半退款。</text>
      <text class="termination-label">实际结束时间（北京时间）</text>
      <view class="termination-time">
        <picker mode="date" :value="endDate" :end="today" :disabled="saving" @change="endDate = $event.detail.value"><view class="termination-picker">{{ endDate }} ▾</view></picker>
        <picker mode="time" :value="endTime" :disabled="saving" @change="endTime = $event.detail.value"><view class="termination-picker">{{ endTime }} ▾</view></picker>
      </view>
      <text class="termination-label">实际情况与诉求</text>
      <textarea v-model="reason" class="termination-reason" :disabled="saving" maxlength="1000" placeholder="例如：达人何时离场、已提供哪些服务、是否协商过（至少 5 个字）" />
      <text class="termination-label">证明材料（选填，最多 3 张）</text>
      <view class="termination-photos">
        <view v-for="(item, index) in images" :key="item.id" class="termination-photo">
          <image class="termination-image" :src="item.url" mode="aspectFill" @tap="preview(index)" />
          <button class="termination-remove" :disabled="saving || uploading" :aria-label="'移除第' + (index + 1) + '张凭证'" @tap="images.splice(index, 1)">移除</button>
        </view>
        <button v-if="images.length < 3" class="termination-add" :disabled="uploading || saving" @tap="chooseImages">{{ uploading ? '上传中…' : '+ 凭证' }}</button>
      </view>
      <text v-if="error" class="termination-error">{{ error }}</text>
      <view class="termination-actions">
        <button class="termination-cancel" :disabled="saving || uploading" @tap="expanded = false">暂不申请</button>
        <button class="termination-submit" :disabled="saving || uploading" @tap="submit">{{ saving ? '提交中…' : '提交客服核查' }}</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createTerminationRequest, uploadProviderOrderAfterSalesEvidence } from '@/services/orders'
import { getErrorMessage } from '@/utils/formatters'

const props = defineProps<{ orderNo: string }>()
const emit = defineEmits<{ (event: 'submitted'): void }>()
const openedAt = Date.now()
const chinaNow = new Date(openedAt + 8 * 3600 * 1000).toISOString()
const today = chinaNow.slice(0, 10)
const endDate = ref(today)
const endTime = ref(chinaNow.slice(11, 16))
const expanded = ref(false)
const reason = ref('')
const images = ref<Array<{ id: string; url: string }>>([])
const saving = ref(false)
const uploading = ref(false)
const error = ref('')

function preview(index: number) { uni.previewImage({ current: index, urls: images.value.map(item => item.url) }) }
function chooseImages() {
  if (saving.value || uploading.value) return
  uni.chooseImage({
    count: 3 - images.value.length, sizeType: ['compressed'],
    success: async ({ tempFilePaths, tempFiles }) => {
      uploading.value = true
      error.value = ''
      try {
        for (let index = 0; index < tempFilePaths.length; index += 1) {
          const picked = Array.isArray(tempFiles) ? tempFiles[index] : tempFiles
          const file = picked && typeof picked === 'object' && 'file' in picked ? picked.file : undefined
          images.value.push((await uploadProviderOrderAfterSalesEvidence(tempFilePaths[index], file)).data)
        }
      } catch (cause) { error.value = getErrorMessage(cause, '凭证上传失败，请重试') }
      finally { uploading.value = false }
    },
  })
}
async function submit() {
  if (saving.value || uploading.value) return
  error.value = ''
  if (reason.value.trim().length < 5) { error.value = '请至少填写 5 个字的实际情况'; return }
  const endedAt = endDate.value === today && endTime.value === chinaNow.slice(11, 16)
    ? new Date(openedAt) : new Date(endDate.value + 'T' + endTime.value + ':00+08:00')
  if (!Number.isFinite(endedAt.getTime()) || endedAt.getTime() > Date.now()) { error.value = '请选择有效的实际结束时间，不能晚于当前时间'; return }
  saving.value = true
  try {
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({
      title: '提交提前终止申请？',
      content: '提交后订单进入客服核查，暂停自动确认与分账。退款金额由客服审核，不会立即退款。',
      confirmText: '确认提交', success: result => resolve(result.confirm), fail: () => resolve(false),
    }))
    if (!confirmed) return
    await createTerminationRequest(props.orderNo, {
      ended_at: endedAt.toISOString(), reason: reason.value.trim(), evidence_asset_ids: images.value.map(item => item.id),
    })
    uni.showToast({ title: '已提交客服核查', icon: 'none' })
    expanded.value = false
    emit('submitted')
  } catch (cause) { error.value = getErrorMessage(cause, '申请失败，请重试') }
  finally { saving.value = false }
}
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;
.termination-card{margin:24rpx 0;padding:24rpx;border:1rpx solid $dz-border-subtle;border-radius:24rpx;background:$dz-surface-card}
.termination-entry{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:88rpx;margin:0;padding:0;background:transparent;color:$dz-text-primary;font-size:28rpx;line-height:1.5;text-align:left}
.termination-entry::after,.termination-remove::after,.termination-add::after,.termination-cancel::after,.termination-submit::after{border:0}
.termination-title{display:block;color:$dz-text-primary;font-weight:600;font-size:30rpx}.termination-help{display:block;margin:14rpx 0;color:$dz-text-secondary;font-size:24rpx;line-height:1.7}
.termination-label{display:block;margin:22rpx 0 12rpx;font-size:26rpx;font-weight:500;color:$dz-text-primary}.termination-time{display:flex;gap:16rpx}.termination-picker{display:flex;align-items:center;min-height:88rpx;padding:0 22rpx;background:$dz-surface-page;border:1rpx solid $dz-border-subtle;border-radius:16rpx;font-size:28rpx}
.termination-reason{box-sizing:border-box;width:100%;height:180rpx;padding:20rpx;border:1rpx solid $dz-border-subtle;border-radius:16rpx;background:$dz-surface-page;font-size:26rpx;line-height:1.6}
.termination-photos{display:flex;gap:16rpx;flex-wrap:wrap}.termination-photo{width:144rpx}.termination-image{width:144rpx;height:144rpx;border-radius:14rpx}.termination-remove{display:flex;align-items:center;justify-content:center;min-height:72rpx;margin:0;padding:0;font-size:24rpx;line-height:1.3;background:$dz-surface-page;color:$dz-text-secondary}
.termination-add{display:flex;align-items:center;justify-content:center;width:144rpx;height:144rpx;margin:0;padding:0;color:$dz-brand-deep;background:$dz-brand-soft;font-size:24rpx;line-height:1.5}
.termination-error{display:block;margin:18rpx 0;color:#bb3333;font-size:24rpx;line-height:1.6}.termination-actions{display:flex;gap:16rpx;margin-top:24rpx}.termination-cancel,.termination-submit{display:flex;align-items:center;justify-content:center;flex:1;min-height:88rpx;margin:0;padding:12rpx;border-radius:18rpx;font-size:28rpx;line-height:1.4}.termination-cancel{color:$dz-text-secondary;background:$dz-surface-page}.termination-submit{color:#fff;background:$dz-brand-primary}.termination-submit:active,.termination-entry:active{opacity:.78}
</style>
