<template>
  <view class="dz-page dz-management-page profile-edit-page">
    <view class="dz-safe-top" />
    <header class="page-nav dz-management-head dz-container">
      <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="back">‹</button>
      <strong class="strong-text">达人资料</strong>
      <view class="nav-space" />
    </header>

    <main class="dz-container">
      <NetworkState v-if="loading" loading message="正在加载达人资料…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <section class="profile-lead">
          <view><text>公开展示资料</text><strong class="strong-text">让用户更快了解你</strong></view>
          <text>照片、视频、个人介绍和服务范围将展示在达人主页。</text>
        </section>

        <section v-if="data.review_status === 'pending'" class="review-notice">资料已提交审核，审核期间用户端继续展示原资料。</section>
        <section v-else-if="data.review_status === 'rejected'" class="review-notice rejected">审核未通过：{{ data.review_rejection_reason }}</section>

        <section class="gallery-panel">
          <view class="panel-heading"><strong class="strong-text">照片与视频</strong><text>{{ media.length }}/9</text></view>
          <text class="gallery-tip">第一张照片作为列表封面，左右调整展示顺序。最多9个素材，其中视频最多2个、每个不超过10秒；照片≤8MB，支持苹果 HEIC/HEIF；MP4/MOV视频≤50MB，上传后自动转为兼容格式。</text>
          <text v-if="hasUnverifiedVideo" class="gallery-tip">旧视频尚未核验时长，下次提交资料前请移除并重新上传不超过10秒的视频。当前已发布的资料不会因此被删除。</text>
          <view class="gallery-grid">
            <!-- 小程序原生 button 复用后可能保留换位前的 disabled 状态，位置变化时重建卡片。 -->
            <view v-for="(item, index) in media" :key="`${item.id}-${index}`" class="gallery-item">
              <image v-if="item.type === 'image'" :src="item.url" mode="aspectFill" @tap="previewPhoto(item.url)" />
              <video v-else :id="`profile-video-${item.id}`" :src="item.url" :autoplay="false" object-fit="contain" @play="pauseVideos(item.id)" />
              <text class="media-label">{{ index === 0 ? '列表封面' : item.type === 'video' ? '视频' : '照片' }}</text>
              <view class="media-actions">
                <button :disabled="mediaLocked || !canMoveMedia(item.id, -1)" aria-label="前移" @tap="moveMedia(item.id, -1)"><text>前移</text></button>
                <button :disabled="mediaLocked || !canMoveMedia(item.id, 1)" aria-label="后移" @tap="moveMedia(item.id, 1)"><text>后移</text></button>
                <button :disabled="mediaLocked" @tap="removeMedia(item.id)"><text>移除</text></button>
              </view>
            </view>
          </view>
          <view class="gallery-buttons">
            <button :disabled="mediaLocked || media.length >= 9" @tap="choosePhoto"><text>＋ 添加照片</text></button>
            <button :disabled="mediaLocked || media.length >= 9 || videoCount >= 2" @tap="chooseVideo"><text>＋ 添加视频</text></button>
          </view>
          <text v-if="uploading" class="gallery-tip">上传及格式处理中，请稍候，不要关闭页面…</text>
          <text v-if="saveAttempted && !media.length" class="field-error">请至少上传一张本人生活照作为封面</text>
        </section>

        <section class="form-panel">
          <view class="panel-heading"><strong class="strong-text">达人名称</strong><text>公开展示 · 无需唯一</text></view>
          <view class="name-input-shell" :class="{ focused: nameFocused, invalid: saveAttempted && form.display_name.trim().length < 2 }">
            <input v-model="form.display_name" class="name-input" maxlength="30" confirm-type="done" placeholder="请输入公开展示的达人名称" placeholder-style="color:#87969b" @focus="nameFocused = true" @blur="nameFocused = false" />
          </view>
          <text class="name-count">{{ form.display_name.length }}/30</text>
          <text v-if="saveAttempted && form.display_name.trim().length < 2" class="field-error">达人名称至少填写2个字</text>
        </section>

        <section class="form-panel">
          <view class="panel-heading"><strong class="strong-text">个人介绍</strong><text>至少 10 字</text></view>
          <textarea v-model="form.bio" :class="{ invalid: saveAttempted && form.bio.trim().length < 10 }" maxlength="500" placeholder="介绍你的特长、性格和服务体验" />
          <text class="count">{{ form.bio.length }}/500</text>
          <text v-if="saveAttempted && form.bio.trim().length < 10" class="field-error">个人介绍至少填写10个字，还差 {{ 10 - form.bio.trim().length }} 字</text>
        </section>

        <section class="settings-panel">
          <view class="setting-row">
            <view><strong class="strong-text">服务城市</strong><text>用于服务推荐与订单匹配</text></view>
            <picker :range="cities" range-key="name" @change="chooseCity"><view>{{ form.service_city_name || '请选择' }} <b>›</b></view></picker>
          </view>
          <view class="radius-row">
            <view class="panel-heading"><view><strong class="strong-text">最大接单半径</strong><text>只推荐范围内的新订单</text></view><b>{{ form.max_service_radius_km }} km</b></view>
            <slider :value="form.max_service_radius_km" min="10" max="70" activeColor="#11c1c4" backgroundColor="#dfe9e9" block-color="#ffffff" block-size="24" @change="changeRadius" />
            <view class="range-label"><text>10 km</text><text>70 km</text></view>
          </view>
        </section>

        <view class="save-bar"><button class="save dz-tappable" hover-class="dz-pressed" :disabled="saving || uploading || data.review_status === 'pending'" @tap="save"><text>{{ saving ? '提交中…' : data.review_status === 'pending' ? '资料审核中' : '提交资料审核' }}</text></button></view>
      </template>
    </main>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import { getProviderProfile, saveProviderProfile, uploadProviderLifestylePhoto, uploadProviderVideo } from '@/services/providers'
