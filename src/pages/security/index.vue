<template>
  <view class="dz-page dz-management-page security-page">
    <view class="security-hero">
      <view class="dz-safe-top" />
      <header class="dz-page-head dz-management-head dz-container">
        <button class="dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="goBack">‹</button>
        <strong class="strong-text">账号设置</strong>
        <view class="head-space" />
      </header>
    </view>

    <main class="dz-container security-content">
      <NetworkState v-if="loading" message="正在加载账号设置…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else>
        <section class="security-summary">
          <view class="summary-icon"><image src="/static/icons/security.svg" mode="aspectFit" /></view>
          <view class="summary-copy">
            <view><strong class="strong-text">账号状态正常</strong><text>正常</text></view>
            <p>手机号与登录密码用于保护账号，敏感操作需要再次验证身份。</p>
          </view>
          <view class="summary-status">
            <view><text>账号状态</text><strong>{{ security?.account_status_label || '正常' }}</strong></view>
            <view><text>登录密码</text><strong>{{ security?.password_set ? '已设置' : '未设置' }}</strong></view>
          </view>
        </section>

        <h2 class="section-title">账号信息</h2>
        <section class="setting-card">
          <view class="setting-row static-row">
            <view class="row-icon"><image src="/static/icons/phone.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text">登录手机号</strong><text>用于登录和身份核验</text></view>
            <view class="row-value"><strong>{{ security?.phone_masked }}</strong><text>已绑定</text></view>
          </view>
        </section>

        <h2 class="section-title">安全设置</h2>
        <section class="setting-card">
          <button class="setting-row dz-tappable" hover-class="dz-pressed" aria-label="修改登录密码" @tap="openPanel('password')">
            <view class="row-icon"><image src="/static/icons/password.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text">登录密码</strong><text>定期更换密码可降低账号风险</text></view>
            <view class="row-value"><strong>修改</strong><b>›</b></view>
          </button>
        </section>

        <h2 class="section-title">账号管理</h2>
        <section class="setting-card danger-card">
          <button class="setting-row dz-tappable" hover-class="dz-pressed" aria-label="注销账号" @tap="openPanel('close')">
            <view class="row-icon danger-icon"><image src="/static/icons/account-close.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text danger-copy">账号注销</strong><text>永久停用当前账号并退出登录</text></view>
            <view class="row-value"><strong class="danger-copy">注销</strong><b>›</b></view>
          </button>
        </section>

        <section class="security-tip">
          <strong class="strong-text">安全提醒</strong>
          <text>平台不会通过电话或聊天索要密码、短信验证码。请勿向他人提供账号或代收款信息。</text>
        </section>
      </template>
    </main>

    <view v-if="panel" class="sheet-mask" @tap.self="closePanel">
      <section class="security-sheet" role="dialog" :aria-label="panelTitle">
        <i class="sheet-handle" />
        <header><view><strong class="strong-text">{{ panelTitle }}</strong><text>{{ panelDescription }}</text></view><button aria-label="关闭" @tap="closePanel">×</button></header>
        <view class="sheet-form">
          <label>
            <text>当前登录密码</text>
            <view class="password-field"><input v-model="currentPassword" :password="!currentVisible" maxlength="20" placeholder="请输入当前密码" /><button @tap.stop="currentVisible = !currentVisible">{{ currentVisible ? '隐藏' : '显示' }}</button></view>
          </label>
          <template v-if="panel === 'password'">
            <label>
              <text>新密码</text>
              <view class="password-field"><input v-model="newPassword" :password="!newVisible" maxlength="20" placeholder="8–20 位，建议包含字母和数字" /><button @tap.stop="newVisible = !newVisible">{{ newVisible ? '隐藏' : '显示' }}</button></view>
            </label>
            <label>
              <text>确认新密码</text>
              <view class="password-field"><input v-model="confirmation" :password="!confirmationVisible" maxlength="20" placeholder="请再次输入新密码" /><button @tap.stop="confirmationVisible = !confirmationVisible">{{ confirmationVisible ? '隐藏' : '显示' }}</button></view>
            </label>
          </template>
          <view v-else class="session-note"><strong class="strong-text">注销后无法恢复</strong><text>账号将被永久停用，所有设备都会退出登录；如仍有进行中的订单，请先完成处理。</text></view>
          <button class="submit-button" :class="{ danger: panel === 'close' }" :disabled="saving" @tap="submit">
            {{ saving ? '正在处理…' : panel === 'password' ? '确认修改' : '确认注销账号' }}
          </button>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'

