<template>
  <view class="crop-overlay" @touchmove.stop.prevent>
    <view class="crop-dialog" role="dialog" aria-modal="true" aria-label="裁剪展示照片" @touchmove.stop>
      <view class="crop-heading"><text class="crop-title">裁剪照片 {{ progress }}</text><button class="crop-reset" :disabled="saving || !state" @tap="reset">重置</button></view>
      <text class="crop-hint">拖动照片选择取景，下方滑块调整大小。请保留完整头部，避开截图黑边和文字。</text>
      <view class="crop-frame" @touchstart.stop="touchStart" @touchmove.stop.prevent="touchMove" @touchend="endDrag" @touchcancel="endDrag" @mousedown.prevent="mouseStart" @mousemove.prevent="mouseMove" @mouseup="endDrag" @mouseleave="endDrag">
        <image v-if="previewUrl" class="crop-image" :src="previewUrl" :style="imageStyle" mode="scaleToFill" @load="imageLoaded" @error="imageError" />
        <view v-if="state" class="crop-grid"><view class="grid-v first" /><view class="grid-v second" /><view class="grid-h first" /><view class="grid-h second" /></view>
        <text v-if="!state" class="crop-loading">{{ loadFailed ? '照片加载失败' : '正在处理照片…' }}</text>
      </view>
      <view class="zoom-label"><text>缩放</text><text>{{ zoom }}%</text></view>
      <slider class="crop-slider" :value="zoom" :min="100" :max="300" :disabled="saving || !state" activeColor="#08b8bc" backgroundColor="#dce9e9" block-color="#ffffff" :block-size="24" @changing="changeZoom" @change="changeZoom" />
      <text v-if="error" class="crop-error">{{ error }}</text>
      <view class="crop-actions"><button class="crop-cancel" :disabled="saving" @tap="emit('close')">取消</button><button v-if="loadFailed" class="crop-confirm" @tap="loadPreview">重试加载</button><button v-else class="crop-confirm" :disabled="saving || !state" @tap="save">{{ saving ? '正在保存…' : '确认裁剪' }}</button></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { cropProviderPhoto, previewProviderPhoto, type PhotoCropSource, type CroppedProviderPhoto } from '@/services/providers'
import { photoPreview } from '@/utils/photoPreview'
import { getErrorMessage } from '@/utils/formatters'
import { createCrop, cropRectangle, minimumScale, panCrop, zoomCrop, type CropState } from '@/utils/coverCrop'

const props = defineProps<{ source: PhotoCropSource; progress?: string }>()
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', photo: CroppedProviderPhoto): void }>()
const instance = getCurrentInstance()
const state = ref<CropState | null>(null)
const saving = ref(false)
const error = ref('')
const loadFailed = ref(false)
const previewUrl = ref('')
let disposePreview = () => {}
let sourceSize: { width: number; height: number } | null = null
let disposed = false
let lastPoint: { x: number; y: number } | null = null
const zoom = computed(() => state.value ? Math.round(state.value.scale / minimumScale(state.value) * 100) : 100)
const imageStyle = computed(() => state.value ? { width: `${state.value.imageWidth * state.value.scale}px`, height: `${state.value.imageHeight * state.value.scale}px`, left: `${state.value.x}px`, top: `${state.value.y}px`, opacity: 1 } : { opacity: 0 })

