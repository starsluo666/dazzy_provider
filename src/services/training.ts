import { request } from './http'
import type { DataResponse } from '@/types/api'
import { getErrorMessage } from '@/utils/formatters'

export interface TrainingData {
  required: boolean
  passed: boolean
  exempt: boolean
  passed_at: string | null
  completed_lesson_ids: string[]
  last_result: { score: number; passed: boolean } | null
  course: {
    version_id: number
    title: string
    pass_score: number
    lessons: Array<{ id: string; title: string; content: string }>
    questions: Array<{ id: string; title: string; options: string[] }>
  } | null
}

export const getTraining = () => request<DataResponse<TrainingData>>('/providers/me/training/')
export const completeTrainingLesson = (versionId: number, lessonId: string) =>
  request<DataResponse<TrainingData>>(`/providers/me/training/lessons/${encodeURIComponent(lessonId)}/complete/`, {
    method: 'POST', data: { version_id: versionId },
  })
export const submitTraining = (versionId: number, answers: Record<string, number>) =>
  request<DataResponse<TrainingData>>('/providers/me/training/submit/', {
    method: 'POST', data: { version_id: versionId, answers },
  })

let checking = false
export async function ensureFirstOrderTraining(): Promise<boolean> {
  if (checking) return false
  checking = true
  try {
    if (!(await getTraining()).data.required) return true
    await new Promise<void>(resolve => uni.showModal({
      title: '首次接单前完成学习', content: '请先阅读接单学习资料并通过答题考核，通过后即可接单。',
      confirmText: '去学习', cancelText: '稍后',
      success: result => {
        if (result.confirm) uni.navigateTo({ url: '/pages/training/index' })
        resolve()
      }, fail: () => resolve(),
    }))
    return false
  } catch (reason) {
    uni.showToast({ title: getErrorMessage(reason, '无法核验学习状态，请重试'), icon: 'none' })
    return false
  } finally { checking = false }
}
