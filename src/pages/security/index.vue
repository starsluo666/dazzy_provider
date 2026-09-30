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
            <view><strong class="strong-text">{{ security?.account_status === 'active' ? '账号状态正常' : '账号' + (security?.account_status_label || '状态待确认') }}</strong><text :class="{ 'status-warning': security?.account_status !== 'active' }">{{ security?.account_status_label || '待确认' }}</text></view>
            <p>手机号与登录密码用于保护账号，敏感操作需要再次验证身份。</p>
          </view>
          <view class="summary-status">
            <view><text>账号状态</text><strong>{{ security?.account_status_label || '待确认' }}</strong></view>
            <view><text>登录密码</text><strong>{{ security?.password_set ? '已设置' : '未设置' }}</strong></view>
          </view>
        </section>

        <h2 class="section-title">账号信息</h2>
        <section class="setting-card">
          <view class="setting-row static-row">
            <view class="row-icon"><image src="/static/icons/security.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text">达人信用分</strong><text>平台当前记录的信用分</text></view>
            <view class="row-value"><strong>{{ security?.provider_credit_score ?? '—' }}</strong><text>分</text></view>
          </view>
          <button class="setting-row dz-tappable" hover-class="dz-pressed" aria-label="修改登录手机号" @tap="openPhoneChange">
            <view class="row-icon"><image src="/static/icons/phone.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text">登录手机号</strong><text>用于登录和身份核验</text></view>
            <view class="row-value"><strong>{{ security?.phone_masked }}</strong><b>›</b></view>
          </button>
        </section>

        <h2 class="section-title">安全设置</h2>
        <section class="setting-card">
          <button class="setting-row dz-tappable" hover-class="dz-pressed" aria-label="修改登录密码" @tap="openPanel('password')">
            <view class="row-icon"><image src="/static/icons/password.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text">登录密码</strong><text>{{ needsInitialPassword ? '验证绑定手机号后设置登录密码' : '定期更换密码可降低账号风险' }}</text></view>
            <view class="row-value"><strong>{{ needsInitialPassword ? '设置' : '修改' }}</strong><b>›</b></view>
          </button>
        </section>

        <h2 class="section-title">账号管理</h2>
        <section class="setting-card danger-card">
          <button class="setting-row dz-tappable" hover-class="dz-pressed" aria-label="注销账号" @tap="openPanel('close')">
            <view class="row-icon danger-icon"><image src="/static/icons/account-close.svg" mode="aspectFit" /></view>
            <view class="row-copy"><strong class="strong-text danger-copy">账号注销</strong><text>申请后等待 5 个工作日完成注销</text></view>
            <view class="row-value"><strong class="danger-copy">注销</strong><b>›</b></view>
          </button>
        </section>

        <h2 class="section-title">协议与隐私</h2>
        <section class="setting-card">
          <button v-for="link in legalLinks" :key="link.kind" class="setting-row dz-tappable" hover-class="dz-pressed" @tap="openLegalDocument(link.kind)">
            <view class="row-copy"><strong class="strong-text">{{ link.label }}</strong></view>
            <view class="row-value"><b aria-hidden="true">›</b></view>
          </button>
        </section>

        <section class="security-tip">
          <strong class="strong-text">安全提醒</strong>
          <text>平台不会通过电话或聊天索要密码、短信验证码。请勿向他人提供账号或代收款信息。</text>
        </section>
      </template>
    </main>

    <view v-if="panel" class="sheet-mask" @tap.self="closePanel()">
      <section class="security-sheet" role="dialog" :aria-label="panelTitle">
        <i class="sheet-handle" />
        <header><view><strong class="strong-text">{{ panelTitle }}</strong><text>{{ panelDescription }}</text></view><button aria-label="关闭" @tap="closePanel()">×</button></header>
        <view class="sheet-form">
          <label v-if="needsInitialPassword && panel === 'password'">
            <text>验证手机号 {{ security?.phone_masked }}</text>
            <view class="password-field"><input v-model="initialCode" type="number" maxlength="6" placeholder="输入 6 位验证码" /><button :disabled="sendingCode || codeSeconds > 0 || saving" @tap="sendInitialCode">{{ codeSeconds > 0 ? `${codeSeconds}s` : sendingCode ? '发送中…' : '获取验证码' }}</button></view>
          </label>
          <label v-else>
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
          <view v-else class="session-note"><strong class="strong-text">注销的是整个平台账号</strong><text>用户端和达人端将同时退出登录。申请后等待 5 个工作日；期间成功登录会撤销申请。完成后无法恢复，有未结交易、结算或投诉时会暂停处理。</text></view>
          <LegalConsent v-if="panel === 'close'" v-model="closureAgreed" :documents="['closure']" :disabled="saving || confirmingClose" @read="readClosureAgreement" />
          <button class="submit-button" :class="{ danger: panel === 'close' }" :disabled="saving || sendingCode || confirmingClose || (panel === 'close' && !closureAgreed)" @tap="submit">
            {{ saving ? '正在处理…' : panel === 'password' ? needsInitialPassword ? '确认设置' : '确认修改' : '提交注销申请' }}
          </button>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref } from 'vue'

