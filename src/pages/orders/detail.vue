<template>
  <view class="dz-page order-detail-page">
    <view class="dz-sticky-head detail-head">
      <view class="dz-safe-top" />
      <header class="detail-nav dz-container">
        <button class="dz-tappable" aria-label="返回" hover-class="dz-pressed" @tap="goBack">‹</button>
        <strong class="strong-text">订单详情</strong>
        <button class="refresh dz-tappable" aria-label="刷新订单" :disabled="loading" hover-class="dz-pressed" @tap="load">↻</button>
      </header>
    </view>

    <main class="dz-container detail-content" :class="{ 'has-action': showActionBar }">
      <NetworkState v-if="loading" message="正在加载订单详情…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />

      <template v-else-if="order">
        <section class="status-hero" :class="statusTone(order.status)">
          <view class="status-line">
            <view class="status-pill" :class="statusTone(order.status)">
              <i />{{ statusLabel(order.status) }}
            </view>
            <text>{{ order.order_no }}</text>
          </view>
          <view class="hero-main">
            <view>
              <text>{{ order.customer_name || '预约用户' }}</text>
              <strong class="strong-text">{{ order.service_name }}</strong>
            </view>
            <view class="hero-price">
              <small>订单金额</small>
              <strong class="strong-text">¥{{ money(order.payable_amount) }}</strong>
            </view>
          </view>
          <text class="hero-tip">{{ nextStepCopy(order) }}</text>
        </section>

        <section v-if="order.provider_rejected_at" class="support-alert">
          <view class="alert-icon">!</view>
          <view>
            <strong class="strong-text">已转交平台客服处理</strong>
            <text>平台客服将在15分钟内联系用户；未形成有效联系时，系统将自动全额退款。</text>
          </view>
        </section>

        <section class="detail-card appointment-card">
          <header>
            <strong class="strong-text">服务信息</strong>
            <text class="duration-pill">约 {{ order.duration_minutes }} 分钟</text>
          </header>
          <view class="info-row time-info-row">
            <view class="row-icon cyan">时</view>
            <view class="row-copy">
              <small class="row-label">预约时间</small>
              <strong class="strong-text row-value time-value">{{ timeRange(order.starts_at, order.ends_at) }}</strong>
            </view>
          </view>
          <view class="info-row address-row">
            <view class="row-icon orange">地</view>
            <view class="row-copy">
              <small class="row-label">集合地址</small>
              <strong class="strong-text row-value address-value">{{ addressLabel(order) }}</strong>
            </view>
            <button v-if="canNavigate" class="mini-action dz-tappable" hover-class="dz-pressed" @tap="openNavigation">导航</button>
          </view>
          <view class="info-row contact-row">
            <view class="row-icon green">人</view>
            <view class="row-copy">
              <small class="row-label">联系人</small>
              <strong class="strong-text row-value">{{ order.contact_name }} {{ order.contact_gender_label }}</strong>
              <text class="phone-value">{{ order.contact_phone_display }}</text>
            </view>
            <button class="mini-action dz-tappable" :disabled="phoneIsMasked || busy" hover-class="dz-pressed" @tap="callCustomer">联系</button>
          </view>
          <view v-if="phoneIsMasked" class="privacy-tip">为保护用户隐私，接受订单后可查看完整电话与导航位置。</view>
        </section>

        <section v-if="order.note" class="detail-card note-card">
          <strong class="strong-text">用户备注</strong>
          <text>{{ order.note }}</text>
        </section>

        <section v-if="order.arrival_photo_url" class="detail-card evidence-card">
          <header>
            <strong class="strong-text">到场凭证</strong>
            <text>{{ dateTime(order.arrival_photo_uploaded_at) }}</text>
          </header>
          <button aria-label="预览集合地点照片" @tap="previewEvidence">
            <image :src="order.arrival_photo_url" mode="aspectFill" />
            <view class="photo-cover"><text>点击查看大图</text></view>
          </button>
        </section>

        <section class="detail-card price-card">
          <header><strong class="strong-text">费用明细</strong></header>
          <view v-for="item in priceRows" :key="item.label" class="price-row">
            <text>{{ item.label }}</text><text>¥{{ money(item.value) }}</text>
          </view>
          <view class="price-total">
            <strong class="strong-text">实付金额</strong>
            <strong class="strong-text">¥{{ money(order.payable_amount) }}</strong>
          </view>
        </section>

        <section class="detail-card timeline-card">
          <header><strong class="strong-text">履约进度</strong></header>
          <view v-for="(item, index) in timeline" :key="`${item.label}-${index}`" class="timeline-row" :class="{ done: item.done, current: item.current, danger: item.danger }">
            <view class="timeline-track">
              <i>{{ item.done ? '✓' : '' }}</i>
              <span v-if="index < timeline.length - 1" />
            </view>
            <view class="timeline-copy">
              <strong class="strong-text">{{ item.label }}</strong>
              <text>{{ item.time || item.copy }}</text>
            </view>
          </view>
        </section>
      </template>
    </main>

    <footer v-if="order && showActionBar" class="action-bar">
      <view class="action-inner dz-container">
        <button v-if="order.status === 'pending_acceptance'" class="secondary dz-tappable" :disabled="busy" hover-class="dz-pressed" @tap="openReject">拒绝订单</button>
        <button class="primary dz-tappable" :disabled="busy || actionDisabled" hover-class="dz-pressed" @tap="performPrimaryAction">
          {{ busy ? busyLabel : actionLabel(order) }}
        </button>
      </view>
    </footer>

    <view v-if="rejectVisible" class="dialog-mask" @tap.self="closeReject">
      <section class="reject-dialog">
        <view class="dialog-mark">!</view>
        <strong class="strong-text">确认拒绝这笔订单？</strong>
        <text>拒单后订单将转交平台客服。客服会在15分钟内联系用户，未形成有效联系时系统将自动全额退款。</text>
        <view class="dialog-actions">
          <button class="dz-tappable" :disabled="busy" hover-class="dz-pressed" @tap="closeReject">暂不拒绝</button>
          <button class="danger-button dz-tappable" :disabled="busy" hover-class="dz-pressed" @tap="confirmReject">
            {{ busy ? '提交中…' : '确认拒绝' }}
          </button>
        </view>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

