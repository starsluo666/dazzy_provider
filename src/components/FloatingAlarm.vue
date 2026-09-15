<template>
  <view class="floating-alarm-layer">
    <movable-area class="floating-alarm-area" :style="areaStyle">
      <movable-view
        class="floating-alarm-positioner"
        direction="all"
        :x="alarmX"
        :y="alarmY"
        :animation="true"
        :inertia="false"
        :out-of-bounds="true"
        :damping="40"
        :style="controlStyle"
        @change="handleChange"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <button
          class="floating-alarm-button"
          :class="{ 'is-dragging': dragging, 'is-disabled': disabled }"
          :disabled="disabled"
          hover-class="floating-alarm-button--pressed"
          aria-label="紧急报警，可拖动位置，点击后需再次确认"
          @tap.stop="handleTap"
        >
          <view class="alarm-symbol" aria-hidden="true">
            <image class="alarm-icon" src="/static/icons/alarm.svg" mode="aspectFit" />
          </view>
          <view class="alarm-copy">
            <strong class="alarm-title">紧急求助</strong>
            <text class="alarm-hint">{{ dragging ? '松开后吸附' : '点击后确认' }}</text>
          </view>
          <view class="drag-grip" aria-hidden="true"><i class="drag-dot" /><i class="drag-dot" /><i class="drag-dot" /></view>
        </button>
      </movable-view>
    </movable-area>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { onResize } from '@dcloudio/uni-app'

defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{ alarm: [] }>()

type AlarmSide = 'left' | 'right'

interface StoredPosition {
  side: AlarmSide
  yRatio: number
}

interface PositionPoint {
  x: number
  y: number
  time: number
}

const STORAGE_KEY = 'dazzy_provider_floating_alarm_position_v1'
const CONTROL_WIDTH_RPX = 178
const CONTROL_HEIGHT_RPX = 88
const EDGE_RPX = 18
const DOCK_CLEARANCE_RPX = 148

const alarmX = ref(0)
const alarmY = ref(0)
const dragging = ref(false)
const areaWidth = ref(0)
const areaHeight = ref(0)
const controlWidth = ref(0)
const controlHeight = ref(0)

let currentX = 0
let currentY = 0
let startX = 0
let startY = 0
let moved = false
let ignoreTapUntil = 0
let positionHistory: PositionPoint[] = []

// 原生组件的 style 属性始终传字符串，规避微信开发者工具在热更新后
// 将对象样式与旧 WXML 绑定错配时触发内部 split 异常。
const areaStyle = computed(() => `width:${areaWidth.value}px;height:${areaHeight.value}px;`)
const controlStyle = computed(() => `width:${controlWidth.value}px;height:${controlHeight.value}px;`)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function screenWidth(windowWidth: number) {
  if (windowWidth >= 768) return 480
  if (windowWidth >= 480) return 430
  return windowWidth
}

function readStoredPosition(): StoredPosition {
  const stored = uni.getStorageSync(STORAGE_KEY) as Partial<StoredPosition> | undefined
  return {
    side: stored?.side === 'left' ? 'left' : 'right',
    yRatio: clamp(Number(stored?.yRatio ?? 0.68), 0, 1),
  }
}

function layoutControl() {
  const info = uni.getWindowInfo()
  const width = screenWidth(Number(info.windowWidth) || 375)
  const viewportHeight = Number(info.windowHeight) || 667
  const scale = width / 750
  const safeTop = Math.max(0, Number(info.safeArea?.top || 0))
  const safeBottom = Math.max(0, viewportHeight - Number(info.safeArea?.bottom || viewportHeight))
  const topInset = safeTop + EDGE_RPX * scale
  const bottomInset = safeBottom + DOCK_CLEARANCE_RPX * scale

  areaWidth.value = width
  areaHeight.value = Math.max(1, viewportHeight - topInset - bottomInset)
  controlWidth.value = CONTROL_WIDTH_RPX * scale
  controlHeight.value = CONTROL_HEIGHT_RPX * scale

  const stored = readStoredPosition()
  const maxX = Math.max(0, areaWidth.value - controlWidth.value)
  const maxY = Math.max(0, areaHeight.value - controlHeight.value)
  const edge = EDGE_RPX * scale
  const targetX = stored.side === 'left' ? edge : maxX - edge
  const targetY = stored.yRatio * maxY

  alarmX.value = clamp(targetX, 0, maxX)
  alarmY.value = clamp(targetY, 0, maxY)
  currentX = alarmX.value
  currentY = alarmY.value
}

function detailPosition(event: Event) {
  const detail = (event as CustomEvent<{ x?: number; y?: number; source?: string }>).detail
  return {
    x: Number(detail?.x ?? currentX),
    y: Number(detail?.y ?? currentY),
    source: detail?.source || '',
  }
}

function handleChange(event: Event) {
  const position = detailPosition(event)
  currentX = position.x
  currentY = position.y
  if (!dragging.value || !position.source) return

  if (Math.hypot(currentX - startX, currentY - startY) > 6) moved = true
  const now = Date.now()
  positionHistory.push({ x: currentX, y: currentY, time: now })
  positionHistory = positionHistory.filter(point => now - point.time <= 120)
}

