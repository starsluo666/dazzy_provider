<template>
  <view class="dz-page dz-management-page services-page">
    <view class="hero">
      <view class="dz-safe-top" />
      <view class="nav dz-management-head dz-container">
        <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="goBack">‹</button>
        <text class="page-title">服务管理</text>
        <view class="nav-spacer" />
      </view>
    </view>

    <view class="dz-container content">
      <NetworkState v-if="loading" message="正在加载服务…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <view v-else-if="!items.length" class="empty">
        <text class="empty-title">还没有服务项目</text>
        <text class="empty-copy">新增服务后，用户就能在达人主页发起预约</text>
        <button class="empty-action dz-tappable" hover-class="dz-pressed" @tap="openEditor()"><text class="empty-action-label">新增服务</text></button>
      </view>
      <template v-else>
        <view class="service-overview">
          <view class="overview-main">
            <view class="overview-copy">
              <text class="overview-eyebrow">服务目录</text>
              <view class="overview-counts">
                <text class="overview-number">{{ items.length }}</text>
                <text class="overview-unit">项服务</text>
                <view class="overview-dot" />
                <text class="overview-active">{{ activeServiceCount }}项展示中</text>
              </view>
            </view>
            <button class="overview-add dz-tappable" hover-class="dz-pressed" @tap="openEditor()">
              <text class="overview-add-icon">＋</text>
              <text>新增服务</text>
            </button>
          </view>
          <text class="overview-helper">新增、修改和重新上架需审核；下架立即生效</text>
        </view>

        <view v-for="item in items" :key="item.id || `revision-${item.revision_id}`" class="service-card" :class="{ 'service-card-off': !item.is_active }">
          <view class="service-head">
            <view class="service-title-block">
              <text class="service-title">{{ item.category }}</text>
              <view class="service-state" :class="{ 'service-state-off': !item.is_active }">
                <view class="service-state-dot" />
                <text>{{ item.review_status === 'pending' ? '审核中' : item.review_status === 'rejected' ? '审核未通过' : item.is_active ? '已上架' : '已下架' }}</text>
              </view>
            </view>
            <view class="price-row">
              <text class="price-symbol">¥</text>
              <text class="price-number">{{ money(item.price_amount) }}</text>
              <text class="price-unit">{{ item.billing_type === 'hourly' ? '/小时' : '/次' }}</text>
            </view>
          </view>
          <view class="service-body">
            <view class="service-meta">
              <text class="service-meta-value">{{ item.billing_type === 'hourly' ? '按小时计费' : '按次计费' }}</text>
              <view class="service-meta-divider" />
              <text class="service-meta-value">{{ durationLabel(item) }}</text>
            </view>
            <text class="service-description" :class="{ 'service-description-empty': !item.description }">{{ item.description || '未填写服务说明' }}</text>
            <text v-if="item.review_status === 'rejected'" class="review-reason">{{ item.review_rejection_reason }}</text>
          </view>
          <view class="service-actions">
            <button class="service-action service-edit dz-tappable" hover-class="dz-pressed" :disabled="item.review_status === 'pending'" @tap="openEditor(item)">{{ item.review_status === 'pending' ? '等待审核' : item.review_status === 'rejected' && !item.id ? '修改重提' : '编辑服务' }}</button>
            <button v-if="item.is_active && item.id" class="service-action service-disable dz-tappable" hover-class="dz-pressed" @tap="disable(item)">下架</button>
          </view>
        </view>
      </template>
    </view>

    <DzBottomSheet :visible="editing" :title="form.id ? '编辑服务' : '新增服务'" subtitle="设置用户看到的服务信息" @close="close">
      <view class="sheet-fields">
        <view class="sheet-field">
          <text class="sheet-field-label">服务分类</text>
          <picker class="sheet-picker" :range="categories" range-key="name" @change="chooseCategory">
            <view class="sheet-control sheet-picker-value"><text class="sheet-picker-text" :class="{ 'picker-placeholder': !categoryName }">{{ categoryName || '请选择' }}</text><text class="sheet-chevron">›</text></view>
          </picker>
        </view>
        <view class="sheet-field">
          <text class="sheet-field-label">计费方式</text>
          <view class="segmented">
            <view class="segmented-thumb" :class="{ 'segmented-thumb--right': form.billing_type === 'per_session' }" />
            <button class="segment" :class="{ 'segment-active': form.billing_type === 'hourly' }" @tap="form.billing_type = 'hourly'"><text>按小时</text></button>
            <button class="segment" :class="{ 'segment-active': form.billing_type === 'per_session' }" @tap="form.billing_type = 'per_session'"><text>按次</text></button>
          </view>
        </view>
        <view class="sheet-field price-field">
          <text class="sheet-field-label">价格（元）</text>
          <view class="sheet-control-stack price-control">
            <view class="sheet-control price-input-shell" :class="{ 'is-focused': focusedField === 'price' }">
              <text class="price-input-currency">¥</text>
              <input v-model="form.price" class="sheet-input price-input" type="digit" placeholder="请输入价格" placeholder-class="input-placeholder" aria-label="服务价格（元）" @focus="focusedField = 'price'" @blur="focusedField = ''" />
            </view>
            <text v-if="priceRange" class="sheet-hint price-limit">允许范围 ¥{{ money(priceRange.minimum) }}–{{ money(priceRange.maximum) }}</text>
          </view>
        </view>
        <view class="sheet-field">
          <text class="sheet-field-label">预计时长</text>
          <view class="sheet-control duration-input-shell" :class="{ 'is-focused': focusedField === 'duration' }">
            <input v-model="form.duration" class="sheet-input duration-input" type="number" placeholder="例如 120" placeholder-class="input-placeholder" aria-label="预计时长（分钟）" @focus="focusedField = 'duration'" @blur="focusedField = ''" />
            <text class="sheet-input-unit">分钟</text>
          </view>
        </view>
        <view class="sheet-field description-field">
          <text class="sheet-field-label">服务说明</text>
          <view class="sheet-control-stack">
            <view class="sheet-control sheet-control--multiline" :class="{ 'is-focused': focusedField === 'description' }">
              <textarea v-model="form.description" class="sheet-textarea" maxlength="500" placeholder="说明服务内容和注意事项" placeholder-class="input-placeholder" aria-label="服务说明" @focus="focusedField = 'description'" @blur="focusedField = ''" />
            </view>
            <text class="sheet-hint sheet-count">{{ form.description.length }}/500</text>
          </view>
        </view>
        <button class="save dz-tappable" :class="{ 'save-disabled': saving || !canSave }" hover-class="dz-pressed" @tap="save"><text>{{ saving ? '提交中…' : '提交服务审核' }}</text></button>
      </view>
    </DzBottomSheet>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'