import NetworkState from '@/components/NetworkState.vue'
import {
  acceptManagedProviderOrder,
  attachManagedOrderArrivalEvidence,
  completeManagedProviderOrder,
  departManagedProviderOrder,
  getManagedProviderOrder,
  rejectManagedProviderOrder,
  startManagedProviderOrder,
  uploadManagedOrderEvidence,
} from '@/services/orders'
import { guardCurrentPage } from '@/services/session'
import type { ProviderManagedOrder } from '@/types/api'
import { formatAmount, formatBusinessDateTime, formatOrderTimeRange, getErrorMessage } from '@/utils/formatters'

import { canContactOrder, contactOrderCustomer, confirmOrderDeparture, getFulfillmentLocation as getCurrentLocation } from '@/utils/orderFulfillment'
type SelectedPhoto = { path: string; file?: unknown }
type TimelineItem = { label: string; time?: string; copy?: string; done?: boolean; current?: boolean; danger?: boolean }

const orderNo = ref('')
const order = ref<ProviderManagedOrder | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const busyLabel = ref('处理中…')
const rejectVisible = ref(false)
const money = formatAmount

const phoneIsMasked = computed(() => !order.value || !canContactOrder(order.value))
const canNavigate = computed(() => Boolean(order.value?.meeting_longitude && order.value?.meeting_latitude))
const showActionBar = computed(() => Boolean(order.value && actionLabel(order.value)))
const actionDisabled = computed(() => Boolean(order.value?.status === 'pending_acceptance' && isExpired(order.value)))
const priceRows = computed(() => {
  if (!order.value) return []
  const rows = [
    { label: '服务费', value: order.value.service_fee_amount },
    { label: '交通费', value: order.value.transport_fee_amount },
  ]
  if (order.value.other_fee_amount) rows.push({ label: '其他费用', value: order.value.other_fee_amount })
  if (order.value.discount_amount) rows.push({ label: '优惠', value: -order.value.discount_amount })
  return rows
})
const timeline = computed<TimelineItem[]>(() => {
  if (!order.value) return []
  const item = order.value
  const rows: TimelineItem[] = [
    { label: '用户已支付', time: dateTime(item.paid_at || item.created_at), done: true },
  ]
  if (item.provider_rejected_at) {
    rows.push({ label: '已拒绝接单', time: dateTime(item.provider_rejected_at), done: true, danger: true })
    rows.push({ label: '等待平台客服处理', copy: '15分钟内未形成有效联系将自动全额退款', current: true, danger: true })
    return rows
  }
  addMilestone(rows, '达人已接单', item.accepted_at)
  addMilestone(rows, '达人已核实订单', item.departure_contact_confirmed_at)
  addMilestone(rows, '达人已出发', item.departed_at)
  addMilestone(rows, '已到达集合地点', item.arrival_photo_uploaded_at)
  addMilestone(rows, '服务已开始', item.service_started_at)
  addMilestone(rows, item.completion_longitude != null ? '已提交完成并留存位置' : '已提交服务完成', item.completion_submitted_at)
  addMilestone(
    rows,
    item.auto_confirmed_at ? '系统已自动确认完成' : '用户已确认完成',
    item.auto_confirmed_at || item.customer_confirmed_at,
  )
  const next = {
    pending_acceptance: ['等待达人接单', acceptanceCopy(item)],
    pending_service: ['等待出发', '请根据预约时间合理安排行程'],
    departed: item.arrival_photo_url ? ['等待开始服务', '与用户会合后确认开始'] : ['等待上传集合照', '抵达集合地点后拍照并留存位置'],
    in_service: ['服务进行中', '服务结束后提交完成'],
    pending_confirmation: [
      '等待用户确认',
      item.confirmation_expires_at
        ? `${dateTime(item.confirmation_expires_at)} 前未操作，系统将自动确认`
        : '用户确认后订单进入待评价',
    ],
    pending_review: ['等待用户评价', '履约已经完成'],
    after_sales: ['售后处理中', '请留意平台处理进度'],
    refunded: ['订单已退款', '本单履约流程已结束'],
    cancelled: ['订单已取消', '本单履约流程已结束'],
    completed: ['订单已完成', '本单履约流程已结束'],
    pending_support: ['等待平台处理', '请留意平台客服消息'],
  }[item.status]
  if (item.fulfillment_review_required) rows.push({ label: '履约异常待审核', copy: '自动确认与分账已暂停，由客服核实后恢复。', current: true, danger: true })
  else if (next) rows.push({ label: next[0], copy: next[1], current: true })
  return rows
})

