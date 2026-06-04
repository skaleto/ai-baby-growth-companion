# 小宝记发布硬化改进方案 Spec v1

- 创建日期：2026-06-05
- 状态：产品/技术改进 spec，进入 implementation plan 前需评审
- 输入评估：`docs/release-readiness-review-2026-06-04.md`
- 战略源：`harness/app-development-roadmap.md`
- 商业化参考：`docs/commercialization/version-strategy.md`、`docs/commercialization/pro-trial-policy.md`、`docs/commercialization/privacy-policy-draft.md`
- 适用范围：正式发布上架前的账号、安全、隐私、Free/Pro、云端、真机和产品信任补齐

> 本 spec 延续“记录为基线、低焦虑反疲劳设计、中文 AI 情感陪伴与 baby 数据关联”的主线。它不新增电商、专家、知识付费、开放社区，也不把成长数据维护单独扩大成新主线。

## 0. 阅读方式

本文是发布硬化规格，不是代码实现计划。它回答：

1. 当前 App 离公开上架还缺哪些发布级能力。
2. 每类能力的目标行为、接口/数据影响、验收标准是什么。
3. 哪些能力进入 P0 阻断项，哪些进入 P1/P2 后续增强。
4. 下一步 implementation plan 应如何拆分，避免继续横向扩张。

本文不直接规定完整类名、SQL 迁移文件名、CSS class 或提交步骤。进入实现前，需要基于本文再写 implementation plan，并按仓库 harness 逐项验证。

## 1. 总体判断

小宝记当前可以继续做邀请码制小范围真实家庭内测，但不适合直接公开上架，也不适合公开收费订阅。

核心原因不是产品方向错误，而是发布级基础设施还没有闭环：

| 维度 | 当前证据 | 发布风险 | 本 spec 的处理 |
| --- | --- | --- | --- |
| 账号 | `AuthLoginRequest` 只有 phone/inviteCode/roleName/caregiver；`AuthService.login` 是手机号 + 邀请码 | 手机号真实性、风控、账号安全不足 | 增加短信验证码、发送频控、防枚举、开发 mock provider |
| 安全 | `RequestLoggingFilter` 当前日志记录完整 phone；`AuthTokenFilter` 支持 query token | 手机号、token 易进入日志/URL/Referer | 统一脱敏，普通 API 禁 query token |
| 隐私 | 隐私政策仍是内测草案 | 儿童信息、AI 数据使用、删除导出、注销入口不足 | 补正式政策、儿童信息规则、数据权利入口 |
| Free/Pro | `ProTrialService.isProEnabled()` 当前直接返回 true | Free/Pro 权益不真实，成本和支付边界不清 | 恢复 entitlement gating，建立家庭级额度和软硬限制 |
| 云端 | 单 ECS + Spring Boot + SQLite WAL + systemd + 本地/OSS + OTA | 没有 HTTPS/深度健康/恢复演练/压测时不能公开放量 | 建立 HTTPS、备份恢复、监控告警、压测门槛 |
| 真机 | 有 native capability audit，但不是设备通过证据 | 通知、闹铃、ASR、媒体、OTA 在真机上风险高 | 建立 iOS/Android 真机验收矩阵 |
| 产品信任 | 记录和陪伴主线已成立 | 用户不理解家庭共享、AI 数据来源和非诊疗边界时会损害信任 | 首登说明、AI 来源说明、客服反馈、核心 E2E |

后续 2-4 周的产品原则：

> 不继续堆功能，先把“记录和陪伴”做成可安全内测、可灰度上架、可承载真实家庭数据的可信系统。

## 2. 发布 Gate

### 2.1 R0：当前内部开发态

允许范围：

- 开发者自测。
- 少量受信任设备安装。
- 使用邀请码和手动配置。
- Pro 能力作为验证态开放。

进入条件：

- `bash harness/init.sh` 通过。
- `docs/release-readiness-review-2026-06-04.md` 和本文档已存在，后续 agent 有统一方向。

退出条件：

- 完成 R1 必需项，才扩大到真实家庭内测。

### 2.2 R1：受控真实家庭内测，5-10 个家庭

允许范围：

- 邀请码制。
- 手动 Pro 白名单。
- 不接真实支付。
- 明确告知内测阶段和非医疗边界。

进入条件：

- P0-A1 日志和手机号脱敏完成。
- P0-A2 query token 收敛完成，普通 API 不再接受 URL token。
- P0-P1 隐私、儿童信息、AI 数据使用说明有 App 内入口。
- P0-O1 每日备份和部署前备份生效，并完成一次恢复演练。
- P0-D1 至少一台 iOS 和一台 Android 真机跑完核心路径。

退出条件：

- 完成 R2 所需的短信验证码、HTTPS 域名、额度控制、深度健康、压测和渠道材料。

### 2.3 R2：渠道灰度或 TestFlight，20-100 个家庭

允许范围：

- TestFlight 或国内安卓受控灰度。
- 继续邀请码制。
- Pro 继续手动白名单或内测申请。
- 不做公开买量，不做公开收费订阅。

进入条件：

- P0-A3 短信验证码登录闭环完成。
- P0-C1 HTTPS 域名和备案准备完成，生产包不访问裸 IP。
- P0-Pro1 entitlement gating 和配额控制完成。
- P0-C3 深度健康检查、基础监控和告警完成。
- P0-C4 灰度容量压测通过或明确限制灰度规模。
- P0-D2 真机权限、通知、闹铃、ASR、媒体选择、OTA 通过记录。
- P0-T1 首登家庭边界、AI 非诊疗、客服反馈入口完成。

退出条件：

- 真实用户问题闭环两轮以上；AI 成本、上传失败、登录失败和崩溃问题可追踪。

### 2.4 R3：公开上架和公开收费

允许范围：

- App Store/国内安卓公开上架。
- 受控公开注册。
- 已接入合规支付后才开放公开收费订阅。

进入条件：

