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
          <text>生活照、个人介绍和服务范围将展示在达人主页。</text>
        </section>

        <section v-if="data.review_status === 'pending'" class="review-notice">资料已提交审核，审核期间用户端继续展示原资料。</section>
        <section v-else-if="data.review_status === 'rejected'" class="review-notice rejected">审核未通过：{{ data.review_rejection_reason }}</section>

        <section class="photo-panel">
          <image v-if="preview" :src="preview" mode="aspectFill" />
          <view v-else class="photo-empty"><b>＋</b><text>生活照</text></view>
          <view class="photo-copy">
            <view><strong class="strong-text">生活照</strong><text>公开展示</text></view>
            <text>建议使用清晰自然的半身或全身照</text>
          </view>
          <button class="photo-action dz-tappable" hover-class="dz-pressed" :disabled="uploading" @tap="choosePhoto">
            {{ preview ? '更换' : '上传' }}
          </button>
        </section>

        <section class="form-panel">
          <view class="panel-heading"><strong class="strong-text">达人名称</strong><text>公开展示 · 无需唯一</text></view>
          <input v-model="form.display_name" class="name-input" maxlength="30" placeholder="请输入公开展示的达人名称" />
        </section>

        <section class="form-panel">
          <view class="panel-heading"><strong class="strong-text">个人介绍</strong><text>至少 10 字</text></view>
          <textarea v-model="form.bio" maxlength="500" placeholder="介绍你的特长、性格和服务体验" />
          <text class="count">{{ form.bio.length }}/500</text>
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

        <view class="save-bar"><button class="save dz-tappable" hover-class="dz-pressed" :disabled="saving || uploading || data.review_status === 'pending'" @tap="save">{{ saving ? '提交中…' : data.review_status === 'pending' ? '资料审核中' : '提交资料审核' }}</button></view>
      </template>
    </main>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import { getProviderProfile, saveProviderProfile, uploadProviderLifestylePhoto } from '@/services/providers'
import type { ProviderProfileData } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

const cities = [
  { code: '130400', name: '邯郸市' },
  { code: '110100', name: '北京市' },
  { code: '310100', name: '上海市' },
]
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const preview = ref('')
const filePath = ref('')
const file = shallowRef<unknown>()
const data = ref<ProviderProfileData | null>(null)
const form = reactive({
  display_name: '', bio: '', lifestyle_photo_id: null as string | null, service_city_code: '130400',
  service_city_name: '邯郸市', max_service_radius_km: 10,
})

function back() { uni.navigateBack() }
function apply(value: ProviderProfileData) {
  data.value = value
  Object.assign(form, {
    display_name: value.display_name,
    bio: value.bio,
    lifestyle_photo_id: value.lifestyle_photo_id,
    service_city_code: value.service_city_code || '130400',
    service_city_name: value.service_city_name || '邯郸市',
    max_service_radius_km: value.max_service_radius_km,
  })
  preview.value = value.lifestyle_photo_url || ''
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
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: ({ tempFilePaths, tempFiles }) => {
      const selected = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
      if (selected?.size && selected.size > 8 * 1024 * 1024) return uni.showToast({ title: '生活照不能超过8MB', icon: 'none' })
      filePath.value = tempFilePaths[0]
      file.value = selected
      preview.value = tempFilePaths[0]
    },
  })
}
async function save() {
  if (form.display_name.trim().length < 2) return uni.showToast({ title: '达人名称至少2个字', icon: 'none' })
  if (form.bio.trim().length < 10) return uni.showToast({ title: '达人简介至少10个字', icon: 'none' })
  saving.value = true
  try {
    if (filePath.value) {
      uploading.value = true
      const uploaded = await uploadProviderLifestylePhoto(filePath.value, file.value)
      form.lifestyle_photo_id = uploaded.data.id
      uploading.value = false
    }
    apply((await saveProviderProfile({ ...form, display_name: form.display_name.trim(), bio: form.bio.trim() })).data)
    filePath.value = ''
    file.value = undefined
    uni.showToast({ title: '资料已提交审核', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason), icon: 'none' })
  } finally {
    saving.value = false
    uploading.value = false
  }
}

