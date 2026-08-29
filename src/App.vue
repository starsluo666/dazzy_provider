<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { guardCurrentPage, installAuthenticationGuards } from '@/services/session'

onLaunch(() => installAuthenticationGuards())
onShow(() => setTimeout(guardCurrentPage, 0))
</script>

<style lang="scss">
@use './styles/tokens.scss' as *;
@use './styles/layout.scss';

page {
  min-height: 100%;
  color: $dz-text-primary;
  background: $dz-page;
  font-family: 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif;
}

view, text, image, button, input, scroll-view { box-sizing: border-box; }
.strong-text { font-weight: 700; }
button { font-family: inherit; }
button::after { border: 0; }
</style>