- R2 运行稳定。
- APP 备案、隐私政策、儿童信息规则、权限/SDK 清单、第三方服务清单齐全。
- 数据删除、导出、账号注销至少有 App 内自助或工单闭环。
- 支付前置条件完成：IAP/安卓支付、服务端订阅状态、恢复购买、协议、客服、退款/取消说明。
- 压测结果支持目标放量，或产品侧仍保留邀请码/排队机制。

## 3. 优先级总表

| 优先级 | 主题 | 需求编号 | 目标 |
| --- | --- | --- | --- |
| P0 | 账号安全 | REQ-AUTH-001 至 REQ-AUTH-005 | 手机号真实校验、风控、防枚举、会话安全 |
| P0 | 隐私合规 | REQ-PRIV-001 至 REQ-PRIV-004 | 隐私、儿童信息、AI 使用、删除导出 |
| P0 | Free/Pro | REQ-PRO-001 至 REQ-PRO-006 | 恢复真实权益、家庭级额度、成本可控 |
| P0 | 云端运维 | REQ-OPS-001 至 REQ-OPS-007 | HTTPS、备份、监控、压测、数据保护 |
| P0 | 真机验证 | REQ-DEVICE-001 至 REQ-DEVICE-006 | 通知、闹铃、ASR、媒体、OTA、键盘安全区 |
| P0 | 产品信任 | REQ-TRUST-001 至 REQ-TRUST-005 | 首登说明、家庭边界、AI 非诊疗、反馈渠道 |
| P1 | 支付订阅 | REQ-PAY-001 至 REQ-PAY-004 | 正式收费订阅前置能力 |
| P1 | 架构扩容 | REQ-SCALE-001 至 REQ-SCALE-005 | DB、Redis、队列、OSS/CDN、多实例 |
| P2 | 长期陪跑 | REQ-LONG-001 至 REQ-LONG-003 | 0-3 岁长期记录沉淀，不扩成内容平台 |

## 4. 非目标

本阶段明确不做：

- 电商、导购、商品推荐、广告画像。
- 专家 IP、医生问诊、付费课程、知识付费。
- 开放社区、同龄家庭广场、公开内容发布。
- 公开收费订阅的第一阶段上线；P0 只做内测白名单和额度。
- 把成长数据维护继续作为独立扩张主线；它只作为记录域的一部分保持稳定。
- 睡眠/喂养预测模型、同龄排名、百分位焦虑化展示。
- 在没有恢复演练和压测前承诺公开流量承载。

## 5. P0-A：账号、安全与隐私

### REQ-AUTH-001：短信验证码发送

目标：手机号登录不再只依赖用户输入和邀请码，公开灰度前完成真实短信校验。

接口规格：

```http
POST /api/auth/sms/send
Content-Type: application/json

{
  "phone": "13800008888",
  "inviteCode": "AUTH-CODE-1",
  "scene": "login",
  "deviceId": "web-or-native-device-id"
}
```

成功响应：

```json
{
  "requestId": "sms-req-uuid",
  "maskedPhone": "138****8888",
  "resendAfterSeconds": 60,
  "expiresInSeconds": 300
}
```

行为要求：

- `phone` 必须符合当前中国手机号规则。
- `inviteCode` 在 login 场景下继续校验，但错误响应不暴露手机号是否注册。
- 同手机号 60 秒内不可重复发送。
- 同手机号、同 IP、同 deviceId 的失败和发送次数都进入限流。
- 非生产环境可使用 mock provider；生产环境必须接短信 provider。
- 短信验证码只保存 hash，不保存明文。

推荐数据结构：

| 字段 | 说明 |
| --- | --- |
| `id` | `sms-req-*` |
| `phone_hash` | 归一化手机号 hash |
| `phone_masked` | 脱敏手机号，用于展示和排查 |
| `code_hash` | 验证码 hash |
| `scene` | `login`、后续可扩展 `bind_phone` |
| `remote_key_hash` | IP 或代理后的 remote key hash |
| `device_id_hash` | 设备标识 hash |
| `provider` | `mock`、`aliyun` 或其他 provider |
| `provider_request_id` | 短信平台请求 id |
| `expires_at` | 过期时间 |
| `attempt_count` | 校验尝试次数 |
| `used_at` | 成功使用时间 |
| `created_at` | 创建时间 |
| `status` | `sent`、`failed`、`used`、`expired` |

验收标准：

- 单测覆盖发送成功、60 秒重复发送、错误手机号、错误邀请码、provider 失败。
- 生产配置缺失短信 provider 时启动失败或发送接口返回明确配置错误，不静默通过。
- 日志只记录 `maskedPhone`、requestId、provider_request_id，不记录验证码明文。

### REQ-AUTH-002：验证码登录校验

目标：`POST /api/auth/login` 必须验证 smsCode，再签发 JWT。

接口调整：

```json
{
  "phone": "13800008888",
  "inviteCode": "AUTH-CODE-1",
  "smsRequestId": "sms-req-uuid",
  "smsCode": "123456",
  "roleName": "妈妈",
  "caregiver": true
}
```

行为要求：

- `smsCode` 在 R2 生产配置中为必填。
- 开发和自动化测试可通过 profile 使用固定测试码，但必须被配置隔离。
- 验证成功后标记验证码已使用，同一验证码不能二次登录。
- 验证失败达到阈值后该 requestId 失效。
- 登录失败文案统一为“手机号、验证码或邀请码不正确，请确认后再试”，避免枚举。
- 保持现有家庭角色选择和邀请码加入逻辑，不改变家庭共享模型。

验收标准：

- `AuthControllerTests` 覆盖正确验证码、错误验证码、过期验证码、重复使用、缺验证码、旧测试 profile。
- 前端登录页覆盖发送验证码、倒计时、重发、输入错误、弱网失败。
- 云端 smoke 用测试短信 provider 或受控手机号完成一次登录。

### REQ-AUTH-003：登录风控持久化

目标：登录和短信频控不能只依赖单 JVM 内存。

行为要求：

