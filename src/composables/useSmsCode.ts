import { onUnmounted, ref } from 'vue'
import { sendSmsCode } from '@/services/auth'

export function useSmsCode(purpose: 'register') {
  const seconds = ref(0), sending = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  async function send(phone: string) {
    if (sending.value || seconds.value > 0) return
    sending.value = true
    try {
      const response = await sendSmsCode(phone, purpose)
      seconds.value = response.data.retry_after
      if (import.meta.env.DEV && response.data.debug_code) {
        uni.showToast({ title: `测试验证码：${response.data.debug_code}`, icon: 'none', duration: 3000 })
      }
      timer = setInterval(() => {
        seconds.value = Math.max(0, seconds.value - 1)
        if (!seconds.value && timer) { clearInterval(timer); timer = undefined }
      }, 1000)
    } finally { sending.value = false }
  }
  onUnmounted(() => { if (timer) clearInterval(timer) })
  return { seconds, sending, send }
}
