<template>
  <view class="dz-page legal-page">
    <view class="dz-safe-top" />
    <header class="legal-nav dz-page-head dz-container">
      <button aria-label="返回" @tap="goBack">‹</button>
      <strong>{{ document?.navTitle || '协议详情' }}</strong><view />
    </header>
    <main v-if="document" class="legal-content dz-container">
      <article class="reading-card">
        <header class="document-header">
          <h1>{{ document.title }}</h1>
          <text v-if="document.effectiveLabel" class="effective-date">{{ document.effectiveLabel }}</text>
        </header>
        <view class="document-contents">
          <button class="contents-toggle" :aria-expanded="contentsExpanded" aria-controls="legal-contents" @tap="contentsExpanded = !contentsExpanded" @keydown.enter.prevent="contentsExpanded = !contentsExpanded" @keydown.space.prevent="contentsExpanded = !contentsExpanded">
            <text>协议目录 · {{ headings.length }} 个章节</text><text aria-hidden="true">{{ contentsExpanded ? '收起 −' : '展开 +' }}</text>
          </button>
          <view v-if="contentsExpanded" id="legal-contents" class="contents-list">
            <button v-for="heading in headings" :key="heading.id" class="contents-link" @tap="scrollToHeading(heading.id)" @keydown.enter.prevent="scrollToHeading(heading.id)" @keydown.space.prevent="scrollToHeading(heading.id)">{{ heading.text }}</button>
          </view>
        </view>
        <view class="document-body">
          <template v-for="block in document.blocks" :key="block.id">
            <h2 v-if="block.kind === 'heading'" :id="block.id">{{ block.text }}</h2>
            <p v-else-if="block.kind === 'paragraph'" :id="block.id" :class="{ 'important-note': block.runs[0]?.text.startsWith('【特别说明】') }"><text v-for="(run, index) in block.runs" :key="index" :class="{ 'clause-bold': run.bold, 'clause-underline': run.underline }" selectable>{{ run.text }}</text></p>
            <view v-else :id="block.id" class="document-table">
              <view v-for="(row, rowIndex) in block.hasHeader ? block.rows.slice(1) : block.rows" :key="rowIndex" class="table-record">
                <view v-for="(cell, cellIndex) in row" :key="cellIndex" class="table-field">
                  <text v-if="block.hasHeader" class="table-label">{{ block.rows[0][cellIndex] }}</text>
                  <text class="table-value" selectable>{{ cell }}</text>
                </view>
              </view>
            </view>
          </template>
        </view>
      </article>
      <section class="related-documents" aria-label="其他协议">
        <text class="related-title">其他协议</text>
        <button v-for="link in relatedLinks" :key="link.kind" class="related-link" @tap="replaceDocument(link.kind)" @keydown.enter.prevent="replaceDocument(link.kind)" @keydown.space.prevent="replaceDocument(link.kind)"><text>{{ link.label }}</text><text aria-hidden="true">›</text></button>
      </section>
    </main>
    <view v-else class="missing-document dz-container"><NetworkState message="未找到该协议，请返回后重试" /><button class="missing-back" @tap="goBack">返回</button></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import NetworkState from '@/components/NetworkState.vue'
import { getLegalDocument, legalLinks, legalDocumentUrl, type LegalDocumentKind, type LegalDocument, type LegalBlock } from '@/content/legal'