- 单 ECS 阶段可先持久化到 SQLite 表。
- R3 或多实例前迁移到 Redis。
- 风控维度至少包含 phoneHash、remoteKeyHash、deviceIdHash、inviteCodeHash。
- 失败计数窗口：10 分钟内 8 次失败进入冷却；短信发送 1 分钟重发、1 小时上限、1 天上限。
- 冷却文案不暴露哪一项触发了限制。

验收标准：

- 重启服务后，冷却状态仍然存在。
- 同一手机号换 deviceId 仍受手机号维度限制。
- 同一 IP 批量撞库时被 remoteKey 维度限制。

### REQ-AUTH-004：手机号脱敏和最小返回

目标：API、UI、日志默认不暴露完整手机号。

行为要求：

- `AuthUserDto` 增加或替换 `maskedPhone`；普通 API 默认只返回脱敏手机号。
- 前端 `AuthUser` 展示脱敏手机号；确需完整手机号的场景只在本人登录安全页展示，并有明确理由。
- `ProTrialApplicationRecord` 可以保存真实手机号用于内测联系，但对前端和日志只输出脱敏值。
- `PhoneMasking.mask("13800008888")` 返回 `138****8888`。

验收标准：

- API contract 测试断言 `/api/auth/me`、登录响应、成员展示没有完整手机号。
- `RequestLoggingFilter` 单测或日志格式测试断言日志 phone 字段为脱敏值。
- 前端 smoke 断言“我的/家庭成员/登录识别”展示 `****`。

### REQ-AUTH-005：Query token 收敛

目标：普通 API 不再接受 URL query token。

行为要求：

- `AuthTokenFilter` 只接受 `Authorization: Bearer` 作为普通 API 鉴权。
- `frontend/src/authApi.ts` 中 `withAuthQuery` 的调用点必须迁移到 Bearer、短期签名 URL 或连接级鉴权。
- 文件下载、缩略图、WebSocket、ASR 如果需要非 header 鉴权，使用短期签名 token，作用域限定为单资源/单连接，过期时间不超过 5 分钟。
- 日志和前端 console 不输出 token。

验收标准：

- 带 `?token=` 调普通 API 返回 401。
- 带 Bearer 调同一 API 成功。
- 缩略图/媒体/ASR 有独立鉴权测试，且 token 不进入 request log。

### REQ-PRIV-001：隐私政策、用户协议、儿童信息规则

目标：公开灰度前，用户在 App 内能读到并同意正式文本。

内容要求：

- 收集字段：手机号、家庭、宝宝资料、照护记录、成长数据、媒体、账本、AI 交互、设备和日志。
- 使用目的：记录、提醒、家庭同步、AI 整理、稳定性、安全和成本控制。
- 家庭共享范围和账号私有范围分别说明。
- 第三方服务清单：云服务器、OSS、模型服务、短信服务、分发/日志相关服务。
- 儿童信息规则：监护人同意、最小必要、敏感信息、删除/更正方式。
- AI 数据处理说明：文本、图片、视频可能被第三方模型处理；结果不构成医疗诊断。

验收标准：

- 首登必须勾选同意，未同意不能进入 App。
- 设置页可再次打开政策、协议、儿童信息规则。
- 文本中的第三方服务与代码和环境配置一致。

### REQ-PRIV-002：删除、导出和注销入口

目标：用户有明确的数据权利入口，即使第一版是人工处理。

行为要求：

- 设置页提供“数据导出”“删除家庭数据”“删除媒体”“注销账号”入口。
- 第一版可以创建人工工单，但必须生成 requestId 和处理说明。
- 注销账号需要二次确认，说明对家庭共享数据和账号私有数据的影响。
- 家庭共享数据删除需要家庭管理员或主要照护人确认。
- 已删除记录不再进入后续 AI 整理。

验收标准：

- 前端能提交请求并展示 requestId。
- 后端保存请求状态、类型、申请人、familyId、createdAt。
- 人工处理完成后可标记 resolved，并保留处理摘要。

### REQ-PRIV-003：AI 数据来源说明

目标：用户知道 AI 会读取哪些宝宝数据来做整理和陪伴。

行为要求：

- `小宝今日观察`、聊天 AI 入口和 Pro 能力页展示短说明。
- 说明必须使用用户语言，不出现 provider、token、prompt 等技术字段。
- 说明覆盖：照护记录、成长数据、提醒、相册附件、AI 对话。
- 明确删除后的数据不会进入后续整理。
- 明确 AI 结果仅供记录整理和一般科普，不替代医生。

验收标准：

- `npm run verify:frontend` 中包含入口可见性。
- Agent benchmark 保持高风险/医疗边界覆盖。

### REQ-PRIV-004：备案与渠道材料

目标：R2/R3 前完成渠道合规材料。

交付物：

- APP 备案信息和备案号展示位置。
- 官网/隐私页/协议页可访问。
- 权限说明：麦克风、相册/相机、通知、网络、文件访问。
- SDK/第三方服务清单。
- iOS 隐私营养标签材料。
- 国内安卓隐私合规自查材料。

验收标准：

- 生产包权限与材料一致。
- App 内和官网能看到备案号、隐私政策和客服入口。

## 6. P0-B：Free/Pro、额度和成本控制

### REQ-PRO-001：恢复真实 Pro entitlement

目标：`ProTrialService.isProEnabled(familyId)` 不再固定返回 true。

行为要求：

- `isProEnabled` 使用家庭 entitlement：enabled、planCode、startsAt、expiresAt。
- `requireProCaregiver` 同时校验 caregiver 和 entitlement。
- entitlement 到期后不允许发起新的 Pro 高成本能力。
- 到期后历史数据仍可查看、导出、删除。

验收标准：

- `ProTrialControllerTests` 中被禁用的 gating 测试恢复并通过。
- Free 家庭触发 Pro 能力得到可理解的 Pro 入口，不是 500 或空白。
- Pro 家庭可正常使用同一能力。

### REQ-PRO-002：Free/Pro 权益矩阵

