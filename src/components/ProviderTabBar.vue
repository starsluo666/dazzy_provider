<template>
  <nav class="tabbar" aria-label="主导航">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === active }"
      hover-class="tab--pressed"
      role="button"
      :aria-label="tab.label"
      :aria-current="tab.key === active ? 'page' : undefined"
      @tap="open(tab.path)"
    >
      <view class="icon-shell">
        <image :src="tab.key === active ? tab.activeIcon : tab.icon" mode="aspectFit" aria-hidden="true" />
      </view>
      <text>{{ tab.label }}</text>
    </view>
  </nav>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ active?: 'workbench' | 'messages' | 'profile' }>(), { active: 'workbench' })

const tabs = [
  { key: 'workbench', label: '工作台', path: '/pages/workbench/index', icon: '/static/tabbar/home.svg', activeIcon: '/static/tabbar/home-active.svg' },
  { key: 'messages', label: '消息', path: '/pages/messages/index', icon: '/static/tabbar/message.svg', activeIcon: '/static/tabbar/message-active.svg' },
  { key: 'profile', label: '我的', path: '/pages/profile/index', icon: '/static/tabbar/profile.svg', activeIcon: '/static/tabbar/profile-active.svg' },
] as const

function open(path: string) {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as { route?: string } | undefined
  if (`/${current?.route}` === path) return
  uni.reLaunch({ url: path })
}
</script>

<style lang="scss" scoped>
@use '../styles/tokens.scss' as *;
.tabbar{position:fixed;z-index:30;right:0;bottom:0;left:0;display:grid;grid-template-columns:repeat(3,1fr);height:calc(116rpx + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);border-top:1rpx solid $dz-border;background:rgba(255,255,255,.97);box-shadow:0 -8rpx 28rpx rgba(31,76,82,.04);backdrop-filter:blur(14px)}
.tab{display:flex;min-height:96rpx;align-items:center;justify-content:center;color:$dz-text-secondary;font-size:20rpx;flex-direction:column;transition:color .18s ease-out}.icon-shell{display:flex;width:96rpx;height:50rpx;align-items:center;justify-content:center;margin-bottom:2rpx;border-radius:26rpx;transition:background-color .18s ease-out,opacity .12s ease-out}.icon-shell image{width:45rpx;height:45rpx}.tab.active{color:$dz-brand-deep;font-weight:650}.tab.active .icon-shell{background:$dz-brand-soft}.tab--pressed .icon-shell{opacity:.68;background:$dz-brand-soft}
@media screen and (min-width:480px){.tabbar{max-width:430px;height:calc(72px + env(safe-area-inset-bottom));margin:0 auto;padding-bottom:env(safe-area-inset-bottom);border-right:1rpx solid $dz-border;border-left:1rpx solid $dz-border}.tab{min-height:64px;font-size:13px}.icon-shell{width:64px;height:34px;margin-bottom:1px;border-radius:18px}.icon-shell image{width:28px;height:28px}}
@media screen and (orientation:landscape) and (max-height:500px){.tabbar{height:64px;padding-bottom:0}.tab{min-height:56px;font-size:12px}.icon-shell{width:60px;height:32px;margin-bottom:0;border-radius:18px}.icon-shell image{width:26px;height:26px}}
</style>
