<template>
  <view class="dz-page schedule-page">
    <view class="dz-safe-top" />
    <header class="nav dz-container">
      <button @tap="goBack">‹</button><strong class="strong-text">档期管理</strong><button class="rule" @tap="showRule">规则</button>
    </header>
    <main>
      <section class="week-head dz-container">
        <view class="week-title">
          <button @tap="moveWeek(-7)">‹</button><strong class="strong-text">{{ rangeLabel }}</strong><button @tap="moveWeek(7)">›</button>
          <button class="current" @tap="resetWeek">本周</button>
        </view>
        <view class="days">
          <button v-for="(day, index) in days" :key="day.date" :class="{ active: index === selected }" @tap="selected = index">
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
            <strong class="strong-text">{{ dayTitle }}</strong>
            <button :disabled="!canManageDay || daySaving" @tap="toggleClosed">
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
            <button v-if="period.status === 'available' && period.id" @tap="remove(period.id)">×</button><i v-else>▣</i>
          </article>
          <section class="template"><i>↻</i><view><strong class="strong-text">每周重复</strong><text>{{ weeklySummary }}</text></view></section>
        </template>
      </section>
    </main>

    <footer><button :disabled="!canManageDay" @tap="openSheet">＋ 添加时间段</button></footer>

    <view v-if="sheet" class="mask" @tap.self="sheet = false">
      <section class="sheet">
        <i /><header><strong class="strong-text">添加可预约时间</strong><button @tap="sheet = false">×</button></header>
        <view class="date-row">▣ <strong class="strong-text">{{ dayTitle }}</strong></view>
        <view class="time-row">
          <picker mode="time" :value="form.starts_at" @change="pickStart"><view><text>开始时间</text><strong class="strong-text">{{ form.starts_at }}</strong></view></picker>
          <b>→</b>
          <picker mode="time" :value="form.ends_at" @change="pickEnd"><view><text>结束时间</text><strong class="strong-text">{{ form.ends_at }}</strong></view></picker>
        </view>
        <view class="switch-row"><view><strong class="strong-text">每周重复</strong><text>同步到之后每个周{{ weekdays[selected] }}</text></view><switch :checked="form.repeat_weekly" color="#18c7c6" @change="changeRepeat" /></view>
        <view v-if="form.repeat_weekly" class="copy">
          <strong class="strong-text">同时复制到其他星期</strong>
          <view><button v-for="item in copyOptions" :key="item.value" :class="{ active: form.copy_weekdays.includes(item.value) }" @tap="toggleCopy(item.value)">{{ item.label }}</button></view>
        </view>
        <view class="notice">● 重叠时段不会重复创建，已有预约始终保持锁定</view>
        <button class="confirm" :disabled="saving" @tap="save">{{ saving ? '添加中…' : '确认添加' }}</button>
      </section>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'

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

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const start = ref(monday(new Date()))
const days = ref<ProviderScheduleDay[]>([])
const selected = ref(Math.min(6, Math.max(0, (new Date().getDay() + 6) % 7)))
const loading = ref(true)
const error = ref('')
const sheet = ref(false)
const saving = ref(false)
const daySaving = ref(false)
const form = reactive({ starts_at: '09:00', ends_at: '12:00', repeat_weekly: true, copy_weekdays: [] as number[] })

