<template>
  <view class="state" role="status">
    <view v-if="loading" class="spinner" aria-hidden="true" />
    <strong class="strong-text">{{ message }}</strong>
    <button v-if="actionText" @tap="$emit('action')">{{ actionText }}</button>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message: string; actionText?: string; loading?: boolean }>(), {
  actionText: '', loading: false,
})
defineEmits<{ action: [] }>()
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;
.state{display:flex;min-height:320rpx;align-items:center;justify-content:center;flex-direction:column;color:$dz-text-secondary;text-align:center}
.state .strong-text{font-size:24rpx;font-weight:500}.state button{min-width:220rpx;height:76rpx;margin-top:26rpx;border:1rpx solid $dz-brand;border-radius:38rpx;color:$dz-brand-deep;background:#fff;font-size:23rpx;line-height:76rpx}
.spinner{width:38rpx;height:38rpx;margin-bottom:22rpx;border:5rpx solid $dz-brand-soft;border-top-color:$dz-brand;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
</style>
