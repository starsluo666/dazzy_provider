<template>
  <view class="invite-page">
    <view class="dz-safe-top" />
    <view class="brand"><image class="brand-logo" src="/static/auth-logo.png" mode="aspectFit" /><text>达人入驻</text></view>
    <view class="content">
      <text class="title">注册成为达人</text>
      <text class="intro">注册账号与入驻意向，一次填写</text>
      <view v-if="loading" class="notice">正在核验邀请来源…</view>
      <view v-else-if="!invite" class="notice"><text>{{ loadError }}</text><button class="secondary" @tap="load">重新加载</button></view>
      <view v-else-if="submitted" class="card success">
        <text class="section-title">入驻意向已提交</text>
        <text class="hint">账号已注册，资料等待平台初审。你可以在这里查看进度；初审通过后使用同一手机号登录达人端，继续完善接单资料。</text>
        <button class="primary" @tap="viewApplication">查看申请进度</button>
      </view>
      <template v-else>
        <view class="source">
          <view><text class="source-kind">{{ invite.kind === 'store' ? '门店邀请' : '达人邀请' }}</text><text class="source-name">{{ invite.name }}</text></view>
          <view class="source-code"><text class="source-kind">邀请码 · 自动填入</text><text>{{ invite.code }}</text></view>
        </view>
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
          <view class="field"><text class="label">近期生活照</text><view class="photo-row"><button class="photo-picker" :disabled="saving" @tap="choosePhoto"><image v-if="photoPath" :src="photoPath" class="photo" mode="aspectFill" /><text v-else class="plus">＋</text></button><view class="photo-copy"><text class="photo-title">{{ photoPath ? '已选择生活照' : '上传一张近期生活照' }}</text><text class="hint">清晰、自然，单张不超过8MB</text></view></view></view>
          <view class="field"><text class="label">服务城市</text><picker :range="invite.cities" range-key="name" :disabled="saving" @change="chooseCity"><view class="input picker-input" :class="{ placeholder: !cityName }">{{ cityName || '请选择服务城市' }}<text>›</text></view></picker></view>
        </view>
        <view class="terms-note">入驻申请须年满18周岁，资料须真实且属于本人。提交仅代表入驻意向，初审通过后还需完成实名认证、开通审核和接单学习。</view>
        <LegalConsent v-model="agreed" :disabled="saving" @read="openLegalDocument" />
        <view class="intent-consent" @tap="!saving && (intentAgreed = !intentAgreed)"><checkbox :checked="intentAgreed" :disabled="saving" color="#08787e" /><text>我已阅读入驻须知，同意将以上资料提交平台审核</text></view>
        <view v-if="error" class="error" role="alert">{{ error }}</view>
        <button class="primary" :disabled="saving" hover-class="pressed" @tap="submit">{{ saving ? '正在上传并提交，请稍候…' : '注册并提交入驻意向' }}</button>
        <text class="footnote">初审通过后前往达人端完善接单资料</text>
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

