<template>
  <view class="invite-page">
    <view class="brand"><image class="brand-logo" src="/static/auth-logo.png" mode="aspectFit" /><text>达人入驻</text></view>
    <view class="content">
      <text class="title">注册成为达人</text><text class="intro">注册账号与入驻意向，一次填写</text>
      <view v-if="loading" class="notice">正在核验邀请来源…</view>
      <view v-else-if="!invite" class="notice"><text>{{ loadError }}</text><button class="secondary" @tap="load">重新加载</button></view>
      <view v-else-if="submitted" class="card success">
        <text class="section-title">入驻意向已提交</text><text class="hint">账号已注册，资料等待平台初审。你可以直接查看审核进度，初审通过后在这里继续完善接单资料。</text>
        <button class="primary" @tap="viewApplication">查看申请进度</button>
      </view>
      <view v-else-if="existingSession" class="card success">
        <text class="section-title">当前已有登录账号</text><text class="hint">可直接查看当前账号的入驻进度。若要为其他手机号注册，请先切换账号；已有账号不能重复领取邀请奖励。</text>
        <button class="primary" @tap="viewApplication">查看申请进度</button>
        <button class="secondary" :disabled="saving" @tap="switchToRegister">切换账号后注册</button>
      </view>
      <template v-else>
        <view class="source"><view><text class="source-kind">{{ invite.kind === 'store' ? '门店邀请' : '达人邀请' }}</text><text class="source-name">{{ invite.name }}</text></view><view class="source-code"><text class="source-kind">邀请码 · 自动填入</text><text>{{ invite.code }}</text></view></view>
        <view class="card">
          <view class="section-head"><text class="step">01</text><text class="section-title">注册账号</text></view>
          <view class="field"><text class="label">手机号</text><input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" :disabled="saving" /></view>
          <view class="field"><text class="label">短信验证码</text><view class="sms-row"><input v-model="form.code" class="input sms-input" type="number" maxlength="6" placeholder="6位验证码" :disabled="saving" /><button class="sms-button" :disabled="saving || sending || seconds > 0" @tap="sendCode">{{ seconds > 0 ? `${seconds}s 后重发` : sending ? '发送中…' : '获取验证码' }}</button></view></view>
          <view class="field"><text class="label">设置密码</text><input v-model="form.password" class="input" :password="true" maxlength="20" placeholder="8–20位密码" :disabled="saving" /></view>
          <view class="field"><text class="label">确认密码</text><input v-model="confirmPassword" class="input" :password="true" maxlength="20" placeholder="请再次输入密码" :disabled="saving" /></view>
        </view>
        <view class="card">
          <view class="section-head"><text class="step">02</text><text class="section-title">入驻意向</text></view>
          <view class="field"><text class="label">真实姓名</text><input v-model="form.application_real_name" class="input" maxlength="50" placeholder="请填写与身份证一致的姓名" :disabled="saving" /></view>
          <view class="paired">
            <view class="field half"><text class="label">出生日期</text><picker mode="date" :end="maxBirthDate" :value="form.application_birth_date || maxBirthDate" :disabled="saving" @change="setBirthDate"><view class="input picker-input" :class="{ placeholder: !form.application_birth_date }">{{ form.application_birth_date || '请选择日期' }}</view></picker></view>
            <view class="field half"><text class="label">性别</text><view class="gender-row"><button class="gender" :class="{ selected: form.gender === 'male' }" :disabled="saving" @tap="form.gender = 'male'">男</button><button class="gender" :class="{ selected: form.gender === 'female' }" :disabled="saving" @tap="form.gender = 'female'">女</button></view></view>
          </view>
          <view class="field"><text class="label">近期生活照</text><view class="photo-row"><button class="photo-picker" :disabled="saving" @tap="choosePhoto"><image v-if="photoPath" :src="photoPath" class="photo" mode="aspectFill" /><text v-else class="plus">＋</text></button><view class="photo-copy"><text class="photo-title">{{ photoPath ? '已选择生活照' : '上传一张近期生活照' }}</text><text class="hint">清晰、自然，单张不超过8MB</text><button v-if="photoPath" class="remove" :disabled="saving" @tap="removePhoto">移除照片</button></view></view></view>
          <view class="field"><text class="label">服务城市</text><picker :range="invite.cities" range-key="name" :disabled="saving" @change="chooseCity"><view class="input picker-input" :class="{ placeholder: !cityName }">{{ cityName || '请选择服务城市' }}<text>›</text></view></picker></view>
        </view>
        <view class="terms-note"><text>入驻须知：申请人须年满18周岁，资料须真实且属于本人。提交仅代表入驻意向，初审通过后还需完成实名认证、开通审核和接单学习。</text></view>
        <LegalConsent v-model="agreed" :disabled="saving" @read="openLegalDocument" />
        <view class="intent-consent" @tap="!saving && (intentAgreed = !intentAgreed)"><checkbox :checked="intentAgreed" :disabled="saving" color="#08787e" /><text>我已阅读入驻须知，同意将以上资料提交平台审核</text></view>
        <view v-if="error" class="error" role="alert">{{ error }}</view>
        <button class="primary" :disabled="saving" hover-class="pressed" @tap="submit">{{ saving ? '正在上传并提交，请稍候…' : '注册并提交入驻意向' }}</button>
        <text class="footnote">提交后可在达人端查看进度，初审通过后继续完善接单资料</text>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LegalConsent from '@/components/LegalConsent.vue'
