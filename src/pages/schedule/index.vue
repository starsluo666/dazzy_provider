<template>
  <view class="dz-page dz-management-page schedule-page">
    <view class="dz-safe-top" />
    <header class="nav dz-management-head dz-container">
      <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="goBack">‹</button><strong class="strong-text">档期管理</strong><button class="rule dz-tappable" hover-class="dz-pressed" @tap="showRule">规则</button>
    </header>
    <main>
      <section class="week-head dz-container">
        <view class="week-title">
          <button @tap="moveWeek(-7)">‹</button><strong class="strong-text">{{ rangeLabel }}</strong><button @tap="moveWeek(7)">›</button>
          <button class="current" @tap="resetWeek">本周</button>
        </view>
        <view class="days">
          <button v-for="(day, index) in days" :key="day.date" class="dz-tappable" hover-class="dz-pressed" :class="{ active: index === selected }" @tap="selected = index">
            <text>{{ weekdays[index] }}</text><strong class="strong-text">{{ dayNumber(day.date) }}</strong>
          </button>
        </view>
        <view class="legend"><text><i class="available" />可预约</text><text><i class="booked" />已预约</text><text><i />休息</text></view>
      </section>

      <section class="content dz-container">
        <NetworkState v-if="loading" message="正在加载档期…" />
        <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
        <template v-else-if="currentDay">
          <header class="day-head">
            <view><strong class="strong-text">{{ dayTitle }}</strong><text>{{ daySummary }}</text></view>
            <button class="dz-tappable" hover-class="dz-pressed" :disabled="!canManageDay || daySaving" @tap="toggleClosed">
              {{ currentDay.is_closed ? '恢复接单' : '设为休息' }}
            </button>
          </header>
          <view v-if="currentDay.is_closed" class="closed">当天已设为休息，用户无法发起新预约</view>
          <view v-else-if="!displayPeriods.length" class="empty">当天还没有可预约时段</view>
          <article
            v-for="period in displayPeriods"
            :key="period.id || `${period.starts_at}-${period.ends_at}`"
            :class="['period', period.status]"
          >
            <view>
              <strong class="strong-text">{{ clock(period.starts_at) }}–{{ clock(period.ends_at) }}</strong>
              <text>{{ period.status === 'booked' ? '已预约 · 时间已锁定' : period.source === 'weekly' ? '可预约 · 每周重复' : '可预约 · 仅当天' }}</text>
            </view>
            <button v-if="period.status === 'available' && period.id" class="dz-tappable" hover-class="dz-pressed" aria-label="删除该时间段" @tap="remove(period.id)">×</button><text v-else class="period-status">已锁定</text>
          </article>
          <section class="template"><image src="/static/icons/refresh.svg" mode="aspectFit" /><view><strong class="strong-text">每周重复</strong><text>{{ weeklySummary }}</text></view></section>
        </template>
      </section>
    </main>

    <view class="schedule-footer">
      <button class="schedule-add-button dz-tappable" hover-class="dz-pressed" :disabled="!canManageDay" @tap="openSheet">添加时间段</button>
    </view>

    <DzBottomSheet :visible="sheet" title="添加可预约时间" subtitle="设置用户可以预约你的时间" @close="sheet = false">
      <view class="sheet-fields">
        <view class="date-row"><image src="/static/icons/calendar.svg" mode="aspectFit" /><strong class="strong-text">{{ dayTitle }}</strong></view>
        <view class="time-row">
          <picker mode="time" :value="form.starts_at" @change="pickStart"><view><text>开始时间</text><strong class="strong-text">{{ form.starts_at }}</strong></view></picker>
          <b>→</b>
          <picker mode="time" :value="form.ends_at" @change="pickEnd"><view><text>结束时间</text><strong class="strong-text">{{ form.ends_at }}</strong></view></picker>
        </view>
        <view class="switch-row"><view><strong class="strong-text">每周重复</strong><text>同步到之后每个周{{ weekdays[selected] }}</text></view><switch :checked="form.repeat_weekly" color="#18c7c6" @change="changeRepeat" /></view>
        <view v-if="form.repeat_weekly" class="copy">
          <strong class="strong-text">同时复制到其他星期</strong>
          <view><button v-for="item in copyOptions" :key="item.value" class="dz-tappable" hover-class="dz-pressed" :class="{ active: form.copy_weekdays.includes(item.value) }" @tap="toggleCopy(item.value)">{{ item.label }}</button></view>
        </view>
        <view class="notice"><i />重叠时段不会重复创建，已有预约始终保持锁定</view>
        <button class="confirm dz-tappable" :class="{ 'confirm-disabled': saving }" hover-class="dz-pressed" :disabled="saving" @tap="save">{{ saving ? '添加中…' : '确认添加' }}</button>
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
  addProviderSchedulePeriod,
  deleteProviderSchedulePeriod,
  getProviderSchedule,
  setProviderScheduleDayClosed,
} from '@/services/providers'
import { guardCurrentPage } from '@/services/session'
import type { ProviderScheduleDay } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'
import { businessDateKey, businessDateKeyParts, shiftBusinessDateKey } from '@/utils/businessTime'

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const start = ref(monday(businessDateKey()))
const days = ref<ProviderScheduleDay[]>([])
const selected = ref((businessDateKeyParts(businessDateKey()).weekday + 6) % 7)
const loading = ref(true)
const error = ref('')
const sheet = ref(false)
const saving = ref(false)
const daySaving = ref(false)
const form = reactive({ starts_at: '09:00', ends_at: '12:00', repeat_weekly: true, copy_weekdays: [] as number[] })

