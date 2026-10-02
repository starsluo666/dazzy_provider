<template>
  <view class="dz-page receiving-page">
    <view class="dz-safe-top" />
    <view class="dz-page-head dz-container">
      <button class="back-button" aria-label="返回" @tap="goBack">‹</button>
      <text class="page-title">收款账户</text>
      <view class="head-spacer" />
    </view>
    <view class="dz-container receiving-content">
      <NetworkState v-if="loading" loading message="正在读取收款资料…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="account">
        <view class="status-card">
          <view class="status-heading">
            <view class="status-icon"><image class="status-image" src="/static/icons/income.svg" mode="aspectFit" /></view>
            <view class="status-copy">
              <text class="eyebrow">本人收款资料</text>
              <text class="status-title">{{ account.materials_saved ? '资料已保存' : '为收款做好准备' }}</text>
            </view>
            <text class="status-badge">待渠道开通</text>
          </view>
          <text class="status-description">{{ account.channel_notice }}</text>
          <view class="steps">
            <view class="step" :class="{ complete: account.identity_verified }"><text class="step-mark">{{ account.identity_verified ? '✓' : '1' }}</text><text>平台实名</text></view>
            <view class="step" :class="{ complete: account.materials_saved }"><text class="step-mark">{{ account.materials_saved ? '✓' : '2' }}</text><text>保存资料</text></view>
            <view class="step"><text class="step-mark">3</text><text>渠道开通</text></view>
          </view>
        </view>

        <view v-if="!account.identity_verified" class="notice-card">
          <text class="notice-title">先完成平台实名认证</text>
          <text class="helper">仅接受与你实名认证一致的本人收款资料。</text>
          <button class="secondary-button" hover-class="dz-pressed" @tap="openIdentity">去实名认证</button>
        </view>
        <view v-else-if="!account.collection_enabled" class="notice-card">
          <text class="notice-title">资料填写暂未开放</text>
          <text class="helper">{{ account.collection_unavailable_reason }}</text>
        </view>

        <view v-if="account.materials_saved && !account.collection_enabled" class="form-card">
          <text class="section-title">已保存资料</text>
          <text class="summary-line">{{ account.bank_name }} · {{ account.bank_card_masked }}</text>
          <text class="helper">{{ account.bank_province }} {{ account.bank_city }}</text>
          <text class="helper">联系电话 {{ account.mobile_masked }}</text>
        </view>

        <template v-if="account.identity_verified && account.collection_enabled">
          <view class="form-card">
            <view class="section-heading"><text class="section-title">身份信息</text><text class="section-note">与实名认证一致</text></view>
            <view class="field">
              <text class="field-label">持卡人姓名</text>
              <view class="readonly-field"><text>{{ account.real_name }}</text><text class="verified-label">已实名</text></view>
              <text class="helper">仅限本人银行卡，姓名有误请联系客服。</text>
            </view>
            <view class="field">
              <text class="field-label">身份证号码</text>
              <input v-model="form.id_number" class="field-input" type="idcard" :maxlength="18" :disabled="busy" :placeholder="account.materials_saved ? account.id_number_masked : '输入已实名认证的身份证号码'" placeholder-class="field-placeholder" aria-label="身份证号码" />
              <text v-if="account.materials_saved" class="helper">留空保留已保存的号码；如需修改，请重新输入。</text>
            </view>
            <view class="field">
              <text class="field-label">证件生效日期</text>
              <picker mode="date" :value="form.cert_begin_date" :end="today" :disabled="busy" @change="setDate('cert_begin_date', $event)">
                <view class="date-field"><text :class="{ 'field-placeholder': !form.cert_begin_date }">{{ form.cert_begin_date || '选择身份证上的生效日期' }}</text><text class="chevron">›</text></view>
              </picker>
            </view>
            <view class="field">
              <view class="validity-heading"><text class="field-label">证件截止日期</text><view class="switch-row"><text class="helper">长期有效</text><switch :checked="form.cert_long_term" :disabled="busy" color="#08b8bd" style="transform:scale(.8);transform-origin:right center" @change="toggleLongTerm" /></view></view>
              <picker v-if="!form.cert_long_term" mode="date" :value="form.cert_end_date" :start="today" end="2099-12-31" :disabled="busy" @change="setDate('cert_end_date', $event)">
                <view class="date-field"><text :class="{ 'field-placeholder': !form.cert_end_date }">{{ form.cert_end_date || '选择身份证上的截止日期' }}</text><text class="chevron">›</text></view>
              </picker>
              <view v-else class="readonly-field"><text>长期有效</text></view>
            </view>
          </view>

          <view class="form-card">
            <view class="section-heading"><text class="section-title">本人银行卡</text><text class="section-note">仅保存资料，尚未绑卡</text></view>
            <view class="field"><text class="field-label">银行卡号</text><input v-model="form.bank_card_number" class="field-input" type="number" :maxlength="19" :disabled="busy" :placeholder="account.materials_saved ? account.bank_card_masked : '输入本人银行卡号'" placeholder-class="field-placeholder" aria-label="银行卡号" /><text v-if="account.materials_saved" class="helper">卡号和联系电话留空时保留原资料。</text></view>
            <view class="field"><text class="field-label">开户银行</text><input v-model="form.bank_name" class="field-input" :maxlength="60" :disabled="busy" placeholder="例如：中国工商银行" placeholder-class="field-placeholder" aria-label="开户银行" /></view>
            <view class="area-fields">
              <view class="area-field"><text class="field-label">银行所在省份</text><input v-model="form.bank_province" class="field-input" :maxlength="40" :disabled="busy" placeholder="例如：河北省" placeholder-class="field-placeholder" aria-label="银行所在省份" /></view>
              <view class="area-field"><text class="field-label">银行所在城市</text><input v-model="form.bank_city" class="field-input" :maxlength="40" :disabled="busy" placeholder="例如：邯郸市" placeholder-class="field-placeholder" aria-label="银行所在城市" /></view>
            </view>
            <view class="field"><text class="field-label">联系电话</text><input v-model="form.mobile" class="field-input" type="number" :maxlength="11" :disabled="busy" :placeholder="account.materials_saved ? account.mobile_masked : '输入本人联系电话'" placeholder-class="field-placeholder" aria-label="联系电话" /><text class="helper">用于后续开户联系；银行卡预留手机号会在正式绑卡时按渠道要求核实。</text></view>
          </view>

          <view class="privacy-card">
            <text class="notice-title">资料如何使用</text>
            <text class="helper">{{ account.collection_notice }}</text>
            <checkbox-group @change="changeConsent">
              <label class="consent-row"><checkbox class="consent-checkbox" value="accepted" :checked="consent" :disabled="busy" color="#087f86" /><text class="consent-text">我已阅读并同意以上收款资料收集说明</text></label>
            </checkbox-group>
          </view>
          <text v-if="formError" class="form-error" role="alert">{{ formError }}</text>
          <button class="save-button" :class="{ 'is-disabled': busy || !consent }" :disabled="busy || !consent" :loading="saving" hover-class="dz-pressed" @tap="save">{{ saving ? '正在保存…' : '保存收款资料' }}</button>
          <text class="save-note">保存不会开户、绑卡或扣款</text>
        </template>
        <button v-if="account.materials_saved" class="clear-button" :disabled="busy" :loading="clearing" hover-class="dz-pressed" @tap="confirmClear">清除已保存的收款资料</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload, onShow } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { clearProviderReceivingAccount, getProviderReceivingAccount, saveProviderReceivingAccount } from '@/services/providers'
