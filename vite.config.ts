import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const platform = process.env.UNI_PLATFORM || 'h5'
  let apiBaseUrl = env.VITE_API_BASE_URL || '/api/v1'
  let proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'
  // H5 本地调试覆盖（.env.development.local 的 DAZZY_H5_* 变量）：
  // 小程序/APP 无法走 vite 代理，必须保持绝对地址，因此覆盖只在 h5 平台生效，
  // 并用 define 同步覆盖运行时 http.ts 读取的 import.meta.env，保持两端一致。
  const h5LocalOverride = platform === 'h5' && env.DAZZY_H5_API_BASE_URL
  if (h5LocalOverride) {
    apiBaseUrl = env.DAZZY_H5_API_BASE_URL
    proxyTarget = env.DAZZY_H5_API_PROXY_TARGET || proxyTarget
  }
  if (mode === 'production' && env.VITE_DEMO_USER_PUBLIC_ID) {
    throw new Error('生产构建禁止配置 VITE_DEMO_USER_PUBLIC_ID')
  }
  if (platform !== 'h5' && !/^https?:\/\//i.test(apiBaseUrl)) {
    throw new Error(`${platform} 构建必须配置绝对 VITE_API_BASE_URL，例如 https://api.example.com/api/v1`)
  }
  return {
    plugins: [uni()],
    define: h5LocalOverride
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl) }
      : undefined,
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
