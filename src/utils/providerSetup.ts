import type { ProviderWorkbench } from '@/types/api'

export type SetupState = 'todo' | 'pending' | 'done' | 'rejected'
export type SetupStepId = 'identity' | 'profile' | 'services'
export type ProviderSetupData = Pick<ProviderWorkbench,
  'identity_status' | 'profile_review_status' | 'is_profile_complete'
  | 'pending_service_revision_count' | 'onboarding_status' | 'onboarding_blockers'
  | 'onboarding_rejection_reason'>

export interface SetupStep {
  id: SetupStepId
  title: string
  state: SetupState
  description: string
  action: string
}

export function providerSetup(data?: ProviderSetupData | null) {
  if (!data) return null
  const identity: SetupState = data.identity_status === 'verified' ? 'done'
    : data.identity_status === 'pending' ? 'pending'
      : data.identity_status === 'rejected' ? 'rejected' : 'todo'
  // 入驻申请的旧资料可能已经完整，但仍须提交本轮达人资料审核。
  const profile: SetupState = data.profile_review_status === 'pending' ? 'pending'
    : data.profile_review_status === 'rejected' ? 'rejected'
      : data.is_profile_complete && (data.profile_review_status === 'approved' || data.onboarding_status === 'approved') ? 'done' : 'todo'
  // 当前接口用这一条 blocker 表示没有启用中的服务；不能用“服务次数”判断，
  // 也不能把客服填写的其他含“服务”字样的限制原因当成未配置。
  const hasActiveService = Array.isArray(data.onboarding_blockers)
    && !data.onboarding_blockers.includes('请先添加并启用至少一项服务')
  const services: SetupState = data.pending_service_revision_count > 0 ? 'pending'
    : hasActiveService ? 'done'
      : data.onboarding_status === 'rejected' ? 'rejected' : 'todo'

  const steps: SetupStep[] = [
    {
      id: 'identity', title: '实名认证', state: identity,
      description: {
        todo: '提交实名信息与认证材料', pending: '材料已提交，等待平台审核',
        done: '身份核验已通过', rejected: '认证未通过，请修改后重新提交',
      }[identity],
      action: { todo: '去认证', pending: '审核中', done: '已认证', rejected: '去修改' }[identity],
    },
    {
      id: 'profile', title: '完善达人资料', state: profile,
      description: {
        todo: '生活照、简介和服务城市', pending: '资料已提交，等待平台审核',
        done: '公开展示资料已就绪', rejected: '资料未通过，请查看原因并修改',
      }[profile],
      action: { todo: '去完善', pending: '审核中', done: '已完成', rejected: '去修改' }[profile],
    },
    {
      id: 'services', title: '配置服务', state: services,
      description: {
        todo: '至少添加并启用一项服务', pending: '服务已提交，等待平台审核',
        done: '已有启用中的服务项目', rejected: '服务未通过，请修改后重新提交',
      }[services],
      action: { todo: '去配置', pending: '审核中', done: '已就绪', rejected: '去修改' }[services],
    },
  ]
  const submitted = steps.filter(step => step.state === 'pending' || step.state === 'done').length
  const completed = steps.filter(step => step.state === 'done').length
  const next = steps.find(step => step.state === 'rejected') || steps.find(step => step.state === 'todo')
  const title = data.onboarding_status === 'pending_review' ? '开通审核中'
    : completed === 3 ? '接单设置已完成'
      : data.onboarding_status === 'rejected' ? '请修改接单设置' : '完成接单设置'
  const caption = data.onboarding_status === 'pending_review' ? '三项材料已齐，平台正在审核'
    : next ? `${next.state === 'rejected' ? '请修改' : '下一步：'}${next.title}`
      : completed === 3 ? (data.onboarding_blockers[0] || '接单设置已就绪') : '材料已提交，等待开通审核'

  return {
    steps, title, caption,
    rejectionReason: data.onboarding_status === 'rejected' ? data.onboarding_rejection_reason || '' : '',
    progress: completed === 3 ? '已就绪 3/3' : `已提交 ${submitted}/3`,
    showSubmissionHint: Boolean(next),
  }
}