目标：核心记录不被付费墙破坏，Pro 只卖“少输入、少遗漏、自动整理”。

| 能力 | Free | Pro/内测白名单 | 说明 |
| --- | --- | --- | --- |
| 文本照护记录 | 可用 | 可用 | 记录主线必须免费可用 |
| 语音输入 | 可用但有基础限流 | 更高额度 | 语音是低摩擦记录，不宜完全锁死 |
| 基础提醒 | 可用 | 可用 | 家庭信任基础能力 |
| 基础相册浏览和手动上传 | 可用 | 可用 | 不锁历史数据 |
| 成长数据新增/编辑/删除 | 可用 | 可用 | 记录域基础能力 |
| 账本基础记录 | 可用 | 可用 | 已有记录域，不作为 Pro 核心卖点 |
| 图片 AI 理解 | 不可用或低试用额度 | 可用，有日额度 | 高成本能力 |
| 视频 AI 理解 | 不可用 | 可用，有周额度 | 高成本能力 |
| 每日/周/月自动整理 | 基础今日观察 | 高级周报/月报和更多整理 | Pro 卖省心，不卖焦虑 |
| 高级趋势洞察 | 不可用 | 可用，有日额度 | 不做同龄排名 |
| 数据导出和删除 | 可用 | 可用 | 数据权利不能付费化 |

验收标准：

- 权益页、Pro 入口、超限文案与后端 gating 一致。
- Free 用户能完成一整天基础记录。
- Pro 入口不使用“落后、错过、危险”等焦虑化文案。

### REQ-PRO-003：家庭级额度策略

目标：AI 成本和体验都可控。

默认额度建议：

| 维度 | 第一阶段默认值 | 口径 |
| --- | --- | --- |
| 图片理解 | 每家庭每天 3 次 | 只统计触发模型视觉理解的请求 |
| 视频理解 | 每家庭每周 1 次 | 限文件大小和时长 |
| 每日漏项小结 | 每家庭每天 1 次 | 用户主动或轻提醒 |
| 周报 | 每家庭每周 1 次 | 用户主动生成 |
| 月报 | 每家庭每月 1 次 | 低频能力 |
| 高级趋势洞察 | 每家庭每天 1-2 次 | 优先用结构化数据 |
| 周 token | 每家庭 100k-200k | 先软告警，再硬限制 |
| 月 token | 每家庭 400k-800k | 和真实账单校准 |

行为要求：

- 额度以 familyId 为主维度，userId 和 feature 作为辅助统计。
- `ai_usage_log` 必须记录 provider、model、feature、input_type、tokens、success、quota_counted。
- 无 token 返回时记录估算值并标记估算。
- 超限时不暴露 token/provider/model，只告诉用户“本周试用额度已用完”或“今天的图片理解次数已用完”。

验收标准：

- 后端单测覆盖额度不足、额度恢复、白名单调整、到期限制。
- 每周可导出家庭级成本表。
- 超限 UI 有明确原因和内测联系入口。

### REQ-PRO-004：Quota 数据结构

目标：先用轻量结构支持单 ECS，后续可迁移 Redis/托管 DB。

推荐结构：

| 表/配置 | 责任 |
| --- | --- |
| `pro_trial_entitlement` | 家庭是否拥有 Pro 内测权益 |
| `ai_usage_log` | 每次 AI 调用明细，当前已有基础 |
| `pro_quota_policy` | planCode 对应默认额度 |
| `pro_quota_usage_daily` | 按 familyId/date/feature 汇总日额度 |
| `pro_quota_usage_weekly` | 按 familyId/week/feature 汇总周额度 |
| `pro_quota_override` | 对特定家庭手动调整额度和到期时间 |

第一版可以将 policy 写在配置文件，但 usage 和 override 必须可查询，避免只靠日志排查。

验收标准：

- 任意家庭能查到今日/本周用量和剩余额度。
- 管理员能用脚本调整家庭额度和到期时间。
- Quota 汇总可重复执行，不因重复任务造成双计数。

### REQ-PRO-005：Pro UI 和文案

目标：Pro 入口是“省心”而不是“焦虑刺激”。

行为要求：

- 触发高成本能力时展示 Pro 入口：图片理解、视频理解、周报/月报、高级趋势。
- 文案锚点固定为“少输入、少遗漏、自动整理”。
- 不使用“错过关键期”“不买会影响宝宝”等表达。
- 内测阶段展示“申请 Pro 内测”，不展示正式价格。
- 到期或超限展示自然语言和可联系入口。

验收标准：

- Free/Pro 双账号 smoke 覆盖同一入口。
- Pro 入口和商业化文档口径一致。

### REQ-PRO-006：支付不进入 P0

目标：P0 不接真实支付，避免在合规和产品信任不足时提前收费。

P1 支付前置条件：

- iOS 数字会员走 Apple IAP。
- 国内安卓渠道支付和私域支付单独评估。
- 后端校验 receipt/transaction，维护订阅状态。
- 支持恢复购买、取消、过期、退款处理。
- 订阅页清晰展示价格、周期、权益、试用、取消方式。

验收标准：

- P0 不出现真实支付入口。
- R3 前沙盒支付全路径通过，协议和客服入口齐全。

## 7. P0-C：云端、数据和访问量承载

### REQ-OPS-001：HTTPS、域名和 CORS

目标：生产 App 不访问裸 IP，公网访问统一走 HTTPS。

行为要求：

- 申请正式域名并启用 HTTPS。
- Nginx 或云负载均衡反代到后端 8300。
- HTTP 自动跳转 HTTPS。
- CORS 只允许正式域名、开发 localhost、Capacitor scheme。
- 生产 `VITE_AGENT_API_BASE_URL` 不再指向 `http://120.55.188.242:8300`。
- 官网、隐私页、协议页、备案号页面可访问。

验收标准：

- `https://<domain>/api/health` 返回 ok。
- 生产包扫描不含裸 IP API base URL。
- HTTP 访问跳 HTTPS。

### REQ-OPS-002：备份和恢复演练

