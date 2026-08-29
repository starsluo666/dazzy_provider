<template>
  <view class="dz-page services-page"><view class="hero"><view class="dz-safe-top"/><header class="nav dz-container"><button @tap="goBack">‹</button><strong class="strong-text">服务管理</strong><button class="add" @tap="openEditor()">新增</button></header></view><main class="dz-container content"><NetworkState v-if="loading" message="正在加载服务…"/><NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load"/><view v-else-if="!items.length" class="empty"><strong class="strong-text">还没有服务项目</strong><text>新增服务后，用户就能在达人主页发起预约</text><button @tap="openEditor()">新增服务</button></view><article v-for="item in items" v-else :key="item.id" class="service-card"><view><strong class="strong-text">{{item.category}}</strong><text>{{item.billing_type==='hourly'?'按小时':'按次'}} · {{durationLabel(item)}}</text><small>{{item.description||'暂无服务说明'}}</small></view><view class="price">¥{{money(item.price_amount)}}<small>{{item.billing_type==='hourly'?'/小时':'/次'}}</small></view><footer><text :class="{off:!item.is_active}">{{item.is_active?'已上架':'已下架'}}</text><button @tap="openEditor(item)">编辑</button><button v-if="item.is_active" @tap="disable(item)">下架</button></footer></article></main><view v-if="editing" class="mask" @tap.self="close"><section class="sheet"><i/><header><strong class="strong-text">{{form.id?'编辑服务':'新增服务'}}</strong><button @tap="close">×</button></header><label><text>服务分类</text><picker :range="categories" range-key="name" @change="chooseCategory"><view>{{categoryName||'请选择'}} ›</view></picker></label><label><text>计费方式</text><view class="segments"><button :class="{active:form.billing_type==='hourly'}" @tap="form.billing_type='hourly'">按小时</button><button :class="{active:form.billing_type==='per_session'}" @tap="form.billing_type='per_session'">按次</button></view></label><label><text>价格（元）</text><input v-model="form.price" type="digit" placeholder="请输入价格"/></label><label><text>预计时长（分钟）</text><input v-model="form.duration" type="number" placeholder="例如 120"/></label><label><text>服务说明</text><textarea v-model="form.description" maxlength="500" placeholder="说明服务内容和注意事项"/></label><button class="save" :disabled="saving||!canSave" @tap="save">{{saving?'保存中…':'保存服务'}}</button></section></view></view>
</template>
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'

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
const form = reactive({
  id: 0,
  category_id: 0,
  billing_type: 'hourly' as 'hourly' | 'per_session',
  price: '',
  duration: '120',
  description: '',
})

const categoryName = computed(() => categories.value.find((item) => item.id === form.category_id)?.name || '')
const canSave = computed(() => form.category_id > 0 && Number(form.price) > 0 && Number(form.duration) >= 30)

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
    const [services, serviceCategories] = await Promise.all([
      getMyProviderServices(),
      getServiceCategories(),
    ])
    items.value = services.data.items
    categories.value = serviceCategories.data.items
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

function openEditor(item?: ProviderManagedService) {
  Object.assign(form, item
    ? {
        id: item.id,
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

function close() { editing.value = false }
function chooseCategory(event: Event) {
  form.category_id = categories.value[Number((event as CustomEvent<{ value: string }>).detail.value)]?.id || 0
}

async function save() {
  if (!canSave.value || saving.value) return
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
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '保存失败'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

function disable(item: ProviderManagedService) {
  uni.showModal({
    title: '下架服务',
    content: `确定下架“${item.category}”吗？`,
    success: async (result) => {
      if (!result.confirm) return
      try {
        await disableMyProviderService(item.id)
        await load()
      } catch (reason) {
        uni.showToast({ title: getErrorMessage(reason, '下架失败'), icon: 'none' })
      }
    },
  })
}

onLoad(() => { if (guardCurrentPage()) load() })
</script>
<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;.services-page{min-height:100vh;background:$dz-surface-page}.hero{background:linear-gradient(150deg,#eafcfc,#fff)}.nav{display:flex;align-items:center;justify-content:space-between;height:94rpx}.nav button{width:80rpx;margin:0;padding:0;border:0;background:transparent}.nav button::after,.sheet button::after,.empty button::after{display:none}.nav>button:first-child{text-align:left;font-size:55rpx}.nav .strong-text{font-size:31rpx}.nav .add{color:$dz-brand-deep;font-size:23rpx}.content{padding-top:22rpx;padding-bottom:50rpx}.service-card{position:relative;margin-bottom:18rpx;padding:24rpx;border-radius:24rpx;background:#fff;box-shadow:$dz-shadow-card}.service-card>view:first-child{display:flex;max-width:72%;flex-direction:column;gap:8rpx}.service-card .strong-text{font-size:27rpx}.service-card text,.service-card small{color:$dz-text-secondary;font-size:19rpx}.service-card .price{position:absolute;top:25rpx;right:24rpx;color:#ff6433;font-size:30rpx;font-weight:800}.price small{color:#ff6433;font-size:17rpx}.service-card footer{display:flex;align-items:center;gap:12rpx;margin-top:22rpx;padding-top:17rpx;border-top:1rpx solid $dz-border-subtle}.service-card footer text{flex:1;color:$dz-brand-deep}.service-card footer text.off{color:$dz-text-tertiary}.service-card footer button{height:50rpx;margin:0;padding:0 22rpx;border:1rpx solid $dz-border-subtle;border-radius:25rpx;background:#fff;font-size:19rpx;line-height:50rpx}.empty{display:flex;flex-direction:column;align-items:center;margin-top:120rpx;color:$dz-text-secondary;text-align:center}.empty .strong-text{color:$dz-text-primary;font-size:29rpx}.empty text{margin-top:12rpx;font-size:21rpx}.empty button{width:280rpx;height:72rpx;margin-top:30rpx;border:0;border-radius:36rpx;color:#fff;background:$dz-gradient-brand;font-size:24rpx}.mask{position:fixed;z-index:80;inset:0;background:rgba(15,30,34,.55)}.sheet{position:absolute;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:14rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));border-radius:32rpx 32rpx 0 0;background:#fff;box-sizing:border-box}.sheet>i{display:block;width:70rpx;height:7rpx;margin:0 auto 16rpx;border-radius:5rpx;background:#cbd3d5}.sheet header{display:flex;align-items:center;justify-content:space-between}.sheet header .strong-text{font-size:29rpx}.sheet header button{width:55rpx;margin:0;padding:0;border:0;background:transparent;font-size:36rpx}.sheet label{display:flex;align-items:center;min-height:84rpx;border-bottom:1rpx solid $dz-border-subtle}.sheet label>text{width:190rpx;flex:none;font-size:22rpx;font-weight:650}.sheet label>picker,.sheet label>input{flex:1;text-align:right;font-size:22rpx}.segments{display:flex;flex:1;justify-content:flex-end;gap:10rpx}.segments button{height:52rpx;margin:0;padding:0 24rpx;border:1rpx solid $dz-border-subtle;border-radius:26rpx;background:#fff;font-size:20rpx;line-height:52rpx}.segments button.active{border-color:$dz-brand-primary;color:$dz-brand-deep;background:$dz-brand-soft}.sheet label:has(textarea){align-items:flex-start;padding:20rpx 0}.sheet textarea{height:100rpx;flex:1;font-size:21rpx;text-align:right}.sheet .save{height:78rpx;margin-top:24rpx;border:0;border-radius:39rpx;color:#fff;background:$dz-gradient-brand;font-size:26rpx;font-weight:700;line-height:78rpx}.sheet .save[disabled]{opacity:.45}
</style>