onLoad(load)
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.profile-edit-page{padding-bottom:calc(132rpx + env(safe-area-inset-bottom));background:linear-gradient(180deg,#edfafa 0,#f5f9f9 350rpx,#f2f6f6 100%)}
.page-nav{position:sticky;z-index:30;top:0;display:flex;height:100rpx;align-items:center;justify-content:space-between;background:rgba(247,252,252,.94)}
.nav-back,.nav-space{width:88rpx;height:80rpx;flex:0 0 88rpx}.nav-back{margin:0;padding:0;border:0;background:transparent;font-size:54rpx;line-height:76rpx;text-align:left}.page-nav>.strong-text{font-size:34rpx}.nav-space{display:block}
.nav-back::after,.photo-action::after,.save::after{display:none}
main{padding-top:12rpx}
.profile-lead{display:flex;gap:12rpx;padding:22rpx 4rpx 26rpx;flex-direction:column}.profile-lead>view{display:flex;align-items:baseline;justify-content:space-between}.profile-lead>view>text{color:$dz-brand-deep;font-size:21rpx;font-weight:700;letter-spacing:.04em}.profile-lead .strong-text{font-size:34rpx}.profile-lead>text{max-width:620rpx;color:$dz-text-secondary;font-size:24rpx;line-height:1.6}
.photo-panel,.form-panel,.settings-panel{border:1rpx solid rgba(220,232,233,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}
.photo-panel{display:flex;min-height:176rpx;align-items:center;padding:24rpx}.photo-panel>image,.photo-empty{display:flex;width:128rpx;height:128rpx;flex:0 0 128rpx;align-items:center;justify-content:center;border-radius:24rpx;background:$dz-brand-pale}.photo-empty{gap:4rpx;color:$dz-brand;flex-direction:column}.photo-empty b{font-size:36rpx;line-height:1}.photo-empty text{font-size:20rpx}.photo-copy{display:flex;min-width:0;gap:10rpx;margin-left:22rpx;flex:1;flex-direction:column}.photo-copy>view{display:flex;align-items:center;gap:12rpx}.photo-copy .strong-text{font-size:28rpx}.photo-copy>view>text{padding:5rpx 11rpx;border-radius:14rpx;color:$dz-brand-deep;background:$dz-brand-soft;font-size:18rpx;font-weight:650}.photo-copy>text{color:$dz-text-secondary;font-size:22rpx;line-height:1.5}.photo-action{height:68rpx;flex:none;margin:0 0 0 12rpx;padding:0 23rpx;border:1rpx solid #b8dddd;border-radius:21rpx;color:$dz-brand-deep;background:#fff;font-size:23rpx;font-weight:650;line-height:68rpx}
.form-panel,.settings-panel{margin-top:20rpx;padding:26rpx}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between}.panel-heading .strong-text,.setting-row .strong-text{font-size:27rpx}.panel-heading>text{color:$dz-text-tertiary;font-size:21rpx}.form-panel textarea{width:100%;height:168rpx;margin-top:18rpx;padding:20rpx;border:1rpx solid $dz-border;border-radius:20rpx;background:#f8fbfb;font-size:25rpx;line-height:1.65}.count{display:block;margin-top:10rpx;color:$dz-text-tertiary;font-size:21rpx;text-align:right}
.review-notice{margin-bottom:20rpx;padding:22rpx 24rpx;border:1rpx solid #9bdedc;border-radius:20rpx;color:$dz-brand-deep;background:#effcfc;font-size:23rpx;line-height:1.55}.review-notice.rejected{border-color:#f2c3bd;color:#b43a2f;background:#fff4f2}.name-input{width:100%;margin-top:18rpx;padding:20rpx;border:1rpx solid $dz-border;border-radius:20rpx;background:#f8fbfb;font-size:25rpx;box-sizing:border-box}
.settings-panel{padding:0 26rpx}.setting-row{display:flex;min-height:126rpx;align-items:center;justify-content:space-between;border-bottom:1rpx solid $dz-border}.setting-row>view{display:flex;gap:7rpx;flex-direction:column}.setting-row>view>text,.radius-row .panel-heading view>text{color:$dz-text-secondary;font-size:21rpx;line-height:1.45}.setting-row picker{flex:none;margin-left:18rpx;color:$dz-text-primary;font-size:25rpx;font-weight:650}.setting-row picker b{margin-left:5rpx;color:$dz-text-tertiary;font-size:31rpx;font-weight:400}
.radius-row{padding:25rpx 0 22rpx}.radius-row .panel-heading>view{display:flex;gap:7rpx;flex-direction:column}.radius-row .panel-heading>b{color:$dz-brand-deep;font-size:28rpx;font-weight:750;font-variant-numeric:tabular-nums}.radius-row slider{margin:26rpx 0 8rpx}.range-label{display:flex;justify-content:space-between;color:$dz-text-tertiary;font-size:19rpx}
.save-bar{position:fixed;z-index:40;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));background:rgba(250,253,253,.96);box-shadow:0 -14rpx 44rpx rgba(24,55,58,.1)}.save{width:100%;height:88rpx;margin:0;border:0;border-radius:24rpx;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control;font-size:27rpx;font-weight:700;line-height:88rpx}
/* #ifdef H5 */
.page-nav,.save-bar{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
/* #endif */
</style>