import NetworkState from '@/components/NetworkState.vue'
import LegalConsent from '@/components/LegalConsent.vue'
import { legalLinks, legalDocumentUrl, openLegalDocument } from '@/content/legal'
import { changePassword, closeAccount, getAccountSecurity, sendInitialPasswordCode, setInitialPassword } from '@/services/auth'
import { clearSession, guardCurrentPage } from '@/services/session'
import { formatBusinessDateTime } from '@/utils/formatters'
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
const confirmingClose = ref(false)
const initialCode = ref(''), closureAgreed = ref(false), sendingCode = ref(false), codeSeconds = ref(0)
const needsInitialPassword = computed(() => security.value?.password_set === false)
let resumeClosure = false, disposed = false, loadVersion = 0
let codeTimer: ReturnType<typeof setInterval> | undefined

const panelTitle = computed(() => panel.value === 'password' ? needsInitialPassword.value ? '设置登录密码' : '修改登录密码' : '注销账号')
const panelDescription = computed(() => panel.value === 'password' ? needsInitialPassword.value ? '验证绑定手机号后设置密码，无需旧密码。' : '修改后，其他设备上的旧登录状态将失效。' : '验证当前密码后提交整个平台账号的注销申请。')

function warn(title: string) { uni.showToast({ title, icon: 'none' }) }
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function openPhoneChange() { uni.navigateTo({ url: '/pages/security/phone' }) }
function openPanel(value: Exclude<SecurityPanel, ''>) {
  if (disposed || saving.value || sendingCode.value || confirmingClose.value || loading.value || error.value || !security.value) return
  clearForm()
  if (value === 'close' && needsInitialPassword.value) {
    uni.showModal({ title: '请先设置登录密码', content: '你的账号尚未设置密码。请先验证绑定手机号并设置密码，再申请注销。', confirmText: '去设置', success: ({ confirm }) => { if (confirm && !disposed) openPanel('password') } })
    return
  }
  panel.value = value
}
function closePanel(force = false) { if ((!saving.value && !sendingCode.value && !confirmingClose.value) || force) { panel.value = ''; clearForm() } }
function clearForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmation.value = ''
  currentVisible.value = false
  newVisible.value = false
  confirmationVisible.value = false
  initialCode.value = ''
  closureAgreed.value = false
}
async function load() {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const securityResponse = await getAccountSecurity()
    if (!disposed && version === loadVersion) security.value = securityResponse.data
  } catch (reason) {
    if (!disposed && version === loadVersion) error.value = reason instanceof Error ? reason.message : '账号设置加载失败'
  } finally {
    if (!disposed && version === loadVersion) loading.value = false
  }
}
async function submit() {
  if (disposed || saving.value || sendingCode.value || confirmingClose.value || !panel.value || loading.value || error.value || !security.value) return
  if (panel.value === 'close' && !closureAgreed.value) return warn('请先阅读并同意账号注销协议')
  const settingInitial = needsInitialPassword.value && panel.value === 'password'
  if (settingInitial) { if (!/^\d{6}$/.test(initialCode.value)) return warn('请输入 6 位短信验证码') }
  else if (currentPassword.value.length < 8) return warn('请输入正确的当前密码')
  if (panel.value === 'password') {
    if (newPassword.value.length < 8 || newPassword.value.length > 20) return warn('新密码长度须为 8–20 位')
    if (newPassword.value === currentPassword.value) return warn('新密码不能与当前密码相同')
    if (newPassword.value !== confirmation.value) return warn('两次输入的新密码不一致')
  }
  if (panel.value === 'close') {
    confirmingClose.value = true
    const confirmed = await confirmAccountClosure()
    confirmingClose.value = false
    if (!confirmed || disposed || panel.value !== 'close' || !closureAgreed.value) return
  }
  saving.value = true
  try {
    if (panel.value === 'password') {
      if (settingInitial) await setInitialPassword(initialCode.value, newPassword.value)
      else await changePassword(currentPassword.value, newPassword.value)
      if (!disposed) uni.showToast({ title: settingInitial ? '密码设置成功' : '密码修改成功', icon: 'success' })
    } else if (panel.value === 'close') {
      const { data } = await closeAccount(currentPassword.value)
      if (data?.status !== 'pending' || data.closed !== false || data.working_days !== 5 || !Number.isFinite(Date.parse(data.execute_after))) {
        throw new Error('注销申请状态异常，请重新登录或联系客服确认')
      }
      clearSession()
      closePanel(true)
      if (!disposed) uni.showModal({
        title: '注销申请已提交',
        content: `预计于 ${formatBusinessDateTime(data.execute_after)}（北京时间）完成注销。等待期内成功登录将撤销申请；如有未结业务，处理会暂停。`,
        showCancel: false,
        confirmText: '我知道了',
        success: () => uni.reLaunch({ url: '/pages/auth/login?closurePending=1' }),
      })
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
      content: '这是整个平台账号的注销，用户端和达人端都会受到影响。等待期为 5 个工作日，期间成功登录可撤销申请。请确认已处理完所有订单和结算。',
      confirmText: '提交申请',
      confirmColor: '#e5484d',
      cancelText: '暂不注销',
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    })
  })
}

