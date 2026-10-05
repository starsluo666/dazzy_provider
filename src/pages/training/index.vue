<template>
  <view class="dz-page training-page">
    <view class="dz-safe-top" />
    <view class="page-nav dz-management-head dz-container">
      <button class="nav-back dz-tappable" hover-class="dz-pressed" aria-label="返回" @tap="back"><text>‹</text></button>
      <text class="nav-title">接单学习</text><view class="nav-space" />
    </view>
    <view class="dz-container training-content">
      <NetworkState v-if="loading" loading message="正在加载学习资料…" />
      <NetworkState v-else-if="error" :message="error" action-text="重新加载" @action="load" />
      <template v-else-if="data">
        <view v-if="!data.required" class="result-card">
          <view class="success-mark"><text>✓</text></view>
          <text class="result-title">{{ data.passed ? '接单考核已通过' : '无需重复考核' }}</text>
          <text class="body-copy">{{ data.passed ? '学习已完成，可返回工作台开启接单。其他开通条件仍需满足。' : '你已有接单记录，可继续正常接单。' }}</text>
          <button class="primary-button dz-tappable" hover-class="dz-pressed" @tap="workbench"><text>返回工作台</text></button>
        </view>
        <view v-else-if="!data.course" class="empty-card">
          <text class="result-title">学习资料准备中</text>
          <text class="body-copy">平台尚未发布接单学习资料，请联系客服。发布后完成学习和考核即可开启接单。</text>
          <button class="secondary-button" @tap="load"><text>刷新资料</text></button>
        </view>
        <template v-else>
          <view class="progress-card">
            <text class="eyebrow">首次接单准备</text>
            <text class="course-title">{{ data.course.title }}</text>
            <text class="body-copy">先学习，再答题。{{ data.course.pass_score === 100 ? '全部答对' : `达到 ${data.course.pass_score} 分` }}即可通过，未通过可重新作答。</text>
            <view class="progress-track"><view class="progress-fill" :style="{ width: `${learnedCount / data.course.lessons.length * 100}%` }" /></view>
            <view class="progress-caption"><text>已学习 {{ learnedCount }}/{{ data.course.lessons.length }} 篇</text><text>{{ allLearned ? '可以开始答题' : '学习进度自动保存' }}</text></view>
          </view>
          <view class="section-heading"><text class="section-title">学习资料</text><text class="section-hint">逐篇阅读并确认完成</text></view>
          <view v-for="(lesson, index) in data.course.lessons" :key="lesson.id" class="lesson-card">
            <button class="lesson-toggle" hover-class="pressed" :aria-expanded="openLesson === lesson.id" @tap="openLesson = openLesson === lesson.id ? '' : lesson.id">
              <text class="lesson-number" :class="{ learned: isLearned(lesson.id) }">{{ isLearned(lesson.id) ? '✓' : index + 1 }}</text>
              <view class="lesson-heading"><text class="lesson-title">{{ lesson.title }}</text><text class="lesson-state">{{ isLearned(lesson.id) ? '已学习' : '待学习' }}</text></view>
              <text class="chevron">{{ openLesson === lesson.id ? '−' : '+' }}</text>
            </button>
            <view v-if="openLesson === lesson.id" class="lesson-detail">
              <text class="lesson-body" selectable>{{ lesson.content }}</text>
              <button class="secondary-button" :disabled="busy || isLearned(lesson.id)" @tap="completeLesson(lesson.id)"><text>{{ isLearned(lesson.id) ? '已完成学习' : busy ? '保存中…' : '我已阅读并完成学习' }}</text></button>
            </view>
          </view>
          <view class="section-heading"><text class="section-title">接单考核</text><text class="section-hint">{{ data.course.questions.length }} 道单选题</text></view>
          <view v-if="!allLearned" class="locked-card"><text class="body-copy">完成上方全部学习资料后，开始答题。</text></view>
          <template v-else>
            <view v-if="data.last_result && !data.last_result.passed" class="retry-note"><text>上次得分 {{ data.last_result.score }} 分，尚未通过。可以重新阅读资料后修改答案，再次提交。</text></view>
            <view v-for="(question, index) in data.course.questions" :key="question.id" class="question-card">
              <text class="question-title">{{ index + 1 }}. {{ question.title }}</text>
              <button v-for="(option, optionIndex) in question.options" :key="optionIndex" class="answer-option" :class="{ selected: answers[question.id] === optionIndex }" :disabled="busy" role="radio" :aria-checked="answers[question.id] === optionIndex" hover-class="pressed" @tap="answers[question.id] = optionIndex">
                <text class="answer-indicator">{{ answers[question.id] === optionIndex ? '✓' : String.fromCharCode(65 + optionIndex) }}</text><text class="answer-copy">{{ option }}</text>
              </button>
            </view>
            <text class="answer-count">已作答 {{ answeredCount }}/{{ data.course.questions.length }} 题</text>
            <button class="primary-button submit-button" :disabled="busy || answeredCount !== data.course.questions.length" hover-class="dz-pressed" @tap="submit"><text>{{ busy ? '提交中…' : '提交考核' }}</text></button>
          </template>
        </template>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { guardCurrentPage } from '@/services/session'