import DzBottomSheet from '@/components/DzBottomSheet.vue'
import NetworkState from '@/components/NetworkState.vue'
import {
  createMyProviderService,
  disableMyProviderService,
  getMyProviderServices,
  getServiceCategories,
  updateMyProviderService,
} from '@/services/providers'
import { guardCurrentPage } from '@/services/session'
import type { ProviderManagedService, ServiceCategory } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

const items = ref<ProviderManagedService[]>([])
const categories = ref<ServiceCategory[]>([])
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const focusedField = ref('')
const form = reactive({
  id: 0,
  category_id: 0,
  billing_type: 'hourly' as 'hourly' | 'per_session',
  price: '',
  duration: '120',
  description: '',
})

const categoryName = computed(() => categories.value.find((item) => item.id === form.category_id)?.name || '')
const priceRange = computed(() => {
  const category = categories.value.find(item => item.id === form.category_id)
  if (!category) return null
  return form.billing_type === 'hourly'
    ? { minimum: category.hourly_min_price_amount, maximum: category.hourly_max_price_amount }
    : { minimum: category.per_session_min_price_amount, maximum: category.per_session_max_price_amount }
})
const submitBlocker = computed(() => {
  if (saving.value) return ''
  if (!(form.category_id > 0)) return '请先选择服务分类'
  if (!(Number(form.price) > 0)) return '请输入有效的价格'
  const priceAmount = Math.round(Number(form.price) * 100)
  if (priceRange.value && (priceAmount < priceRange.value.minimum || priceAmount > priceRange.value.maximum)) return `价格需在¥${money(priceRange.value.minimum)}–¥${money(priceRange.value.maximum)}之间`
  if (Number(form.duration) < 30) return '预计时长至少 30 分钟'
  return ''
})
const canSave = computed(() => !submitBlocker.value)
const activeServiceCount = computed(() => items.value.filter((item) => item.is_active).length)

