<template>
  <view class="auth-page">
    <view class="dz-safe-top" />
    <main class="auth-shell">
      <view class="auth-brand"><image src="/static/auth-logo.png" mode="aspectFit" aria-label="乐搭伴" /></view>
      <view class="auth-heading"><h1>欢迎回来</h1><p>登录达人工作端，开始管理服务</p></view>
      <view class="auth-form">
        <view class="auth-mode-title"><text>密码登录</text><view /></view>
        <label class="auth-field"><input v-model="phone" type="number" maxlength="11" placeholder="请输入手机号" /></label>
        <label class="auth-field"><input v-model="password" :password="!visible" maxlength="20" placeholder="请输入密码" /><view class="auth-field-action" @tap="visible=!visible">{{ visible ? '隐藏' : '显示' }}</view></label>
        <view class="auth-inline-link">仅审核通过的达人账号可登录</view>
        <button class="auth-primary" :disabled="submitting" @tap="submit">{{ submitting ? '登录中…' : '登录' }}</button>
      </view>
      <view class="auth-agreement" @tap="agreed=!agreed"><view class="agreement-check" :class="{ checked:agreed }">{{ agreed ? '✓' : '' }}</view><view class="agreement-copy">我已阅读并同意 <text>《用户协议》</text> 和 <text>《隐私政策》</text></view></view>
    </main>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { loginWithPassword } from '@/services/auth'
import { returnAfterAuthentication } from '@/services/session'

const phone=ref(''),password=ref(''),visible=ref(false),agreed=ref(false),submitting=ref(false),redirect=ref('')
onLoad(query=>{redirect.value=typeof query?.redirect==='string'?decodeURIComponent(query.redirect):''})
function warn(title:string){uni.showToast({title,icon:'none'})}
async function submit(){
  if(!/^1[3-9]\d{9}$/.test(phone.value))return warn('请输入正确的手机号')
  if(password.value.length<8)return warn('请输入 8–20 位密码')
  if(!agreed.value)return warn('请先阅读并同意用户协议和隐私政策')
  submitting.value=true
  try{await loginWithPassword(phone.value,password.value);uni.showToast({title:'登录成功',icon:'success'});setTimeout(()=>returnAfterAuthentication(redirect.value),300)}
  catch(reason){warn((reason as Error).message||'登录失败')}
  finally{submitting.value=false}
}
</script>

<style lang="scss" scoped>
@use '../../styles/tokens.scss' as *;
.auth-page{min-height:100vh;min-height:100dvh;padding-bottom:calc(36rpx + env(safe-area-inset-bottom));background:#fff;box-sizing:border-box}.auth-shell{width:100%;max-width:430px;margin:0 auto;padding:34rpx 46rpx 0;box-sizing:border-box}.auth-brand{display:flex;height:92rpx;justify-content:center}.auth-brand image{width:300rpx;height:92rpx}.auth-heading{margin-top:42rpx;text-align:center}.auth-heading h1{display:block;margin:0;color:#111b20;font-size:48rpx;font-weight:700;line-height:1.25}.auth-heading p{display:block;margin-top:14rpx;color:$dz-text-secondary;font-size:25rpx;line-height:1.5}.auth-form{margin-top:52rpx}.auth-mode-title{display:flex;align-items:center;gap:18rpx;margin-bottom:32rpx;color:#121c21;font-size:28rpx;font-weight:650}.auth-mode-title view{height:1rpx;flex:1;background:#dfe6e8}.auth-field{display:flex;min-height:98rpx;align-items:center;margin-bottom:24rpx;padding:0 26rpx;border:2rpx solid #e0e6e8;border-radius:18rpx;background:#fff;box-sizing:border-box}.auth-field:focus-within{border-color:rgba(24,199,198,.74);box-shadow:0 0 0 5rpx rgba(24,199,198,.08)}.auth-field input{min-width:0;height:94rpx;flex:1;color:$dz-text-primary;font-size:27rpx}.auth-field-action{display:flex;min-width:72rpx;height:76rpx;align-items:center;justify-content:center;margin-right:-18rpx;padding:0 12rpx;color:$dz-text-secondary;font-size:25rpx;white-space:nowrap}.auth-inline-link{display:flex;min-height:58rpx;align-items:center;justify-content:flex-end;margin-top:-8rpx;color:$dz-text-tertiary;font-size:21rpx}.auth-primary{display:flex;width:100%;height:102rpx;align-items:center;justify-content:center;margin-top:28rpx;border-radius:18rpx;color:#fff;background:$dz-gradient-brand;font-size:31rpx;font-weight:650;box-shadow:0 12rpx 28rpx rgba(8,181,194,.18)}.auth-primary[disabled]{opacity:.58}.auth-agreement{display:flex;align-items:flex-start;justify-content:center;margin-top:54rpx;color:$dz-text-secondary;font-size:21rpx;line-height:1.65}.agreement-check{display:flex;width:30rpx;height:30rpx;flex:0 0 auto;align-items:center;justify-content:center;margin:2rpx 12rpx 0 0;border:2rpx solid #cbd5d8;border-radius:50%;color:#fff;font-size:20rpx;box-sizing:border-box}.agreement-check.checked{border-color:$dz-brand-primary;background:$dz-brand-primary}.agreement-copy{text-align:left}.agreement-copy text{color:$dz-brand-deep}
</style>
