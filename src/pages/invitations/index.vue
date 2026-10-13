<template>
  <view class="page">
    <view class="dz-safe-top" /><view class="invite-nav"><button class="back" aria-label="返回" @tap="goBack">‹</button><text>邀请达人</text></view>
    <view class="content">
      <view v-if="error" class="notice"><text>{{ error }}</text><button class="secondary" @tap="load">重新加载</button></view>
      <view v-else-if="loading" class="notice">正在加载邀请信息…</view>
      <template v-else-if="data">
        <view class="card hero"><text class="eyebrow">推荐新伙伴</text><text class="title">一起成为乐搭伴达人</text><text class="description">新朋友注册并提交完整入驻意向后，记一次邀请奖励。经平台财务核验后人工打款。</text>
          <view class="reward"><text>当前每位奖励</text><text class="amount">{{ money(data.reward_amount) }}</text></view>
          <template v-if="data.enabled && data.source"><image class="qr" :src="data.qr_data" mode="aspectFit" :show-menu-by-longpress="true" /><text class="code">专属邀请码 {{ data.source.code }}</text><button class="primary" @tap="copyLink">复制邀请链接</button><text class="hint">分享二维码或链接，新朋友扫码即可打开邀请网页，填写注册与入驻资料；初审通过后前往达人端完善接单资料。</text></template>
          <text v-else class="notice">邀请活动暂未开放，请留意平台通知。</text>
        </view>
        <view class="summary"><view v-for="status in ['pending', 'approved', 'paid']" :key="status" class="metric"><text>{{ labels[status] }}</text><text class="metric-value">{{ money(data.summary.find(s => s.status === status)?.amount || 0) }}</text></view></view>
        <view class="card"><view class="list-heading"><text class="section-title">邀请记录</text><text class="hint">共 {{ data.pagination.total }} 位</text></view><text v-if="!data.items.length" class="hint">还没有邀请记录，邀请新朋友加入吧。</text><view v-for="item in data.items" :key="item.public_id" class="record"><view><text>{{ item.invitee_phone_masked }}</text><text class="hint">{{ item.created_at.slice(0, 10) }}</text></view><view class="record-right"><text>{{ money(item.amount) }}</text><text class="hint">{{ item.status_label }}</text></view></view><view class="pagination"><button class="secondary" :disabled="page === 1" @tap="turn(-1)">上一页</button><text>{{ page }}</text><button class="secondary" :disabled="page * 20 >= data.pagination.total" @tap="turn(1)">下一页</button></view></view>
        <text class="footnote">奖励独立于订单收入，不计入可提现余额。已有账号、重复注册不计奖；奖励以注册时金额和财务核验结果为准。</text>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '@/services/http'
interface InviteSummary {
  source: { code: string; name: string; invite_url: string } | null
  enabled: boolean; reward_amount: number; qr_data: string
  summary: Array<{ status: string; amount: number; count: number }>
  items: Array<{ public_id: string; invitee_phone_masked: string; amount: number; status_label: string; created_at: string }>
  pagination: { total: number }
}
const data = ref<InviteSummary | null>(null), loading = ref(true), error = ref(''), page = ref(1)
const labels: Record<string, string> = { pending: '待审核', approved: '待打款', paid: '已打款' }
const money = (value: number) => `¥${(value / 100).toFixed(2)}`
async function load() {
  loading.value = true; error.value = ''
  try {
    data.value = (await request<{ data: InviteSummary }>('/growth/provider-invites/me/', { query: { page: page.value } })).data
    if (!data.value.source) {
      await request('/growth/provider-invites/me/', { method: 'POST' })
      data.value = (await request<{ data: InviteSummary }>('/growth/provider-invites/me/', { query: { page: page.value } })).data
    }
  } catch (e) { error.value = e instanceof Error ? e.message : '邀请信息加载失败，请稍后重试' }
  finally { loading.value = false }
}
function turn(direction: number) { page.value += direction; void load() }
function copyLink() { if (data.value?.enabled && data.value.source) uni.setClipboardData({ data: data.value.source.invite_url }) }
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
onShow(load)
</script>

<style scoped>
.invite-nav{position:relative;display:flex;justify-content:center;align-items:center;min-height:48px;font-size:18px;font-weight:600;padding-right:80px;padding-left:80px}.back{position:absolute;left:12px;top:0;width:44px;height:48px;line-height:44px;margin:0;padding:0;background:transparent;border:0;font-size:28px}.back::after{border:0}
.page{min-height:100vh;background:#f3f7f8;color:#172126}.content{max-width:520px;margin:auto;padding:20px 18px calc(28px + env(safe-area-inset-bottom))}.card{background:white;border:1px solid #e1ebee;border-radius:20px;padding:22px 20px;margin-bottom:18px}.hero{text-align:center}.eyebrow{display:block;color:#08787e;font-size:12px;line-height:1.6}.title{display:block;font-size:23px;font-weight:650;line-height:1.5;margin:10px 0}.description{font-size:13px;color:#66737a;line-height:1.8}.reward{display:flex;align-items:center;justify-content:center;gap:12px;margin:20px 0;color:#66737a;font-size:12px}.amount{font-size:28px;color:#08787e;font-weight:650}.qr{display:block;width:220px;height:220px;margin:10px auto}.code{font-size:12px;color:#66737a;display:block;margin:10px 0}.primary{background:#08787e;color:white;min-height:50px;padding:12px;border:0;border-radius:12px;line-height:1.6;font-size:15px;font-weight:600}.hint{display:block;font-size:12px;color:#66737a;line-height:1.8;margin-top:8px}.summary{display:flex;gap:8px;margin:18px 0}.metric{flex:1;min-width:0;border:1px solid #e1ebee;background:white;border-radius:14px;padding:14px 8px;text-align:center;color:#66737a;font-size:11px}.metric-value{display:block;font-size:16px;font-weight:600;color:#172126;margin-top:8px;word-break:break-all}.section-title{font-size:17px;font-weight:600}.list-heading{display:flex;align-items:center;justify-content:space-between}.record{padding:14px 0;display:flex;justify-content:space-between;border-bottom:1px solid #edf2f3;font-size:14px;gap:10px}.record-right{text-align:right}.pagination{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:20px;font-size:12px}.secondary{margin:0;padding:0 14px;line-height:44px;background:#eaf8f7;color:#08787e;font-size:12px;border:0;border-radius:10px}.primary::after,.secondary::after{border:0}.notice{display:block;padding:20px 0;font-size:14px;color:#66737a;line-height:1.8}.footnote{display:block;font-size:12px;color:#66737a;line-height:1.9;margin:0 6px}
</style>