import { openLegalDocument } from '@/content/legal'
import { useSmsCode } from '@/composables/useSmsCode'
import { getProviderInvite, registerInvitedProvider, type ProviderInvite } from '@/services/providerInvites'
import { isAuthenticated } from '@/services/session'
import { logout } from '@/services/auth'

const invite = ref<ProviderInvite | null>(null)
const sourceCode = ref('')
const loading = ref(true), saving = ref(false), submitted = ref(false)
const existingSession = ref(false)
const loadError = ref(''), error = ref(''), agreed = ref(false), intentAgreed = ref(false)
const photoPath = ref(''), photoFile = shallowRef<unknown>(), confirmPassword = ref('')
const form = reactive({ phone: '', code: '', password: '', application_real_name: '', application_birth_date: '', gender: '', service_city_code: '' })
const { seconds, sending, send } = useSmsCode('register')
const cityName = computed(() => invite.value?.cities.find(c => c.code === form.service_city_code)?.name || '')
const maxBirthDate = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const message = (e: unknown) => e instanceof Error ? e.message : '操作失败，请稍后重试'
async function load() {
  loading.value = true; loadError.value = ''; invite.value = null
  try {
    if (!/^[A-F0-9]{12}$/.test(sourceCode.value)) throw new Error('邀请链接无效，请重新扫描邀请人提供的二维码。')
    invite.value = (await getProviderInvite(sourceCode.value)).data
  } catch (e) { loadError.value = message(e) }
  finally { loading.value = false }
}
async function sendCode() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) { error.value = '请输入正确的手机号'; return }
  try { await send(form.phone); error.value = ''; uni.showToast({ title: '验证码已发送', icon: 'none' }) } catch (e) { error.value = message(e) }
}
function setBirthDate(e: { detail: { value: string } }) { form.application_birth_date = e.detail.value }
function chooseCity(e: { detail: { value: string } }) { form.service_city_code = invite.value?.cities[Number(e.detail.value)]?.code || '' }
function removePhoto() { photoPath.value = ''; photoFile.value = undefined }
function choosePhoto() {
  if (saving.value) return
  uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
    success: ({ tempFilePaths, tempFiles }) => {
      const selected = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
      if (selected?.size && selected.size > 8 * 1024 * 1024) { error.value = '生活照不能超过8MB'; return }
      photoPath.value = tempFilePaths[0] || ''; photoFile.value = selected; error.value = ''
    }, fail: e => { if (!e.errMsg?.includes('cancel')) error.value = '无法选择照片，请检查相册权限后重试' },
  })
}
async function submit() {
  if (saving.value || !invite.value || submitted.value) return
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(form.phone)) error.value = '请输入正确的手机号'
  else if (!/^\d{6}$/.test(form.code)) error.value = '请输入6位短信验证码'
  else if (form.password.length < 8 || form.password.length > 20) error.value = '密码需为8–20位'
  else if (form.password !== confirmPassword.value) error.value = '两次密码不一致'
  else if (form.application_real_name.trim().length < 2) error.value = '请填写真实姓名'
  else if (!form.application_birth_date || form.application_birth_date > maxBirthDate) error.value = '请选择出生日期，申请需年满18周岁'
  else if (!form.gender) error.value = '请选择性别'
  else if (!photoPath.value) error.value = '请选择近期生活照'
  else if (!form.service_city_code) error.value = '请选择服务城市'
  else if (!agreed.value || !intentAgreed.value) error.value = '请阅读并同意协议及入驻须知'
  if (error.value) { uni.showToast({ title: error.value, icon: 'none' }); return }
  saving.value = true
  try {
    await registerInvitedProvider(photoPath.value, photoFile.value, { ...form, source_code: invite.value.code, agreement_accepted: 'true' })
    submitted.value = true; form.password = ''; confirmPassword.value = ''; form.code = ''; removePhoto()
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } catch (e) { error.value = `${message(e)}（如提交失败后验证码失效，请重新获取；若提示已注册，请使用该手机号登录查看申请。）` }
  finally { saving.value = false }
}
function viewApplication() { uni.redirectTo({ url: '/pages/invitations/application' }) }
function switchToRegister() {
  if (saving.value) return
  uni.showModal({ title: '切换账号后注册', content: '将退出当前登录账号，不会清除已提交的入驻申请。', success: async result => {
    if (!result.confirm) return
    saving.value = true
    try { await logout() } catch { /* logout clears local credentials even if the network is unavailable. */ }
    finally { existingSession.value = false; saving.value = false }
  } })
}
onLoad(query => { existingSession.value = isAuthenticated(); sourceCode.value = String(query?.code || '').toUpperCase(); void load() })
</script>