const document = ref<LegalDocument>()
const contentsExpanded = ref(false)
const scrollTop = ref(0)
const headings = computed(() => document.value?.blocks.filter((block): block is Extract<LegalBlock, { kind: 'heading' }> => block.kind === 'heading') || [])
const relatedLinks = computed(() => legalLinks.filter(link => link.kind !== document.value?.id))
onLoad(query => { document.value = getLegalDocument(query?.type) })
onPageScroll(event => { scrollTop.value = event.scrollTop })
function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/profile/index' }) }) }
function replaceDocument(kind: LegalDocumentKind) { uni.redirectTo({ url: legalDocumentUrl(kind) }) }
function scrollToHeading(id: string) {
  if (!headings.value.some(heading => heading.id === id)) return
  uni.createSelectorQuery().select('.legal-page .legal-nav').boundingClientRect().select(`#${id}`).boundingClientRect().exec(result => {
    const navbar = result[0] as { height: number } | null
    const target = result[1] as { top: number } | null
    if (target) uni.pageScrollTo({ scrollTop: Math.max(0, scrollTop.value + target.top - (navbar?.height || 44) - 16), duration: 0 })
  })
}
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.legal-nav { display:flex; align-items:center; justify-content:space-between; min-height:44px; }
.legal-nav button, .legal-nav > view { display:flex; align-items:center; justify-content:center; width:44px; height:44px; flex:none; margin:0; padding:0; border:0; background:transparent; font-size:32px; line-height:1; }
.legal-nav strong { color:$dz-text-primary; font-size:18px; }
.legal-content { padding-top: 24rpx; padding-bottom: calc(#{40rpx} + env(safe-area-inset-bottom)); }
.reading-card { padding: 40rpx 32rpx; border-radius: $dz-radius-md; background: $dz-surface-card; }
.document-header { margin-bottom: 32rpx; }
h1 { margin: 0; color: $dz-text-primary; font-size: max(18px, #{36rpx}); font-weight: 700; line-height: 1.45; letter-spacing: -.01em; }
.effective-date { display: block; margin-top: 16rpx; color: $dz-text-secondary; font-size: max(12px, #{22rpx}); line-height: 1.6; }
.document-contents { padding-bottom: 32rpx; border-bottom: 1rpx solid $dz-border-subtle; }
.contents-toggle, .contents-link, .related-link, .missing-back { display: flex; align-items: center; width: 100%; min-height: 44px; margin: 0; padding: 16rpx 0; border: 0; color: #087b83; background: transparent; font-size: max(14px, #{28rpx}); line-height: 1.6; text-align: left; white-space: normal; }
.contents-toggle { justify-content: space-between; gap: 24rpx; font-weight: 600; }
.contents-toggle > text:last-child { flex: none; font-size: max(12px, #{22rpx}); font-weight: 400; }
.contents-list { padding-top: 16rpx; }
.contents-link { border-bottom: 1rpx solid $dz-border-subtle; }
.contents-link:last-child { border: 0; }
.document-body { color: $dz-text-primary; font-size: max(14px, #{28rpx}); line-height: 1.85; overflow-wrap: anywhere; word-break: break-word; }
.document-body h2 { margin: 40rpx 0 24rpx; font-size: max(16px, #{30rpx}); font-weight: 700; line-height: 1.6; }
.document-body p { margin: 32rpx 0; white-space: pre-wrap; }
.clause-bold { font-weight: 700; }
.clause-underline { text-decoration: underline; text-underline-offset: .2em; }
.important-note { padding: 24rpx; border-radius: $dz-radius-sm; background: #fff9e8; }
.document-table { margin: 32rpx 0; }
.table-record { padding: 24rpx; border: 1rpx solid $dz-border-subtle; border-radius: $dz-radius-sm; background: #f5f8f8; }
.table-record + .table-record { margin-top: 16rpx; }
.table-field + .table-field { margin-top: 16rpx; }
.table-label, .table-value { display: block; white-space: pre-wrap; }
.table-label { color: $dz-text-secondary; font-size: max(12px, #{22rpx}); line-height: 1.6; }
.related-documents { margin-top: 32rpx; padding: 24rpx 32rpx; border-radius: $dz-radius-md; background: $dz-surface-card; }
.related-title { color: $dz-text-secondary; font-size: max(12px, #{22rpx}); }
.related-link { justify-content: space-between; gap: 24rpx; }
.related-link + .related-link { border-top: 1rpx solid $dz-border-subtle; }
.missing-document { padding-top: 48rpx; }
.missing-back { justify-content: center; }
button::after { border: 0; }
button:focus-visible { outline: 2px solid #087b83; outline-offset: 2px; }
</style>