import type { ProviderMedia, ProviderProfileData } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

const cities = [
  { code: '130400', name: '邯郸市' },
  { code: '110100', name: '北京市' },
  { code: '310100', name: '上海市' },
]
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const saveAttempted = ref(false)
const nameFocused = ref(false)
const error = ref('')
const media = ref<ProviderMedia[]>([])
const data = ref<ProviderProfileData | null>(null)
const mediaLocked = computed(() => uploading.value || saving.value || data.value?.review_status === 'pending')
const videoCount = computed(() => media.value.filter(item => item.type === 'video').length)
const hasUnverifiedVideo = computed(() => media.value.some(item => item.type === 'video' && !item.duration_ms))
const form = reactive({
  display_name: '', bio: '', lifestyle_photo_id: null as string | null, service_city_code: '130400',
  service_city_name: '邯郸市', max_service_radius_km: 10,
})

function back() { uni.navigateBack() }
function apply(value: ProviderProfileData) {
  pauseVideos()
  data.value = value
  Object.assign(form, {
    display_name: value.display_name,
    bio: value.bio,
    lifestyle_photo_id: value.lifestyle_photo_id,
    service_city_code: value.service_city_code || '130400',
    service_city_name: value.service_city_name || '邯郸市',
    max_service_radius_km: value.max_service_radius_km,
  })
  media.value = value.media?.length ? value.media.map(item => ({ ...item })) : value.lifestyle_photo_id && value.lifestyle_photo_url
    ? [{ id: value.lifestyle_photo_id, type: 'image', url: value.lifestyle_photo_url }] : []
}
async function load() {
  loading.value = true
  error.value = ''
  try { apply((await getProviderProfile()).data) } catch (reason) { error.value = getErrorMessage(reason) } finally { loading.value = false }
}
function chooseCity(event: { detail: { value: string } }) {
  const city = cities[Number(event.detail.value)]
  if (city) { form.service_city_code = city.code; form.service_city_name = city.name }
}
function changeRadius(event: { detail: { value: number } }) { form.max_service_radius_km = Number(event.detail.value) }
function choosePhoto() {
  if (mediaLocked.value || media.value.length >= 9) return
  uploading.value = true
  uni.chooseImage({
    count: 9 - media.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async ({ tempFilePaths, tempFiles }) => {
      try {
        for (let index = 0; index < tempFilePaths.length && media.value.length < 9; index++) {
          const selected = Array.isArray(tempFiles) ? tempFiles[index] : tempFiles
          if (selected?.size && selected.size > 8 * 1024 * 1024) throw new Error('生活照不能超过8MB，已上传的照片会保留')
          const uploaded = await uploadProviderLifestylePhoto(tempFilePaths[index], selected)
          media.value.push({ ...uploaded.data, type: 'image' })
        }
      } catch (reason) { uni.showToast({ title: getErrorMessage(reason, '照片上传失败'), icon: 'none' }) }
      finally { uploading.value = false }
    },
    fail: (reason) => { uploading.value = false; if (!reason.errMsg.includes('cancel')) uni.showToast({ title: '无法选择照片，请重试', icon: 'none' }) },
  })
}
function chooseVideo() {
  if (mediaLocked.value || media.value.length >= 9 || videoCount.value >= 2) return
  if (!media.value.length) return uni.showToast({ title: '请先添加一张照片作为封面', icon: 'none' })
  uploading.value = true
  uni.chooseVideo({
    sourceType: ['album', 'camera'], compressed: true, maxDuration: 10,
    success: async (selected) => {
      try {
        if (!selected.tempFilePath) throw new Error('未获取到视频，请重新选择')
        if (selected.duration > 10) throw new Error('每个视频不能超过10秒，请裁剪后重试')
        if (selected.size > 50 * 1024 * 1024) throw new Error('视频不能超过50MB')
        const uploaded = await uploadProviderVideo(selected.tempFilePath, (selected as unknown as { tempFile?: unknown }).tempFile)
        media.value.push({ ...uploaded.data, type: 'video' })
      } catch (reason) { uni.showToast({ title: getErrorMessage(reason, '视频上传失败'), icon: 'none' }) }
      finally { uploading.value = false }
    },
    fail: (reason) => { uploading.value = false; if (!reason.errMsg.includes('cancel')) uni.showToast({ title: '无法选择视频，请重试', icon: 'none' }) },
  })
}
function canMoveMedia(id: string, offset: number) {
  const index = media.value.findIndex(item => item.id === id)
  const target = index + offset
  if (index < 0 || target < 0 || target >= media.value.length) return false
  if (target === 0 && media.value[index].type !== 'image') return false
  if (index === 0 && media.value[target].type !== 'image') return false
  return true
}
function moveMedia(id: string, offset: number) {
  if (mediaLocked.value || !canMoveMedia(id, offset)) return
  const index = media.value.findIndex(item => item.id === id)
  const target = index + offset
  const next = [...media.value]
  const moving = next[index]
  next[index] = next[target]
  next[target] = moving
  pauseVideos()
  media.value = next
}
function removeMedia(id: string) {
  if (mediaLocked.value) return
  pauseVideos()
  const next = media.value.filter(item => item.id !== id)
  if (next.length && next[0].type === 'video') {
    const cover = next.findIndex(item => item.type === 'image')
    if (cover < 0) return uni.showToast({ title: '有视频时至少保留一张封面照片', icon: 'none' })
    next.unshift(...next.splice(cover, 1))
  }
  media.value = next
}
function previewPhoto(url: string) { uni.previewImage({ current: url, urls: media.value.filter(item => item.type === 'image').map(item => item.url) }) }
function pauseVideos(exceptId?: string) {
  media.value.filter(item => item.type === 'video' && item.id !== exceptId).forEach(item => uni.createVideoContext(`profile-video-${item.id}`).pause())
}
async function save() {
  if (mediaLocked.value) return
  saveAttempted.value = true
  if (form.display_name.trim().length < 2) return uni.showToast({ title: '达人名称至少2个字', icon: 'none' })
  if (form.bio.trim().length < 10) return uni.showToast({ title: '达人简介至少10个字', icon: 'none' })
  if (!media.value.length || media.value[0].type !== 'image') return uni.showToast({ title: '请上传一张封面照片', icon: 'none' })
  if (videoCount.value > 2) return uni.showToast({ title: '最多保留2个视频，请先移除多余视频', icon: 'none' })
  saving.value = true
  try {
    apply((await saveProviderProfile({ ...form, lifestyle_photo_id: media.value[0].id, media_ids: media.value.map(item => item.id), display_name: form.display_name.trim(), bio: form.bio.trim() })).data)
    uni.showToast({ title: '资料已提交审核', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason), icon: 'none' })
  } finally {
    saving.value = false
    uploading.value = false
  }
}