async function sendInitialCode() {
  if (disposed || panel.value !== 'password' || !needsInitialPassword.value || loading.value || sendingCode.value || codeSeconds.value > 0 || saving.value) return
  sendingCode.value = true
  try {
    const { data } = await sendInitialPasswordCode()
    if (disposed || panel.value !== 'password') return
    if (import.meta.env.DEV && data.debug_code) initialCode.value = data.debug_code
    codeSeconds.value = data.retry_after
    if (codeTimer) clearInterval(codeTimer)
    codeTimer = setInterval(() => { codeSeconds.value = Math.max(0, codeSeconds.value - 1); if (!codeSeconds.value && codeTimer) clearInterval(codeTimer) }, 1000)
    warn('验证码已发送至绑定手机号')
  } catch (reason) { if (!disposed) warn(reason instanceof Error ? reason.message : '验证码发送失败') }
  finally { sendingCode.value = false }
}
function readClosureAgreement() {
  if (panel.value !== 'close' || saving.value || confirmingClose.value || disposed) return
  resumeClosure = true
  uni.navigateTo({ url: legalDocumentUrl('closure'), fail: () => { resumeClosure = false; warn('协议页面打开失败，请重试') } })
}
onHide(() => { loadVersion += 1; closePanel(true) })
onShow(async () => {
  if (!guardCurrentPage()) return
  const reopen = resumeClosure
  resumeClosure = false
  await load()
  if (reopen && !disposed) openPanel('close')
})
onBeforeUnmount(() => { disposed = true; loadVersion += 1; resumeClosure = false; clearForm(); if (codeTimer) clearInterval(codeTimer) })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.summary-copy > view .status-warning { color:#9a4b16; background:#fff3e7; }

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
.security-sheet header button { display:flex; flex:none; align-items:center; justify-content:center; min-width:44px; min-height:44px; line-height:1; }
.password-field button { min-height:44px; }
.submit-button { display:flex; align-items:center; justify-content:center; min-height:44px; padding:12px 16px; line-height:1.4; box-sizing:border-box; }
.submit-button[disabled] { opacity:1; color:#657580; background:#eaf0f1; }
.submit-button.danger[disabled] { color:#925259; background:#fbe6e7; }
.security-sheet { overflow-y:auto; overscroll-behavior:contain; box-sizing:border-box; }
@media screen and (min-width:480px) { .security-sheet { margin:0 auto; transform:none; } }
/* #ifdef H5 */
.security-hero,.security-sheet{-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px)}
.password-field button[disabled] { opacity:.55; }
@media (prefers-reduced-transparency:reduce) { .security-hero,.security-sheet { background:#fff; backdrop-filter:none; -webkit-backdrop-filter:none; } }
/* #endif */
</style>