import type { ProviderReceivingAccount } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

const account = ref<ProviderReceivingAccount | null>(null)
const loading = ref(true)
const saving = ref(false)
const clearing = ref(false)
const busy = computed(() => saving.value || clearing.value)
const error = ref('')
const formError = ref('')
const consent = ref(false)
const returningFromIdentity = ref(false)
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const form = reactive({ id_number: '', bank_card_number: '', mobile: '', cert_begin_date: '', cert_end_date: '', cert_long_term: false, bank_name: '', bank_province: '', bank_city: '' })

function clearSensitiveInputs() { form.id_number = ''; form.bank_card_number = ''; form.mobile = '' }
function applyAccount(value: ProviderReceivingAccount) {
  account.value = value
  clearSensitiveInputs()
  form.cert_begin_date = value.cert_begin_date || ''
  form.cert_end_date = value.cert_end_date || ''
  form.cert_long_term = value.cert_long_term
  form.bank_name = value.bank_name
  form.bank_province = value.bank_province
  form.bank_city = value.bank_city
  consent.value = false
}
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function openIdentity() { returningFromIdentity.value = true; uni.navigateTo({ url: '/pages/identity/index' }) }
function setDate(key: 'cert_begin_date' | 'cert_end_date', event: { detail: { value: string } }) { form[key] = event.detail.value }
function toggleLongTerm(event: unknown) { form.cert_long_term = Boolean((event as { detail: { value: boolean } }).detail.value); if (form.cert_long_term) form.cert_end_date = '' }
function changeConsent(event: { detail: { value: string[] } }) { consent.value = event.detail.value.includes('accepted') }
async function load() {
  loading.value = true
  error.value = ''
  try { applyAccount((await getProviderReceivingAccount()).data) }
  catch (reason) { error.value = getErrorMessage(reason, '收款资料加载失败') }
  finally { loading.value = false }
}
async function save() {
  if (busy.value || !consent.value || !account.value?.collection_enabled) return
  formError.value = ''
  if ((!account.value.materials_saved && (!form.id_number.trim() || !form.bank_card_number.trim() || !form.mobile.trim())) || !form.cert_begin_date || (!form.cert_long_term && !form.cert_end_date) || !form.bank_name.trim() || !form.bank_province.trim() || !form.bank_city.trim()) {
    formError.value = '请完整填写身份信息、证件有效期和本人银行卡资料。'
    return
  }
  saving.value = true
  try {
    const result = await saveProviderReceivingAccount({ ...form, cert_end_date: form.cert_long_term ? null : form.cert_end_date, consent_accepted: true, consent_version: account.value.consent_version })
    applyAccount(result.data)
    uni.showToast({ title: '资料已保存，待渠道开通', icon: 'none' })
  } catch (reason) { formError.value = getErrorMessage(reason, '保存失败，请稍后再试') }
  finally { saving.value = false }
}
function confirmClear() {
  if (busy.value) return
  uni.showModal({ title: '清除收款资料？', content: '将删除这里保存的身份证和银行卡资料，不影响平台实名认证、订单与账务记录。之后需要重新填写。', confirmText: '确认清除', confirmColor: '#d9485f', success: async (result) => {
    if (!result.confirm || busy.value) return
    clearing.value = true
    try { await clearProviderReceivingAccount(); clearSensitiveInputs(); formError.value = ''; await load(); uni.showToast({ title: '收款资料已清除', icon: 'none' }) }
    catch (reason) { formError.value = getErrorMessage(reason, '清除失败，请稍后重试'); uni.showToast({ title: formError.value, icon: 'none' }) }
    finally { clearing.value = false }
  } })
}
onLoad(load)
onShow(() => { if (returningFromIdentity.value) { returningFromIdentity.value = false; void load() } })
onUnload(clearSensitiveInputs)
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.receiving-page{min-height:100vh;background:#f3f7f8}
.page-title{font-size:31rpx;font-weight:650}.head-spacer{width:80rpx}.back-button{display:flex;width:80rpx;min-height:88rpx;align-items:center;justify-content:flex-start;margin:0;padding:0;border:0;background:transparent;font-size:52rpx;line-height:1}.back-button::after{border:0}
.receiving-content{padding-top:16rpx;padding-bottom:calc(48rpx + env(safe-area-inset-bottom))}
.status-card,.form-card,.notice-card{margin-bottom:24rpx;padding:28rpx;border:1rpx solid #e0e9ec;border-radius:28rpx;background:#fff}
.status-heading{display:flex;align-items:center;gap:18rpx;flex-wrap:wrap}.status-icon{display:flex;width:84rpx;height:84rpx;align-items:center;justify-content:center;border-radius:24rpx;background:#e1f5f5}.status-image{width:44rpx;height:44rpx}
.status-copy{display:flex;flex:1;min-width:220rpx;gap:6rpx;flex-direction:column}.eyebrow{font-size:23rpx;color:#087f86}.status-title{font-size:34rpx;font-weight:650;line-height:1.3}.status-badge{padding:8rpx 14rpx;border-radius:12rpx;color:#8c620e;background:#fff4d9;font-size:22rpx}
.status-description{display:block;margin-top:22rpx;color:#566576;font-size:25rpx;line-height:1.65}.steps{display:flex;justify-content:space-between;gap:12rpx;margin-top:28rpx;padding-top:24rpx;border-top:1rpx solid #edf1f3}.step{display:flex;align-items:center;gap:8rpx;color:#697788;font-size:23rpx}.step-mark{display:flex;width:32rpx;height:32rpx;align-items:center;justify-content:center;border-radius:50%;background:#edf1f3;font-size:20rpx}.complete{color:#16754b}.complete .step-mark{background:#e2f5ea}
.notice-title,.section-title{display:block;font-size:30rpx;font-weight:650;line-height:1.4}.notice-card .helper{margin-top:12rpx}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12rpx;flex-wrap:wrap;margin-bottom:24rpx}.section-note{color:#667788;font-size:22rpx}.field{margin-top:24rpx}.field-label{display:block;margin-bottom:12rpx;font-size:27rpx;font-weight:550;line-height:1.4}
.field-input,.date-field,.readonly-field{box-sizing:border-box;width:100%;height:92rpx;min-height:46px;padding:0 22rpx;border:1rpx solid #dbe5e9;border-radius:18rpx;background:#f8fafb;font-size:28rpx;color:#17212b;line-height:46px}
.date-field,.readonly-field{display:flex;align-items:center;justify-content:space-between;line-height:1.4}.readonly-field{background:#f1f5f6}.field-placeholder{color:#758390;font-size:25rpx}.chevron{color:#83939e;font-size:36rpx}.verified-label{font-size:23rpx;color:#16754b}.helper{display:block;margin-top:10rpx;color:#657485;font-size:24rpx;line-height:1.65}.validity-heading{display:flex;align-items:center;justify-content:space-between;gap:10rpx}.switch-row{display:flex;align-items:center;justify-content:flex-end}.switch-row .helper{margin:0}.area-fields{display:flex;gap:18rpx;margin-top:24rpx}.area-field{flex:1;min-width:0}.privacy-card{padding:6rpx 8rpx 24rpx}.privacy-card .notice-title{font-size:27rpx}.consent-row{display:flex;align-items:flex-start;gap:10rpx;min-height:88rpx;margin-top:18rpx;padding:12rpx 0}.consent-checkbox{transform:scale(.85);transform-origin:left top}.consent-text{padding-top:2rpx;font-size:25rpx;line-height:1.65;color:#34475a}
.save-button,.secondary-button,.clear-button{display:flex;width:100%;min-height:96rpx;align-items:center;justify-content:center;box-sizing:border-box;margin:0;padding:20rpx;border:0;border-radius:22rpx;font-size:30rpx;font-weight:600;line-height:1.4}.save-button{color:#fff;background:#087f86}.save-button.is-disabled{color:#657d82;background:#dce9eb}.secondary-button{margin-top:22rpx;background:#e1f5f5;color:#087f86}.clear-button{margin-top:22rpx;background:transparent;color:#a94451;font-size:25rpx;font-weight:500}.save-button::after,.secondary-button::after,.clear-button::after{border:0}.save-note{display:block;margin:14rpx 0;text-align:center;color:#657485;font-size:23rpx;line-height:1.5}.form-error{display:block;margin:0 8rpx 20rpx;color:#b12f3c;font-size:25rpx;line-height:1.6}.summary-line{display:block;margin-top:16rpx;font-size:27rpx;line-height:1.5}
</style>
