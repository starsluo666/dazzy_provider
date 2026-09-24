<template>
  <view class="phone-page">
    <view class="dz-safe-top" />
    <header class="page-head"><button aria-label="返回" @tap="goBack">‹</button><strong>修改登录手机号</strong><view /></header>
    <main>
      <section class="notice">
        <strong>当前手机号 {{ security?.phone_masked || '—' }}</strong>
        <text>修改后请使用新手机号登录，其他设备上的登录状态会立即失效。</text>
      </section>

      <section class="form-card">
        <label><text>验证当前手机号</text><view class="code-field"><input v-model="currentCode" type="number" maxlength="6" placeholder="输入 6 位验证码" /><button :disabled="currentSeconds > 0 || sendingCurrent" @tap="sendCurrentCode">{{ currentSeconds > 0 ? `${currentSeconds}s` : sendingCurrent ? '发送中' : '获取验证码' }}</button></view></label>
        <label><text>新手机号</text><view class="input-field"><input v-model="newPhone" type="number" maxlength="11" placeholder="请输入新的手机号" /></view></label>
        <label><text>验证新手机号</text><view class="code-field"><input v-model="newCode" type="number" maxlength="6" placeholder="输入 6 位验证码" /><button :disabled="newSeconds > 0 || sendingNew" @tap="sendNewCode">{{ newSeconds > 0 ? `${newSeconds}s` : sendingNew ? '发送中' : '获取验证码' }}</button></view></label>
        <button class="submit" :class="{ invalid: touched && !canSubmit }" :disabled="saving" @tap="submit">{{ saving ? '正在修改…' : '确认修改手机号' }}</button>
        <text v-if="touched && !canSubmit" class="form-error">请完整填写当前验证码、新手机号和新手机号验证码</text>
      </section>
    </main>
  </view>
</template>

<script setup lang="ts">
import { onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'

import { changePhone, getAccountSecurity, sendPhoneChangeCode } from '@/services/auth'
import { guardCurrentPage } from '@/services/session'
import type { AccountSecurity } from '@/types/api'

const security = ref<AccountSecurity | null>(null)
const currentCode = ref('')
const newPhone = ref('')
const newCode = ref('')
const currentSeconds = ref(0)
const newSeconds = ref(0)
const sendingCurrent = ref(false)
const sendingNew = ref(false)
const saving = ref(false)
const touched = ref(false)
let currentTimer: ReturnType<typeof setInterval> | undefined
let newTimer: ReturnType<typeof setInterval> | undefined

const canSubmit = computed(() => /^1[3-9]\d{9}$/.test(newPhone.value) && currentCode.value.length === 6 && newCode.value.length === 6)
function warn(title: string) { uni.showToast({ title, icon: 'none' }) }
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function countdown(target: 'current' | 'new', seconds: number) {
  const value = target === 'current' ? currentSeconds : newSeconds
  const oldTimer = target === 'current' ? currentTimer : newTimer
  if (oldTimer) clearInterval(oldTimer)
  value.value = seconds
  const timer = setInterval(() => { value.value = Math.max(0, value.value - 1); if (!value.value) clearInterval(timer) }, 1000)
  if (target === 'current') currentTimer = timer
  else newTimer = timer
}
async function sendCurrentCode() {
  if (sendingCurrent.value || currentSeconds.value) return
  sendingCurrent.value = true
  try {
    const response = await sendPhoneChangeCode('current')
    if (response.data.debug_code) currentCode.value = response.data.debug_code
    countdown('current', response.data.retry_after)
    uni.showToast({ title: `验证码已发送至 ${response.data.destination_masked}`, icon: 'none' })
  } catch (error) { warn(error instanceof Error ? error.message : '验证码发送失败') }
  finally { sendingCurrent.value = false }
}
async function sendNewCode() {
  if (!/^1[3-9]\d{9}$/.test(newPhone.value)) return warn('请输入正确的新手机号')
  if (sendingNew.value || newSeconds.value) return
  sendingNew.value = true
  try {
    const response = await sendPhoneChangeCode('new', newPhone.value)
    if (response.data.debug_code) newCode.value = response.data.debug_code
    countdown('new', response.data.retry_after)
    uni.showToast({ title: `验证码已发送至 ${response.data.destination_masked}`, icon: 'none' })
  } catch (error) { warn(error instanceof Error ? error.message : '验证码发送失败') }
  finally { sendingNew.value = false }
}
async function submit() {
  touched.value = true
  if (!canSubmit.value) return warn('请完整填写并检查手机号和验证码')
  saving.value = true
  try {
    await changePhone(currentCode.value, newPhone.value, newCode.value)
    uni.showToast({ title: '手机号修改成功', icon: 'success' })
    setTimeout(goBack, 500)
  } catch (error) { warn(error instanceof Error ? error.message : '手机号修改失败') }
  finally { saving.value = false }
}
onShow(async () => { if (guardCurrentPage()) { try { security.value = (await getAccountSecurity()).data } catch (error) { warn(error instanceof Error ? error.message : '账号信息加载失败') } } })
onUnload(() => { if (currentTimer) clearInterval(currentTimer); if (newTimer) clearInterval(newTimer) })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.phone-page{min-height:100vh;background:linear-gradient(180deg,#e9fafa 0,$dz-surface-page 400rpx);box-sizing:border-box}.page-head{display:flex;height:96rpx;align-items:center;justify-content:space-between;padding:0 24rpx}.page-head button,.page-head view{width:72rpx;height:72rpx;margin:0;padding:0;border:0;background:transparent;font-size:52rpx;line-height:68rpx}.page-head strong{font-size:31rpx}.phone-page main{padding:18rpx 28rpx calc(48rpx + env(safe-area-inset-bottom))}.notice,.form-card{border:1rpx solid $dz-border-subtle;border-radius:28rpx;background:#fff;box-shadow:$dz-shadow-card}.notice{display:flex;gap:10rpx;padding:26rpx;flex-direction:column}.notice strong{font-size:27rpx}.notice text{color:$dz-text-secondary;font-size:21rpx;line-height:1.6}.form-card{display:flex;gap:26rpx;margin-top:24rpx;padding:30rpx 26rpx;flex-direction:column}.form-card label{display:flex;gap:11rpx;flex-direction:column}.form-card label>text{font-size:23rpx;font-weight:700}.input-field,.code-field{display:flex;height:92rpx;align-items:center;border:1rpx solid #dbe7e9;border-radius:21rpx;background:#f9fbfb;overflow:hidden}.input-field:focus-within,.code-field:focus-within{border-color:$dz-brand-primary;box-shadow:0 0 0 4rpx rgba(17,193,196,.1)}.input-field input,.code-field input{min-width:0;height:100%;padding:0 22rpx;flex:1;font-size:25rpx}.code-field button{min-width:184rpx;height:66rpx;margin:0 12rpx 0 0;padding:0 18rpx;border:0;border-left:1rpx solid $dz-border-subtle;color:$dz-brand-deep;background:transparent;font-size:21rpx;line-height:66rpx}.code-field button[disabled]{color:$dz-text-tertiary}.submit{height:92rpx;margin-top:8rpx;border:0;border-radius:23rpx;color:#fff;background:$dz-gradient-brand;font-size:27rpx;font-weight:700;line-height:92rpx}.submit[disabled]{opacity:.6}.submit.invalid{background:#e5484d}.form-error{margin-top:-14rpx;color:#d83b42;font-size:20rpx;text-align:center}
</style>