import { completeTrainingLesson, getTraining, submitTraining, type TrainingData } from '@/services/training'
import { getErrorMessage } from '@/utils/formatters'

const data = ref<TrainingData | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const openLesson = ref('')
const answers = reactive<Record<string, number>>({})
const isLearned = (id: string) => data.value?.completed_lesson_ids.includes(id) || false
const learnedCount = computed(() => data.value?.course?.lessons.filter(item => isLearned(item.id)).length || 0)
const allLearned = computed(() => Boolean(data.value?.course?.lessons.length && learnedCount.value === data.value.course.lessons.length))
const answeredCount = computed(() => data.value?.course?.questions.filter(q => Number.isInteger(answers[q.id])).length || 0)

function apply(value: TrainingData) {
  if (data.value?.course?.version_id !== value.course?.version_id) {
    Object.keys(answers).forEach(key => { delete answers[key] })
    openLesson.value = value.course?.lessons.find(item => !value.completed_lesson_ids.includes(item.id))?.id || ''
  }
  data.value = value
}
function back() { uni.navigateBack({ fail: workbench }) }
function workbench() { uni.reLaunch({ url: '/pages/workbench/index' }) }
async function load() {
  loading.value = true
  error.value = ''
  try { apply((await getTraining()).data) }
  catch (reason) { error.value = getErrorMessage(reason) }
  finally { loading.value = false }
}
async function handleFailure(reason: unknown) {
  uni.showToast({ title: getErrorMessage(reason), icon: 'none' })
  if ((reason as { status?: number })?.status === 409) await load()
}
async function completeLesson(id: string) {
  if (busy.value || !data.value?.course || isLearned(id)) return
  busy.value = true
  try {
    apply((await completeTrainingLesson(data.value.course.version_id, id)).data)
    uni.showToast({ title: '学习进度已保存', icon: 'success' })
  } catch (reason) { await handleFailure(reason) }
  finally { busy.value = false }
}
async function submit() {
  if (busy.value || !data.value?.course || !allLearned.value || answeredCount.value !== data.value.course.questions.length) return
  busy.value = true
  try {
    apply((await submitTraining(data.value.course.version_id, { ...answers })).data)
    if (data.value?.passed) uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } catch (reason) { await handleFailure(reason) }
  finally { busy.value = false }
}
onShow(() => { if (guardCurrentPage()) load() })
</script>

