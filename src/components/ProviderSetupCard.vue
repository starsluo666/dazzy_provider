<template>
  <view v-if="setup" class="setup-card">
    <view class="setup-heading">
      <view class="setup-title-group">
        <text class="setup-eyebrow">接单准备</text>
        <text class="setup-title">{{ setup.title }}</text>
      </view>
      <text class="setup-progress">{{ setup.progress }}</text>
    </view>
    <text class="setup-caption">{{ setup.caption }}</text>
    <view class="setup-track" aria-hidden="true">
      <view v-for="step in setup.steps" :key="step.id" class="setup-track-segment" :class="'is-' + step.state" />
    </view>
    <text v-if="setup.rejectionReason" class="setup-reason">{{ setup.rejectionReason }}</text>
    <view class="setup-steps">
      <view
        v-for="step in setup.steps" :key="step.id"
        class="setup-step dz-tappable" :class="'is-' + step.state"
        role="button" :aria-label="step.title + '，' + step.action"
        hover-class="dz-pressed" @tap="openStep(step.id)"
      >
        <view class="setup-icon" aria-hidden="true">
          <view v-if="step.state === 'done'" class="setup-check" />
          <view v-else-if="step.state === 'pending'" class="setup-clock" />
          <text v-else-if="step.state === 'rejected'" class="setup-exclamation">!</text>
          <view v-else>
            <image v-if="step.id === 'identity'" class="setup-icon-image" src="/static/icons/security.svg" mode="aspectFit" />
            <image v-else-if="step.id === 'profile'" class="setup-icon-image" src="/static/icons/orders.svg" mode="aspectFit" />
            <image v-else class="setup-icon-image" src="/static/icons/service.svg" mode="aspectFit" />
          </view>
        </view>
        <view class="setup-copy">
          <text class="setup-step-title">{{ step.title }}</text>
          <text class="setup-description">{{ step.description }}</text>
        </view>
        <view class="setup-action">
          <text>{{ step.action }}</text>
          <view class="setup-chevron" aria-hidden="true" />
        </view>
      </view>
    </view>
    <text v-if="setup.showSubmissionHint" class="setup-footnote">三项提交齐全后，将自动进入开通审核</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { providerSetup, type ProviderSetupData, type SetupStepId } from '@/utils/providerSetup'

// 小程序 attached 可能早于跨层 props 同步，收到数据前不渲染状态卡片。
const props = defineProps({
  data: { type: Object as PropType<ProviderSetupData | null>, default: null },
})
const emit = defineEmits<{ (event: 'identity' | 'profile' | 'services'): void }>()
const setup = computed(() => providerSetup(props.data))
function openStep(id: SetupStepId) { emit(id) }
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;

.setup-card{margin:8rpx 0 20rpx;padding:28rpx 24rpx 24rpx;border:1rpx solid #e3eded;border-radius:32rpx;background:#fcfefe;box-shadow:$dz-shadow-soft}
.setup-heading{display:flex;align-items:center;justify-content:space-between;gap:12rpx}
.setup-title-group{display:flex;min-width:0;gap:8rpx;flex-direction:column}
.setup-eyebrow{color:#087b80;font-size:21rpx;font-weight:600;line-height:1.3}
.setup-title{color:#182a30;font-size:32rpx;font-weight:700;line-height:1.3}
.setup-progress{flex:none;padding:10rpx 14rpx;border-radius:18rpx;color:#536970;background:#edf3f3;font-size:21rpx;font-weight:600;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap}
.setup-caption{display:block;margin-top:12rpx;color:#62767c;font-size:23rpx;line-height:1.5}
.setup-track{display:flex;gap:10rpx;margin:20rpx 0 22rpx}
.setup-track-segment{height:7rpx;flex:1;border-radius:8rpx;background:#e6eeee}
.setup-track-segment.is-pending{background:#4cbbb9}.setup-track-segment.is-done{background:#2d9a65}.setup-track-segment.is-rejected{background:#d79a59}
.setup-reason{display:block;margin-bottom:18rpx;padding:16rpx 18rpx;border-radius:16rpx;color:#986020;background:#fff4e7;font-size:23rpx;line-height:1.5;overflow-wrap:anywhere}
.setup-steps{display:flex;gap:14rpx;flex-direction:column}
.setup-step{display:flex;box-sizing:border-box;width:100%;min-height:128rpx;align-items:center;gap:16rpx;padding:20rpx 18rpx;border:1rpx solid #e0e9e9;border-radius:24rpx;background:#fff;text-align:left}
.setup-icon{position:relative;display:flex;flex:0 0 62rpx;width:62rpx;height:62rpx;align-items:center;justify-content:center;border-radius:20rpx;color:#167d81;background:#eff7f7}
.setup-icon-image{display:block;width:36rpx;height:36rpx}
.setup-copy{display:flex;flex:1;min-width:0;gap:8rpx;flex-direction:column}
.setup-step-title{color:#1b2c31;font-size:27rpx;font-weight:600;line-height:1.35}
.setup-description{color:#64777d;font-size:22rpx;line-height:1.5}
.setup-action{display:flex;flex:none;align-items:center;gap:9rpx;color:#23767a;font-size:22rpx;font-weight:600;line-height:1.35;white-space:nowrap}
.setup-chevron{width:9rpx;height:9rpx;border-top:2rpx solid currentColor;border-right:2rpx solid currentColor;transform:rotate(45deg)}
.setup-step.is-pending{border-color:#cce9e8;background:#f0fafa}.is-pending .setup-icon{color:#087b80;background:#dcf2f1}.is-pending .setup-action{color:#087b80}
.setup-step.is-done{border-color:#cde5d7;background:#f2faf5}.is-done .setup-icon{color:#208253;background:#ddf1e4}.is-done .setup-action{color:#217c50}
.setup-step.is-rejected{border-color:#efddc6;background:#fff8ef}.is-rejected .setup-icon{color:#986020;background:#f9ead5}.is-rejected .setup-action{color:#986020}
.setup-check{width:23rpx;height:13rpx;margin-top:-5rpx;border-left:4rpx solid currentColor;border-bottom:4rpx solid currentColor;transform:rotate(-45deg)}
.setup-clock{position:relative;box-sizing:border-box;width:31rpx;height:31rpx;border:3rpx solid currentColor;border-radius:50%}
.setup-clock::after{position:absolute;top:4rpx;left:11rpx;width:6rpx;height:9rpx;border-left:2rpx solid currentColor;border-bottom:2rpx solid currentColor;content:''}
.setup-exclamation{font-size:36rpx;font-weight:700;line-height:1}
.setup-footnote{display:block;margin:20rpx 4rpx 0;color:#6d7e83;font-size:21rpx;line-height:1.5}
@media (prefers-reduced-motion:reduce){.setup-step{transition:none;transform:none}}
</style>
