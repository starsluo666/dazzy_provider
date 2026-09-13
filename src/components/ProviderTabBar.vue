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
withDefaults(defineProps<{ active?: 'workbench' | 'orders' | 'profile' }>(), { active: 'workbench' })

const tabs = [
  { key: 'workbench', label: '工作台', path: '/pages/workbench/index', icon: '/static/tabbar/home.svg', activeIcon: '/static/tabbar/home-active.svg' },
  { key: 'orders', label: '订单', path: '/pages/orders/index', icon: '/static/tabbar/order.svg', activeIcon: '/static/tabbar/order-active.svg' },
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

/* 悬浮胶囊 Dock：与用户端 DazzyTabBar 同构；小程序端用近实体材质，H5 端加玻璃模糊。 */
.tabbar {
  position: fixed;
  z-index: 100;
  right: 0;
  bottom: calc(16rpx + env(safe-area-inset-bottom));
  left: 0;
  display: grid;
  width: calc(100% - 48rpx);
  height: 112rpx;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 auto;
  padding: 8rpx;
  border: 1rpx solid $dz-border-material;
  border-radius: 36rpx;
  background: $dz-surface-glass;
  box-shadow: $dz-shadow-floating;
  box-sizing: border-box;
  isolation: isolate;
}

.tabbar::before {
  position: absolute;
  z-index: -1;
  top: 1rpx;
  right: 28rpx;
  left: 28rpx;
  height: 1rpx;
  background: rgba(255, 255, 255, 0.96);
  content: '';
  pointer-events: none;
}

/* #ifdef H5 */
.tabbar {
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
}
/* #endif */

.tab {
  display: flex;
  min-width: 0;
  min-height: 96rpx;
  align-items: center;
  justify-content: center;
  color: $dz-text-secondary;
  font-size: 20rpx;
  flex-direction: column;
  transition: color .18s ease-out;
}

.icon-shell {
  display: flex;
  width: 96rpx;
  height: 50rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rpx;
  border-radius: 26rpx;
  transition: background-color .18s ease-out, opacity .12s ease-out;
}

.icon-shell image { width: 45rpx; height: 45rpx; }
.tab.active { color: $dz-brand-deep; font-weight: 650; }
.tab.active .icon-shell { background: $dz-brand-soft; }
.tab--pressed .icon-shell { opacity: .68; background: $dz-brand-soft; }

@media (prefers-reduced-transparency: reduce) {
  .tabbar {
    background: rgba(255, 255, 255, 0.98);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media screen and (min-width:480px){
  .tabbar{
    width: calc(430px - 32px);
    height: 72px;
    padding: 4px;
    border-radius: 26px;
  }
  .tab{min-height:64px;font-size:13px}
  .icon-shell{width:64px;height:34px;margin-bottom:1px;border-radius:18px}
  .icon-shell image{width:28px;height:28px}
}
@media screen and (orientation:landscape) and (max-height:500px){
  .tabbar{height:64px;bottom:8px;padding-bottom:0}
  .tab{min-height:56px;font-size:12px}
  .icon-shell{width:60px;height:32px;margin-bottom:0;border-radius:18px}
  .icon-shell image{width:26px;height:26px}
}
</style>
