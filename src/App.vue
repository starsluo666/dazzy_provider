<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { guardCurrentPage, installAuthenticationGuards } from '@/services/session'

onLaunch(() => installAuthenticationGuards())
onShow((options: { path?: string; query?: Record<string, unknown> } = {}) => {
  // At cold start the page stack can still be empty. Guard the actual launch
  // path instead of treating every public invitation as the workbench.
  const query = Object.entries(options.query || {})
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const url = options.path ? `/${options.path.replace(/^\//, '')}${query ? `?${query}` : ''}` : undefined
  setTimeout(() => guardCurrentPage(url), 0)
})
</script>

<style lang="scss">
@use './styles/tokens.scss' as *;
@use './styles/layout.scss';

page {
  min-height: 100%;
  color: $dz-text-primary;
  background: $dz-page;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif;
}

view, text, image, button, input, scroll-view { box-sizing: border-box; }
.strong-text { font-weight: 700; }
button { font-family: inherit; }
button::after { border: 0; }
</style>