import NetworkState from '@/components/NetworkState.vue'
import { changePassword, closeAccount, getAccountSecurity } from '@/services/auth'
import { clearSession, guardCurrentPage } from '@/services/session'
import type { AccountSecurity } from '@/types/api'

type SecurityPanel = 'password' | 'close' | ''

const security = ref<AccountSecurity | null>(null)
const loading = ref(true)
const error = ref('')
const panel = ref<SecurityPanel>('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const currentVisible = ref(false)
const newVisible = ref(false)
const confirmationVisible = ref(false)
const saving = ref(false)

const panelTitle = computed(() => panel.value === 'password' ? '修改登录密码' : '注销账号')
const panelDescription = computed(() => panel.value === 'password' ? '修改后，其他设备上的旧登录状态将失效。' : '验证当前密码后永久停用当前账号。')

function warn(title: string) { uni.showToast({ title, icon: 'none' }) }
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function openPanel(value: Exclude<SecurityPanel, ''>) { clearForm(); panel.value = value }
function closePanel(force = false) { if (!saving.value || force) { panel.value = ''; clearForm() } }
function clearForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmation.value = ''
  currentVisible.value = false
  newVisible.value = false
  confirmationVisible.value = false
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const securityResponse = await getAccountSecurity()
    security.value = securityResponse.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '账号设置加载失败'
  } finally {
    loading.value = false
  }
}
async function submit() {
  if (currentPassword.value.length < 8) return warn('请输入正确的当前密码')
  if (panel.value === 'password') {
    if (newPassword.value.length < 8 || newPassword.value.length > 20) return warn('新密码长度须为 8–20 位')
    if (newPassword.value === currentPassword.value) return warn('新密码不能与当前密码相同')
    if (newPassword.value !== confirmation.value) return warn('两次输入的新密码不一致')
  }
  if (panel.value === 'close' && !await confirmAccountClosure()) return
  saving.value = true
  try {
    if (panel.value === 'password') {
      await changePassword(currentPassword.value, newPassword.value)
      uni.showToast({ title: '密码修改成功', icon: 'success' })
    } else if (panel.value === 'close') {
      await closeAccount(currentPassword.value)
      clearSession()
      closePanel(true)
      uni.reLaunch({ url: '/pages/auth/login' })
      return
    }
    closePanel(true)
    await load()
  } catch (reason) {
    warn(reason instanceof Error ? reason.message : '操作失败，请重试')
  } finally {
    saving.value = false
  }
}

function confirmAccountClosure(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '确认注销账号？',
      content: '注销后账号将无法登录且不可恢复，请确认已处理完所有订单。',
      confirmText: '确认注销',
      confirmColor: '#e5484d',
      cancelText: '暂不注销',
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    })
  })
}

