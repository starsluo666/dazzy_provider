<template>
  <view class="dz-sheet" :class="{ 'dz-sheet--visible': visible, 'dz-sheet--dragging': dragging }">
    <view
      class="dz-sheet__mask"
      :style="maskStyle"
      @tap="$emit('close')"
    />
    <view
      class="dz-sheet__panel"
      :style="panelStyle"
    >
      <view class="dz-sheet__dragzone" @touchstart="onTouchStart" @touchmove.prevent="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
        <view class="dz-sheet__grabber" />
        <view v-if="title || closable" class="dz-sheet__header">
          <view class="dz-sheet__heading">
            <text class="dz-sheet__title">{{ title }}</text>
            <text v-if="subtitle" class="dz-sheet__subtitle">{{ subtitle }}</text>
          </view>
          <text v-if="closable" class="dz-sheet__close" hover-class="dz-sheet__close--pressed" @tap="$emit('close')">✕</text>
        </view>
        <view v-else class="dz-sheet__dragzone-pad" />
      </view>
      <scroll-view class="dz-sheet__body" scroll-y>
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{ visible: boolean; title?: string; subtitle?: string; closable?: boolean }>(), {
  title: '',
  subtitle: '',
  closable: true,
})
const emit = defineEmits<{ close: [] }>()

/*
 * 拖拽规则（与用户端 DzBottomSheet 同一套约定）：
 * - 拖动 1:1 跟手，仅把手和标题区可拖，避免与内容滚动冲突；
 * - 上方越界走橡皮筋阻尼，下方越界 1:1；
 * - 松手按「最近约 100ms 的速度符号 + 位移比例」决策收起或回弹；
 * - 拖动过程中遮罩透明度随位移同步衰减。
 */
const dragging = ref(false)
const dragOffset = ref(0)
const maskProgress = ref(1)
const maskStyle = computed(() => dragging.value
  ? `opacity:${maskProgress.value};transition:none;`
  : '')
const panelStyle = computed(() => dragging.value
  ? `transform:translateY(${dragOffset.value}px);transition:none;`
  : '')

let startY = 0
let panelHeight = 0
let history: Array<{ y: number; t: number }> = []

function rubberBand(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

function onTouchStart(e: TouchEvent) {
  if (!props.visible) return
  const touch = e.touches[0]
  startY = touch.clientY
  history = [{ y: touch.clientY, t: Date.now() }]
  panelHeight = Math.max(1, uni.getWindowInfo().windowHeight || 667)
  dragging.value = true
  dragOffset.value = 0
}

function onTouchMove(e: TouchEvent) {
  if (!dragging.value) return
  const touch = e.touches[0]
  history.push({ y: touch.clientY, t: Date.now() })
  if (history.length > 8) history.shift()
  let dy = touch.clientY - startY
  if (dy < 0) dy = -rubberBand(-dy, panelHeight)
  dragOffset.value = dy
  maskProgress.value = Math.max(0, 1 - dy / (panelHeight * 0.6))
}

function onTouchEnd() {
  if (!dragging.value) return
  const now = Date.now()
  const recent = history.find((item) => now - item.t <= 120) ?? history[0]
  const elapsed = Math.max(1, now - recent.t)
  const velocity = (history[history.length - 1].y - recent.y) / elapsed // px/ms，向下为正
  const dy = dragOffset.value

  dragging.value = false
  dragOffset.value = 0
  maskProgress.value = 1

  if (dy > 0 && (velocity > 0.35 || dy > Math.min(panelHeight * 0.32, 260))) emit('close')
}
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;

.dz-sheet {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
  pointer-events: none;
}

.dz-sheet--visible {
  pointer-events: auto;
}

.dz-sheet__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(15, 30, 34, 0.42);
  opacity: 0;
  transition: opacity $dz-duration-base ease;
}

.dz-sheet--visible .dz-sheet__mask {
  opacity: 1;
}

.dz-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  max-width: 750px;
  margin: 0 auto;
  border: 1rpx solid $dz-border-material;
  border-bottom: 0;
  border-radius: 38rpx 38rpx 0 0;
  background: $dz-surface-glass-strong;
  box-shadow: $dz-shadow-sheet;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  transform: translateY(calc(100% + 12rpx));
  transition: transform $dz-duration-sheet $dz-ease-drawer;
  will-change: transform;
}

.dz-sheet--visible .dz-sheet__panel {
  transform: translateY(0);
}

.dz-sheet__dragzone {
  flex: 0 0 auto;
}

.dz-sheet__grabber {
  width: 76rpx;
  height: 8rpx;
  margin: 14rpx auto 16rpx;
  border-radius: 999rpx;
  background: rgba(102, 115, 122, 0.24);
}

.dz-sheet__dragzone-pad {
  height: 20rpx;
}

.dz-sheet__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx 18rpx;
}

.dz-sheet__heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.dz-sheet__title {
  color: $dz-text-primary;
  font-size: 32rpx;
  font-weight: 750;
  line-height: 1.3;
}

.dz-sheet__subtitle {
  color: $dz-text-secondary;
  font-size: 21rpx;
  line-height: 1.5;
}

.dz-sheet__close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin: 0 -14rpx 0 0;
  border-radius: 50%;
  color: $dz-text-secondary;
  background: $dz-brand-pale;
  font-size: 34rpx;
  line-height: 1;
}

.dz-sheet__close--pressed {
  opacity: 0.6;
}

.dz-sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(80vh - 160rpx);
  padding: 0 30rpx 30rpx;
  box-sizing: border-box;
}

/* #ifdef H5 */
.dz-sheet__mask {
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.dz-sheet__panel {
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  backdrop-filter: saturate(180%) blur(22px);
}
/* #endif */
</style>
