<template>
  <view class="dz-page dz-management-page identity-page">
    <view class="dz-safe-top" />
    <header class="page-nav dz-management-head dz-container">
      <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="back">‹</button>
      <strong class="strong-text">实名认证</strong>
      <view class="nav-space" />
    </header>
    <main class="dz-container">
      <NetworkState v-if="loading" loading message="正在加载认证资料…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <section class="status-card" :class="data.identity_status">
          <view class="status-mark">{{ statusMark }}</view>
          <view class="status-copy">
            <view class="status-title"><strong class="strong-text">{{ data.identity_status_label }}</strong><text>{{ materialProgress }}</text></view>
            <text>{{ statusCopy }}</text>
          </view>
        </section>

        <section v-if="data.identity_status === 'rejected'" class="reject-card">
          <strong>未通过原因</strong><text>{{ data.identity_rejection_reason }}</text>
        </section>

        <section class="form-card">
          <label><text>真实姓名</text><input v-model="form.identity_real_name" :disabled="locked" placeholder="请输入身份证上的姓名" maxlength="50" /></label>
          <label><text>身份证号码</text><input v-model="form.id_number" :disabled="locked" type="idcard" placeholder="请输入18位身份证号码" maxlength="18" /><small v-if="data.identity_number_masked">已保存：{{ data.identity_number_masked }}</small></label>
        </section>

        <section class="materials">
          <view class="section-title"><strong>认证材料</strong><text>请确保文字清晰、边角完整</text></view>
          <button v-for="item in photoItems" :key="item.key" class="material-row dz-tappable" hover-class="dz-pressed" :disabled="locked || uploading" @tap="choosePhoto(item.key)">
            <image v-if="item.url" :src="item.url" mode="aspectFill" />
            <view v-else class="photo-empty"><b>＋</b><text>{{ item.label }}</text></view>
            <view class="photo-copy"><strong>{{ item.label }}</strong><text>{{ item.help }}</text></view>
            <text class="action">{{ item.url ? '更换' : '上传' }} ›</text>
          </button>
        </section>

        <section class="privacy"><strong>隐私保护说明</strong><text>认证材料使用私有存储，仅用于达人身份核验；公开页面只展示认证结果，不展示姓名、证件号码或原图。</text></section>
        <view v-if="!locked" class="actions"><button class="secondary" :disabled="saving" @tap="save">保存资料</button><button class="primary" :disabled="saving || uploading" @tap="submit">提交认证</button></view>
      </template>
    </main>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { getProviderIdentity, saveProviderIdentity, submitProviderIdentity, uploadProviderIdentityPhoto } from '@/services/providers'
import type { ProviderIdentity } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

type PhotoKey = 'identity_front_photo' | 'identity_back_photo' | 'identity_face_photo'
const loading = ref(true); const saving = ref(false); const uploading = ref(false); const error = ref('')
const data = ref<ProviderIdentity | null>(null)
const form = reactive({ identity_real_name: '', id_number: '', identity_front_photo_id: null as string | null, identity_back_photo_id: null as string | null, identity_face_photo_id: null as string | null })
const previews = reactive({ identity_front_photo: '', identity_back_photo: '', identity_face_photo: '' })
const locked = computed(() => data.value?.identity_status === 'pending' || data.value?.identity_status === 'verified')
const statusMark = computed(() => data.value?.identity_status === 'verified' ? '✓' : data.value?.identity_status === 'pending' ? '…' : data.value?.identity_status === 'rejected' ? '!' : '○')
const statusCopy = computed(() => ({ unverified: '填写信息并上传材料后提交平台核验', pending: '资料已提交，平台正在核验，请耐心等待', verified: '身份核验已完成，可继续完善资料和服务', rejected: '请根据原因修改材料后重新提交' }[data.value?.identity_status || 'unverified']))
const photoItems = computed(() => [
  { key: 'identity_front_photo' as PhotoKey, label: '身份证人像面', help: '证件正面，姓名与号码清晰', url: previews.identity_front_photo },
  { key: 'identity_back_photo' as PhotoKey, label: '身份证国徽面', help: '证件背面，有效期清晰', url: previews.identity_back_photo },
  { key: 'identity_face_photo' as PhotoKey, label: '本人核验照片', help: '正脸清晰、光线自然', url: previews.identity_face_photo },
])
const materialProgress = computed(() => {
  if (data.value?.identity_status === 'verified') return '认证完成'
  if (data.value?.identity_status === 'pending') return '审核中'
  const count = photoItems.value.filter((item) => Boolean(item.url)).length
  return `${count}/3 份材料`
})