<style scoped lang="scss">
.training-page { min-height: 100vh; background: #f3f7f7; color: #18242b; }
.page-nav { display: flex; align-items: center; justify-content: space-between; min-height: 100rpx; background: #f7fbfb; }
.nav-back, .nav-space { flex: 0 0 88rpx; width: 88rpx; height: 88rpx; }
.nav-back { display: flex; align-items: center; justify-content: flex-start; margin: 0; padding: 0; background: transparent; font-size: 54rpx; line-height: 1; }
.nav-back::after { border: 0; }
.nav-back { min-width: 44px; min-height: 44px; }
.nav-title { font-size: 34rpx; font-weight: 650; }
.training-content { padding-top: 20rpx; padding-bottom: calc(48rpx + env(safe-area-inset-bottom)); }
.progress-card, .lesson-card, .question-card, .result-card, .empty-card, .locked-card { margin-bottom: 20rpx; padding: 30rpx; border: 1rpx solid #e0e9e9; border-radius: 28rpx; background: #fff; }
.eyebrow { display: block; color: #087b80; font-size: 24rpx; font-weight: 600; }
.course-title, .result-title { display: block; margin: 14rpx 0; font-size: 40rpx; font-weight: 700; line-height: 1.3; }
.body-copy { display: block; color: #637477; font-size: 27rpx; line-height: 1.65; }
.progress-track { height: 10rpx; margin-top: 26rpx; overflow: hidden; border-radius: 10rpx; background: #edf2f2; }
.progress-fill { height: 100%; background: #16826c; border-radius: 10rpx; }
.progress-caption, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.progress-caption { margin-top: 14rpx; color: #617577; font-size: 23rpx; }
.section-heading { margin: 34rpx 4rpx 18rpx; flex-wrap: wrap; }
.section-title { font-size: 31rpx; font-weight: 650; }
.section-hint { color: #617577; font-size: 23rpx; }
.lesson-card { padding: 0; overflow: hidden; }
.lesson-toggle { display: flex; align-items: center; gap: 20rpx; width: 100%; min-height: 112rpx; padding: 24rpx; margin: 0; text-align: left; background: #fff; line-height: 1.4; border-radius: 0; }
.lesson-toggle::after, .primary-button::after, .secondary-button::after, .answer-option::after { border: 0; }
.lesson-number { display: flex; align-items: center; justify-content: center; width: 58rpx; height: 58rpx; flex: 0 0 58rpx; border-radius: 18rpx; background: #edf5f5; color: #087b80; font-size: 28rpx; }
.learned { color: #16714f; background: #e7f5ec; }
.lesson-heading { flex: 1; min-width: 0; }
.lesson-title, .lesson-state { display: block; }
.lesson-title { font-size: 29rpx; font-weight: 600; overflow-wrap: anywhere; }
.lesson-state { margin-top: 6rpx; font-size: 23rpx; color: #637477; }
.chevron { color: #7b9193; font-size: 34rpx; }
.lesson-detail { padding: 0 28rpx 28rpx; }
.lesson-body { display: block; padding: 24rpx 0; border-top: 1rpx solid #edf2f2; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 29rpx; line-height: 1.8; }
.primary-button, .secondary-button { display: flex; justify-content: center; align-items: center; min-height: 88rpx; padding: 20rpx 24rpx; margin: 20rpx 0 0; border-radius: 20rpx; font-size: 29rpx; font-weight: 600; line-height: 1.4; }
.primary-button { background: #087e83; color: #fff; }
.secondary-button { background: #e8f5f4; color: #087b80; }
.question-title { display: block; margin-bottom: 24rpx; font-size: 29rpx; line-height: 1.6; font-weight: 600; }
.answer-option { display: flex; align-items: center; gap: 18rpx; min-height: 88rpx; margin: 14rpx 0 0; padding: 20rpx; text-align: left; border: 2rpx solid #e4ecec; border-radius: 18rpx; background: #fff; font-size: 28rpx; line-height: 1.5; }
.answer-indicator { display: flex; align-items: center; justify-content: center; flex: 0 0 40rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #f0f4f4; color: #617577; font-size: 24rpx; }
.answer-copy { flex: 1; overflow-wrap: anywhere; }
.selected { border-color: #138589; background: #edf9f7; color: #086568; }
.selected .answer-indicator { color: #fff; background: #087e83; }
.retry-note { margin: 0 0 20rpx; padding: 24rpx; border-radius: 20rpx; background: #fff4e6; color: #915817; font-size: 26rpx; line-height: 1.6; }
.answer-count { display: block; text-align: center; color: #617577; font-size: 25rpx; }
.result-card, .empty-card { padding: 48rpx 32rpx; text-align: center; }
.success-mark { display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; margin: 0 auto 24rpx; border-radius: 50%; background: #e7f5ec; color: #16714f; font-size: 48rpx; }
.pressed { opacity: .75; }
.primary-button, .secondary-button, .answer-option { min-height: 44px; }
</style>