目标：真实家庭数据有可验证恢复能力。

行为要求：

- SQLite 每日自动备份，保留策略为 7 天每日、30 天每周、90 天每月。
- 每次 `deploy:aliyun` 前自动生成 DB 快照。
- 媒体文件和 DB 分开备份；OSS 开启版本控制或生命周期策略。
- 提供恢复脚本：新目录恢复 DB、媒体、mobile-updates manifest，并启动服务。
- 恢复演练每月至少一次，记录文件大小、耗时、校验结果。
- 默认部署继续使用 `SYNC_DATA=0`，禁止覆盖生产数据。

验收标准：

- 备份脚本和恢复脚本可执行。
- 最近一次恢复演练记录在 harness 或 docs。
- 部署日志能看到备份是否成功。

### REQ-OPS-003：深度健康检查

目标：`/api/health` 之外有能发现真实依赖问题的探针。

接口建议：

```http
GET /api/ops/health/deep
Authorization: Bearer <admin-or-internal-token>
```

检查项：

| 检查 | 目标 |
| --- | --- |
| DB read | 能读取 schema/version |
| DB write | 能写入临时探针或事务回滚 |
| Storage | 本地目录或 OSS 可写可读 |
| Mobile update | manifest 可读，bundle URL 可生成 |
| Model config | 必要模型 key/profile 存在，不输出密钥 |
| SMS config | 生产 provider 已配置 |
| Disk | 数据目录剩余空间足够 |
| Time | 服务器时间偏移在可接受范围内 |

验收标准：

- 普通用户不能访问深度健康。
- 深度健康失败时返回具体非敏感项。
- 运维报告能区分普通健康 ok 和深度健康失败。

### REQ-OPS-004：可观测与脱敏日志

目标：生产问题能从 requestId 追踪到用户体验、Agent trace 和成本，同时不泄漏敏感信息。

指标要求：

- 请求量、状态码、P50/P95/P99 latency。
- 登录失败、短信发送失败、验证码失败。
- AI 请求耗时、首进度事件耗时、模型失败、fallback。
- 上传成功率、上传大小、缩略图生成失败。
- DB busy/locked、事务耗时、WAL 文件大小。
- AI token 和估算成本。
- 磁盘、内存、CPU、带宽。
- OTA manifest 下载和 bundle 下载失败率。

告警要求：

- 5xx 比例超过阈值。
- 磁盘 > 80%。
- 备份失败。
- DB busy 持续出现。
- AI 成本超过周预算。
- OTA manifest 或 bundle 无法下载。

验收标准：

- 日志中无完整手机号、验证码、JWT、模型 key。
- 生产问题可以通过 requestId 找到相关 Agent trace 和 usage log。
- 每周可生成一页内测运行报告。

### REQ-OPS-005：发布前压测

目标：用压测决定灰度规模，而不是口头承诺容量。

灰度目标场景：

- 100 个家庭。
- 20 个并发用户。
- 每分钟 30 次普通 API。
- 每分钟 5 次 AI 请求。
- 并发上传 3 个 20MB 文件。

通过标准：

- 普通 API P95 < 800ms，不含 AI 模型耗时。
- AI 首进度事件 P95 < 5s。
- 上传失败率 < 1%，大文件有明确进度和失败重试。
- 无持续 `SQLITE_BUSY`。
- WAL 文件不异常膨胀。
- CPU、内存、磁盘、带宽有余量。

验收标准：

- 压测报告包含命令、数据集、机器规格、结果、瓶颈、调参记录。
- 未达标时只能邀请码灰度，不公开放量。

### REQ-OPS-006：媒体与 OTA 走 OSS/CDN

目标：媒体和 OTA 不压垮单 ECS 带宽和磁盘。

行为要求：

- 生产媒体上传优先走 OSS。
- 缩略图和原图访问使用签名 URL 或私有读代理。
- OTA bundle 优先放 OSS，后续接 CDN。
- 本地 ECS 只保留 manifest 和必要缓存。
- 大图、大视频上传有大小限制、失败重试和用户可理解提示。

验收标准：

- OTA check 对旧版本返回 `updateAvailable=true`，当前版本返回 `false`。
- OSS bundle checksum 校验通过。
- 媒体上传失败不会造成 app_state 半写入。

### REQ-OPS-007：生产数据保护

目标：任何部署都不能误覆盖真实家庭数据。

行为要求：

- 部署脚本默认 `SYNC_DATA=0`。
- 任何数据迁移、修复、重置都需要显式命令和备份。
- 生产数据脚本必须打印目标 host、DB path、备份 path、影响 familyId。
- 对用户数据的人工修复必须记录原因、操作、备份、验证结果。

验收标准：

- 部署脚本没有默认同步本地 data 到生产。
- 人工数据修复记录可追溯。

## 8. P0-D：真机验证

### REQ-DEVICE-001：通知和提醒

目标：提醒不是只有 Web smoke 通过，而是真机可达。

验收矩阵：

| 场景 | iOS | Android |
| --- | --- | --- |
| 首次请求通知权限 | 必测 | 必测 |
| 用户拒绝权限后的降级文案 | 必测 | 必测 |
| 一次性提醒到点触发 | 必测 | 必测 |
| 循环提醒触发 | 必测 | 必测 |
| App 后台提醒 | 必测 | 必测 |
| 只读成员不能改家庭共享提醒 | 必测 | 必测 |

验收标准：

- 有设备型号、系统版本、App build、截图或录屏记录。
- 失败时有用户可理解的降级文案。

### REQ-DEVICE-002：全屏响铃和闹铃降级

目标：高优先级闹铃能力在权限不足时不表现成静默失败。

行为要求：

- Android 测全屏通知、锁屏、勿扰限制和电池优化影响。
- iOS 明确只支持通知级提醒，不承诺 Android 式全屏闹铃。
- 权限不足时解释如何开启或切换为普通提醒。

验收标准：

- Android 至少一台主流机型验证。
- iOS 文案不承诺系统不允许的能力。

