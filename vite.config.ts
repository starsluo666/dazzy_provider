import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && env.VITE_DEMO_USER_PUBLIC_ID) {
    throw new Error('生产构建禁止配置 VITE_DEMO_USER_PUBLIC_ID')
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
