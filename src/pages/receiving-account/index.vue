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
              <text class="eyebrow">余额提现 · 本人银行卡</text>
              <text class="status-title">{{ account.status_label }}</text>
            </view>
            <text class="status-badge" :class="{ 'badge-ready': account.channel_status === 'active' }">{{ account.channel_status === 'active' ? '已开通' : '待确认' }}</text>
          </view>
          <text class="status-description">{{ account.channel_notice }}</text>
          <view class="steps">
            <view class="step" :class="{ complete: account.identity_verified }"><text class="step-mark">{{ account.identity_verified ? '✓' : '1' }}</text><text>平台实名</text></view>
            <view class="step" :class="{ complete: account.materials_saved }"><text class="step-mark">{{ account.materials_saved ? '✓' : '2' }}</text><text>保存资料</text></view>
            <view class="step" :class="{ complete: account.channel_status === 'active' }"><text class="step-mark">{{ account.channel_status === 'active' ? '✓' : '3' }}</text><text>渠道开通</text></view>
          </view>
        </view>

        <view v-if="!account.identity_verified" class="notice-card">
          <text class="notice-title">先完成平台实名认证</text>
          <text class="helper">仅接受与你实名认证一致的本人收款资料。</text>
          <button class="secondary-button" hover-class="dz-pressed" @tap="openIdentity">去实名认证</button>
        </view>
        <view v-else-if="!account.collection_enabled && !account.can_refresh" class="notice-card">
          <text class="notice-title">资料填写暂未开放</text>
          <text class="helper">{{ account.collection_unavailable_reason }}</text>
        </view>

        <view v-if="account.materials_saved" class="form-card">
          <text class="section-title">已保存资料</text>
          <text class="summary-line">{{ account.bank_name }} · {{ account.bank_card_masked }}</text>
          <text class="helper">{{ account.bank_province }} {{ account.bank_city }}</text>
          <text class="helper">联系电话 {{ account.mobile_masked }}</text>
          <text v-if="!account.can_edit" class="helper">{{ account.collection_notice }}</text>
        </view>

        <template v-if="account.identity_verified && account.can_edit">
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
              <view class="area-field"><text class="field-label">银行所在省份</text><picker :range="regions" range-key="name" :value="provinceIndex" :disabled="busy" @change="selectProvince"><view class="date-field"><text>{{ form.bank_province || '选择省份' }}</text><text class="chevron">›</text></view></picker></view>
              <view class="area-field"><text class="field-label">银行所在城市</text><picker :range="cities" range-key="name" :value="cityIndex" :disabled="busy || !form.bank_province_code" @change="selectCity"><view class="date-field"><text>{{ form.bank_city || '选择城市' }}</text><text class="chevron">›</text></view></picker></view>
            </view>
            <view class="field"><text class="field-label">银行卡预留手机号</text><input v-model="form.mobile" class="field-input" type="number" :maxlength="11" :disabled="busy" :placeholder="account.materials_saved ? account.mobile_masked : '输入银行预留的本人手机号'" placeholder-class="field-placeholder" aria-label="银行卡预留手机号" /><text class="helper">同时用于渠道开户联系，请确认与银行预留信息一致。</text></view>
          </view>

          <view class="privacy-card">
            <text class="notice-title">资料如何使用</text>
            <text class="helper">{{ account.collection_notice }}</text>
            <checkbox-group @change="changeConsent">
              <label class="consent-row"><checkbox class="consent-checkbox" value="accepted" :checked="consent" :disabled="busy" color="#087f86" /><text class="consent-text">我已阅读并同意以上收款资料收集说明</text></label>
            </checkbox-group>
          </view>
          <button class="save-button" :class="{ 'is-disabled': busy || !consent }" :disabled="busy || !consent" :loading="saving" hover-class="dz-pressed" @tap="save">{{ saving ? '正在保存…' : '保存收款资料' }}</button>
          <text class="save-note">保存不会开户、绑卡或扣款</text>
        </template>
        <view v-if="account.materials_saved" class="form-card channel-card">
          <text class="section-title">申请渠道开户</text>
          <text v-if="account.can_submit" class="helper">将提交上方已保存的本人资料。若刚修改了输入内容，请先保存再申请。</text>
          <template v-if="account.can_submit">
            <text class="helper">{{ account.onboarding_notice }}</text>
            <checkbox-group @change="changeOnboardingConsent"><label class="consent-row"><checkbox class="consent-checkbox" value="accepted" :checked="onboardingConsent" :disabled="busy" color="#087f86" /><text class="consent-text">我已核对已保存资料，并同意以上开户及手动提现授权</text></label></checkbox-group>
            <text v-if="hasUnsavedChanges" class="form-error">有尚未保存的修改，请先保存资料，再申请开户。</text>
            <button class="save-button" :class="{ 'is-disabled': busy || !onboardingConsent || hasUnsavedChanges }" :disabled="busy || !onboardingConsent || hasUnsavedChanges" :loading="submitting" @tap="submit">{{ submitting ? '正在提交…' : account.can_refresh ? '确认手动提现授权并继续' : '申请开户并开通手动提现' }}</button>
          </template>
          <text v-else-if="!account.onboarding_enabled && !account.can_refresh" class="helper">平台尚未启用渠道开户。资料已安全保存，不会自动提交，请联系平台完成配置。</text>
          <text v-else class="helper">{{ account.channel_notice }}</text>
          <view v-if="account.can_refresh" class="channel-checks">
            <view class="channel-check"><text>本人提现卡</text><text :class="{ 'check-ready': account.card_status === 'S' }">{{ account.card_status === 'S' ? '已确认' : account.card_status === 'F' ? '未通过，请核实' : '待核实' }}</text></view>
            <view class="channel-check"><text>手动提现配置</text><text :class="{ 'check-ready': account.cash_status === 'S' }">{{ account.cash_status === 'S' ? '已确认' : account.cash_status === 'F' ? '未通过，请核实' : '待核实' }}</text></view>
            <view class="channel-check"><text>自动结算</text><text :class="{ 'check-ready': account.automatic_settlement_disabled === true }">{{ account.automatic_settlement_disabled === true ? '已核验关闭' : account.automatic_settlement_disabled === false ? '仍开启，需关闭' : '关闭状态待核实' }}</text></view>
          </view>
          <button v-if="account.can_refresh" class="secondary-button" :disabled="busy" :loading="refreshing" @tap="refresh">{{ refreshing ? '正在查询渠道…' : '刷新渠道状态' }}</button>
          <text class="helper">各项核验及授权满足条件后才可提现。订单分账核验后先计入达人余额，再由你主动申请提现；开通本身不代表银行卡已到账。</text>
        </view>
        <text v-if="formError" class="form-error" role="alert">{{ formError }}</text>
        <button v-if="account.can_clear" class="clear-button" :disabled="busy" :loading="clearing" hover-class="dz-pressed" @tap="confirmClear">清除已保存的收款资料</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload, onShow } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { clearProviderReceivingAccount, getProviderReceivingAccount, saveProviderReceivingAccount, getReceivingBankRegions, submitProviderReceivingAccount, refreshProviderReceivingAccount } from '@/services/providers'