onLoad(load)
onHide(() => pauseVideos())
onUnload(() => pauseVideos())
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.gallery-panel{padding:24rpx;border:1rpx solid $dz-border;border-radius:28rpx;background:#fff}
.gallery-tip{display:block;margin:14rpx 0;color:$dz-text-secondary;font-size:22rpx;line-height:1.6}
.gallery-grid{display:flex;flex-wrap:wrap;gap:20rpx}.gallery-item{position:relative;width:calc(50% - 10rpx);overflow:hidden;border-radius:18rpx;background:#f2f7f7}.gallery-item>image,.gallery-item>video{display:block;width:100%;height:250rpx}.media-label{display:block;padding:8rpx 12rpx;color:$dz-brand-deep;font-size:21rpx}.media-actions,.gallery-buttons{display:flex;gap:8rpx;padding:8rpx}.media-actions button,.gallery-buttons button{display:flex;flex:1;min-width:0;align-items:center;justify-content:center;margin:0;padding:0 4rpx;border:0;color:#086f75;background:$dz-brand-soft;line-height:1}.media-actions button::after,.gallery-buttons button::after{display:none}.media-actions button{height:72rpx;font-size:26rpx;font-weight:650}.media-actions button text,.gallery-buttons button text{line-height:1.25;white-space:nowrap}.media-actions button[disabled],.gallery-buttons button[disabled]{color:#64747a;background:#f3f4f4}.gallery-buttons{margin-top:14rpx;gap:16rpx}.gallery-buttons button{height:80rpx;font-size:27rpx;font-weight:650}

.profile-edit-page{padding-bottom:calc(132rpx + env(safe-area-inset-bottom));background:linear-gradient(180deg,#edfafa 0,#f5f9f9 350rpx,#f2f6f6 100%)}
.page-nav{position:sticky;z-index:30;top:0;display:flex;height:100rpx;align-items:center;justify-content:space-between;background:rgba(247,252,252,.94)}
.nav-back,.nav-space{width:88rpx;height:80rpx;flex:0 0 88rpx}.nav-back{margin:0;padding:0;border:0;background:transparent;font-size:54rpx;line-height:76rpx;text-align:left}.page-nav>.strong-text{font-size:34rpx}.nav-space{display:block}
.nav-back::after,.save::after{display:none}
main{padding-top:12rpx}
.profile-lead{display:flex;gap:12rpx;padding:22rpx 4rpx 26rpx;flex-direction:column}.profile-lead>view{display:flex;align-items:baseline;justify-content:space-between}.profile-lead>view>text{color:$dz-brand-deep;font-size:21rpx;font-weight:700;letter-spacing:.04em}.profile-lead .strong-text{font-size:34rpx}.profile-lead>text{max-width:620rpx;color:$dz-text-secondary;font-size:24rpx;line-height:1.6}
.form-panel,.settings-panel{border:1rpx solid rgba(220,232,233,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}
.form-panel,.settings-panel{margin-top:20rpx;padding:26rpx}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between}.panel-heading .strong-text,.setting-row .strong-text{font-size:27rpx}.panel-heading>text{color:$dz-text-tertiary;font-size:21rpx}.form-panel textarea{display:block;box-sizing:border-box;width:100%;height:168rpx;margin-top:18rpx;padding:20rpx;border:1rpx solid $dz-border;border-radius:20rpx;color:$dz-text-primary;background:#f8fbfb;font-size:25rpx;line-height:1.65}.count{display:block;margin-top:10rpx;color:$dz-text-tertiary;font-size:21rpx;text-align:right}
.review-notice{margin-bottom:20rpx;padding:22rpx 24rpx;border:1rpx solid #9bdedc;border-radius:20rpx;color:$dz-brand-deep;background:#effcfc;font-size:23rpx;line-height:1.55}.review-notice.rejected{border-color:#f2c3bd;color:#b43a2f;background:#fff4f2}
.name-input-shell{display:flex;box-sizing:border-box;width:100%;min-height:88rpx;align-items:center;margin-top:18rpx;padding:0 22rpx;border:1rpx solid $dz-border;border-radius:20rpx;background:#f8fbfb;transition:border-color .18s ease,box-shadow .18s ease}.name-input-shell.focused{border-color:$dz-brand;box-shadow:0 0 0 4rpx rgba(17,193,196,.12)}.name-input{display:block;box-sizing:border-box;width:100%;height:64rpx;padding:0;border:0;color:$dz-text-primary;background:transparent;font-size:27rpx;line-height:64rpx}.name-count{display:block;margin-top:10rpx;color:$dz-text-tertiary;font-size:21rpx;text-align:right}
.settings-panel{padding:0 26rpx}.setting-row{display:flex;min-height:126rpx;align-items:center;justify-content:space-between;border-bottom:1rpx solid $dz-border}.setting-row>view{display:flex;gap:7rpx;flex-direction:column}.setting-row>view>text,.radius-row .panel-heading view>text{color:$dz-text-secondary;font-size:21rpx;line-height:1.45}.setting-row picker{flex:none;margin-left:18rpx;color:$dz-text-primary;font-size:25rpx;font-weight:650}.setting-row picker b{margin-left:5rpx;color:$dz-text-tertiary;font-size:31rpx;font-weight:400}
.radius-row{padding:25rpx 0 22rpx}.radius-row .panel-heading>view{display:flex;gap:7rpx;flex-direction:column}.radius-row .panel-heading>b{color:$dz-brand-deep;font-size:28rpx;font-weight:750;font-variant-numeric:tabular-nums}.radius-row slider{margin:26rpx 0 8rpx}.range-label{display:flex;justify-content:space-between;color:$dz-text-tertiary;font-size:19rpx}
.save-bar{position:fixed;z-index:40;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));background:rgba(250,253,253,.96);box-shadow:0 -14rpx 44rpx rgba(24,55,58,.1)}.save{display:flex;width:100%;height:88rpx;align-items:center;justify-content:center;margin:0;padding:0;border:0;border-radius:24rpx;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control;font-size:30rpx;font-weight:700;line-height:1}.save text{line-height:1.3}.name-input-shell.invalid,.form-panel textarea.invalid{border-color:$dz-danger;background:$dz-danger-soft}.field-error{display:block;margin-top:9rpx;color:$dz-danger;font-size:20rpx}
/* #ifdef H5 */
.page-nav,.save-bar{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
/* #endif */
</style>