function addMilestone(rows: TimelineItem[], label: string, value: string | null) {
  if (value) rows.push({ label, time: dateTime(value), done: true })
}
function dateTime(value: string | null) {
  return value ? formatBusinessDateTime(value) : ''
}
function timeRange(startsAt: string, endsAt: string) {
  return formatOrderTimeRange(startsAt, endsAt, true)
}
function addressLabel(item: ProviderManagedOrder) {
  return [item.meeting_location_name, item.meeting_address]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join('，') || '地址待确认'
}
function statusLabel(status: string) {
  return {
    pending_acceptance: '等待接单', pending_service: '等待服务', departed: '已出发',
    in_service: '服务中', pending_confirmation: '等待用户确认', pending_review: '等待评价',
    completed: '已完成', cancelled: '已取消', refunded: '已退款', pending_support: '客服处理中',
    after_sales: '售后处理中',
  }[status] || order.value?.status_label || '处理中'
}
function statusTone(status: string) {
  if (['pending_acceptance', 'pending_support', 'after_sales'].includes(status)) return 'orange'
  if (['completed', 'pending_review'].includes(status)) return 'green'
  if (['cancelled', 'refunded'].includes(status)) return 'gray'
  return 'cyan'
}
function isExpired(item: ProviderManagedOrder) {
  return Boolean(item.acceptance_expires_at && new Date(item.acceptance_expires_at).getTime() <= Date.now())
}
function acceptanceCopy(item: ProviderManagedOrder) {
  if (!item.acceptance_expires_at) return '请尽快确认订单'
  const minutes = Math.max(0, Math.ceil((new Date(item.acceptance_expires_at).getTime() - Date.now()) / 60000))
  return minutes ? `剩余约 ${minutes} 分钟确认` : '接单时限已到，请联系客服'
}
function nextStepCopy(item: ProviderManagedOrder) {
  if (item.fulfillment_review_required) return '履约异常待客服审核，自动确认与分账已暂停'
  if (item.status === 'pending_acceptance') return acceptanceCopy(item)
  if (item.status === 'pending_service') return '接受订单后，可查看完整电话与导航位置'
  if (item.status === 'departed' && !item.arrival_photo_url) return '抵达集合地点后，请上传现场照片'
  if (item.status === 'departed') return '集合照已留存，与用户会合后开始服务'
  if (item.status === 'in_service') return '服务结束后提交完成，等待用户确认'
  if (item.status === 'pending_confirmation') return '服务已提交完成，等待用户确认'
  if (item.status === 'pending_support') return '订单已进入平台客服处理流程'
  return item.status_label
}
function actionLabel(item: ProviderManagedOrder) {
  if (item.status === 'pending_acceptance') return '接受订单'
  if (item.status === 'pending_service') return '确认出发'
  if (item.status === 'departed') return item.arrival_photo_url ? '开始服务' : '上传集合照'
  if (item.status === 'in_service') return '提交完成'
  return ''
}
function confirmAction(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({ title, content, success: (result) => resolve(result.confirm), fail: () => resolve(false) })
  })
}
function chooseEvidencePhoto() {
  return new Promise<SelectedPhoto>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: ({ tempFilePaths, tempFiles }) => {
        const file = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
        if (file?.size && file.size > 8 * 1024 * 1024) {
          reject(new Error('集合照大小不能超过8MB。'))
          return
        }
        if (!tempFilePaths[0]) {
          reject(new Error('没有选择照片。'))
          return
        }
        resolve({ path: tempFilePaths[0], file })
      },
      fail: (result) => reject(new Error(result.errMsg.includes('cancel') ? '' : '无法选择照片，请重试。')),
    })
  })
}
async function runUpdate(label: string, task: () => Promise<{ data: ProviderManagedOrder }>) {
  if (busy.value) return false
  busy.value = true
  busyLabel.value = label
  try {
    order.value = (await task()).data
    uni.showToast({ title: '订单进度已更新', icon: 'success' })
    return true
  } catch (reason) {
    const message = getErrorMessage(reason, '操作失败')
    if (message) uni.showToast({ title: message, icon: 'none' })
    return false
  } finally {
    busy.value = false
  }
}
async function acceptOrder() {
  if (!order.value) return
  const confirmed = await confirmAction('确认接受订单', `必须由账号实名认证本人接单并提供服务，禁止代接、转单或由他人替代。确认由本人于 ${timeRange(order.value.starts_at, order.value.ends_at)} 按时提供服务吗？`)
  if (confirmed) await runUpdate('接单中…', () => acceptManagedProviderOrder(orderNo.value))
}
async function departOrder() {
  if (!order.value || busy.value) return
  const confirmed = await confirmOrderDeparture(order.value)
  if (confirmed) await runUpdate('更新中…', () => departManagedProviderOrder(orderNo.value, true))
}
async function uploadEvidence() {
  if (busy.value) return
  busy.value = true
  busyLabel.value = '选择照片…'
  try {
    if (!await confirmAction('上传包含本人的到场照片', '开始服务前必须上传到场照片。照片须清晰包含实名认证本人及到场环境，请勿使用他人照片或仅拍摄场地。')) return
    const selected = await chooseEvidencePhoto()
    busyLabel.value = '定位中…'
    const location = await getCurrentLocation()
    busyLabel.value = '上传中…'
    const uploaded = await uploadManagedOrderEvidence(selected.path, selected.file)
    order.value = (await attachManagedOrderArrivalEvidence(orderNo.value, { photo_id: uploaded.data.id, ...location })).data
    uni.showToast({ title: '集合照已留存', icon: 'success' })
  } catch (reason) {
    const message = getErrorMessage(reason, '上传失败')
    if (message) uni.showToast({ title: message, icon: 'none' })
  } finally {
    busy.value = false
  }
}
async function startOrder() {
  const confirmed = await confirmAction('开始服务', '请确认本人已与用户会合，且已上传清晰包含本人的到场照片。开始后订单将进入服务中。')
  if (confirmed) await runUpdate('开始中…', () => startManagedProviderOrder(orderNo.value))
}
async function completeOrder() {
  const confirmed = await confirmAction('提交服务完成', '将获取并保存当前定位，核对订单时间。时间异常时会暂停自动确认与分账，由客服审核。请确认约定服务已完成。')
  if (confirmed) await runUpdate('定位并提交…', async () => completeManagedProviderOrder(orderNo.value, await getCurrentLocation()))
}
function performPrimaryAction() {
  if (!order.value) return
  if (order.value.status === 'pending_acceptance') return acceptOrder()
  if (order.value.status === 'pending_service') return departOrder()
  if (order.value.status === 'departed' && !order.value.arrival_photo_url) return uploadEvidence()
  if (order.value.status === 'departed') return startOrder()
  if (order.value.status === 'in_service') return completeOrder()
}
function openReject() {
  rejectVisible.value = true
}
function closeReject() {
  if (!busy.value) rejectVisible.value = false
}
async function confirmReject() {
  const updated = await runUpdate('提交中…', () => rejectManagedProviderOrder(orderNo.value))
  if (updated) rejectVisible.value = false
}
async function callCustomer() {
  if (!order.value || phoneIsMasked.value || busy.value) return
  busy.value = true
  try {
    order.value = (await contactOrderCustomer(order.value)).data
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '联系操作未完成，请重试'), icon: 'none' })
  } finally { busy.value = false }
}
function openNavigation() {
  if (!order.value || !canNavigate.value) return
  uni.openLocation({
    longitude: Number(order.value.meeting_longitude),
    latitude: Number(order.value.meeting_latitude),
    name: order.value.meeting_location_name,
    address: order.value.meeting_address,
  })
}
function previewEvidence() {
  if (order.value?.arrival_photo_url) {
    uni.previewImage({ current: order.value.arrival_photo_url, urls: [order.value.arrival_photo_url] })
  }
}
function goBack() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/orders/index' })
}
async function load() {
  if (!orderNo.value) return
  loading.value = true
  error.value = ''
  try {
    order.value = (await getManagedProviderOrder(orderNo.value)).data
  } catch (reason) {
    error.value = getErrorMessage(reason, '订单加载失败')
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  orderNo.value = String(query?.order_no || '')
  if (!guardCurrentPage()) return
  if (!orderNo.value) {
    loading.value = false
    error.value = '缺少订单编号'
    return
  }
  load()
})
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.order-detail-page{min-height:100vh;background:linear-gradient(180deg,#e9fbfb 0,#f7fbfb 350rpx)}.detail-nav{display:flex;align-items:center;justify-content:space-between;height:94rpx}.detail-nav button{width:80rpx;height:80rpx;margin:0;padding:0;border:0;background:transparent;line-height:80rpx}.detail-nav button::after,.detail-card button::after,.action-bar button::after,.reject-dialog button::after{display:none}.detail-nav>button:first-child{text-align:left;font-size:55rpx}.detail-nav .refresh{text-align:right;color:$dz-brand-deep;font-size:38rpx}.detail-nav .strong-text{font-size:31rpx}.detail-content{padding-top:12rpx;padding-bottom:50rpx}.detail-content.has-action{padding-bottom:180rpx}.status-hero{padding:28rpx;border-radius:30rpx;color:#fff;background:linear-gradient(135deg,#20ceca 0,#08a9b1 100%);box-shadow:0 18rpx 38rpx rgba(8,169,177,.2)}.status-line,.hero-main{display:flex;align-items:center;justify-content:space-between}.status-line>text{color:rgba(255,255,255,.72);font-size:17rpx}.status-pill{display:flex;align-items:center;padding:8rpx 14rpx;border-radius:22rpx;background:rgba(255,255,255,.18);font-size:19rpx;font-weight:700}.status-pill i{width:12rpx;height:12rpx;margin-right:8rpx;border-radius:50%;background:#fff}.status-pill.orange i{background:#ffe07a}.status-pill.green i{background:#d2ffd5}.status-pill.gray i{background:#e4ebec}.hero-main{margin-top:26rpx}.hero-main>view:first-child{display:flex;min-width:0;flex-direction:column;gap:8rpx}.hero-main text{color:rgba(255,255,255,.78);font-size:19rpx}.hero-main .strong-text{overflow:hidden;max-width:430rpx;font-size:31rpx;text-overflow:ellipsis;white-space:nowrap}.hero-price{display:flex;flex-direction:column;align-items:flex-end}.hero-price small{color:rgba(255,255,255,.72);font-size:16rpx}.hero-price .strong-text{font-size:36rpx}.hero-tip{display:block;margin-top:26rpx;padding-top:19rpx;border-top:1rpx solid rgba(255,255,255,.22);font-size:19rpx}.support-alert{display:flex;gap:16rpx;margin-top:20rpx;padding:20rpx;border:1rpx solid #ffd8ca;border-radius:22rpx;background:#fff7f2}.alert-icon{display:flex;width:42rpx;height:42rpx;flex:none;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:#ff713e;font-weight:800}.support-alert>view:last-child{display:flex;flex-direction:column;gap:7rpx}.support-alert .strong-text{font-size:21rpx}.support-alert text{color:#875342;font-size:18rpx;line-height:1.5}.detail-card{margin-top:20rpx;padding:24rpx;border:1rpx solid rgba(224,235,236,.8);border-radius:26rpx;background:#fff;box-shadow:$dz-shadow-soft}.detail-card>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10rpx}.detail-card>header .strong-text{font-size:25rpx}.detail-card>header>text{color:$dz-text-secondary;font-size:18rpx}.info-row{display:flex;align-items:center;min-height:100rpx;border-top:1rpx solid $dz-border-subtle}.appointment-card>header+.info-row{border-top:0}.row-icon{display:flex;width:50rpx;height:50rpx;flex:none;align-items:center;justify-content:center;border-radius:16rpx;font-size:18rpx;font-weight:800}.row-icon.cyan{color:#069ba3;background:$dz-brand-soft}.row-icon.orange{color:#f26b35;background:#fff1e8}.row-icon.green{color:#258f58;background:#eaf9ef}.row-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx;margin-left:15rpx}.row-copy small{color:$dz-text-tertiary;font-size:16rpx}.row-copy .strong-text{font-size:20rpx;line-height:1.45}.row-copy>text{color:$dz-text-secondary;font-size:19rpx}.mini-action{width:90rpx;height:54rpx;margin:0 0 0 12rpx;padding:0;border:1rpx solid $dz-brand-primary;border-radius:27rpx;color:$dz-brand-deep;background:#fff;font-size:19rpx;line-height:54rpx}.mini-action[disabled]{border-color:$dz-border;color:$dz-text-tertiary}.privacy-tip{padding:14rpx 16rpx;border-radius:14rpx;color:#816642;background:#fff9e8;font-size:17rpx;line-height:1.5}.note-card{display:flex;flex-direction:column;gap:12rpx}.note-card .strong-text{font-size:25rpx}.note-card text{color:$dz-text-secondary;font-size:20rpx;line-height:1.65}.evidence-card>button{position:relative;overflow:hidden;width:100%;height:260rpx;margin:16rpx 0 0;padding:0;border:0;border-radius:20rpx;background:#eef4f4}.evidence-card image{width:100%;height:100%}.photo-cover{position:absolute;right:0;bottom:0;left:0;padding:35rpx 18rpx 15rpx;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.55));text-align:right}.photo-cover text{font-size:18rpx}.price-card>header,.timeline-card>header{padding-bottom:12rpx}.price-row,.price-total{display:flex;align-items:center;justify-content:space-between;min-height:64rpx;color:$dz-text-secondary;font-size:20rpx}.price-total{margin-top:7rpx;padding-top:15rpx;border-top:1rpx solid $dz-border-subtle;color:$dz-text-primary}.price-total .strong-text:last-child{color:$dz-price-primary;font-size:29rpx}.timeline-row{display:flex;min-height:82rpx}.timeline-track{position:relative;width:36rpx;flex:none}.timeline-track i{position:relative;z-index:1;display:flex;width:26rpx;height:26rpx;align-items:center;justify-content:center;border:4rpx solid #dce8e9;border-radius:50%;color:#fff;background:#fff;font-size:14rpx;font-style:normal}.timeline-track span{position:absolute;top:27rpx;bottom:-1rpx;left:13rpx;width:2rpx;background:#dce8e9}.timeline-row .timeline-copy{display:flex;flex-direction:column;gap:6rpx;padding:1rpx 0 20rpx 12rpx}.timeline-copy .strong-text{color:$dz-text-secondary;font-size:20rpx}.timeline-copy text{color:$dz-text-tertiary;font-size:17rpx}.timeline-row.done .timeline-track i,.timeline-row.current .timeline-track i{border-color:$dz-brand-primary;background:$dz-brand-primary}.timeline-row.done .timeline-copy .strong-text,.timeline-row.current .timeline-copy .strong-text{color:$dz-text-primary}.timeline-row.current .timeline-track i{box-shadow:0 0 0 8rpx $dz-brand-soft}.timeline-row.danger .timeline-track i{border-color:#ff7545;background:#ff7545}.timeline-row.danger .timeline-copy .strong-text{color:#d94d27}.action-bar{position:fixed;z-index:30;right:0;bottom:0;left:0;padding:16rpx 0 calc(16rpx + env(safe-area-inset-bottom));border-top:1rpx solid $dz-border;background:rgba(255,255,255,.96);box-shadow:0 -10rpx 30rpx rgba(25,69,73,.07)}.action-inner{display:flex;gap:16rpx}.action-inner button{height:82rpx;margin:0;padding:0;border-radius:41rpx;font-size:23rpx;font-weight:700;line-height:82rpx}.action-inner .secondary{width:210rpx;border:1rpx solid #ff8b66;color:#de542e;background:#fff}.action-inner .primary{flex:1;border:0;color:#fff;background:$dz-gradient-brand}.action-inner button[disabled]{opacity:.45}.dialog-mask{position:fixed;z-index:80;inset:0;display:flex;align-items:center;justify-content:center;padding:40rpx;background:rgba(15,30,34,.58)}.reject-dialog{width:100%;max-width:640rpx;padding:30rpx;border-radius:30rpx;background:#fff;box-shadow:0 28rpx 70rpx rgba(0,0,0,.2)}.dialog-mark{display:flex;width:58rpx;height:58rpx;align-items:center;justify-content:center;margin-bottom:18rpx;border-radius:18rpx;color:#fff;background:#ff7044;font-size:30rpx;font-weight:800}.reject-dialog>.strong-text{display:block;font-size:29rpx}.reject-dialog>text{display:block;margin-top:12rpx;color:$dz-text-secondary;font-size:19rpx;line-height:1.6}.reason-field{position:relative;margin-top:22rpx;padding:18rpx;border:1rpx solid $dz-border;border-radius:18rpx;background:#f8fbfb}.reason-field textarea{width:100%;height:140rpx;font-size:21rpx;line-height:1.5}.reason-field small{display:block;color:$dz-text-tertiary;font-size:16rpx;text-align:right}.dialog-actions{display:flex;gap:14rpx;margin-top:24rpx}.dialog-actions button{height:72rpx;flex:1;margin:0;padding:0;border:1rpx solid $dz-border;border-radius:36rpx;background:#fff;font-size:21rpx;line-height:72rpx}.dialog-actions .danger-button{border:0;color:#fff;background:#ff7044}.dialog-actions button[disabled]{opacity:.42}

.order-detail-page { background: radial-gradient(circle at 88% 2%, rgba(75,220,215,.17) 0, rgba(75,220,215,0) 330rpx), linear-gradient(180deg,#f2fbfb 0,#f5f9f9 560rpx,#f1f6f6 100%); }
.detail-head { border-bottom: 1rpx solid rgba(213,229,230,.62); background: rgba(249,253,253,.88); }
.detail-content { padding-top: 22rpx; }
.status-hero { position: relative; overflow: hidden; border: 1rpx solid rgba(255,255,255,.36); border-radius: 33rpx; background: linear-gradient(138deg,#22cbc8 0,#079ba8 100%); box-shadow: 0 4rpx 8rpx rgba(8,115,121,.08), 0 24rpx 54rpx rgba(8,136,143,.18); }
.status-hero::after { position: absolute; top: -105rpx; right: -72rpx; width: 260rpx; height: 260rpx; border: 38rpx solid rgba(255,255,255,.08); border-radius: 50%; content: ''; }
.status-hero.orange { background: linear-gradient(138deg,#ff9b5c 0,#ee6941 100%); box-shadow: 0 4rpx 8rpx rgba(170,73,36,.08), 0 24rpx 54rpx rgba(208,90,45,.17); }
.status-hero.green { background: linear-gradient(138deg,#55bd7b 0,#258c5a 100%); box-shadow: 0 4rpx 8rpx rgba(32,108,67,.08), 0 24rpx 54rpx rgba(38,127,79,.16); }
.status-hero.gray { background: linear-gradient(138deg,#7d9092 0,#586b6e 100%); box-shadow: 0 4rpx 8rpx rgba(53,75,78,.08), 0 24rpx 54rpx rgba(47,69,72,.15); }
.status-line, .hero-main, .hero-tip { position: relative; z-index: 1; }
.status-pill { border: 1rpx solid rgba(255,255,255,.17); background: rgba(255,255,255,.19); }
.detail-card { border-color: rgba(215,227,228,.92); border-radius: 30rpx; box-shadow: 0 2rpx 2rpx rgba(23,57,61,.02), 0 15rpx 40rpx rgba(28,72,76,.07); }
.support-alert { border-radius: 25rpx; box-shadow: 0 10rpx 28rpx rgba(137,68,38,.06); }
.row-icon { border-radius: 17rpx; box-shadow: inset 0 0 0 1rpx rgba(20,80,85,.04); }
.mini-action { border-color: rgba(17,193,196,.22); background: $dz-brand-pale; font-weight: 650; }
.action-bar { border-top-color: rgba(209,225,226,.72); background: rgba(249,253,253,.9); box-shadow: 0 -16rpx 42rpx rgba(24,66,70,.09); }
.action-inner .secondary { border-color: rgba(225,83,50,.28); background: rgba(255,255,255,.88); }
.action-inner .primary { box-shadow: 0 10rpx 25rpx rgba(8,143,150,.2); }
.dialog-mask { align-items: flex-end; padding: 0; background: rgba(15,30,34,.48); }
.reject-dialog { max-width: 750rpx; padding: 24rpx 30rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; box-shadow: 0 -20rpx 65rpx rgba(0,0,0,.18); }
.reject-dialog::before { display: block; width: 72rpx; height: 8rpx; margin: 0 auto 25rpx; border-radius: 999rpx; background: #dce5e6; content: ''; }
.dialog-mark { border-radius: 50%; box-shadow: 0 8rpx 20rpx rgba(232,83,42,.18); }
.dialog-actions button { border-radius: 999rpx; }
.order-detail-page { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif; }
.detail-nav .strong-text { font-size: 32rpx; line-height: 1.15; }
.status-pill { font-size: 20rpx; line-height: 1.2; }
.hero-main .strong-text { font-size: 32rpx; line-height: 1.2; }
.hero-price .strong-text { font-size: 38rpx; line-height: 1; font-variant-numeric: tabular-nums; }
.hero-tip { font-size: 20rpx; line-height: 1.45; }
.detail-card>header .strong-text { font-size: 26rpx; line-height: 1.2; }
.row-copy .strong-text { font-size: 21rpx; line-height: 1.4; }
.row-copy>text { font-size: 20rpx; line-height: 1.4; }
.mini-action { font-size: 20rpx; font-weight: 650; }
.price-row, .price-total { font-size: 21rpx; }
.price-total .strong-text:last-child { font-size: 30rpx; font-variant-numeric: tabular-nums; }
.timeline-copy .strong-text { font-size: 21rpx; }
.timeline-copy text { font-size: 18rpx; line-height: 1.45; }
.action-inner button { font-size: 24rpx; }
.reject-dialog>.strong-text { font-size: 30rpx; line-height: 1.2; }
.reject-dialog>text { font-size: 20rpx; line-height: 1.6; }
.dialog-actions button { font-size: 22rpx; }
.appointment-card { padding: 22rpx 24rpx 18rpx; }
.appointment-card>header { min-height: 52rpx; margin-bottom: 2rpx; }
.appointment-card>header .strong-text { font-size: 27rpx; font-weight: 720; letter-spacing: -.018em; }
.duration-pill { padding: 7rpx 12rpx; border-radius: 999rpx; color: $dz-brand-deep!important; background: $dz-brand-pale; font-size: 17rpx!important; font-weight: 650; line-height: 1.2; }
.appointment-card .info-row { min-height: 112rpx; }
.appointment-card .row-icon { width: 54rpx; height: 54rpx; border-radius: 18rpx; font-size: 18rpx; }
.appointment-card .row-copy { gap: 7rpx; margin-left: 17rpx; }
.row-label { color: $dz-text-tertiary; font-size: 17rpx; font-weight: 560; letter-spacing: .025em; line-height: 1.2; }
.appointment-card .row-value { color: $dz-text-primary; font-size: 23rpx; font-weight: 680; line-height: 1.38; letter-spacing: -.006em; }
.appointment-card .time-value { color: $dz-brand-deep; font-size: 24rpx; font-variant-numeric: tabular-nums; letter-spacing: -.012em; }
.appointment-card .address-value { max-width: 430rpx; }
.phone-value { color: $dz-text-secondary; font-size: 20rpx; line-height: 1.2; font-variant-numeric: tabular-nums; letter-spacing: .025em; }
.appointment-card .mini-action { width: 94rpx; height: 58rpx; border-radius: 999rpx; font-size: 19rpx; line-height: 58rpx; }

/* #ifdef H5 */
.detail-head, .action-bar {
  -webkit-backdrop-filter: saturate(160%) blur(16px);
  backdrop-filter: saturate(160%) blur(16px);
}
@media (prefers-reduced-transparency: reduce) {
  .detail-head, .action-bar { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
/* #endif */
</style>
