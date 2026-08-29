<template>
  <view class="login-page">
    <view class="dz-safe-top" />
    <main class="login-shell">
      <view class="brand-mark"><view class="brand-ring"><i /></view><text>DAZZY</text></view>
      <view class="heading"><h1>达人工作端</h1><p>登录后管理接单、订单与服务档期</p></view>
      <view class="form-card">
        <label><text>手机号</text><input v-model="phone" type="number" maxlength="11" placeholder="请输入手机号" /></label>
        <label><text>密码</text><input v-model="password" :password="!visible" maxlength="20" placeholder="请输入 8–20 位密码" /><button @tap="visible=!visible">{{ visible ? '隐藏' : '显示' }}</button></label>
        <view class="agreement" @tap="agreed=!agreed"><view :class="{ checked:agreed }">{{ agreed ? '✓' : '' }}</view><text>我已阅读并同意《用户协议》和《隐私政策》</text></view>
        <button class="submit" :disabled="submitting" @tap="submit">{{ submitting ? '登录中…' : '登录达人端' }}</button>
        <text class="hint">仅审核通过的达人账号可进入工作台</text>
      </view>
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
.login-page{min-height:100vh;background:radial-gradient(circle at 78% 8%,rgba(78,220,216,.2),transparent 30%),linear-gradient(180deg,#f1fbfb,#fff 45%)}.login-shell{width:100%;max-width:430px;margin:0 auto;padding:72rpx 44rpx 60rpx}.brand-mark{display:flex;align-items:center;color:$dz-brand-deep;font-size:25rpx;font-weight:800;letter-spacing:5rpx}.brand-ring{display:flex;width:54rpx;height:54rpx;align-items:center;justify-content:center;margin-right:12rpx;border:6rpx solid $dz-brand;border-radius:50%}.brand-ring i{width:13rpx;height:13rpx;border-radius:50%;background:$dz-orange}.heading{margin-top:64rpx}.heading h1{margin:0;font-size:48rpx;line-height:1.2}.heading p{margin:16rpx 0 0;color:$dz-text-secondary;font-size:23rpx}.form-card{margin-top:54rpx;padding:34rpx 30rpx;border:1rpx solid $dz-border;border-radius:32rpx;background:#fff;box-shadow:$dz-shadow}.form-card label{display:flex;height:102rpx;align-items:center;border-bottom:1rpx solid $dz-border}.form-card label>text{width:110rpx;font-size:22rpx;font-weight:650}.form-card input{height:100%;min-width:0;flex:1;font-size:23rpx}.form-card label button{width:88rpx;min-height:66rpx;margin:0;padding:0;border:0;color:$dz-brand-deep;background:transparent;font-size:20rpx;line-height:66rpx}.agreement{display:flex;align-items:flex-start;margin-top:26rpx;color:$dz-text-secondary;font-size:18rpx;line-height:1.45}.agreement>view{display:flex;width:34rpx;height:34rpx;align-items:center;justify-content:center;margin-right:11rpx;border:2rpx solid #cbd7d9;border-radius:9rpx;color:#fff;flex:0 0 34rpx}.agreement>view.checked{border-color:$dz-brand;background:$dz-brand}.submit{height:84rpx;margin-top:31rpx;border:0;border-radius:44rpx;color:#fff;background:$dz-gradient-brand;font-size:25rpx;font-weight:700;line-height:84rpx;box-shadow:0 12rpx 26rpx rgba(17,193,196,.22)}.submit[disabled]{opacity:.58}.hint{display:block;margin-top:20rpx;color:$dz-text-tertiary;font-size:18rpx;text-align:center}
</style>