### REQ-DEVICE-003：ASR 语音输入

目标：语音记录在真机上可用、可失败、可恢复。

场景：

- 首次麦克风权限。
- 开始录音、松手发送、取消录音。
- 弱网/断网。
- ASR provider 失败。
- 长录音超时。
- 只读成员语音问答和记录边界。

验收标准：

- 录音失败不会丢失用户输入意图。
- ASR 错误提示不暴露 provider 技术细节。

### REQ-DEVICE-004：媒体选择、拍照和上传

目标：照片和视频链路在真机上稳定。

场景：

- 相册选择单图、多图。
- 拍照上传。
- 视频选择和大小限制。
- 上传中断和重试。
- 截图忽略、生活照自动入相册。
- 上传后 app_state 刷新不覆盖 optimistic album item。

验收标准：

- iOS/Android 各完成照片和视频上传。
- 大文件失败有明确提示，不出现永久 loading。

### REQ-DEVICE-005：OTA 更新

目标：移动更新能在真机上从旧版本升级到新版本。

场景：

- 旧 bundle 检测到新版本。
- 下载进度可见。
- 校验失败能回退。
- 当前 bundle 检测为 up-to-date。
- 弱网下载失败可重试。

验收标准：

- `POST /api/mobile-updates/check` 旧/新版本探针通过。
- 真机完成一次安装后 OTA。

### REQ-DEVICE-006：安全区、键盘和触感

目标：移动端常见交互不遮挡、不误触。

场景：

- iPhone 刘海/底部 home indicator。
- Android 手势导航。
- 聊天输入法弹起。
- 长按语音按钮 pointer drift。
- haptics 权限和不可用降级。

验收标准：

- `npm run verify:frontend` 继续作为 Web 视口 gate。
- 真机记录覆盖至少一个 iOS 和一个 Android。

## 9. P0-E：产品信任和发布 UX

### REQ-TRUST-001：首登家庭边界说明

目标：用户一开始就知道哪些数据全家可见、哪些只自己可见。

行为要求：

- 首登三步内解释家庭共享数据：宝宝资料、照护记录、成长数据、相册、账本。
- 解释账号私有数据：聊天记录、个人提醒、待确认卡片、个人记忆和会话摘要。
- 加入家庭时展示家庭名、角色、是否照护人、只读状态。
- 只读成员看到明确只读说明，不把禁用态误以为出 bug。

验收标准：

- 新照护人、新只读成员、已有成员再登录各有 smoke 或 cloud E2E。
- UI 不出现内部字段名。

### REQ-TRUST-002：核心记录路径 E2E

目标：公开灰度前，用户最常走的记录路径有端到端证据。

路径：

1. 登录。
2. 首登资料。
3. 聊天文本记录。
4. 语音记录。
5. 照片入相册。
6. 成长数据新增/编辑/删除。
7. 提醒创建和到点。
8. 账本记录。
9. 今日观察和交接摘要。
10. 退出登录和再次登录。

验收标准：

- Web smoke、agent benchmark、cloud E2E 分层覆盖。
- 至少一次真实云端测试账号验证持久化。
- 多账号共享边界覆盖 caregiver/read-only/different-family。

### REQ-TRUST-003：AI 非诊疗和低焦虑口径

目标：AI 可以陪伴，但不能诊断、吓人或替代医生。

行为要求：

- 疲惫、自责、无助表达：承接情绪，基于已有数据说明事实，鼓励交接和休息。
- 高烧、呼吸异常、外伤、用药、精神危机：进入线下医生/急救/家人支持边界。
- 不生成药物剂量、诊断结论、治疗方案。
- App Store 描述、隐私政策、AI 入口、AI 回复口径一致。

验收标准：

- Agent benchmark 覆盖高风险输入和照护人疲惫输入。
- 人工抽样真实模型回复，不出现诊断和药物剂量承诺。

### REQ-TRUST-004：反馈和客服入口

目标：内测家庭遇到问题时能低成本反馈。

行为要求：

- 设置页提供“反馈问题”入口。
- 反馈带上 requestId、App version、bundle version、device info、当前页面。
- 用户可选择是否附带最近错误日志摘要。
- 不默认上传聊天正文和宝宝媒体。

验收标准：

- 后端保存反馈请求或生成外部工单。
- 反馈日志脱敏。

### REQ-TRUST-005：发布文案一致性

目标：对外描述和产品真实能力一致。

要求：

- 主描述：记录和陪伴。
- AI 描述：辅助整理、低焦虑陪伴、一般科普，不是医生。
- Pro 描述：少输入、少遗漏、自动整理。
- 不写电商、专家、社区、预测排名。
- 不承诺无限云空间、永久免费、高准确率诊断。

验收标准：

- App Store/安卓渠道/官网/隐私政策/产品内文案互相一致。

## 10. P1/P2 路线

### P1：支付订阅前置

REQ-PAY-001：iOS IAP 和恢复购买。

REQ-PAY-002：国内安卓支付和私域支付评估，不能在 iOS App 内引导绕开 IAP。

REQ-PAY-003：服务端订阅状态、过期、取消、退款、恢复购买。

REQ-PAY-004：会员服务协议、自动续费协议、客服、退款/取消说明。

进入条件：

- R2 灰度稳定。
- Pro 付费意愿有真实证据。
- P0 隐私和数据权利闭环完成。

### P1：架构扩容

REQ-SCALE-001：SQLite 迁移到托管 MySQL/PostgreSQL。

REQ-SCALE-002：Redis 承担验证码、限流、session blacklist、队列状态。

REQ-SCALE-003：Agent/视觉/日报/周报进入异步任务队列。

REQ-SCALE-004：媒体统一 OSS + CDN，缩略图异步生成。

REQ-SCALE-005：Spring Boot 多实例部署，前面接负载均衡。

触发条件：

- 真实家庭超过低百级。
- 压测显示 SQLite 写锁或带宽成为瓶颈。
- AI 请求耗时和队列堆积影响核心记录。

### P2：0-3 岁长期陪跑

