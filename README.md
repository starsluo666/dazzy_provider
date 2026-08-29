# DAZZY 达人端

独立的 uni-app + Vue 3 微信小程序工程，用于达人在线接单、位置上报、订单与服务管理。

## 本地运行

```bash
npm install
npm run dev:h5
```

微信小程序构建：

```bash
npm run build:mp-weixin
```

构建产物位于 `dist/build/mp-weixin`，可用微信开发者工具导入。

## 环境变量

复制 `.env.example` 为 `.env`，配置后端地址。`VITE_DEMO_USER_PUBLIC_ID` 仅用于本地联调，正式环境必须留空并使用登录令牌。

## 微信侧配置

1. 在 `src/manifest.json` 的两个 `appid` 字段填写达人小程序 AppID。
2. 在微信公众平台配置后端 `request` 合法域名，并启用 HTTPS。
3. 申请定位相关权限；后台持续定位需要 `requiredBackgroundModes: ["location"]` 对应的接口权限与合适服务类目。
4. 当前策略为用户主动开启接单后获取首次高精度 GCJ-02 定位，默认每 5 分钟上报；超过 30 分钟没有有效位置，后端判定离线。

## 校验命令

```bash
npm run type-check
npm run build:h5
npm run build:mp-weixin
```
