# 达人端账号安全与协议

- 登录前可阅读服务协议、隐私政策；阅读不会自动勾选同意。
- 账号设置保留信用分、登录手机号、密码操作，注销和协议分组独立。
- 未设置密码的微信登录账号，先验证绑定手机号并设置密码；接口不接受任意短信接收号码。
- 注销需单独勾选账号注销协议，阅读返回会重新加载账号安全状态，并清空密码和勾选。
- 注销的是整个平台账号，不是仅注销达人身份。用户端和达人端同时失效，5 个工作日等待期及未结业务阻断共用后端。
- 协议正文为用户端 `src/content/legal/*.json` 的同版副本，达人端可独立构建部署，不在运行时依赖另一个站点。更新法律文本时两端应同步，`npm run test:legal` 在完整工作区会比对内容一致性。
- 2026-11-03 按用户确认，服务协议和隐私政策的展示生效日期统一为 2026 年 9 月 15 日，与用户端保持一致；原 DOCX 来源指纹保留。
- 协议运营主体、SDK 清单、数据清理等仍按用户端 `docs/legal-document-review.md` 上线前核实，本轮不新承诺数据抹除或达人独立服务协议。

## 微信选图接口声明

实名认证页在微信端通过 `chooseMedia` 选择身份证照片与本人自拍；其他平台使用 `chooseImage`。
微信公众平台中需要为达人端小程序设置《用户隐私保护指引》，声明实际使用的“选中的照片或视频信息”，并等待对应指引生效。代码中的协议 JSON 和登录勾选不能代替微信平台的接口声明。

- `api scope is not declared in the privacy agreement`：平台接口声明缺失或未对当前版本生效，由运营在微信公众平台更新指引。用户端显示“照片选择暂不可用，请联系客服”。
- `privacy permission is not authorized`：用户隐私授权未完成，提示用户先同意小程序隐私保护指引。
- 排查日志标记为 `[identity-photo-picker]`，保留接口名与脱敏后的错误信息，不记录证件照片、上传返回对象或临时/签名图片地址。

配置入口与图片信息类型参考：[腾讯云官方说明](https://cloud.tencent.com/document/product/1301/97930)。

验证：`npm run test:legal`、`npm run test:security`、`npm run test:account-closure`、`npm run type-check`、`npm run build:h5`、`npm run build:mp-weixin`。