onShow(() => { if (guardCurrentPage()) load() })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.security-page{background:linear-gradient(180deg,#eafafa 0,#f7fbfb 420rpx)}
.security-hero{background:linear-gradient(145deg,rgba(221,248,247,.92),rgba(255,255,255,.92))}
.head-space{width:80rpx}
.security-content{padding-top:24rpx;padding-bottom:calc(48rpx + env(safe-area-inset-bottom))}
.security-summary{display:grid;grid-template-columns:82rpx 1fr;gap:20rpx;padding:28rpx;border:1rpx solid #d9eeee;border-radius:32rpx;background:#fff;box-shadow:$dz-shadow}
.summary-icon,.row-icon{display:flex;align-items:center;justify-content:center;background:$dz-brand-pale}
.summary-icon{width:82rpx;height:82rpx;border-radius:24rpx}.summary-icon image{width:50rpx;height:50rpx}
.summary-copy>view{display:flex;align-items:center;gap:12rpx}.summary-copy strong{font-size:30rpx}.summary-copy>view text{padding:5rpx 12rpx;border-radius:14rpx;color:#13885d;background:#e9f9f0;font-size:18rpx;font-weight:700}
.summary-copy p{margin:10rpx 0 0;color:$dz-text-secondary;font-size:21rpx;line-height:1.6}
.summary-status{display:grid;grid-column:1/-1;grid-template-columns:repeat(2,1fr);margin-top:4rpx;padding-top:22rpx;border-top:1rpx solid $dz-border}
.summary-status view{display:flex;gap:8rpx;align-items:center;flex-direction:column;border-right:1rpx solid $dz-border}.summary-status view:last-child{border-right:0}.summary-status text{color:$dz-text-tertiary;font-size:18rpx}.summary-status strong{font-size:22rpx}
.section-title{margin:34rpx 4rpx 16rpx;font-size:27rpx}
.setting-card{overflow:hidden;border:1rpx solid $dz-border;border-radius:28rpx;background:#fff;box-shadow:$dz-shadow-soft}
.setting-row{display:flex;width:100%;min-height:114rpx;align-items:center;margin:0;padding:18rpx 24rpx;border:0;border-bottom:1rpx solid $dz-border;background:#fff;text-align:left;touch-action:manipulation}.setting-row:last-child{border-bottom:0}.setting-row:active{background:#f7fbfb}
.row-icon{width:64rpx;height:64rpx;border-radius:18rpx;flex:none}.row-icon image{width:39rpx;height:39rpx}
.row-copy{display:flex;min-width:0;gap:7rpx;margin-left:18rpx;flex:1;flex-direction:column}.row-copy strong{font-size:24rpx}.row-copy text{color:$dz-text-secondary;font-size:19rpx;line-height:1.45}
.row-value{display:flex;gap:9rpx;align-items:flex-end;margin-left:12rpx;flex-direction:column;color:$dz-text-secondary}.row-value strong{font-size:20rpx}.row-value text{color:#18885f;font-size:17rpx}.row-value b{color:$dz-text-tertiary;font-size:34rpx;font-weight:400;line-height:1}.row-value .danger-copy{color:$dz-danger}
.security-tip{display:flex;gap:12rpx;margin-top:26rpx;padding:24rpx;border-radius:24rpx;color:#705b26;background:#fff9e8;flex-direction:column}.security-tip strong{font-size:22rpx}.security-tip text{font-size:20rpx;line-height:1.65}
.sheet-mask{position:fixed;z-index:50;inset:0;display:flex;align-items:flex-end;background:rgba(12,28,32,.46)}
.security-sheet{width:100%;max-height:88vh;max-height:88dvh;padding:14rpx 30rpx calc(34rpx + env(safe-area-inset-bottom));border-radius:38rpx 38rpx 0 0;background:#fff;box-shadow:0 -20rpx 60rpx rgba(20,50,55,.16)}
.sheet-handle{display:block;width:76rpx;height:8rpx;margin:0 auto 14rpx;border-radius:8rpx;background:#dce5e7}
.security-sheet header{display:flex;align-items:flex-start;justify-content:space-between;padding:10rpx 0 22rpx}.security-sheet header>view{display:flex;gap:8rpx;flex-direction:column}.security-sheet header strong{font-size:31rpx}.security-sheet header text{color:$dz-text-secondary;font-size:20rpx}.security-sheet header button{width:72rpx;height:72rpx;margin:0;padding:0;border:0;border-radius:50%;color:$dz-text-secondary;background:$dz-brand-pale;font-size:38rpx;line-height:72rpx}
.sheet-form{display:flex;gap:22rpx;flex-direction:column}.sheet-form label{display:flex;gap:10rpx;flex-direction:column}.sheet-form label>text{font-size:22rpx;font-weight:700}
.password-field{display:flex;height:92rpx;align-items:center;padding:0 10rpx 0 24rpx;border:1rpx solid #dbe7e9;border-radius:22rpx;background:#f9fbfb}.password-field:focus-within{border-color:$dz-brand;box-shadow:0 0 0 4rpx rgba(17,193,196,.1)}.password-field input{height:100%;min-width:0;flex:1;font-size:24rpx}.password-field button{min-width:84rpx;height:72rpx;margin:0;padding:0 12rpx;border:0;color:$dz-brand-deep;background:transparent;font-size:20rpx;line-height:72rpx}
.session-note{display:flex;gap:8rpx;padding:22rpx;border-radius:20rpx;background:$dz-danger-soft;flex-direction:column}.session-note strong{font-size:22rpx}.session-note text{color:$dz-text-secondary;font-size:20rpx;line-height:1.55}
.submit-button{width:100%;height:92rpx;margin:4rpx 0 0;border-radius:24rpx;color:#fff;background:$dz-gradient-brand;font-size:26rpx;font-weight:700;line-height:92rpx}.submit-button.danger{background:linear-gradient(135deg,#ff696f,#ff3e46)}.submit-button[disabled]{opacity:.58}
@media screen and (min-width:480px){
  .security-page .dz-page-head{height:64px}.security-page .dz-page-head button,.head-space{width:48px}.security-page .dz-page-head button{min-height:48px;font-size:34px;line-height:48px}.security-page .dz-page-head .strong-text{font-size:20px}
  .security-content{padding-top:16px;padding-bottom:32px}.security-summary{grid-template-columns:52px 1fr;gap:14px;padding:20px;border-radius:20px}.summary-icon{width:52px;height:52px;border-radius:14px}.summary-icon image{width:30px;height:30px}.summary-copy>view{gap:8px}.summary-copy strong{font-size:19px}.summary-copy>view text{padding:3px 8px;border-radius:9px;font-size:12px}.summary-copy p{margin-top:6px;font-size:13px}.summary-status{margin-top:3px;padding-top:14px}.summary-status view{gap:5px}.summary-status text{font-size:12px}.summary-status strong{font-size:14px}
  .section-title{margin:24px 3px 12px;font-size:18px}.setting-card{border-radius:18px}.setting-row{min-height:74px;padding:12px 16px}.row-icon{width:42px;height:42px;border-radius:12px}.row-icon image{width:25px;height:25px}.row-copy{gap:4px;margin-left:12px}.row-copy strong{font-size:15px}.row-copy text{font-size:12px}.row-value{gap:5px;margin-left:8px}.row-value strong{font-size:13px}.row-value text{font-size:11px}.row-value b{font-size:23px}.security-tip{gap:8px;margin-top:18px;padding:16px;border-radius:16px}.security-tip strong{font-size:14px}.security-tip text{font-size:13px}
  .security-sheet{left:50%;max-width:430px;padding:9px 20px calc(22px + env(safe-area-inset-bottom));border-radius:24px 24px 0 0;transform:translateX(-50%)}.sheet-handle{width:48px;height:5px;margin-bottom:9px}.security-sheet header{padding:7px 0 15px}.security-sheet header>view{gap:5px}.security-sheet header strong{font-size:20px}.security-sheet header text{font-size:13px}.security-sheet header button{width:48px;height:48px;font-size:25px;line-height:48px}.sheet-form{gap:15px}.sheet-form label{gap:7px}.sheet-form label>text{font-size:14px}.password-field{height:58px;padding:0 7px 0 16px;border-radius:14px}.password-field input{font-size:15px}.password-field button{min-width:56px;height:48px;padding:0 8px;font-size:13px;line-height:48px}.session-note{gap:5px;padding:15px;border-radius:13px}.session-note strong{font-size:14px}.session-note text{font-size:13px}.submit-button{height:58px;border-radius:15px;font-size:17px;line-height:58px}
}

/* 管理页统一规格：安全信息先给结论，再给可操作设置。 */
.security-page{background:linear-gradient(180deg,#edfafa 0,#f5f9f9 350rpx,#f2f6f6 100%)}
.security-hero{background:rgba(247,252,252,.94)}.security-page .dz-page-head{height:100rpx}.security-page .dz-page-head button,.head-space{width:88rpx;height:80rpx;flex:0 0 88rpx}.security-page .dz-page-head button{font-size:54rpx;line-height:76rpx}.security-page .dz-page-head .strong-text{font-size:34rpx}.security-content{padding-top:20rpx;padding-bottom:calc(58rpx + env(safe-area-inset-bottom))}
.security-page button::after{display:none}
.security-summary{grid-template-columns:88rpx 1fr;gap:22rpx;padding:28rpx;border:1rpx solid rgba(255,255,255,.95);border-radius:30rpx;background:rgba(255,255,255,.94);box-shadow:$dz-shadow}.summary-icon{width:88rpx;height:88rpx;border-radius:26rpx}.summary-icon image{width:52rpx;height:52rpx}.summary-copy>view{gap:13rpx}.summary-copy strong{font-size:31rpx}.summary-copy>view text{padding:6rpx 13rpx;border-radius:16rpx;font-size:19rpx}.summary-copy p{margin-top:10rpx;font-size:23rpx;line-height:1.55}.summary-status{margin-top:6rpx;padding-top:24rpx}.summary-status view{gap:9rpx}.summary-status text{font-size:20rpx}.summary-status strong{font-size:25rpx;font-variant-numeric:tabular-nums}
.section-title{margin:34rpx 4rpx 15rpx;font-size:28rpx}.setting-card{border-color:rgba(220,232,233,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}.setting-row{min-height:126rpx;padding:21rpx 24rpx;background:transparent}.row-icon{width:70rpx;height:70rpx;border-radius:21rpx}.row-icon image{width:42rpx;height:42rpx}.row-copy{gap:8rpx;margin-left:20rpx}.row-copy strong{font-size:26rpx}.row-copy text{font-size:21rpx;line-height:1.45}.row-value{align-items:center;gap:10rpx;margin-left:14rpx;flex-direction:row}.row-value strong{font-size:22rpx;white-space:nowrap}.row-value text{padding:4rpx 9rpx;border-radius:12rpx;background:#eaf8f1;font-size:18rpx;white-space:nowrap}.row-value b{font-size:36rpx}.security-tip{gap:10rpx;margin-top:24rpx;padding:24rpx 26rpx;border:1rpx solid #eee5c9;border-radius:24rpx;background:rgba(255,250,234,.88)}.security-tip strong{font-size:24rpx}.security-tip text{font-size:22rpx;line-height:1.65}
.security-sheet{padding:14rpx 30rpx calc(34rpx + env(safe-area-inset-bottom));border-radius:40rpx 40rpx 0 0;background:rgba(253,254,254,.98);box-shadow:$dz-shadow-sheet}.sheet-handle{width:76rpx;height:8rpx;margin-bottom:18rpx}.security-sheet header{padding:10rpx 0 24rpx}.security-sheet header strong{font-size:33rpx}.security-sheet header text{font-size:22rpx;line-height:1.5}.security-sheet header button{width:72rpx;height:72rpx;font-size:38rpx;line-height:72rpx}.sheet-form{gap:24rpx}.sheet-form label{gap:11rpx}.sheet-form label>text{font-size:24rpx}.password-field{height:96rpx;padding:0 10rpx 0 24rpx;border-radius:22rpx}.password-field input{font-size:25rpx}.password-field button{min-width:92rpx;height:72rpx;font-size:22rpx;line-height:72rpx}.session-note{gap:9rpx;padding:24rpx;border-radius:22rpx}.session-note strong{font-size:25rpx}.session-note text{font-size:22rpx;line-height:1.6}.submit-button{height:92rpx;border-radius:24rpx;font-size:27rpx;line-height:92rpx}
.danger-card{border-color:rgba(229,72,77,.18)}.danger-icon{background:$dz-danger-soft}.danger-copy{color:$dz-danger}
/* #ifdef H5 */
.security-hero,.security-sheet{-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px)}
/* #endif */
</style>
