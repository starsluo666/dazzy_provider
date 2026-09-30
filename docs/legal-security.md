# 达人端账号安全与协议

- 登录前可阅读服务协议、隐私政策；阅读不会自动勾选同意。
- 账号设置保留信用分、登录手机号、密码操作，注销和协议分组独立。
- 未设置密码的微信登录账号，先验证绑定手机号并设置密码；接口不接受任意短信接收号码。
- 注销需单独勾选账号注销协议，阅读返回会重新加载账号安全状态，并清空密码和勾选。
- 注销的是整个平台账号，不是仅注销达人身份。用户端和达人端同时失效，5 个工作日等待期及未结业务阻断共用后端。
- 协议正文为用户端 `src/content/legal/*.json` 的同版副本，达人端可独立构建部署，不在运行时依赖另一个站点。更新法律文本时两端应同步，`npm run test:legal` 在完整工作区会比对内容一致性。
- 协议运营主体、SDK 清单、数据清理等仍按用户端 `docs/legal-document-review.md` 上线前核实，本轮不新承诺数据抹除或达人独立服务协议。

验证：`npm run test:legal`、`npm run test:security`、`npm run test:account-closure`、`npm run type-check`、`npm run build:h5`、`npm run build:mp-weixin`。
