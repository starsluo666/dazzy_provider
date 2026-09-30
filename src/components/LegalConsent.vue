<template>
  <view class="legal-consent">
    <button class="consent-toggle" role="checkbox" :aria-checked="modelValue" :aria-label="consentLabel" :disabled="disabled" :tabindex="disabled ? -1 : 0" @tap="toggle" @keydown.enter.stop.prevent="toggle" @keydown.space.stop.prevent="toggle">
      <view class="consent-check" :class="{ checked: modelValue }" aria-hidden="true">{{ modelValue ? '✓' : '' }}</view>
    </button>
    <view class="consent-copy">
      <text>我已阅读并同意</text>
      <template v-for="(link, index) in links" :key="link.kind">
        <text v-if="index">和</text>
        <button class="consent-link" :disabled="disabled" :tabindex="disabled ? -1 : 0" @tap.stop="emit('read', link.kind)" @keydown.enter.stop.prevent="emit('read', link.kind)" @keydown.space.stop.prevent="emit('read', link.kind)">《{{ link.label }}》</button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { legalLinks, type LegalDocumentKind } from '@/content/legal'

const props = withDefaults(defineProps<{ modelValue: boolean; documents?: LegalDocumentKind[]; disabled?: boolean }>(), {
  documents: () => ['service', 'privacy'], disabled: false,
})
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; read: [kind: LegalDocumentKind] }>()
const links = computed(() => legalLinks.filter(link => props.documents.includes(link.kind)))
const consentLabel = computed(() => '同意' + links.value.map(link => link.label).join('和'))
function toggle() { if (!props.disabled) emit('update:modelValue', !props.modelValue) }
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;
.legal-consent { display: flex; align-items: flex-start; color: $dz-text-secondary; font-size: max(12px, #{22rpx}); line-height: 1.7; }
.consent-toggle { display: flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; background: transparent; }
.consent-check { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid $dz-text-secondary; border-radius: 50%; color: #fff; font-size: 12px; line-height: 1; box-sizing: border-box; }
.consent-check.checked { border-color: #087b83; background: #087b83; }
.consent-copy { min-width: 0; flex: 1; padding-top: 8px; }
.consent-link { display: inline; margin: 0; padding: 0; border: 0; border-radius: 0; color: #087b83; background: transparent; font-size: inherit; line-height: inherit; white-space: normal; text-align: left; }
.consent-toggle::after, .consent-link::after { border: 0; }
.consent-toggle:focus-visible, .consent-link:focus-visible { outline: 2px solid #087b83; outline-offset: 2px; }
.consent-toggle[disabled], .consent-link[disabled] { opacity: .6; }
</style>
