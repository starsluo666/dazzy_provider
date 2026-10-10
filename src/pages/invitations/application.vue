<template>
  <view class="application-page">
    <view class="dz-safe-top" />
    <view class="application-content">
      <view class="heading"><text class="title">入驻申请</text><button class="text-button" :disabled="leaving || loading" @tap="switchAccount">切换账号</button></view>
      <text class="intro">注册、审核与接单准备，都在达人端完成</text>
      <view v-if="loading" class="card notice">正在查询审核进度…</view>
      <view v-else-if="error" class="card notice" role="alert"><text>{{ error }}</text><button class="secondary" @tap="load">重新加载</button></view>
      <template v-else>
        <view class="card status-card" :class="{ approved: application?.status === 'approved' }">
          <text class="status-mark">{{ application?.status === 'approved' ? '✓' : '…' }}</text>
          <text class="status-title">{{ statusTitle }}</text><text class="description">{{ statusDescription }}</text>
          <text v-if="application?.rejection_reason && application.status === 'rejected'" class="rejection" role="alert">审核说明：{{ application.rejection_reason }}</text>
          <button v-if="application?.status === 'approved'" class="primary" @tap="enterWorkbench">进入达人工作台</button>
          <button class="secondary" :disabled="loading" @tap="load">刷新审核进度</button>
        </view>
        <view v-if="application" class="card">
          <text class="section-title">已提交的入驻意向</text>
          <view class="detail"><text class="muted">申请姓名</text><text>{{ application.application_real_name || '—' }}</text></view>
          <view class="detail"><text class="muted">服务城市</text><text>{{ application.service_city_name || '—' }}</text></view>
          <view v-if="application.invitation_code" class="detail"><text class="muted">邀请码</text><text>{{ application.invitation_code }}</text></view>
        </view>
        <view class="steps"><text class="section-title">接下来</text><text class="description">入驻初审 → 实名认证、完善资料和服务配置 → 开通审核 → 完成接单学习。</text><text class="description">初审通过不代表已经可以接单，请按工作台提示完成准备。</text></view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProviderApplication, enterProviderApp, type ProviderApplication } from '@/services/providerApplication'
import { guardCurrentPage } from '@/services/session'
import { logout } from '@/services/auth'

const application = ref<ProviderApplication | null>(null)
const loading = ref(true), leaving = ref(false), error = ref('')
const statusTitle = computed(() => ({ draft: '入驻意向尚未提交', pending: '入驻意向审核中', approved: '入驻初审已通过', rejected: '入驻意向未通过', suspended: '达人资格已暂停' })[application.value?.status || 'draft'])
const statusDescription = computed(() => {
  if (!application.value) return '当前账号还没有入驻申请。如已用其他手机号提交，请切换到申请时的账号；已有账号请勿重复注册。'
  return {
    draft: '资料尚未提交审核，请联系平台核对申请情况。',
    pending: '平台正在核验你的入驻意向，请耐心等待。之后可使用注册时的手机号和密码登录达人端查看结果。',
    approved: '欢迎加入！进入工作台，继续完成实名认证、资料及服务配置。',
    rejected: '请根据审核说明联系客服核对资料，无需重新注册账号。',
    suspended: '当前暂不能接单，请联系平台了解原因。',
  }[application.value.status]
})
async function load() {
  if (!guardCurrentPage()) return
  loading.value = true; error.value = ''
  try { application.value = (await getProviderApplication()).data }
  catch (e) { error.value = e instanceof Error ? e.message : '审核进度查询失败，请重试' }
  finally { loading.value = false }
}
async function enterWorkbench() {
  try { await enterProviderApp('/pages/workbench/index') }
  catch (e) { uni.showToast({ title: e instanceof Error ? e.message : '暂时无法进入工作台', icon: 'none' }) }
}
function switchAccount() {
  if (leaving.value) return
  uni.showModal({ title: '切换账号', content: '退出当前账号后，可使用申请时的手机号和密码重新登录。', success: async result => {
    if (!result.confirm) return
    leaving.value = true
    try { await logout() } catch { /* logout always clears the local session. */ }
    finally { leaving.value = false; uni.reLaunch({ url: '/pages/auth/login?redirect=%2Fpages%2Finvitations%2Fapplication' }) }
  } })
}
onShow(load)
</script>

<style scoped>
.application-page{min-height:100vh;background:#f3f5f6;color:#172126}.application-content{max-width:480px;margin:auto;padding:24px 20px calc(32px + env(safe-area-inset-bottom))}.heading{display:flex;gap:12px;align-items:center;justify-content:space-between}.title{font-size:27px;font-weight:700}.intro{display:block;margin-top:8px;font-size:13px;line-height:1.7;color:#66737a}.card{margin-top:20px;padding:24px 20px;background:#fff;border:1px solid #e5ebee;border-radius:20px}.status-card{text-align:center}.status-mark{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin:0 auto 18px;border-radius:18px;background:#edf6f6;color:#08787e;font-size:28px}.approved .status-mark{background:#e4f6ec;color:#228757}.status-title{display:block;font-size:21px;line-height:1.5;font-weight:650}.description{display:block;margin-top:12px;color:#66737a;font-size:14px;line-height:1.8}.rejection{display:block;margin-top:16px;padding:14px;border-radius:12px;background:#fff2e8;color:#9a4b22;font-size:14px;line-height:1.7;text-align:left}.primary,.secondary{display:flex;align-items:center;justify-content:center;min-height:48px;margin:18px 0 0;padding:10px 12px;border-radius:12px;font-size:15px;font-weight:600;line-height:1.6}.primary{background:#08787e;color:#fff}.secondary{background:#eaf8f7;color:#08787e}.text-button{display:flex;align-items:center;min-height:44px;margin:0;padding:0 8px;background:transparent;color:#08787e;font-size:13px}.primary::after,.secondary::after,.text-button::after{border:0}.primary:active,.secondary:active{opacity:.85}.section-title{font-size:16px;font-weight:600;line-height:1.6}.detail{display:flex;justify-content:space-between;gap:16px;margin-top:18px;font-size:14px;line-height:1.6;word-break:break-all}.muted{flex-shrink:0;color:#66737a}.notice{font-size:14px;color:#66737a;line-height:1.8}.steps{padding:26px 6px}
</style>