function handleTouchStart() {
  dragging.value = true
  moved = false
  startX = currentX
  startY = currentY
  positionHistory = [{ x: currentX, y: currentY, time: Date.now() }]
}

function projectVelocity(velocity: number, decelerationRate = 0.99) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}

async function handleTouchEnd() {
  dragging.value = false
  if (!moved) return

  ignoreTapUntil = Date.now() + 320
  const first = positionHistory[0]
  const last = positionHistory[positionHistory.length - 1]
  const elapsed = Math.max(16, (last?.time || 0) - (first?.time || 0))
  const velocityX = first && last ? ((last.x - first.x) / elapsed) * 1000 : 0
  const velocityY = first && last ? ((last.y - first.y) / elapsed) * 1000 : 0
  const maxX = Math.max(0, areaWidth.value - controlWidth.value)
  const maxY = Math.max(0, areaHeight.value - controlHeight.value)
  const projectedX = currentX + projectVelocity(velocityX)
  const targetSide: AlarmSide = projectedX + controlWidth.value / 2 < areaWidth.value / 2 ? 'left' : 'right'
  const edge = Math.min(EDGE_RPX * areaWidth.value / 750, maxX / 2)
  const targetX = targetSide === 'left' ? edge : maxX - edge
  const targetY = clamp(currentY + projectVelocity(velocityY), 0, maxY)

  alarmX.value = clamp(currentX, 0, maxX)
  alarmY.value = clamp(currentY, 0, maxY)
  await nextTick()
  alarmX.value = clamp(targetX, 0, maxX)
  alarmY.value = targetY
  currentX = alarmX.value
  currentY = alarmY.value

  uni.setStorageSync(STORAGE_KEY, {
    side: targetSide,
    yRatio: maxY ? targetY / maxY : 0,
  } satisfies StoredPosition)
  uni.vibrateShort({ type: 'light', fail: () => undefined })
}

function handleTap() {
  if (Date.now() < ignoreTapUntil || moved) return
  emit('alarm')
}

onMounted(layoutControl)
onResize(layoutControl)
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;

.floating-alarm-layer {
  position: fixed;
  z-index: 92;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.floating-alarm-area {
  position: absolute;
  top: calc(var(--status-bar-height) + 18rpx);
  left: 50%;
  pointer-events: none;
  transform: translateX(-50%);
}

.floating-alarm-positioner {
  display: block;
  pointer-events: auto;
}

.floating-alarm-button {
  position: relative;
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  align-items: center;
  margin: 0;
  padding: 9rpx 11rpx;
  border: 1rpx solid rgba(255, 62, 70, 0.16);
  border-radius: 999rpx;
  color: $dz-text-primary;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4rpx 12rpx rgba(123, 34, 42, 0.1), 0 20rpx 48rpx rgba(40, 52, 56, 0.16);
  line-height: 1;
  text-align: left;
  transform-origin: center;
  transition: opacity $dz-duration-fast ease-out, transform $dz-duration-fast $dz-ease-out;
}

.floating-alarm-button::before {
  position: absolute;
  top: 1rpx;
  right: 18rpx;
  left: 18rpx;
  height: 1rpx;
  background: rgba(255, 255, 255, 0.98);
  content: '';
  pointer-events: none;
}

.floating-alarm-button::after { display: none; }
.floating-alarm-button.is-disabled { opacity: 0.55; }
.floating-alarm-button--pressed { transform: scale(0.95); opacity: 0.88; }
.floating-alarm-button.is-dragging { opacity: 0.9; transform: scale(1.055); box-shadow: 0 8rpx 24rpx rgba(123,34,42,.14), 0 28rpx 66rpx rgba(40,52,56,.2); }

.alarm-symbol {
  display: flex;
  width: 54rpx;
  height: 54rpx;
  flex: 0 0 54rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,62,70,.12);
  border-radius: 50%;
  background: $dz-danger-soft;
  box-shadow: inset 0 1rpx 0 rgba(255,255,255,.9), 0 5rpx 12rpx rgba(217,45,56,.08);
}

.alarm-icon { width: 40rpx; height: 40rpx; }
.alarm-copy { display: flex; min-width: 0; gap: 5rpx; margin-left: 10rpx; flex: 1; flex-direction: column; }
.alarm-title { color: #c92b35; font-size: 20rpx; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; }
.alarm-hint { color: #8d6b70; font-size: 14rpx; white-space: nowrap; }
.drag-grip { display: flex; width: 7rpx; gap: 4rpx; margin-left: 5rpx; flex-direction: column; }
.drag-dot { width: 6rpx; height: 6rpx; border-radius: 50%; background: rgba(108, 116, 120, 0.3); }
.floating-alarm-button { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif; }
.alarm-title { font-size: 19rpx; line-height: 1.18; font-weight: 700; }
.alarm-hint { font-size: 15rpx; line-height: 1.15; letter-spacing: .01em; }

/* #ifdef H5 */
.floating-alarm-button {
  -webkit-backdrop-filter: saturate(165%) blur(18px);
  backdrop-filter: saturate(165%) blur(18px);
}

@media (prefers-reduced-transparency: reduce) {
  .floating-alarm-button {
    background: #fffafa;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-alarm-button { transition-duration: 0.01ms; }
}
/* #endif */
</style>