function monday(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const currentDay = computed(() => days.value[selected.value])
const displayPeriods = computed(() => currentDay.value?.is_closed
  ? currentDay.value.periods.filter((item) => item.status === 'booked')
  : currentDay.value?.periods || [])
const canManageDay = computed(() => Boolean(currentDay.value && currentDay.value.date >= iso(new Date())))
const copyOptions = computed(() => weekdays
  .map((label, value) => ({ label: `周${label}`, value }))
  .filter((item) => item.value !== selected.value))
const rangeLabel = computed(() => {
  const end = new Date(start.value)
  end.setDate(end.getDate() + 6)
  return `${start.value.getMonth() + 1}月${start.value.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`
})
const dayTitle = computed(() => currentDay.value
  ? `${new Date(`${currentDay.value.date}T00:00:00`).getMonth() + 1}月${dayNumber(currentDay.value.date)}日 周${weekdays[selected.value]}`
  : '')
const weeklySummary = computed(() => {
  const periods = currentDay.value?.periods.filter((item) => item.source === 'weekly' && item.status === 'available') || []
  return periods.length
    ? periods.map((item) => `${clock(item.starts_at)}–${clock(item.ends_at)}`).join('、')
    : '暂无每周模板'
})

function dayNumber(value: string) { return new Date(`${value}T00:00:00`).getDate() }
function clock(value: string) { return value.slice(0, 5) }
function goBack() { uni.navigateBack() }
function showRule() { uni.showToast({ title: '已预约时段不可修改；重叠时段不可重复添加', icon: 'none' }) }

function moveWeek(offset: number) {
  const date = new Date(start.value)
  date.setDate(date.getDate() + offset)
  start.value = date
  selected.value = 0
  load()
}

function resetWeek() {
  start.value = monday(new Date())
  selected.value = (new Date().getDay() + 6) % 7
  load()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    days.value = (await getProviderSchedule(iso(start.value))).data.days
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
.schedule-page{min-height:100vh;padding-bottom:130rpx;background:#fff}.nav{display:flex;align-items:center;justify-content:space-between;height:90rpx}.nav button{width:70rpx;margin:0;padding:0;border:0;background:transparent}.nav button::after,.week-title button::after,.days button::after,.day-head button::after,.period button::after,.sheet button::after,footer button::after{display:none}.nav>button:first-child{text-align:left;font-size:55rpx}.nav .strong-text{font-size:31rpx}.nav .rule{color:$dz-brand-deep;font-size:22rpx}.week-head{border-bottom:1rpx solid $dz-border-subtle}.week-title{display:flex;align-items:center;justify-content:center;gap:15rpx}.week-title button{width:48rpx;margin:0;padding:0;background:transparent}.week-title .strong-text{font-size:25rpx}.week-title .current{width:82rpx;height:47rpx;margin-left:12rpx;border:1rpx solid $dz-brand-primary;border-radius:24rpx;color:$dz-brand-deep;font-size:19rpx;line-height:47rpx}.days{display:grid;grid-template-columns:repeat(7,1fr);margin-top:18rpx}.days button{display:flex;flex-direction:column;align-items:center;height:94rpx;margin:0;padding:8rpx 0;border-radius:17rpx;background:#fff;line-height:1.4}.days text{font-size:18rpx}.days .strong-text{font-size:24rpx}.days button.active{color:#fff;background:$dz-gradient-brand}.legend{display:flex;gap:38rpx;padding:22rpx 5rpx}.legend text{display:flex;align-items:center;color:$dz-text-secondary;font-size:18rpx}.legend i{width:14rpx;height:14rpx;margin-right:8rpx;border-radius:50%;background:#d7ddde}.legend i.available{background:$dz-brand-primary}.legend i.booked{background:#ff742f}.content{padding-top:22rpx}.day-head{display:flex;align-items:center;justify-content:space-between}.day-head .strong-text{font-size:27rpx}.day-head button{margin:0;padding:0;background:transparent;color:$dz-brand-deep;font-size:21rpx}.day-head button[disabled]{color:$dz-text-tertiary}.period{display:flex;align-items:center;margin-top:15rpx;padding:21rpx;border:1rpx solid $dz-border-subtle;border-left:5rpx solid $dz-brand-primary;border-radius:17rpx}.period.booked{border-left-color:#ff742f;background:#fff8f3}.period>view{display:flex;flex:1;flex-direction:column;gap:7rpx}.period .strong-text{color:$dz-brand-deep;font-size:27rpx}.period.booked .strong-text{color:#ff642d}.period text{color:$dz-text-secondary;font-size:19rpx}.period button,.period>i{width:50rpx;height:50rpx;margin:0;border:1rpx solid $dz-border-subtle;border-radius:13rpx;background:#fff;color:$dz-brand-deep;font-size:28rpx;font-style:normal;line-height:50rpx}.template{display:flex;align-items:center;margin-top:25rpx;padding:20rpx;border:1rpx solid $dz-border-subtle;border-radius:17rpx}.template>i{color:$dz-brand-primary;font-size:35rpx;font-style:normal}.template>view{display:flex;flex-direction:column;gap:6rpx;margin-left:15rpx}.template .strong-text{font-size:21rpx}.template text{color:$dz-text-secondary;font-size:18rpx}.empty,.closed{margin-top:18rpx;padding:48rpx 20rpx;border-radius:17rpx;color:$dz-text-secondary;background:$dz-surface-page;text-align:center;font-size:21rpx}footer{position:fixed;z-index:20;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:15rpx 28rpx calc(15rpx + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -5rpx 20rpx rgba(30,60,68,.08)}footer button,.confirm{height:78rpx;margin:0;border:0;border-radius:18rpx;color:#fff;background:$dz-gradient-brand;font-size:26rpx;font-weight:700;line-height:78rpx}footer button[disabled]{opacity:.42}.mask{position:fixed;z-index:80;inset:0;background:rgba(17,29,33,.55)}.sheet{position:absolute;right:0;bottom:0;left:0;max-width:750px;margin:auto;padding:14rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));border-radius:30rpx 30rpx 0 0;background:#fff;box-sizing:border-box}.sheet>i{display:block;width:70rpx;height:7rpx;margin:0 auto 14rpx;border-radius:5rpx;background:#cbd2d4}.sheet header{display:flex;justify-content:space-between}.sheet header .strong-text{font-size:28rpx}.sheet header button{width:50rpx;margin:0;padding:0;border:0;background:transparent;font-size:34rpx}.date-row{margin-top:20rpx;font-size:21rpx}.time-row{display:grid;grid-template-columns:1fr 35rpx 1fr;align-items:center;margin-top:18rpx}.time-row picker view{display:flex;flex-direction:column;align-items:center;gap:8rpx;padding:17rpx;border:1rpx solid $dz-border-subtle;border-radius:16rpx}.time-row text{color:$dz-text-secondary;font-size:18rpx}.time-row .strong-text{font-size:31rpx}.time-row b{text-align:center}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-top:18rpx;padding:18rpx 0;border-top:1rpx solid $dz-border-subtle;border-bottom:1rpx solid $dz-border-subtle}.switch-row>view{display:flex;flex-direction:column;gap:6rpx}.switch-row .strong-text,.copy>.strong-text{font-size:21rpx}.switch-row text{color:$dz-text-secondary;font-size:17rpx}.copy{padding:18rpx 0}.copy>view{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx}.copy button{height:48rpx;margin:0;padding:0 25rpx;border:1rpx solid $dz-border-subtle;border-radius:24rpx;background:#fff;font-size:18rpx;line-height:48rpx}.copy button.active{border-color:$dz-brand-primary;background:$dz-brand-soft}.notice{padding:13rpx;border-radius:12rpx;color:#e96729;background:#fff5eb;font-size:18rpx}.confirm{width:100%;margin-top:15rpx}
</style>