function goBack() { uni.navigateBack() }
function money(value: number) {
  return (value / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function durationLabel(value: ProviderManagedService) {
  return value.estimated_duration_minutes ? `${value.estimated_duration_minutes}分钟` : '时长可选'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [services, serviceCategories] = await Promise.all([getMyProviderServices(), getServiceCategories()])
    items.value = services.data.items
    categories.value = serviceCategories.data.items
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

function openEditor(item?: ProviderManagedService) {
  focusedField.value = ''
  Object.assign(form, item
    ? {
        id: item.id || 0,
        category_id: item.category_id,
        billing_type: item.billing_type,
        price: String(item.price_amount / 100),
        duration: String(item.estimated_duration_minutes || 120),
        description: item.description,
      }
    : {
        id: 0,
        category_id: categories.value[0]?.id || 0,
        billing_type: 'hourly',
        price: '',
        duration: '120',
        description: '',
      })
  editing.value = true
}

function close() { editing.value = false; focusedField.value = '' }
function chooseCategory(event: Event) {
  form.category_id = categories.value[Number((event as CustomEvent<{ value: string }>).detail.value)]?.id || 0
}

async function save() {
  if (saving.value) return
  if (!canSave.value) {
    uni.showToast({ title: submitBlocker.value, icon: 'none' })
    return
  }
  saving.value = true
  const data = {
    category_id: form.category_id,
    billing_type: form.billing_type,
    price_amount: Math.round(Number(form.price) * 100),
    estimated_duration_minutes: Number(form.duration),
    description: form.description.trim(),
    is_active: true,
  }
  try {
    if (form.id) await updateMyProviderService(form.id, data)
    else await createMyProviderService(data)
    editing.value = false
    await load()
    uni.showToast({ title: '已提交审核', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '保存失败'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

function disable(item: ProviderManagedService) {
  if (!item.id) return
  const serviceId = item.id
  uni.showModal({
    title: '下架服务',
    content: `确定下架“${item.category}”吗？`,
    success: async (result) => {
      if (!result.confirm) return
      try { await disableMyProviderService(serviceId); await load() } catch (reason) { uni.showToast({ title: getErrorMessage(reason, '下架失败'), icon: 'none' }) }
    },
  })
}

onLoad(() => { if (guardCurrentPage()) load() })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;

.services-page{min-height:100vh;background:linear-gradient(180deg,#edfafa 0,#f5f9f9 360rpx,#f1f5f5 100%);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-synthesis:none;line-break:strict}
.review-reason{display:block;margin-top:10rpx;color:#bf4a3d;font-size:21rpx;line-height:1.45}
.hero{background:rgba(247,252,252,.94)}
.nav{position:sticky;z-index:30;top:0;display:flex;height:100rpx;align-items:center;justify-content:space-between}
.nav-back{display:flex;width:88rpx;height:80rpx;align-items:center;justify-content:flex-start;margin:0;padding:0;border:0;background:transparent;font-size:54rpx;line-height:1}
.page-title{font-size:34rpx;font-weight:750;line-height:1.2;letter-spacing:0}
.nav-spacer{width:88rpx;height:80rpx;flex:none}
.nav-back::after,.overview-add::after,.service-action::after,.segment::after,.save::after,.empty-action::after{display:none}

.content{padding-top:20rpx;padding-bottom:54rpx}
.service-overview{margin-bottom:18rpx;padding:24rpx 26rpx 22rpx;border:1rpx solid rgba(255,255,255,.96);border-radius:28rpx;background:rgba(255,255,255,.9);box-shadow:$dz-shadow-soft}
.overview-main{display:flex;align-items:center;justify-content:space-between;gap:20rpx}
.overview-copy{display:flex;min-width:0;gap:6rpx;flex:1;flex-direction:column}
.overview-eyebrow{color:$dz-text-secondary;font-size:21rpx;font-weight:600;line-height:1.4;letter-spacing:.02em}
.overview-counts{display:flex;align-items:baseline;min-width:0;white-space:nowrap}
.overview-number{color:$dz-text-primary;font-size:38rpx;font-weight:760;line-height:1.1;font-variant-numeric:tabular-nums}
.overview-unit{margin-left:6rpx;color:$dz-text-primary;font-size:24rpx;font-weight:650}
.overview-dot{width:6rpx;height:6rpx;flex:none;margin:0 12rpx;border-radius:50%;background:#a3b4b7}
.overview-active{overflow:hidden;color:$dz-brand-deep;font-size:22rpx;font-weight:650;text-overflow:ellipsis;white-space:nowrap}
.overview-add{display:flex;width:190rpx;height:68rpx;flex:none;align-items:center;justify-content:center;gap:5rpx;margin:0;padding:0;border:0;border-radius:21rpx;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control;font-size:23rpx;font-weight:700;line-height:1}
.overview-add-icon{font-size:29rpx;font-weight:450;line-height:1}
.overview-helper{display:block;margin-top:15rpx;color:$dz-text-tertiary;font-size:20rpx;line-height:1.5}

.service-card{margin-bottom:18rpx;padding:26rpx 26rpx 22rpx;border:1rpx solid rgba(218,231,232,.92);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:$dz-shadow-soft}
.service-card-off{opacity:.82}
.service-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20rpx}
.service-title-block{display:flex;min-width:0;gap:11rpx;align-items:center;flex:1}
.service-title{overflow:hidden;color:$dz-text-primary;font-size:30rpx;font-weight:750;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
.service-state{display:flex;flex:none;align-items:center;gap:7rpx;padding:6rpx 12rpx;border-radius:16rpx;color:#13885d;background:#eaf8f1;font-size:19rpx;font-weight:700;line-height:1.25}
.service-state-dot{width:8rpx;height:8rpx;border-radius:50%;background:#20a873}
.service-state-off{color:$dz-text-secondary;background:#eef2f2}
.service-state-off .service-state-dot{background:#93a1a4}
.price-row{display:flex;flex:none;align-items:baseline;color:$dz-orange;white-space:nowrap}
.price-symbol{font-size:25rpx;font-weight:700;line-height:1}
.price-number{margin-left:2rpx;font-size:38rpx;font-weight:760;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.price-unit{margin-left:5rpx;color:#c85832;font-size:20rpx;font-weight:650}
.service-body{display:flex;gap:12rpx;margin-top:20rpx;flex-direction:column}
.service-meta{display:flex;align-items:center;color:$dz-text-secondary}
.service-meta-value{font-size:22rpx;line-height:1.4}
.service-meta-divider{width:1rpx;height:22rpx;margin:0 14rpx;background:$dz-border}
.service-description{overflow:hidden;color:$dz-text-secondary;font-size:22rpx;line-height:1.55;text-overflow:ellipsis;white-space:nowrap}
.service-description-empty{color:$dz-text-tertiary}
.service-actions{display:flex;align-items:center;justify-content:flex-end;gap:12rpx;margin-top:20rpx;padding-top:18rpx;border-top:1rpx solid rgba(31,65,72,.06)}
.service-action{display:flex;height:64rpx;align-items:center;justify-content:center;margin:0;padding:0;border-radius:19rpx;font-size:22rpx;font-weight:680;line-height:1}
.service-edit{width:180rpx;border:0;color:$dz-text-primary;background:#f1f6f6}
.service-disable{width:112rpx;border:0;color:#bd4a43;background:$dz-danger-soft}

.empty{display:flex;align-items:center;margin-top:150rpx;color:$dz-text-secondary;text-align:center;flex-direction:column}
.empty-title{color:$dz-text-primary;font-size:32rpx;font-weight:750;line-height:1.35}
.empty-copy{margin-top:14rpx;font-size:24rpx;line-height:1.65}
.empty-action{display:flex;width:300rpx;height:84rpx;align-items:center;justify-content:center;margin-top:32rpx;padding:0;border:0;border-radius:24rpx;color:#fff;background:$dz-brand;font-size:30rpx;font-weight:700;line-height:1}
.empty-action-label{display:block;line-height:1.3}

/* 编辑弹层由 DzBottomSheet 承载（拖拽收起/进出场动画），这里只定义表单字段。 */
.sheet-fields{display:block;padding-top:2rpx}
.sheet-field{display:flex;align-items:flex-start;gap:16rpx;padding:12rpx 0}
.sheet-field-label{display:flex;width:184rpx;min-height:88rpx;flex:none;align-items:center;color:$dz-text-primary;font-size:25rpx;font-weight:600;line-height:1.4}
.sheet-picker{min-width:0;flex:1}
.sheet-control-stack{display:flex;min-width:0;flex:1;gap:12rpx;flex-direction:column}
.sheet-control{display:flex;box-sizing:border-box;min-width:0;width:100%;min-height:88rpx;flex:1;align-items:center;gap:12rpx;padding:0 20rpx;border:1rpx solid #dce7e8;border-radius:18rpx;background:#fff}
.sheet-control.is-focused{border-color:#08a9b1;box-shadow:0 0 0 3rpx rgba(17,193,196,.1)}
.sheet-picker-value{justify-content:space-between;color:$dz-text-primary;font-size:27rpx;line-height:1.4}
.sheet-picker-text{overflow:hidden;min-width:0;text-overflow:ellipsis;white-space:nowrap}
.sheet-input{display:block;box-sizing:border-box;min-width:0;width:100%;height:64rpx;flex:1;padding:0;border:0;color:$dz-text-primary;background:transparent;font-size:27rpx;line-height:64rpx;text-align:left;font-variant-numeric:tabular-nums}
.sheet-input-unit{flex:none;color:#667085;font-size:23rpx;line-height:1.4}
.picker-placeholder{color:$dz-text-tertiary}
.input-placeholder{color:$dz-text-tertiary}
.sheet-chevron{flex:none;margin-left:5rpx;color:$dz-text-tertiary;font-size:31rpx;font-weight:400}
.price-input-currency{flex:none;color:#64777d;font-size:27rpx;line-height:1}
.sheet-hint{display:block;color:#667085;font-size:22rpx;line-height:1.5;text-align:right;overflow-wrap:anywhere}

/* iOS 风格分段控件：灰底轨道 + 白色滑块，选中态只变字色，动效仅 transform。 */
.segmented{position:relative;display:flex;min-width:0;flex:1;height:88rpx;padding:6rpx;border:1rpx solid #dce7e8;border-radius:18rpx;background:#e9f1f1;box-sizing:border-box}
.segmented-thumb{position:absolute;top:6rpx;left:6rpx;width:calc(50% - 6rpx);height:calc(100% - 12rpx);border-radius:12rpx;background:#fff;box-shadow:0 4rpx 12rpx rgba(19,34,40,.1);transition:transform $dz-duration-base $dz-ease-out}
.segmented-thumb--right{transform:translateX(100%)}
.segment{position:relative;z-index:1;display:flex;min-width:0;flex:1;height:100%;align-items:center;justify-content:center;margin:0;padding:0;border:0;background:transparent;color:$dz-text-secondary;font-size:26rpx;line-height:1.4;transition:color $dz-duration-fast ease}
.segment-active{color:#087b80;font-weight:600}

.description-field .sheet-field-label{min-height:0;padding-top:22rpx}
.sheet-control--multiline{align-items:flex-start;padding:20rpx}
.sheet-textarea{display:block;box-sizing:border-box;width:100%;height:156rpx;padding:0;border:0;color:$dz-text-primary;background:transparent;font-size:27rpx;line-height:1.55;text-align:left}
.save{display:flex;width:100%;height:88rpx;align-items:center;justify-content:center;margin:22rpx 0 6rpx;padding:0;border:0;border-radius:18rpx;color:#fff;background:$dz-brand;box-shadow:$dz-shadow-control;font-size:28rpx;font-weight:600;line-height:1.4}
.save-disabled{box-shadow:none;opacity:.45}
/* #ifdef H5 */
.hero{-webkit-backdrop-filter:saturate(170%) blur(22px);backdrop-filter:saturate(170%) blur(22px)}
/* #endif */
</style>