async function imageLoaded(event: Event) {
  const detail = (event as unknown as { detail: { width: number; height: number } }).detail
  await nextTick()
  if (disposed) return
  uni.createSelectorQuery().in(instance?.proxy).select('.crop-frame').boundingClientRect(rect => {
    if (disposed || !rect || Array.isArray(rect) || !rect.width) return
    try { state.value = createCrop(sourceSize?.width || detail.width, sourceSize?.height || detail.height, rect.width); loadFailed.value = false }
    catch (reason) { imageError() }
  }).exec()
}
async function loadPreview() {
  loadFailed.value = false; error.value = ''; state.value = null; previewUrl.value = ''
  disposePreview()
  try {
    const response = await previewProviderPhoto(props.source)
    if (disposed) return
    sourceSize = { width: response.data.width, height: response.data.height }
    const preview = await photoPreview(response.data.preview_base64)
    if (disposed) { preview.dispose(); return }
    disposePreview = preview.dispose; previewUrl.value = preview.url
  } catch (reason) { if (!disposed) { loadFailed.value = true; error.value = getErrorMessage(reason, '照片处理失败，请重试') } }
}
function imageError() { loadFailed.value = true; state.value = null }
function reset() { if (state.value && !saving.value) state.value = createCrop(state.value.imageWidth, state.value.imageHeight, state.value.frameWidth) }
function move(x: number, y: number) {
  if (!lastPoint || !state.value || saving.value) return
  state.value = panCrop(state.value, x - lastPoint.x, y - lastPoint.y)
  lastPoint = { x, y }
}
type CropTouchEvent = { touches: ArrayLike<{ clientX: number; clientY: number }> }
function touchStart(event: CropTouchEvent) { if (event.touches.length === 1 && !saving.value) lastPoint = { x: event.touches[0].clientX, y: event.touches[0].clientY } }
function touchMove(event: CropTouchEvent) { if (event.touches.length === 1) move(event.touches[0].clientX, event.touches[0].clientY); else endDrag() }
function mouseStart(event: { clientX: number; clientY: number }) { if (!saving.value) lastPoint = { x: event.clientX, y: event.clientY } }
function mouseMove(event: { clientX: number; clientY: number }) { move(event.clientX, event.clientY) }
function endDrag() { lastPoint = null }
function changeZoom(event: { detail: { value: number } }) { if (state.value && !saving.value) state.value = zoomCrop(state.value, minimumScale(state.value) * event.detail.value / 100) }
async function save() {
  if (!state.value || saving.value || loadFailed.value) return
  saving.value = true; error.value = ''; endDrag()
  try {
    const response = await cropProviderPhoto(props.source, cropRectangle(state.value))
    if (!disposed) emit('done', response.data)
  } catch (reason) { if (!disposed) error.value = getErrorMessage(reason, '照片保存失败，请重试') }
  finally { if (!disposed) saving.value = false }
}
onMounted(loadPreview)
onBeforeUnmount(() => { disposed = true; disposePreview() })
</script>

<style scoped>
.crop-overlay{position:fixed;z-index:200;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));background:rgba(12,30,33,.65)}
.crop-dialog{box-sizing:border-box;width:100%;max-width:440px;max-height:100%;overflow-y:auto;padding:20px;border-radius:24px;background:#fff;color:#183239}
.crop-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.crop-title{font-size:19px;font-weight:700}.crop-reset{margin:0;padding:0 8px;background:transparent;color:#087e83;font-size:14px;min-height:44px;line-height:44px}
.crop-hint{display:block;margin:4px 0 16px;color:#63797f;font-size:13px;line-height:1.6}
.crop-frame{position:relative;width:100%;height:0;padding-bottom:80%;overflow:hidden;border-radius:12px;background:#e7eeee;touch-action:none;user-select:none;cursor:move}.crop-image{position:absolute;max-width:none;pointer-events:none}.crop-grid{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}.grid-v,.grid-h{position:absolute;background:rgba(255,255,255,.5);pointer-events:none}.grid-v{width:1px;top:0;bottom:0}.grid-v.first{left:33.33%}.grid-v.second{left:66.67%}.grid-h{height:1px;left:0;right:0}.grid-h.first{top:33.33%}.grid-h.second{top:66.67%}.crop-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#63797f}
.zoom-label{display:flex;justify-content:space-between;margin-top:18px;font-size:13px;font-variant-numeric:tabular-nums}.crop-slider{margin:18px 8px}.crop-error{display:block;margin-bottom:12px;color:#b23b35;font-size:13px;line-height:1.5}.crop-actions{display:flex;gap:10px}.crop-cancel,.crop-confirm{display:flex;align-items:center;justify-content:center;margin:0;padding:0 12px;min-height:46px;border:0;border-radius:14px;font-size:15px;line-height:1.3;font-weight:600}.crop-cancel{flex:1;background:#eef4f4;color:#4d676e}.crop-confirm{flex:2;background:#08b8bc;color:#fff}.crop-reset::after,.crop-cancel::after,.crop-confirm::after{display:none}
.crop-cancel:active,.crop-confirm:active{transform:scale(.98)}
@media(prefers-reduced-motion:reduce){.crop-cancel:active,.crop-confirm:active{transform:none}}
</style>