const invite = ref<ProviderInvite | null>(null)
const sourceCode = ref('')
const loading = ref(true), saving = ref(false), submitted = ref(false)
const loadError = ref(''), error = ref(''), agreed = ref(false), intentAgreed = ref(false)
const photoPath = ref(''), photoFile = shallowRef<unknown>(), confirmPassword = ref('')
const form = reactive({ phone: '', code: '', password: '', application_real_name: '', application_birth_date: '', gender: '', service_city_code: '' })
const { seconds, sending, send } = useSmsCode('register')
const cityName = computed(() => invite.value?.cities.find(city => city.code === form.service_city_code)?.name || '')
const maxBirthDate = (() => { const date = new Date(); date.setFullYear(date.getFullYear() - 18); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` })()
const message = (reason: unknown) => reason instanceof Error ? reason.message : '操作失败，请稍后重试'

async function load() {
  loading.value = true; loadError.value = ''; invite.value = null
  try {
    if (!/^[A-F0-9]{12}$/.test(sourceCode.value)) throw new Error('邀请链接无效，请重新打开邀请卡片。')
    invite.value = (await getProviderInvite(sourceCode.value)).data
  } catch (reason) { loadError.value = message(reason) }
  finally { loading.value = false }
}
function sendCode() {
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(form.phone)) { error.value = '请输入正确的手机号'; return }
  void send(form.phone).then(() => uni.showToast({ title: '验证码已发送', icon: 'none' })).catch(reason => { error.value = message(reason) })
}
function setBirthDate(event: { detail: { value: string } }) { form.application_birth_date = event.detail.value }
function chooseCity(event: { detail: { value: string } }) { form.service_city_code = invite.value?.cities[Number(event.detail.value)]?.code || '' }
function choosePhoto() {
  if (saving.value) return
  uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: ({ tempFilePaths, tempFiles }) => {
    const selected = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
    if (selected?.size && selected.size > 8 * 1024 * 1024) { error.value = '生活照不能超过8MB'; return }
    photoPath.value = tempFilePaths[0] || ''; photoFile.value = selected; error.value = ''
  }, fail: result => { if (!result.errMsg?.includes('cancel')) error.value = '无法选择照片，请检查相册权限后重试' } })
}
function validateForm() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) return '请输入正确的手机号'
  if (!/^\d{6}$/.test(form.code)) return '请输入6位短信验证码'
  if (form.password.length < 8 || form.password.length > 20) return '密码需为8–20位'
  if (form.password !== confirmPassword.value) return '两次密码不一致'
  if (form.application_real_name.trim().length < 2) return '请填写真实姓名'
  if (!form.application_birth_date || form.application_birth_date > maxBirthDate) return '请选择出生日期，申请需年满18周岁'
  if (!form.gender) return '请选择性别'
  if (!photoPath.value) return '请选择近期生活照'
  if (!form.service_city_code) return '请选择服务城市'
  if (!agreed.value || !intentAgreed.value) return '请阅读并同意协议及入驻须知'
  return ''
}
async function submit() {
  if (saving.value || !invite.value || submitted.value) return
  error.value = validateForm()
  if (error.value) { uni.showToast({ title: error.value, icon: 'none' }); return }
  saving.value = true
  try {
    await registerInvitedProvider(photoPath.value, photoFile.value, { ...form, source_code: invite.value.code, agreement_accepted: 'true' })
    submitted.value = true; form.password = ''; confirmPassword.value = ''; form.code = ''; photoPath.value = ''; photoFile.value = undefined
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } catch (reason) { error.value = `${message(reason)}（如提示已注册，请使用该手机号登录查看申请。）` }
  finally { saving.value = false }
}
function viewApplication() { uni.redirectTo({ url: '/pages/invitations/application' }) }
onLoad(query => { sourceCode.value = String(query?.code || '').toUpperCase(); void load() })
</script>

<style scoped>
.invite-page{min-height:100vh;background:#f3f5f6;color:#172126}.brand{padding:calc(16px + env(safe-area-inset-top)) 20px 16px;display:flex;align-items:center;gap:10px;background:#fff;font-size:14px;color:#526267}.brand-logo{width:110px;height:37px}.content{max-width:480px;margin:auto;padding:24px 18px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box}.title{display:block;font-size:26px;font-weight:700;line-height:1.4}.intro{display:block;margin-top:6px;color:#66737a;font-size:14px}.source{display:flex;justify-content:space-between;gap:10px;margin:22px 0 18px;padding:14px;border-radius:16px;background:#ddf8f7;color:#08787e}.source-kind{display:block;font-size:11px;line-height:1.6}.source-name{display:block;font-size:15px;font-weight:600;line-height:1.8;word-break:break-all}.source-code{flex-shrink:0;text-align:right;font-size:12px;line-height:1.8}.card{margin-top:16px;padding:20px 16px;background:#fff;border:1px solid #e5ebee;border-radius:18px}.section-head{display:flex;gap:10px;align-items:center;margin-bottom:16px}.step{font-size:12px;color:#08787e;font-weight:600}.section-title{font-size:18px;font-weight:650;line-height:1.5}.field{margin-top:16px}.label{display:block;font-size:14px;font-weight:550;line-height:1.5;margin-bottom:8px}.input{display:block;box-sizing:border-box;width:100%;height:46px;min-height:46px;padding:0 12px;font-size:14px;line-height:46px;border:1px solid #dee7ea;border-radius:10px;background:#f9fbfc;color:#172126}.sms-row{display:flex;gap:8px}.sms-input{flex:1;min-width:0}.sms-button{flex:none;margin:0;padding:0 9px;height:46px;line-height:46px;font-size:12px;color:#08787e;background:#eaf8f7;border:0;border-radius:10px}.paired{display:flex;gap:12px}.half{flex:1;min-width:0}.gender-row{display:flex;gap:8px}.gender{flex:1;height:46px;line-height:44px;margin:0;padding:0;border:1px solid #dee7ea;border-radius:10px;background:#f9fbfc;font-size:14px;color:#526267}.selected{border-color:#08787e;color:#08787e;background:#eaf8f7}.picker-input{display:flex;justify-content:space-between;align-items:center;line-height:1.4}.placeholder{color:#87959c}.photo-row{display:flex;gap:12px;align-items:center}.photo-picker{flex:none;width:76px;height:84px;display:flex;align-items:center;justify-content:center;margin:0;padding:0;border:1px dashed #a5ced0;border-radius:12px;background:#f0f9f9}.photo{width:76px;height:84px}.plus{font-size:30px;color:#08787e}.photo-title{display:block;font-size:13px;line-height:1.5}.hint{display:block;font-size:12px;color:#66737a;line-height:1.8;margin-top:6px}.terms-note{margin:18px 4px 8px;color:#66737a;font-size:12px;line-height:1.8}.intent-consent{display:flex;align-items:center;gap:8px;font-size:12px;color:#66737a;line-height:1.7;min-height:44px;padding:6px 8px}.primary{width:100%;display:flex;justify-content:center;align-items:center;margin:18px 0 0;padding:13px 10px;min-height:52px;border:0;border-radius:13px;background:#08787e;color:white;font-size:15px;font-weight:600;line-height:1.6}.secondary{font-size:14px;line-height:44px;color:#08787e;margin-top:16px;background:#ddf8f7}.pressed{opacity:.88}.footnote{display:block;text-align:center;color:#79878d;font-size:11px;line-height:1.8;margin:14px 8px}.error{padding:12px;border-radius:10px;background:#fff0e8;color:#a74326;font-size:13px;line-height:1.8;margin-top:14px}.notice{padding:28px 4px;font-size:14px;color:#66737a;line-height:1.8}.success{margin-top:24px}.success .hint{margin-top:12px}.primary::after,.secondary::after,.sms-button::after,.gender::after,.photo-picker::after{border:0}@media(max-width:350px){.content{padding-left:14px;padding-right:14px}.paired{display:block}.source{gap:6px;padding:12px}.source-code{font-size:11px}}
</style>