function back(){ uni.navigateBack() }
function apply(value: ProviderIdentity){ data.value=value; form.identity_real_name=value.identity_real_name; form.id_number=''; form.identity_front_photo_id=value.identity_front_photo_id; form.identity_back_photo_id=value.identity_back_photo_id; form.identity_face_photo_id=value.identity_face_photo_id; previews.identity_front_photo=value.identity_front_photo_url||''; previews.identity_back_photo=value.identity_back_photo_url||''; previews.identity_face_photo=value.identity_face_photo_url||'' }
async function load(){ loading.value=true; error.value=''; try{ apply((await getProviderIdentity()).data) }catch(reason){ error.value=getErrorMessage(reason) }finally{ loading.value=false } }
function payload(){ return { identity_real_name: form.identity_real_name.trim(), ...(form.id_number ? { id_number: form.id_number.trim().toUpperCase() } : {}), identity_front_photo_id: form.identity_front_photo_id, identity_back_photo_id: form.identity_back_photo_id, identity_face_photo_id: form.identity_face_photo_id } }
async function save(silent=false){ if(saving.value)return false; saving.value=true; try{ apply((await saveProviderIdentity(payload())).data); if(!silent)uni.showToast({title:'资料已保存',icon:'success'}); return true }catch(reason){ uni.showToast({title:getErrorMessage(reason),icon:'none'}); return false }finally{ saving.value=false } }
async function submit(){ if(!form.identity_real_name.trim())return uni.showToast({title:'请填写真实姓名',icon:'none'}); if(!form.id_number && !data.value?.identity_number_masked)return uni.showToast({title:'请填写身份证号码',icon:'none'}); if(!form.identity_front_photo_id||!form.identity_back_photo_id||!form.identity_face_photo_id)return uni.showToast({title:'请上传全部认证材料',icon:'none'}); if(!await save(true))return; try{ apply((await submitProviderIdentity()).data); uni.showToast({title:'已提交审核',icon:'success'}) }catch(reason){ uni.showToast({title:getErrorMessage(reason),icon:'none'}) } }
function choosePhoto(key: PhotoKey){ uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera'],success:async({tempFilePaths,tempFiles})=>{ const file=Array.isArray(tempFiles)?tempFiles[0]:tempFiles; if(file?.size&&file.size>8*1024*1024)return uni.showToast({title:'图片不能超过8MB',icon:'none'}); uploading.value=true; try{ const result=await uploadProviderIdentityPhoto(tempFilePaths[0],file); const idKey=`${key}_id` as keyof typeof form; form[idKey]=result.data.id; previews[key]=result.data.url }catch(reason){ uni.showToast({title:getErrorMessage(reason),icon:'none'}) }finally{ uploading.value=false } }}) }
onLoad(load)
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.identity-page{padding-bottom:calc(138rpx + env(safe-area-inset-bottom));background:linear-gradient(180deg,#edfafa 0,#f5f9f9 360rpx,#f2f6f6 100%)}
.page-nav{position:sticky;z-index:30;top:0;display:flex;height:100rpx;align-items:center;justify-content:space-between;background:rgba(247,252,252,.94)}
.nav-back,.nav-space{width:88rpx;height:80rpx;flex:0 0 88rpx}.nav-back{margin:0;padding:0;border:0;background:transparent;font-size:54rpx;line-height:76rpx;text-align:left}.page-nav>.strong-text{font-size:34rpx;letter-spacing:0}.nav-space{display:block}
.nav-back::after,.material-row::after,.actions button::after{display:none}
main{padding-top:18rpx}
.status-card{display:flex;align-items:center;padding:28rpx;border:1rpx solid rgba(255,255,255,.94);border-radius:30rpx;background:rgba(255,255,255,.93);box-shadow:$dz-shadow}
.status-mark{display:flex;width:82rpx;height:82rpx;flex:0 0 82rpx;align-items:center;justify-content:center;border-radius:26rpx;color:#fff;background:$dz-brand;font-size:36rpx;font-weight:750;box-shadow:$dz-shadow-control}
.status-copy{display:flex;min-width:0;gap:10rpx;margin-left:22rpx;flex:1;flex-direction:column}.status-title{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.status-title>.strong-text{font-size:31rpx}.status-title>text{flex:none;padding:6rpx 13rpx;border-radius:16rpx;color:$dz-brand-deep;background:$dz-brand-soft;font-size:20rpx;font-weight:650}.status-copy>text{color:$dz-text-secondary;font-size:24rpx;line-height:1.55}
.status-card.rejected{border-color:#ffd8cd}.status-card.rejected .status-mark{background:$dz-orange;box-shadow:none}.status-card.rejected .status-title>text{color:#b64b29;background:#fff0ea}
.reject-card,.privacy{display:flex;gap:10rpx;margin-top:20rpx;padding:24rpx 26rpx;border-radius:24rpx;background:#fff1ec;flex-direction:column}.reject-card strong{color:#c94927;font-size:25rpx}.reject-card text,.privacy text{color:$dz-text-secondary;font-size:23rpx;line-height:1.65}
.form-card,.materials{overflow:hidden;margin-top:22rpx;border:1rpx solid rgba(220,232,233,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}
.form-card label{display:flex;min-height:118rpx;align-items:center;padding:22rpx 26rpx;border-bottom:1rpx solid $dz-border}.form-card label:last-child{border-bottom:0}.form-card label>text{width:166rpx;flex:none;font-size:26rpx;font-weight:700}.form-card input{height:72rpx;min-width:0;flex:1;font-size:25rpx}.form-card small{display:block;color:$dz-text-tertiary;font-size:21rpx;line-height:1.45}
.materials{padding:26rpx}.section-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20rpx;margin-bottom:12rpx}.section-title strong{font-size:29rpx}.section-title text{color:$dz-text-secondary;font-size:21rpx;line-height:1.4;text-align:right}
.material-row{display:flex;width:100%;min-height:146rpx;align-items:center;margin:0;padding:18rpx 0;border:0;border-bottom:1rpx solid $dz-border;background:transparent;text-align:left}.material-row:last-child{border-bottom:0}.materials image,.photo-empty{display:flex;width:116rpx;height:100rpx;flex:none;align-items:center;justify-content:center;border-radius:20rpx;background:$dz-brand-pale}.photo-empty{gap:5rpx;color:$dz-brand;flex-direction:column}.photo-empty b{font-size:34rpx;line-height:1}.photo-empty text{font-size:19rpx}.photo-copy{display:flex;min-width:0;gap:8rpx;margin-left:20rpx;flex:1;flex-direction:column}.photo-copy strong{font-size:25rpx}.photo-copy text{color:$dz-text-secondary;font-size:22rpx;line-height:1.45}.action{flex:none;margin-left:12rpx;color:$dz-brand-deep;font-size:23rpx;font-weight:650}
.privacy{margin-bottom:0;background:rgba(232,249,248,.9)}.privacy strong{font-size:25rpx}.actions{position:fixed;z-index:40;right:0;bottom:0;left:0;display:grid;max-width:750px;gap:16rpx;margin:auto;padding:18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));grid-template-columns:1fr 1.35fr;background:rgba(250,253,253,.96);box-shadow:0 -14rpx 44rpx rgba(24,55,58,.1)}.actions button{height:88rpx;margin:0;border-radius:24rpx;font-size:27rpx;font-weight:700;line-height:88rpx}.secondary{border:1rpx solid #c4dedf;color:$dz-brand-deep;background:#fff}.primary{border:0;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control}
/* #ifdef H5 */
.page-nav,.actions{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
/* #endif */
</style>
