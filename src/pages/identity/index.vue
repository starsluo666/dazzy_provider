<template>
  <view class="dz-page dz-management-page identity-page" :class="{ 'identity-page-locked': locked }">
    <view class="dz-safe-top" />
    <view class="page-nav dz-management-head dz-container">
      <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="back">‹</button>
      <text class="page-title">实名认证</text>
      <view class="nav-space" />
    </view>

    <view class="identity-content dz-container">
      <NetworkState v-if="loading" loading message="正在加载认证资料…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <view class="status-card" :class="data.identity_status">
          <view class="status-mark">
            <text v-if="data.identity_status === 'verified'" class="status-check">✓</text>
            <text v-else-if="data.identity_status === 'pending'" class="status-pending">•••</text>
            <text v-else-if="data.identity_status === 'rejected'" class="status-alert">!</text>
            <image v-else src="/static/icons/security.svg" mode="aspectFit" />
          </view>
          <view class="status-copy">
            <view class="status-title">
              <text class="status-heading">{{ statusHeading }}</text>
              <text class="status-badge">{{ materialProgress }}</text>
            </view>
            <text class="status-description">{{ statusCopy }}</text>
            <view class="status-progress">
              <view
                v-for="(item, index) in photoItems"
                :key="item.key"
                class="progress-step"
                :class="{ complete: locked || Boolean(item.id) }"
              >
                <view class="progress-line" />
                <text>{{ progressSteps[index] }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="data.identity_status === 'rejected'" class="reject-card">
          <text class="reject-title">未通过原因</text>
          <text class="reject-copy">{{ data.identity_rejection_reason }}</text>
        </view>

        <view class="materials-card">
          <view class="section-title">
            <text class="section-heading">认证材料</text>
            <text class="section-hint">{{ locked ? '已锁定' : '请确保文字清晰、边角完整' }}</text>
          </view>
          <view
            v-for="item in photoItems"
            :key="item.key"
            class="material-row dz-tappable"
            :class="{ 'material-row-locked': locked }"
            :aria-disabled="busy || locked || checkingIdentity"
            role="button"
            hover-class="dz-pressed"
            @tap="choosePhoto(item.key)"
          >
            <view class="photo-frame">
              <image v-if="item.url" :src="item.url" mode="aspectFill" />
              <view v-else-if="item.id || locked" class="photo-locked-placeholder" />
              <view v-else class="photo-empty">
                <view class="photo-glyph" :class="item.glyph" />
                <text>＋ 上传</text>
              </view>
              <text v-if="item.id || locked" class="photo-complete">✓</text>
            </view>
            <view class="photo-copy">
              <text class="photo-title">{{ item.label }}</text>
              <text class="photo-help">{{ data.identity_status === 'verified' ? '已通过平台审核' : locked ? '材料已锁定，待核验' : item.help }}</text>
            </view>
            <view v-if="!locked" class="material-action">
              <text>{{ uploading[item.key] ? '上传中' : item.id ? '更换' : '上传' }}</text>
              <text class="action-chevron">›</text>
            </view>
          </view>
        </view>

        <view class="form-card">
          <view class="form-row">
            <text class="form-label">真实姓名</text>
            <view class="form-value">
              <text class="locked-value">{{ recognizedIdentity ? data.identity_real_name : '上传后自动识别' }}</text>
              <text class="form-helper">与入驻申请姓名核对，无需重复填写</text>
            </view>
          </view>
          <view class="form-row form-row-tall">
            <text class="form-label">身份证号码</text>
            <view class="form-value">
              <text class="locked-value identity-number">{{ recognizedIdentity ? data.identity_number_masked : '上传后自动识别' }}</text>
              <text class="form-helper">仅展示脱敏号码，不支持手动修改</text>
            </view>
          </view>
        </view>

        <view class="privacy-card">
          <view class="privacy-title"><view class="lock-icon privacy-lock" /><text>隐私保护说明</text></view>
          <text class="privacy-copy">新上传的身份证正反面自动添加“仅用于达人验证”水印。认证资料不公开展示，仅用于身份审核。</text>
          <text class="privacy-copy">本人自拍仅供客服人工审核，不进行活体检测或自动人脸比对。</text>
          <text v-if="!locked && !data.identity_verification?.enabled" class="privacy-copy">身份验证暂不可用，已上传的照片会自动保存，请稍后重试或联系客服。</text>
          <text v-if="data.identity_verification?.enabled" class="privacy-copy">{{ data.identity_verification.notice }}</text>
        </view>
      </template>
    </view>

    <view v-if="data && !loading && !error" class="identity-footer">
      <view v-if="!locked" class="footer-actions">
        <button class="primary-button dz-tappable" hover-class="dz-pressed" :disabled="busy || checkingIdentity" @tap="submit">{{ submitting ? '提交中…' : uploadingAny ? '正在上传…' : verifying || checkingIdentity ? '正在识别…' : '提交认证' }}</button>
      </view>
      <view v-else class="locked-note"><text>{{ lockedFooterCopy }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { getProviderIdentity, saveProviderIdentity, verifyProviderIdentity, submitProviderIdentity, uploadProviderIdentityPhoto } from '@/services/providers'
import { guardCurrentPage } from '@/services/session'
import type { ProviderIdentity } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

type PhotoKey = 'identity_front_photo' | 'identity_back_photo' | 'identity_face_photo'
const loading = ref(true); const submitting = ref(false); const error = ref('')
const verifying = ref(false); const picking = ref(false)
let acceptedConsentVersion = ''
let disposed = false
const uploading = reactive<Record<PhotoKey, boolean>>({
  identity_front_photo: false,
  identity_back_photo: false,
  identity_face_photo: false,
})
const uploadingAny = computed(() => Object.values(uploading).some(Boolean))
const busy = computed(() => loading.value || submitting.value || verifying.value || picking.value || uploadingAny.value)
const data = ref<ProviderIdentity | null>(null)
const form = reactive({ identity_front_photo_id: null as string | null, identity_back_photo_id: null as string | null, identity_face_photo_id: null as string | null })
const previews = reactive({ identity_front_photo: '', identity_back_photo: '', identity_face_photo: '' })
const checkingIdentity = computed(() => verifying.value || data.value?.identity_verification?.status === 'processing')
const locked = computed(() => data.value?.identity_status === 'pending' || data.value?.identity_status === 'verified')
const statusHeading = computed(() => checkingIdentity.value ? '身份证识别中' : recognizedIdentity.value && !locked.value ? '待提交认证' : ({
  unverified: '请上传身份证照片',
  pending: '审核中',
  verified: '已认证',
  rejected: '认证未通过',
}[data.value?.identity_status || 'unverified']))
const statusCopy = computed(() => ({ unverified: '上传证件与本人自拍，姓名和号码自动识别', pending: '证件与自拍已提交，等待客服人工审核', verified: '身份核验已完成，可继续完善资料和服务', rejected: '请根据原因修改照片后重新提交' }[data.value?.identity_status || 'unverified']))
const progressSteps = ['人像面', '国徽面', '本人自拍']
const photoItems = computed(() => [
  { key: 'identity_front_photo' as PhotoKey, label: '身份证人像面', help: '证件正面，姓名与号码清晰', id: form.identity_front_photo_id, url: previews.identity_front_photo, glyph: 'camera-glyph' },
  { key: 'identity_back_photo' as PhotoKey, label: '身份证国徽面', help: '证件背面，有效期清晰', id: form.identity_back_photo_id, url: previews.identity_back_photo, glyph: 'camera-glyph' },
  { key: 'identity_face_photo' as PhotoKey, label: '本人自拍', help: '正脸清晰，仅供客服人工审核', id: form.identity_face_photo_id, url: previews.identity_face_photo, glyph: 'face-glyph' },
])
const completedMaterialCount = computed(() => photoItems.value.filter((item) => Boolean(item.id)).length)
const materialProgress = computed(() => {
  if (data.value?.identity_status === 'verified') return '核验完成'
  if (data.value?.identity_status === 'pending') return '审核中'
  if (data.value?.identity_status === 'rejected') return '待修改'
  return `${completedMaterialCount.value}/3 份材料`
})
const recognizedIdentity = computed(() => Boolean(
  data.value?.identity_real_name && data.value?.identity_number_masked
  && (data.value.identity_verification?.status === 'passed' || ['pending', 'verified'].includes(data.value.identity_status))
  && form.identity_front_photo_id === data.value?.identity_front_photo_id,
))
const lockedFooterCopy = computed(() => checkingIdentity.value ? '身份证验真中 · 请稍后刷新结果' : data.value?.identity_status === 'pending'
  ? '资料审核中 · 审核完成前暂时无法修改'
  : '资料已锁定 · 如需变更请联系客服')

function back(){ uni.navigateBack() }
function apply(value: ProviderIdentity){ data.value=value; form.identity_front_photo_id=value.identity_front_photo_id; form.identity_back_photo_id=value.identity_back_photo_id; form.identity_face_photo_id=value.identity_face_photo_id; previews.identity_front_photo=value.identity_front_photo_url||''; previews.identity_back_photo=value.identity_back_photo_url||''; previews.identity_face_photo=value.identity_face_photo_url||'' }
async function load(){ loading.value=true; error.value=''; try{ const response = await getProviderIdentity(); if (!disposed) apply(response.data) }catch(reason){ if (!disposed) error.value=getErrorMessage(reason) }finally{ loading.value=false } }
async function refreshAfterError() {
  try { const response = await getProviderIdentity(); if (!disposed) apply(response.data) } catch { /* Keep the last saved state; never auto-retry verification. */ }
}
async function verifyFront() {
  if (disposed || busy.value || locked.value || checkingIdentity.value) return
  const frontId = form.identity_front_photo_id
  if (!frontId) return uni.showToast({ title: '请上传身份证照片', icon: 'none' })
  if (!data.value?.identity_verification?.enabled) {
    return uni.showToast({ title: '身份验证暂不可用，请稍后重试', icon: 'none' })
  }
  verifying.value = true
  try {
    const verification = data.value.identity_verification
    if (acceptedConsentVersion !== verification.consent_version) {
      const accepted = await new Promise<boolean>((resolve, reject) => uni.showModal({
        title: '身份证验真授权', content: verification.notice,
        confirmText: '同意验真', cancelText: '暂不验真',
        success: result => resolve(result.confirm === true), fail: reject,
      })).catch(() => {
        // A failed native dialog is not consent. Preserve the draft and allow retry.
        if (!disposed) uni.showToast({ title: '授权弹窗未能打开，请重试', icon: 'none' })
        return false
      })
      if (!accepted || disposed) return
      acceptedConsentVersion = verification.consent_version
    }
    const response = await verifyProviderIdentity(frontId, acceptedConsentVersion)
    if (!disposed && form.identity_front_photo_id === frontId) apply(response.data)
  } catch (reason) {
    if (!disposed) {
      uni.showToast({ title: getErrorMessage(reason, '识别未完成，请重新上传人像面'), icon: 'none' })
      await refreshAfterError()
    }
  } finally { verifying.value = false }
}
async function submit() {
  if (disposed || busy.value || locked.value || checkingIdentity.value) return
  if (!form.identity_front_photo_id || !form.identity_back_photo_id || !form.identity_face_photo_id) {
    return uni.showToast({ title: '请上传全部认证材料', icon: 'none' })
  }
  if (!recognizedIdentity.value || data.value?.identity_verification?.status !== 'passed') {
    return uni.showToast({ title: '请重新上传身份证人像面完成识别', icon: 'none' })
  }
  submitting.value = true
  try {
    const response = await submitProviderIdentity()
    if (disposed) return
    apply(response.data)
    uni.showToast({ title: '已提交审核', icon: 'success' })
  } catch (reason) {
    if (!disposed) {
      uni.showModal({ title: '认证提交未通过', content: getErrorMessage(reason), showCancel: false })
      await refreshAfterError()
    }
  } finally {
    submitting.value = false
  }
}
function choosePhoto(key: PhotoKey) {
  if (disposed || busy.value || locked.value || checkingIdentity.value) return
  picking.value = true
  try { uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async ({ tempFilePaths, tempFiles }) => {
      picking.value = false
      if (disposed || uploadingAny.value) return
      if (!tempFilePaths[0]) {
        uni.showToast({ title: '未获取到图片，请重试', icon: 'none' })
        return
      }
      const file = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
      if (file?.size && file.size > 8 * 1024 * 1024) {
        uni.showToast({ title: '图片不能超过8MB', icon: 'none' })
        return
      }
      uploading[key] = true
      let saved = false
      try {
        const result = await uploadProviderIdentityPhoto(tempFilePaths[0], file, key)
        if (disposed) return
        const response = await saveProviderIdentity({ recognition_mode: 'photo', [`${key}_id`]: result.data.id })
        if (disposed) return
        apply(response.data)
        saved = true
      } catch (reason) {
        if (!disposed) {
          uni.showToast({ title: getErrorMessage(reason, '照片保存失败，请重新上传'), icon: 'none' })
          await refreshAfterError()
        }
      } finally {
        uploading[key] = false
      }
      if (saved && key === 'identity_front_photo') await verifyFront()
    },
    fail: ({ errMsg }) => {
      picking.value = false
      if (!disposed && !/cancel/i.test(errMsg || '')) {
        uni.showToast({ title: '打开相册失败，请重试', icon: 'none' })
      }
    },
  }) } catch {
    picking.value = false
    if (!disposed) uni.showToast({ title: '打开相册失败，请重试', icon: 'none' })
  }
}
onLoad(() => { if (guardCurrentPage()) void load() })
onUnload(() => { disposed = true })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