REQ-LONG-001：近 7/30 天儿保资料摘要，支持复制和导出。

REQ-LONG-002：0-3 岁记录域扩展：辅食、过敏、发热事实记录、托育交接、语言动作里程碑。

REQ-LONG-003：月度小故事：照片、里程碑、照护事实整理，不做排名和焦虑化预测。

进入条件：

- R2/R3 基础发布能力稳定。
- 核心记录留存和家庭交接价值被真实家庭验证。

## 11. 实施拆分建议

### Sprint 0：当前文档收敛

目标：只完成 spec，不动产品代码。

交付：

- 本文档。
- harness 进度记录。
- 文档自检通过。

### Sprint 1：账号、安全、隐私

目标：R1/R2 的安全底座。

范围：

- 短信验证码发送和校验。
- 登录风控持久化。
- 手机号脱敏和日志脱敏。
- query token 收敛。
- 隐私政策、儿童信息规则、数据删除/导出/注销请求入口。

最小验证：

- `bash harness/init.sh`
- 后端 auth/privacy targeted tests。
- 前端登录和设置 smoke。
- `git diff --check`

### Sprint 2：Pro gating、额度和产品信任

目标：把 Pro 从验证壳变成真实内测机制。

范围：

- 恢复 entitlement gating。
- 家庭级额度和 usage 汇总。
- Free/Pro 权益页和超限文案。
- 首登家庭边界说明。
- AI 来源说明和反馈入口。

最小验证：

- `npm run test:agent-benchmark`
- `npm run test:agent-l2:unit`
- `npm run verify:frontend`
- Free/Pro 双账号 cloud E2E。

### Sprint 3：云端、真机和压测

目标：R2 灰度前的运维和设备证据。

范围：

- HTTPS 域名、CORS、备案展示。
- 备份脚本、恢复脚本、恢复演练。
- 深度健康、监控、告警、运行周报。
- OSS/CDN 媒体和 OTA 路径。
- 压测脚本和报告。
- iOS/Android 真机矩阵。

最小验证：

- `bash harness/init.sh`
- `npm run mobile:sync`
- `npm run build:ios:debug` 或记录本地环境阻塞原因。
- `npm run build:android:debug` 或记录本地环境阻塞原因。
- 云端 health、deep health、OTA stale/current probe。
- 恢复演练记录。

### Sprint 4：R2 渠道灰度准备

目标：可以邀请 20-100 个家庭，而不是公开放量。

范围：

- TestFlight/安卓灰度材料。
- 隐私营养标签、权限说明、截图、描述。
- 客服反馈流程。
- 两轮真实家庭问题闭环。
- 灰度规模和成本阈值。

最小验证：

- 上架材料检查。
- 内测运营周报。
- 生产错误和 AI 成本周报。

## 12. 验证矩阵

| 变更类型 | 必跑命令或证据 |
| --- | --- |
| 文档/spec | 文档完成度扫描无命中，`git diff --check` |
| 基线 | `bash harness/init.sh` |
| 登录/安全 | 后端 Auth targeted tests，登录前端 smoke |
| Agent 行为 | `npm run test:agent-benchmark`，必要时 `npm run test:agent-l2:unit` |
| UI/移动布局 | `npm run verify:frontend` |
| Native 风险 | `npm run mobile:sync`，再尝试 `npm run build:ios:debug` 和 `npm run build:android:debug` |
| 云端部署 | `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun`，再验 `/api/health`、deep health、OTA stale/current |
| OTA | `POST /api/mobile-updates/check` 对旧版本返回 updateAvailable=true，对当前版本返回 false |
| 数据迁移/修复 | 先备份，记录 DB path、familyId、命令、验证结果 |

## 13. 准出定义

### R1 准出

- 日志和手机号脱敏完成。
- 普通 API 不接受 query token。
- 隐私、儿童信息、AI 数据使用说明有入口。
- 每日备份和一次恢复演练完成。
- iOS/Android 真机核心路径完成。

### R2 准出

- 短信验证码登录完成。
- HTTPS 域名、CORS、备案展示完成。
- Free/Pro gating 和额度完成。
- 深度健康、监控告警和压测报告完成。
- 通知、闹铃、ASR、媒体、OTA 真机验证完成。
- 首登家庭边界、AI 非诊疗、反馈入口完成。

### R3 准出

- R2 灰度问题完成两轮闭环。
- 账号注销、删除、导出流程可用。
- 支付订阅和协议材料完成。
- 扩容路线按压测结果执行或明确保留邀请码限制。
- App Store/国内安卓材料和实际能力一致。

## 14. 决策建议

下一步不要继续新增大功能。最优先开一个“发布硬化 Sprint 1”，只做账号、安全、隐私：

1. 短信验证码和登录风控。
2. 手机号/日志脱敏。
3. query token 收敛。
4. 隐私、儿童信息、AI 数据使用、删除导出入口。

这四项做完，小宝记才从“能给熟人内测”推进到“可以扩大真实家庭灰度”。之后再做 Pro 额度、云端压测和真机矩阵，最后才讨论公开上架和真实支付。

## 15. Claude×Codex 交叉 review 共识（2026-06-05）

经与 Claude 两轮交叉 review，本 spec 与 agent 架构优化 spec（`2026-06-05-agent-architecture-optimization.md`）协调到一条统一发布路线。以下修正叠加在前述 R0-R3 / REQ 之上。

### 15.1 R0.5「最小可内测」子集（R0 与 R1 之间）

原 R1 准出 5 项 + R2 准出 7+ 项对单人开发者过重，最早真实内测启动太慢。切出 R0.5：让 5-10 个真实家庭尽快用起来，但**不砍安全/合规项，只降实现深度**（Codex：R0.5 不能再砍）。