import type { ProviderReceivingAccount, ReceivingBankProvince } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

const account = ref<ProviderReceivingAccount | null>(null)
const loading = ref(true)
const saving = ref(false)
const clearing = ref(false)
const submitting = ref(false)
const refreshing = ref(false)
const onboardingConsent = ref(false)
const regions = ref<ReceivingBankProvince[]>([])
const busy = computed(() => saving.value || clearing.value || submitting.value || refreshing.value)
const error = ref('')
const formError = ref('')
const consent = ref(false)
const returningFromIdentity = ref(false)
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const form = reactive({ id_number: '', bank_card_number: '', mobile: '', cert_begin_date: '', cert_end_date: '', cert_long_term: false, bank_name: '', bank_province: '', bank_city: '', bank_province_code: '', bank_city_code: '' })
const savedForm = ref('')
const hasUnsavedChanges = computed(() => Boolean(account.value?.can_edit && JSON.stringify(form) !== savedForm.value))
const provinceIndex = computed(() => Math.max(0, regions.value.findIndex(p => p.code === form.bank_province_code)))
const cities = computed(() => regions.value.find(p => p.code === form.bank_province_code)?.cities || [])
const cityIndex = computed(() => Math.max(0, cities.value.findIndex(c => c.code === form.bank_city_code)))
function selectProvince(event: { detail: { value: string } }) { const p = regions.value[Number(event.detail.value)]; if (!p) return; form.bank_province = p.name; form.bank_province_code = p.code; form.bank_city = ''; form.bank_city_code = '' }
function selectCity(event: { detail: { value: string } }) { const c = cities.value[Number(event.detail.value)]; if (!c) return; form.bank_city = c.name; form.bank_city_code = c.code }
function changeOnboardingConsent(event: { detail: { value: string[] } }) { onboardingConsent.value = event.detail.value.includes('accepted') }

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
  form.bank_province_code = value.bank_province_code
  form.bank_city_code = value.bank_city_code
  savedForm.value = JSON.stringify(form)
  consent.value = false
  onboardingConsent.value = false
}
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function openIdentity() { returningFromIdentity.value = true; uni.navigateTo({ url: '/pages/identity/index' }) }
function setDate(key: 'cert_begin_date' | 'cert_end_date', event: { detail: { value: string } }) { form[key] = event.detail.value }
function toggleLongTerm(event: unknown) { form.cert_long_term = Boolean((event as { detail: { value: boolean } }).detail.value); if (form.cert_long_term) form.cert_end_date = '' }
function changeConsent(event: { detail: { value: string[] } }) { consent.value = event.detail.value.includes('accepted') }
async function load() {
  loading.value = true
  error.value = ''
  try { const [result, areaResult] = await Promise.all([getProviderReceivingAccount(), getReceivingBankRegions()]); regions.value = areaResult.data; applyAccount(result.data) }
  catch (reason) { error.value = getErrorMessage(reason, '收款资料加载失败') }
  finally { loading.value = false }
}
async function save() {
  if (busy.value || !consent.value || !account.value?.can_edit) return
  formError.value = ''
  if ((!account.value.materials_saved && (!form.id_number.trim() || !form.bank_card_number.trim() || !form.mobile.trim())) || !form.cert_begin_date || (!form.cert_long_term && !form.cert_end_date) || !form.bank_name.trim() || !form.bank_province_code || !form.bank_city_code) {
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
async function submit() {
  if (busy.value || !onboardingConsent.value || hasUnsavedChanges.value || !account.value?.can_submit) return
  submitting.value = true; formError.value = ''
  try { applyAccount((await submitProviderReceivingAccount(account.value.onboarding_consent_version)).data) }
  catch (reason) { formError.value = getErrorMessage(reason, '渠道结果尚未确认，请刷新状态后再操作'); await load() }
  finally { submitting.value = false }
}
async function refresh() {
  if (busy.value || !account.value?.can_refresh) return
  refreshing.value = true; formError.value = ''
  try { applyAccount((await refreshProviderReceivingAccount()).data) }
  catch (reason) { formError.value = getErrorMessage(reason, '暂时无法查询渠道，请稍后刷新') }
  finally { refreshing.value = false }
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
.channel-checks{margin-top:20rpx;padding:8rpx 20rpx;border-radius:18rpx;background:#f5f8f9}.channel-check{display:flex;align-items:center;justify-content:space-between;gap:16rpx;flex-wrap:wrap;padding:14rpx 0;font-size:24rpx;line-height:1.5;color:#657485}.check-ready{color:#16754b}
.status-badge.badge-ready{background:#e2f5ea;color:#16754b}.channel-card{margin-top:24rpx}.date-field{gap:8rpx;overflow:hidden}
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
