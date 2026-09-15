<template>
  <view class="trend-chart-wrap">
    <view class="trend-chart-head">
      <strong class="trend-chart-title strong-text">近7日服务趋势</strong>
      <text class="trend-chart-unit">单位：小时</text>
    </view>
    <view class="trend-chart" aria-label="近7日服务趋势柱状图">
      <view class="trend-grid-lines" aria-hidden="true">
        <i class="trend-grid-line" />
        <i class="trend-grid-line" />
        <i class="trend-grid-line" />
      </view>
      <view v-for="item in items" :key="item.date" class="trend-column">
        <text class="trend-value">{{ formatHours(item.service_hours) }}</text>
        <view class="trend-track"><view class="trend-bar" :style="barStyle(item.service_hours)" /></view>
        <text class="trend-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProviderTrendItem } from '@/types/api'

const props = defineProps<{ items: ProviderTrendItem[] }>()
const maxTrend = computed(() => Math.max(1, ...props.items.map(item => item.service_hours)))

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function barStyle(value: number) {
  const percentage = value ? Math.max(18, Math.round((value / maxTrend.value) * 100)) : 5
  return `height:${percentage}%;`
}
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;

.trend-chart-head{display:flex;align-items:center;justify-content:space-between;margin:12rpx 5rpx 0;padding-top:24rpx;border-top:1rpx dashed $dz-border}.trend-chart-title{font-size:24rpx}.trend-chart-unit{color:$dz-text-tertiary;font-size:17rpx}.trend-chart{position:relative;display:grid;height:260rpx;margin-top:14rpx;padding:22rpx 0 0;grid-template-columns:repeat(7,1fr)}.trend-grid-lines{position:absolute;top:42rpx;right:4rpx;bottom:38rpx;left:4rpx;display:flex;justify-content:space-between;flex-direction:column}.trend-grid-line{width:100%;border-top:1rpx dashed #e8eeee}.trend-column{position:relative;z-index:1;display:flex;min-width:0;align-items:center;justify-content:flex-end;flex-direction:column}.trend-value{height:27rpx;color:$dz-text-secondary;font-size:17rpx}.trend-track{display:flex;width:100%;height:160rpx;align-items:flex-end;justify-content:center}.trend-bar{width:24rpx;min-height:8rpx;border-radius:12rpx 12rpx 2rpx 2rpx;background:linear-gradient(180deg,#11c1c4,#a7efec);box-shadow:0 6rpx 12rpx rgba(17,193,196,.13)}.trend-label{height:31rpx;margin-top:8rpx;color:$dz-text-secondary;font-size:18rpx}
</style>