function monday(value: string) {
  return shiftBusinessDateKey(value, -((businessDateKeyParts(value).weekday + 6) % 7))
}

const currentDay = computed(() => days.value[selected.value])
const displayPeriods = computed(() => currentDay.value?.is_closed
  ? currentDay.value.periods.filter((item) => item.status === 'booked')
  : currentDay.value?.periods || [])
const canManageDay = computed(() => Boolean(currentDay.value && currentDay.value.date >= businessDateKey()))
const copyOptions = computed(() => weekdays
  .map((label, value) => ({ label: `周${label}`, value }))
  .filter((item) => item.value !== selected.value))
const rangeLabel = computed(() => {
  const startParts = businessDateKeyParts(start.value)
  const endParts = businessDateKeyParts(shiftBusinessDateKey(start.value, 6))
  return `${startParts.month}月${startParts.day}日–${endParts.month}月${endParts.day}日`
})
const dayTitle = computed(() => currentDay.value
  ? `${businessDateKeyParts(currentDay.value.date).month}月${businessDateKeyParts(currentDay.value.date).day}日 周${weekdays[selected.value]}`
  : '')
const weeklySummary = computed(() => {
  const periods = currentDay.value?.periods.filter((item) => item.source === 'weekly' && item.status === 'available') || []
  return periods.length
    ? periods.map((item) => `${clock(item.starts_at)}–${clock(item.ends_at)}`).join('、')
    : '暂无每周模板'
})
const daySummary = computed(() => {
  if (!currentDay.value) return ''
  if (currentDay.value.is_closed) return '今天休息'
  const available = displayPeriods.value.filter((item) => item.status === 'available').length
  const booked = displayPeriods.value.filter((item) => item.status === 'booked').length
  if (!available && !booked) return '暂无可预约时间'
  return `${available} 个可预约${booked ? ` · ${booked} 个已预约` : ''}`
})

function dayNumber(value: string) { return businessDateKeyParts(value).day }
function clock(value: string) { return value.slice(0, 5) }
function goBack() { uni.navigateBack() }
function showRule() { uni.showToast({ title: '已预约时段不可修改；重叠时段不可重复添加', icon: 'none' }) }

function moveWeek(offset: number) {
  start.value = shiftBusinessDateKey(start.value, offset)
  selected.value = 0
  load()
}