<style scoped>
.invite-page{min-height:100vh;background:#f3f5f6;color:#172126;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}.brand{padding:20px 24px;display:flex;align-items:center;gap:10px;background:#fff;font-size:14px;color:#526267;padding-top:calc(20px + env(safe-area-inset-top))}.brand-logo{width:110px;height:37px}.content{max-width:480px;margin:auto;padding:28px 20px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box}.title{display:block;font-size:28px;font-weight:700;line-height:1.4;letter-spacing:-.6px}.intro{display:block;margin-top:8px;color:#66737a;font-size:14px}.source{display:flex;justify-content:space-between;gap:12px;margin:24px 0 20px;padding:16px;border-radius:16px;background:#ddf8f7;color:#08787e}.source-kind{display:block;font-size:11px;line-height:1.6;font-weight:400}.source-name{display:block;font-size:15px;font-weight:600;line-height:1.8;word-break:break-all}.source-code{flex-shrink:0;text-align:right;font-size:12px;line-height:1.8}.card{margin-top:16px;padding:22px 18px;background:#fff;border:1px solid #e5ebee;border-radius:20px}.section-head{display:flex;gap:10px;align-items:center;margin-bottom:20px}.step{font-size:12px;color:#08787e;font-weight:600}.section-title{font-size:18px;font-weight:650;line-height:1.5}.field{margin-top:18px}.label{display:block;font-size:14px;font-weight:550;line-height:1.5;margin-bottom:9px}.input{display:block;box-sizing:border-box;width:100%;height:48px;min-height:48px;padding:0 12px;font-size:14px;line-height:48px;border:1px solid #dee7ea;border-radius:11px;background:#f9fbfc;color:#172126}.sms-row{display:flex;gap:10px}.sms-input{flex:1;min-width:0}.sms-button{flex:none;margin:0;padding:0 10px;height:48px;line-height:48px;font-size:12px;color:#08787e;background:#eaf8f7;border:0;border-radius:10px}.paired{display:flex;gap:14px}.half{flex:1;min-width:0}.gender-row{display:flex;gap:8px}.gender{flex:1;height:48px;line-height:46px;margin:0;padding:0;border:1px solid #dee7ea;border-radius:11px;background:#f9fbfc;font-size:14px;color:#526267}.selected{border-color:#08787e;color:#08787e;background:#eaf8f7}.picker-input{display:flex;justify-content:space-between;align-items:center;line-height:1.4}.placeholder{color:#87959c}.photo-row{display:flex;gap:14px;align-items:center}.photo-picker{flex:none;width:80px;height:88px;display:flex;align-items:center;justify-content:center;margin:0;padding:0;border:1px dashed #a5ced0;border-radius:12px;background:#f0f9f9}.photo{width:80px;height:88px}.plus{font-size:30px;color:#08787e}.photo-copy{min-width:0}.photo-title{display:block;font-size:13px;line-height:1.5}.hint{display:block;font-size:12px;color:#66737a;line-height:1.8;margin-top:6px}.remove{min-height:44px;line-height:44px;background:none;padding:0;margin:0;border:0;text-align:left;font-size:12px;color:#08787e}.terms-note{margin:20px 4px 8px;color:#66737a;font-size:12px;line-height:1.8}.intent-consent{display:flex;align-items:center;gap:8px;font-size:12px;color:#66737a;line-height:1.7;min-height:44px;padding:6px 8px}.primary{width:100%;display:flex;justify-content:center;align-items:center;margin:20px 0 0;padding:14px 10px;min-height:54px;border:0;border-radius:14px;background:#08787e;color:white;font-size:16px;font-weight:600;line-height:1.6}.pressed{opacity:.88}.footnote{display:block;text-align:center;color:#79878d;font-size:11px;line-height:1.8;margin:14px 8px}.error{padding:12px;border-radius:10px;background:#fff0e8;color:#a74326;font-size:13px;line-height:1.8;margin-top:14px}.notice{padding:30px 4px;font-size:14px;color:#66737a;line-height:1.8}.secondary{font-size:14px;line-height:44px;color:#08787e;margin-top:16px;background:#ddf8f7}.success{margin-top:26px}.primary::after,.sms-button::after,.gender::after,.photo-picker::after,.remove::after,.secondary::after{border:0}@media(max-width:350px){.content{padding-left:14px;padding-right:14px}.paired{display:block}.source{gap:6px;padding:12px}.source-code{font-size:11px}}
</style>
