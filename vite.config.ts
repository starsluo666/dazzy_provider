import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const platform = process.env.UNI_PLATFORM || 'h5'
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api/v1'
  if (mode === 'production' && env.VITE_DEMO_USER_PUBLIC_ID) {
    throw new Error('生产构建禁止配置 VITE_DEMO_USER_PUBLIC_ID')
  }
  if (platform !== 'h5' && !/^https?:\/\//i.test(apiBaseUrl)) {
    throw new Error(`${platform} 构建必须配置绝对 VITE_API_BASE_URL，例如 https://api.example.com/api/v1`)
  }
  return {
    plugins: [uni()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