function resetWeek() {
  start.value = monday(businessDateKey())
  selected.value = (businessDateKeyParts(businessDateKey()).weekday + 6) % 7
  load()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    days.value = (await getProviderSchedule(start.value)).data.days
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function toggleClosed() {
  if (!currentDay.value || !canManageDay.value || daySaving.value) return
  daySaving.value = true
  try {
    await setProviderScheduleDayClosed(currentDay.value.date, !currentDay.value.is_closed)
    await load()
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '档期更新失败'), icon: 'none' })
  } finally {
    daySaving.value = false
  }
}

function openSheet() {
  if (!currentDay.value || !canManageDay.value) {
    uni.showToast({ title: '不能修改过去日期的档期', icon: 'none' })
    return
  }
  form.copy_weekdays = []
  sheet.value = true
}

function pickStart(event: Event) { form.starts_at = (event as CustomEvent<{ value: string }>).detail.value }
function pickEnd(event: Event) { form.ends_at = (event as CustomEvent<{ value: string }>).detail.value }
function changeRepeat(event: Event) {
  form.repeat_weekly = Boolean((event as CustomEvent<{ value: boolean }>).detail.value)
  if (!form.repeat_weekly) form.copy_weekdays = []
}
function toggleCopy(value: number) {
  const index = form.copy_weekdays.indexOf(value)
  if (index >= 0) form.copy_weekdays.splice(index, 1)
  else form.copy_weekdays.push(value)
}

