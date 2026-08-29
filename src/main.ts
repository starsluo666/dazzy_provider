import { createSSRApp } from 'vue'

import App from './App.vue'
import { isProtectedRoute, requireAuthentication } from './services/session'

export function createApp() {
  const app = createSSRApp(App)
  app.mixin({
    onLoad() {
      const page = this as unknown as { $page?: { fullPath?: string } }
      const url = page.$page?.fullPath
      if (url && isProtectedRoute(url)) requireAuthentication(url)
    },
  })
  return { app }
}