**R0.5 必做（不可再砍，只降深度）**：
- 日志 + 手机号脱敏（REQ-AUTH-004 日志部分）
- query token 收敛（REQ-AUTH-005）
- HTTPS + 正式域名（REQ-OPS-001）——真实家庭数据不能明文传输
- 隐私 + 儿童信息 + AI 数据使用说明**入口**（REQ-PRIV-001/003，首版文本可简）
- 删除/注销**最小人工通道**（REQ-PRIV-002，先工单 + requestId，不要求自助）
- AI 非诊疗边界（REQ-TRUST-003）
- 备份恢复**一次最小演练**（REQ-OPS-002，必须覆盖 DB+媒体+app_state 一致性）
- 能力矩阵 grounding + 反向校验 gate（来自 agent spec，防 AI 承诺幻觉）
- **内测知情同意 + 监护人确认**（新增漏项，见 15.3）
- **模型供应商/第三方 SDK 清单 + 数据处理口径**（新增漏项）
- **最小崩溃/白屏/OTA 失败采集**（新增漏项）

**短信能推到 R1 的前提**：5-10 家庭**全部邀请码 + 人工核验 + 短期 token**。做不到这三条，短信验证码必须提到 R0.5。

### 15.2 可从 P0 推后的项
- 短信验证码（REQ-AUTH-001/002/003）→ R1（前提见上）
- Pro entitlement + 家庭级额度（REQ-PRO-*）→ R1
- 100 家庭压测（REQ-OPS-005）→ R2（现在 ROI 低，先拿 10 家庭真实数据 + 备份演练）
- 完整监控告警（REQ-OPS-004 完整版）→ R1/R2（R0.5 只要最小崩溃/失败采集）
- OSS/CDN（REQ-OPS-006）→ R2

### 15.3 两份 spec 都漏的「真正会出事」项（Codex 指出，补入）

| 漏项 | 阶段 | 说明 |
|---|---|---|
| 内测知情同意 + 监护人确认 | R0.5 | 母婴 app 涉儿童信息，内测就要知情同意 + 监护人确认（合规底线）|
| 模型供应商/第三方 SDK 清单 + 数据处理口径 | R0.5 | 用户数据发给豆包/deepseek 等第三方模型，必须明确口径 |
| 最小崩溃/白屏/OTA 失败采集 | R0.5 | 无崩溃监控则线上出问题无感知 |
| 备份覆盖 DB+媒体+app_state 一致性 | R0.5 | careLog 等都在 app_state JSON 里，三者备份时点不一致会数据错乱 |
| 家庭邀请泄漏后的踢人/撤权/清 token | R1 | 邀请码泄漏的应急通道 |

### 15.4 成本表（单人开发者视角，定性 + 待真实报价校准）

| P0/R0.5 项 | 钱 | 工期 | 运维复杂度 |
|---|---|---|---|
| HTTPS + 域名 | 低（域名~几十元/年 + Let's Encrypt 免费）| ~0.5 天 | 低（certbot 自动续）|
| 日志/手机号脱敏 | 0 | ~1 天 | 低 |
| query token 收敛 | 0 | ~1-2 天 | 低 |
| 隐私/儿童信息/同意文本 | 0（自写）或低（模板）| ~1-2 天 | 低 |
| 备份恢复脚本 + 演练 | 0（OSS 存储极低）| ~1 天 | 中（需定期演练）|
| 能力矩阵反向校验 gate | 0 | ~0.5-1 天 | 低 |
| 崩溃/失败最小采集 | 0-低 | ~1 天 | 低 |
| 短信验证码（R1）| 中（~0.03-0.05 元/条 + provider）| ~2-3 天 | 中 |
| Pro 额度（R1）| 0 | ~2-3 天 | 中 |
| OSS/CDN（R2）| 中（按流量）| ~1-2 天 | 中 |
| 监控告警（R1/R2）| 低-中 | ~2-4 天 | 中-高 |
| 100 家庭压测（R2）| 低 | ~1-2 天 | 中 |

> 成本为单人开发者定性估算；短信/OSS/CDN/监控的实际单价需按 provider 真实报价校准后再排期。

## 16. R0.5 实现进度（2026-06-05，Claude 实现）

按 15 节统一发布路线，R0.5 已落地如下（均有 commit + 测试/演练证据）：

| R0.5 项 | 状态 | 证据 |
|---|---|---|
| 能力矩阵 grounding + 反向可达校验 gate（agent）| ✅ | `57b53f9` + `bfa69e5`，124 测试 + unit gate |
| 日志手机号脱敏 | ✅ | `fd0db81`，PhoneMaskingTests |
| API 手机号脱敏 | ✅ | `ed2c86a`，56 测试，单一 `toDto` chokepoint |
| 第三方数据处理口径清单 | ✅ | `2f3b85e` |
| 数据权利请求人工通道（导出/删除/注销）| ✅ | `f310a77`，DataRightsControllerTests 4 |
| query token 收敛（普通 API 只 Bearer，媒体白名单）| ✅ | `af345b8`，56 测试 |
| DB+媒体+app_state 一致性备份恢复 + 演练 | ✅ | `1454d75`，演练 PASS（25 表 row-for-row + dump shasum 一致）|
| HTTPS+域名+CORS 配置准备 | ✅ 文档 | `abe0e3f`，实际启用待正式域名+备案 |
| AI 非诊疗边界 | ✅ 已覆盖 | capability manifest `log_care_health`（cannot 诊断/开药）+ benchmark fever-risk/safety-refuse + SafetyGuardTests |
| 内测知情同意+监护人+AI数据说明入口 | ✅ | `8cc20e1`，ConsentGate 全屏同意+监护人勾选+AI数据说明入口，tsc 0 |
| 最小崩溃/失败采集 | ✅ | `e6526a5`，POST /api/client-errors，4 测试（前端 error boundary 后续）|

**剩余（明确后续）**：崩溃采集前端 error boundary；HTTPS 实际启用（需正式域名+备案，审核有周期，建议最先启动）；前端入口反向校验深化（agent spec）。**R1/R2 项**（短信验证码、Pro entitlement+额度、100家庭压测、完整监控告警、OSS/CDN、渠道材料、支付）按统一路线在 R0.5 稳定后推进。