async function save() {
  if (!currentDay.value || saving.value) return
  if (form.starts_at >= form.ends_at) {
    uni.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await addProviderSchedulePeriod({ date: currentDay.value.date, ...form })
    sheet.value = false
    await load()
    uni.showToast({ title: '档期已保存', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '档期保存失败'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

function remove(id: string) {
  uni.showModal({
    title: '删除可预约时段',
    content: id.startsWith('weekly-') ? '每周时段删除后，后续同星期也会同步移除。' : '确定删除当天的这个可预约时段吗？',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await deleteProviderSchedulePeriod(id)
        await load()
      } catch (reason) {
        uni.showToast({ title: getErrorMessage(reason, '删除失败'), icon: 'none' })
      }
    },
  })
}

onLoad(() => { if (guardCurrentPage()) load() })
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.schedule-page{min-height:100vh;padding-bottom:130rpx;background:#fff}.nav{display:flex;align-items:center;justify-content:space-between;height:90rpx}.nav button{width:70rpx;margin:0;padding:0;border:0;background:transparent}.nav button::after,.week-title button::after,.days button::after,.day-head button::after,.period button::after,.confirm::after,.copy button::after,footer button::after{display:none}.nav>button:first-child{text-align:left;font-size:55rpx}.nav .strong-text{font-size:31rpx}.nav .rule{color:$dz-brand-deep;font-size:22rpx}.week-head{border-bottom:1rpx solid $dz-border-subtle}.week-title{display:flex;align-items:center;justify-content:center;gap:15rpx}.week-title button{width:48rpx;margin:0;padding:0;background:transparent}.week-title .strong-text{font-size:25rpx}.week-title .current{width:82rpx;height:47rpx;margin-left:12rpx;border:1rpx solid $dz-brand-primary;border-radius:24rpx;color:$dz-brand-deep;font-size:19rpx;line-height:47rpx}.days{display:grid;grid-template-columns:repeat(7,1fr);margin-top:18rpx}.days button{display:flex;flex-direction:column;align-items:center;height:94rpx;margin:0;padding:8rpx 0;border-radius:17rpx;background:#fff;line-height:1.4}.days text{font-size:18rpx}.days .strong-text{font-size:24rpx}.days button.active{color:#fff;background:$dz-gradient-brand}.legend{display:flex;gap:38rpx;padding:22rpx 5rpx}.legend text{display:flex;align-items:center;color:$dz-text-secondary;font-size:18rpx}.legend i{width:14rpx;height:14rpx;margin-right:8rpx;border-radius:50%;background:#d7ddde}.legend i.available{background:$dz-brand-primary}.legend i.booked{background:#ff742f}.content{padding-top:22rpx}.day-head{display:flex;align-items:center;justify-content:space-between}.day-head .strong-text{font-size:27rpx}.day-head button{margin:0;padding:0;background:transparent;color:$dz-brand-deep;font-size:21rpx}.day-head button[disabled]{color:$dz-text-tertiary}.period{display:flex;align-items:center;margin-top:15rpx;padding:21rpx;border:1rpx solid $dz-border-subtle;border-left:5rpx solid $dz-brand-primary;border-radius:17rpx}.period.booked{border-left-color:#ff742f;background:#fff8f3}.period>view{display:flex;flex:1;flex-direction:column;gap:7rpx}.period .strong-text{color:$dz-brand-deep;font-size:27rpx}.period.booked .strong-text{color:#ff642d}.period text{color:$dz-text-secondary;font-size:19rpx}.period button,.period>i{width:50rpx;height:50rpx;margin:0;border:1rpx solid $dz-border-subtle;border-radius:13rpx;background:#fff;color:$dz-brand-deep;font-size:28rpx;font-style:normal;line-height:50rpx}.template{display:flex;align-items:center;margin-top:25rpx;padding:20rpx;border:1rpx solid $dz-border-subtle;border-radius:17rpx}.template>i{color:$dz-brand-primary;font-size:35rpx;font-style:normal}.template>view{display:flex;flex-direction:column;gap:6rpx;margin-left:15rpx}.template .strong-text{font-size:21rpx}.template text{color:$dz-text-secondary;font-size:18rpx}.empty,.closed{margin-top:18rpx;padding:48rpx 20rpx;border-radius:17rpx;color:$dz-text-secondary;background:$dz-surface-page;text-align:center;font-size:21rpx}footer{position:fixed;z-index:20;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:15rpx 28rpx calc(15rpx + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -5rpx 20rpx rgba(30,60,68,.08)}footer button,.confirm{height:78rpx;margin:0;border:0;border-radius:18rpx;color:#fff;background:$dz-gradient-brand;font-size:26rpx;font-weight:700;line-height:78rpx}footer button[disabled]{opacity:.42}.date-row{margin-top:20rpx;font-size:21rpx}.time-row{display:grid;grid-template-columns:1fr 35rpx 1fr;align-items:center;margin-top:18rpx}.time-row picker view{display:flex;flex-direction:column;align-items:center;gap:8rpx;padding:17rpx;border:1rpx solid $dz-border-subtle;border-radius:16rpx}.time-row text{color:$dz-text-secondary;font-size:18rpx}.time-row .strong-text{font-size:31rpx}.time-row b{text-align:center}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-top:18rpx;padding:18rpx 0;border-top:1rpx solid $dz-border-subtle;border-bottom:1rpx solid $dz-border-subtle}.switch-row>view{display:flex;flex-direction:column;gap:6rpx}.switch-row .strong-text,.copy>.strong-text{font-size:21rpx}.switch-row text{color:$dz-text-secondary;font-size:17rpx}.copy{padding:18rpx 0}.copy>view{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx}.copy button{height:48rpx;margin:0;padding:0 25rpx;border:1rpx solid $dz-border-subtle;border-radius:24rpx;background:#fff;font-size:18rpx;line-height:48rpx}.copy button.active{border-color:$dz-brand-primary;background:$dz-brand-soft}.notice{padding:13rpx;border-radius:12rpx;color:#e96729;background:#fff5eb;font-size:18rpx}.confirm{width:100%;margin-top:15rpx}

/* 当前基线精修：减少卡片套卡片，以材质、间距和状态色建立层级。 */
.schedule-page{background:linear-gradient(180deg,#f9fcfc 0,#f3f7f7 100%)}
.nav{background:$dz-surface-glass-strong}.nav .strong-text{letter-spacing:-.015em}.week-head{padding-top:8rpx;background:rgba(255,255,255,.72)}
.days button{border-radius:21rpx;background:transparent;transition:transform $dz-duration-fast $dz-ease-out,background-color $dz-duration-fast ease}.days button.active{background:$dz-brand;box-shadow:$dz-shadow-control}.days button:active{transform:scale(.95)}
.content{padding-top:26rpx}.day-head .strong-text{letter-spacing:-.01em}
.period{min-height:112rpx;padding:22rpx;border:1rpx solid rgba(218,229,230,.95);border-left-width:1rpx;border-radius:22rpx;background:rgba(255,255,255,.97);box-shadow:$dz-shadow-soft}.period.booked{border-color:#ffdccc;background:#fff9f5}.period .strong-text{font-size:28rpx;letter-spacing:-.015em}.period button{width:54rpx;height:54rpx;border:0;border-radius:18rpx;background:$dz-brand-pale;line-height:54rpx}.period-status{display:flex;min-width:88rpx;height:44rpx;align-items:center;justify-content:center;border-radius:22rpx;color:#c35428!important;background:#fff0e7;font-size:17rpx!important;font-weight:650}
.template{margin-top:26rpx;padding:22rpx 4rpx;border:0;border-top:1rpx solid $dz-border-subtle;border-radius:0}.template>image{width:38rpx;height:38rpx;opacity:.8}.template>view{margin-left:16rpx}
footer{padding:16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom));background:$dz-surface-glass-strong;box-shadow:0 -12rpx 38rpx rgba(24,55,58,.09)}footer button,.confirm{height:78rpx;border-radius:$dz-radius-control;background:$dz-brand;box-shadow:$dz-shadow-control;line-height:78rpx}footer button[disabled]{box-shadow:none}
.date-row{display:flex;align-items:center}.date-row image{width:34rpx;height:34rpx;margin-right:11rpx}.time-row picker view{border-radius:20rpx;background:#f8fafa}.copy button{border-radius:18rpx}.notice{display:flex;align-items:flex-start;line-height:1.5}.notice>i{width:12rpx;height:12rpx;flex:none;margin:7rpx 10rpx 0 0;border-radius:50%;background:$dz-orange}
/* #ifdef H5 */
.nav,.week-head,footer{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
/* #endif */

/* 管理页统一规格：扩大阅读与触控尺度，减少横条分割。 */
.schedule-page{padding-bottom:150rpx;background:linear-gradient(180deg,#edfafa 0,#f5f9f9 330rpx,#f2f6f6 100%)}
.nav{position:sticky;z-index:32;top:0;height:100rpx;background:rgba(247,252,252,.94)}.nav button{width:88rpx;height:80rpx;line-height:80rpx}.nav>button:first-child{font-size:54rpx;line-height:76rpx}.nav>.strong-text{font-size:34rpx}.nav .rule{font-size:24rpx;font-weight:650;text-align:right}
.week-head{width:auto;margin:12rpx 30rpx 0;padding:22rpx 20rpx 18rpx;border:1rpx solid rgba(255,255,255,.94);border-radius:28rpx;background:rgba(255,255,255,.91);box-shadow:$dz-shadow-soft}.week-title{gap:8rpx}.week-title button{width:68rpx;height:68rpx;border:0;font-size:32rpx;line-height:68rpx}.week-title .strong-text{font-size:28rpx;font-variant-numeric:tabular-nums}.week-title .current{width:92rpx;height:58rpx;margin-left:8rpx;border-color:#b6dddd;border-radius:19rpx;font-size:22rpx;line-height:58rpx}
.days{gap:5rpx;margin-top:20rpx}.days button{height:108rpx;padding:13rpx 0;border-radius:22rpx;line-height:1.35}.days text{font-size:21rpx}.days .strong-text{margin-top:3rpx;font-size:28rpx;font-variant-numeric:tabular-nums}.days button.active{background:$dz-brand;box-shadow:$dz-shadow-control}
.legend{justify-content:center;gap:28rpx;padding:22rpx 0 2rpx}.legend text{font-size:21rpx}.legend i{width:15rpx;height:15rpx;margin-right:9rpx}
.content{padding-top:30rpx}.day-head>view{display:flex;gap:7rpx;flex-direction:column}.day-head .strong-text{font-size:31rpx}.day-head>view>text{color:$dz-text-secondary;font-size:22rpx}.day-head>button{min-width:104rpx;height:64rpx;padding:0 20rpx;border:0;border-radius:20rpx;background:#f1f6f6;font-size:23rpx;line-height:64rpx}
.period{min-height:128rpx;margin-top:18rpx;padding:24rpx 25rpx;border-radius:26rpx}.period>view{gap:9rpx}.period .strong-text{font-size:32rpx;font-variant-numeric:tabular-nums}.period text{font-size:22rpx;line-height:1.45}.period button{width:68rpx;height:68rpx;border-radius:21rpx;font-size:32rpx;line-height:68rpx}.period-status{min-width:96rpx;height:54rpx;border-radius:17rpx;font-size:20rpx!important}
.template{margin-top:24rpx;padding:24rpx 6rpx}.template>image{width:44rpx;height:44rpx}.template>view{gap:8rpx;margin-left:18rpx}.template .strong-text{font-size:25rpx}.template text{font-size:21rpx}.empty,.closed{margin-top:20rpx;padding:58rpx 24rpx;border-radius:26rpx;background:rgba(255,255,255,.76);font-size:24rpx;line-height:1.6}
footer{padding:18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));background:rgba(250,253,253,.96)}footer button,.confirm{width:100%;height:88rpx;border-radius:24rpx;background:$dz-brand;font-size:27rpx;line-height:88rpx}
/* 弹层由 DzBottomSheet 承载（拖拽收起/进出场动画），这里只保留表单字段规格。 */
.sheet-fields{display:block}
.date-row{margin-top:6rpx;font-size:24rpx}.date-row image{width:38rpx;height:38rpx;margin-right:12rpx}.time-row{grid-template-columns:1fr 42rpx 1fr;margin-top:20rpx}.time-row picker view{min-height:112rpx;justify-content:center;gap:10rpx;padding:18rpx;border-radius:22rpx}.time-row text{font-size:21rpx}.time-row .strong-text{font-size:36rpx;font-variant-numeric:tabular-nums}.time-row b{font-size:26rpx}.switch-row{min-height:102rpx;margin-top:20rpx;padding:18rpx 0}.switch-row>view{gap:8rpx}.switch-row .strong-text,.copy>.strong-text{font-size:25rpx}.switch-row text{font-size:21rpx}.copy{padding:22rpx 0}.copy>view{display:grid;gap:10rpx;margin-top:16rpx;grid-template-columns:repeat(3,1fr)}.copy button{width:100%;height:66rpx;padding:0;border-radius:19rpx;font-size:22rpx;line-height:66rpx}.notice{padding:17rpx 18rpx;border-radius:18rpx;font-size:21rpx;line-height:1.55}.notice>i{margin-top:9rpx}.confirm{margin-top:20rpx}.confirm-disabled{box-shadow:none;opacity:.45}

/* 使用纯 class 选择器，避免 footer 在小程序端被编译为 view 后丢失底栏样式。 */
.schedule-footer{
  position:fixed;
  z-index:20;
  right:0;
  bottom:0;
  left:0;
  box-sizing:border-box;
  width:100%;
  max-width:750px;
  margin:0 auto;
  padding:18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));
  background:rgba(250,253,253,.96);
  box-shadow:0 -12rpx 38rpx rgba(24,55,58,.09);
}
.schedule-add-button{
  display:flex;
  width:100%;
  height:88rpx;
  align-items:center;
  justify-content:center;
  box-sizing:border-box;
  margin:0;
  padding:0;
  border:0;
  border-radius:24rpx;
  color:#fff;
  background:$dz-brand;
  box-shadow:$dz-shadow-control;
  font-size:27rpx;
  font-weight:700;
  line-height:1;
}
.schedule-add-button::after{display:none}
.schedule-add-button[disabled]{box-shadow:none;opacity:.42}
/* #ifdef H5 */
.schedule-footer{-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
/* #endif */
</style>