/* 认证页：先上传材料，再查看识别信息，最后提交人工审核。 */
.identity-page{
  min-height:100vh;
  padding-bottom:calc(136rpx + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,#edf8f8 0,#f4f8f8 340rpx,#f1f6f6 100%);
}
.page-nav{
  position:sticky;
  z-index:30;
  top:0;
  display:flex;
  height:100rpx;
  align-items:center;
  justify-content:space-between;
  background:rgba(247,252,252,.94);
}
.page-title{
  color:$dz-text-primary;
  font-size:34rpx;
  font-weight:750;
  line-height:1.15;
  letter-spacing:-.015em;
}
.nav-back,.nav-space{width:88rpx;height:80rpx;flex:0 0 88rpx}
.nav-back{margin:0;padding:0;border:0;background:transparent;font-size:54rpx;line-height:76rpx;text-align:left}
.nav-space{display:block}
.nav-back::after,.material-row::after,.primary-button::after{display:none}
.identity-content{padding-top:18rpx;padding-bottom:24rpx}

.status-card{
  display:flex;
  min-height:214rpx;
  align-items:center;
  padding:28rpx 30rpx;
  border:1rpx solid rgba(255,255,255,.95);
  border-radius:30rpx;
  background:rgba(255,255,255,.94);
  box-shadow:0 12rpx 38rpx rgba(31,76,82,.075);
}
.status-mark{
  display:flex;
  width:86rpx;
  height:86rpx;
  flex:0 0 86rpx;
  align-items:center;
  justify-content:center;
  border:2rpx solid rgba(17,193,196,.2);
  border-radius:50%;
  color:$dz-brand-deep;
  background:$dz-brand-soft;
  box-shadow:none;
}
.status-mark image{width:50rpx;height:50rpx}
.status-check,.status-alert{font-size:47rpx;font-weight:700;line-height:1}
.status-pending{font-size:26rpx;font-weight:800;letter-spacing:3rpx}
.status-card.verified .status-mark,.status-card.pending .status-mark{
  border-color:transparent;
  color:#fff;
  background:$dz-brand;
  box-shadow:$dz-shadow-control;
}
.status-card.rejected{border-color:#ffd8cd}
.status-card.rejected .status-mark{border-color:transparent;color:#fff;background:$dz-orange}
.status-copy{display:flex;min-width:0;margin-left:22rpx;flex:1;flex-direction:column}
.status-title{display:flex;align-items:center;justify-content:space-between;gap:16rpx}
.status-title>.status-heading{min-width:0;flex:1;padding:0;border-radius:0;color:$dz-text-primary;background:transparent;font-size:31rpx;font-weight:750;line-height:1.15;letter-spacing:-.018em}
.status-title>.status-badge{flex:none;padding:7rpx 14rpx;border-radius:999rpx;color:$dz-brand-deep;background:$dz-brand-soft;font-size:19rpx;font-weight:700;line-height:1.25}
.status-card.rejected .status-badge{color:#b64b29;background:#fff0ea}
.status-description{margin-top:8rpx;color:$dz-text-secondary;font-size:22rpx;line-height:1.45}
.status-progress{display:grid;gap:10rpx;margin-top:16rpx;grid-template-columns:repeat(3,1fr)}
.progress-step{display:flex;min-width:0;align-items:center;flex-direction:column}
.progress-line{width:100%;height:9rpx;border-radius:999rpx;background:#e5eeee}
.progress-step text{margin-top:8rpx;color:$dz-text-tertiary;font-size:17rpx;line-height:1.2;white-space:nowrap}
.progress-step.complete .progress-line{background:$dz-brand}
.progress-step.complete text{color:$dz-brand-deep;font-weight:650}

.reject-card{
  display:flex;
  gap:8rpx;
  margin-top:20rpx;
  padding:22rpx 26rpx;
  border:1rpx solid #ffd8cd;
  border-radius:23rpx;
  background:#fff1ec;
  flex-direction:column;
}
.reject-title{color:#c94927;font-size:24rpx;font-weight:700}
.reject-copy{color:$dz-text-secondary;font-size:22rpx;line-height:1.55}

.form-card,.materials-card{
  overflow:hidden;
  margin-top:22rpx;
  border:1rpx solid rgba(211,226,227,.96);
  border-radius:28rpx;
  background:rgba(255,255,255,.97);
  box-shadow:0 8rpx 24rpx rgba(31,76,82,.055);
}
.form-row{
  display:flex;
  min-height:108rpx;
  align-items:center;
  padding:20rpx 26rpx;
  border-bottom:1rpx solid $dz-border;
}
.form-row:last-child{border-bottom:0}
.form-row-tall{min-height:122rpx}
.form-label{width:166rpx;flex:0 0 166rpx;color:$dz-text-primary;font-size:25rpx;font-weight:700;line-height:1.35}
.form-value{display:flex;min-width:0;gap:6rpx;flex:1;flex-direction:column}
.locked-value{display:block;color:$dz-text-primary;font-size:25rpx;line-height:1.4}
.identity-number{font-variant-numeric:tabular-nums;letter-spacing:.01em}
.form-helper{color:$dz-text-tertiary;font-size:20rpx;line-height:1.4}
.lock-icon{
  position:relative;
  width:17rpx;
  height:15rpx;
  flex:0 0 17rpx;
  margin-left:16rpx;
  border:2rpx solid $dz-text-tertiary;
  border-radius:4rpx;
}
.lock-icon::before{
  position:absolute;
  top:-10rpx;
  left:2rpx;
  width:9rpx;
  height:9rpx;
  border:2rpx solid $dz-text-tertiary;
  border-bottom:0;
  border-radius:8rpx 8rpx 0 0;
  content:'';
}

.materials-card{padding:26rpx 26rpx 4rpx}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:20rpx;margin-bottom:4rpx}
.section-title>.section-heading{color:$dz-text-primary;font-size:29rpx;font-weight:750;letter-spacing:-.01em;text-align:left}
.section-title>.section-hint{color:$dz-text-tertiary;font-size:20rpx;line-height:1.35;text-align:right}
.material-row{
  display:flex;
  width:100%;
  min-height:160rpx;
  align-items:center;
  box-sizing:border-box;
  margin:0;
  padding:18rpx 0;
  border:0;
  border-bottom:1rpx solid $dz-border;
  border-radius:0;
  color:$dz-text-primary;
  background:transparent;
  text-align:left;
}
.material-row:last-child{border-bottom:0}
.material-row.material-row-locked{color:$dz-text-primary;background:transparent!important;opacity:1}
.material-row-locked .photo-title{color:$dz-text-primary}
.material-row-locked .photo-help{color:$dz-text-secondary}
.photo-frame{position:relative;width:124rpx;height:108rpx;flex:0 0 124rpx}
.photo-frame image,.photo-empty,.photo-locked-placeholder{width:100%;height:100%;border-radius:20rpx;background:$dz-brand-pale}
.photo-locked-placeholder{background:linear-gradient(145deg,#b7e9e7 0,#8fd8d5 100%)}
.photo-empty{display:flex;align-items:center;justify-content:center;color:$dz-brand-deep;flex-direction:column}
.photo-empty text{margin-top:8rpx;font-size:17rpx;line-height:1}
.photo-glyph{position:relative;color:$dz-brand}
.camera-glyph{width:31rpx;height:24rpx;border:3rpx solid currentColor;border-radius:5rpx}
.camera-glyph::before{position:absolute;top:-8rpx;left:8rpx;width:12rpx;height:7rpx;border-radius:4rpx 4rpx 0 0;background:currentColor;content:''}
.camera-glyph::after{position:absolute;top:5rpx;left:9rpx;width:9rpx;height:9rpx;border:3rpx solid currentColor;border-radius:50%;content:''}
.face-glyph{width:32rpx;height:35rpx}
.face-glyph::before{position:absolute;top:0;left:10rpx;width:12rpx;height:12rpx;border:3rpx solid currentColor;border-radius:50%;content:''}
.face-glyph::after{position:absolute;right:2rpx;bottom:0;left:2rpx;height:16rpx;border:3rpx solid currentColor;border-bottom:0;border-radius:18rpx 18rpx 0 0;content:''}
.photo-complete{position:absolute;top:-8rpx;right:-8rpx;display:flex;width:27rpx;height:27rpx;align-items:center;justify-content:center;border:3rpx solid #fff;border-radius:50%;color:#fff;background:$dz-online;font-size:17rpx;font-weight:800;line-height:1}
.photo-copy{display:flex;min-width:0;gap:7rpx;margin-left:20rpx;flex:1;flex-direction:column}
.photo-title{overflow:hidden;color:$dz-text-primary;font-size:25rpx;font-weight:700;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
.photo-help{color:$dz-text-secondary;font-size:21rpx;line-height:1.42}
.material-action{display:flex;height:56rpx;flex:none;align-items:center;margin-left:12rpx;padding:0 16rpx 0 20rpx;border-radius:999rpx;color:$dz-brand-deep;background:$dz-brand-pale;font-size:22rpx;font-weight:700}
.action-chevron{margin-left:5rpx;font-size:28rpx;font-weight:400;line-height:1}

.privacy-card{margin-top:22rpx;padding:23rpx 27rpx;border:1rpx solid rgba(198,236,234,.52);border-radius:26rpx;background:rgba(230,248,247,.9)}
.privacy-title{display:flex;align-items:center;color:$dz-brand-deep;font-size:24rpx;font-weight:750}
.privacy-title .lock-icon{margin-right:14rpx;margin-left:0;border-color:$dz-brand-deep}
.privacy-title .lock-icon::before{border-color:$dz-brand-deep}
.privacy-copy{display:block;margin-top:8rpx;padding-left:31rpx;color:$dz-text-secondary;font-size:21rpx;line-height:1.55}

.identity-footer{
  position:fixed;
  z-index:40;
  right:0;
  bottom:0;
  left:0;
  box-sizing:border-box;
  width:100%;
  max-width:750px;
  margin:0 auto;
  padding:16rpx 30rpx calc(16rpx + env(safe-area-inset-bottom));
  background:rgba(250,253,253,.96);
  box-shadow:0 -12rpx 38rpx rgba(24,55,58,.085);
}
.footer-actions{display:flex}
.primary-button{
  display:flex;
  width:100%;
  height:86rpx;
  min-height:44px;
  align-items:center;
  justify-content:center;
  box-sizing:border-box;
  margin:0;
  padding:0;
  border-radius:24rpx;
  font-size:26rpx;
  font-weight:750;
  line-height:1;
}
.primary-button{border:0;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control}
.locked-note{display:flex;min-height:70rpx;align-items:center}
.locked-note text{width:340rpx;padding:13rpx 20rpx;border-radius:18rpx;color:$dz-text-secondary;background:#f1f5f5;font-size:22rpx;font-weight:650;line-height:1.45}

/* #ifdef H5 */
.page-nav,.identity-footer{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
@media (prefers-reduced-transparency:reduce){.page-nav,.identity-footer{background:#fbfdfd;-webkit-backdrop-filter:none;backdrop-filter:none}}
/* #endif */
</style>
