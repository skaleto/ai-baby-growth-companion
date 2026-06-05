# 安全风险与技术债清单

最近一次审计：2026-05-16（Claude，结合自动化 + 人工复核）
最近一次部署：`263c1da security: agent guards, jwt refresh, app state allowlist`（已上 main + ECS + OTA `0.1.0-202605170021`）
最近一次整理：2026-06-05（Codex，文件清理时校准当前状态）

本文件保留安全技术债历史。当前发布阻断和 R0.5/R1/R2 准出应优先看 `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`，实际会话状态看 `harness/claude-progress.md`。

本文件中 2026-05-16 以前的状态可能已经被后续 R0.5 改动覆盖；清理时只更新了能从当前代码直接确认的项目。

---

## 总览

| 编号 | 类别 | 风险 | 优先级 | 状态 | 估时 |
|------|------|------|--------|------|------|
| R1 | 隐私 | 账号私有 vs 家庭共享边界缺少 server-side 强制 | P1 | 完成（2026-05-17，已有 viewerCanReadSharedStateButCannotWrite + familyMembersShareRecordsAndAlbumsButNotChatOrReminders 测试钉住） | — |
| R2 | 安全 | 上传无 MIME / magic-bytes 白名单 | P1 | 完成（2026-05-17，AttachmentUploadRules.matchesMagicBytes + AttachmentUploadRulesTests 9 项） | 2h |
| R3 | 安全 | UploadController 缺少 controller 层 `requireCaregiver()` | P1 | 完成（2026-05-17，4 个端点全部显式 requireCaregiver/requirePrincipal） | 30min |
| R4 | 运维 | OTA 新版本未在真机验证过 | P1 | 完成（2026-05-17，用户手动验证） | 10min（手动） |
| R5 | 安全 | OSS access key 明文落盘 `/etc/ai-baby-growth-companion/` | P2 | TODO（已有方案） | 1h 工程 + 24h 观察 |
| R6 | 运维 | `deploy:aliyun` 脚本默认 `SYNC_DATA=1` 会覆盖生产 SQLite | P2 | 完成（2026-05-17，默认改 0 + 交互确认 + 文档同步） | 10min |
| R7 | 工程 | `App.tsx` 仍 8639 行（God component） | P2 | 部分（已抽 5 个 utils；App.tsx 8664→8428；后续抽 trend/icon helpers） | 多次 PR，~6h |
| R8 | 工程 | 测试覆盖薄弱（**修正**：原 audit 误报零测试，实际已有 22 个测试类） | P2 | 进展（2026-05-17 新增 AgentRequestGuardTests + AttachmentUploadRulesTests + AppStateController allowlist + Auth refresh，继续补 AgentPlanner 输入清洗等） | 持续投入 |
| R9 | 运维 | 无监控告警（rate limit / budget / 5xx / OTA 失败） | P2 | TODO | 4h |
| R10 | 数据 | SQLite schema 无版本化迁移（无 Flyway/Liquibase） | P3 | TODO | 30min 接入 |
| R11 | 安全 | Capacitor `allowMixedContent=true` + `cleartext=true` | P2 | TODO（依赖 HTTPS） | 看后端 HTTPS 进度 |
| R12 | 隐私 | `RequestLoggingFilter` 把手机号写进日志 | P3 | 完成（2026-06-05，`PhoneMasking` 已接入日志和 auth DTO 测试） | — |
| R13 | 工程 | `AgentRequestGuard` 内存版，多实例时失效 | P3 | 监控触发后再改 | — |
| R14 | 安全 | DeepSeek API 单点，无 fallback / 熔断 | P3 | 长期规划 | — |
| R15 | 安全 | `SecurityConfig.csrf.disable()` | P3 | TODO（影响有限） | 1h |
| R16 | 运维 | DeepSeek 用量无成本告警 | P3 | TODO | 2h |
| R17 | 工程 | Frontend `localStorage` 失败静默回退 | P3 | TODO | 30min |
| R18 | 架构 | 后端单实例无 HA，SPOF | P3 | 视体量决定 | — |

---

## R1 — 账号私有 vs 家庭共享边界

**风险**：现在所有家庭成员都能读 `growthEvents / careLogs / albumItems / expenses`，但 `messages / reminders / memories / pendingEffects` 是 account-private（按 `owner_user_id` 过滤）。**没有 UI 或后端字段允许 caregiver 标记某条记录为「私有」**，也没有「观察者只能看部分内容」的精细控制。

**影响**：观察者（如月嫂、亲友）可能看到 caregiver 本想私藏的备忘 / 育儿笔记。

**位置**：
- [AppStateService.readForUser](backend/src/main/java/com/xiaobao/babycompanion/service/AppStateService.java) line 132-151
- 数据模型：没有 `privacy: 'family'|'private'` 字段

**修复方案**：
1. 在 `growthEvents / albumItems / expenses` payload 加 `privacy` 字段
2. `readList` 接受 `principal` 参数，根据 `privacy` + role 过滤
3. 前端 UI 加「设为私有」开关

**估时**：4h（含 schema 变更 + UI）

---

## R2 — 上传无 MIME / magic-bytes 白名单

**风险**：`AttachmentStorageService.saveDataUrlAttachment` 等方法没有校验文件实际类型，只接收前端声明的 `kind` 和 `mimeType`。攻击者可以上传 `.html` / `.exe` 伪装成图片，后续如果被以 inline 方式 serve 就成 XSS 载体。

**位置**：
- [AttachmentStorageService.java](backend/src/main/java/com/xiaobao/babycompanion/service/AttachmentStorageService.java)
- [UploadController.java](backend/src/main/java/com/xiaobao/babycompanion/controller/UploadController.java)

**修复方案**：
1. 白名单允许的 MIME（`image/jpeg|png|webp|heic`、`video/mp4|quicktime`、`audio/m4a|wav`）
2. 用 magic bytes（前 8-16 字节）二次校验，不只信 header
3. OSS 返回时附 `Content-Disposition: attachment` 头，禁止浏览器 inline 渲染

**估时**：2h

---

## R3 — UploadController 缺 controller 层 `requireCaregiver()`

**风险**：`POST /api/uploads` 系列端点目前依赖 service 内部隐式 family 绑定，但没有像 `AppStateController` 那样在 controller 层显式 `requireCaregiver()`。观察者理论上能触发上传逻辑（虽然内部用 principal 的 familyId，但 fail-late 不如 fail-fast）。

**位置**：[UploadController.java:33-46](backend/src/main/java/com/xiaobao/babycompanion/controller/UploadController.java)

**修复方案**：每个端点入口加 `currentUser.requireCaregiver()`。

**估时**：30min

---

## R4 — OTA 真机验证

**风险**：`0.1.0-202605170021` 已发到 OSS，但**没人在真机或模拟器上跑过 `Capacitor Updater` 完整流程**。理论上拉得到，实际可能因为 native shell 缓存 / Capgo 版本不匹配 / 网络等原因失败。

**修复方案**：
1. 拿一台已装本 App 的真机
2. 彻底关闭 App（从最近任务清掉）
3. 重新打开，等待几秒
4. 在「我的」或开发者菜单查看版本号是否变成 `0.1.0-202605170021`
5. 验证关键功能：登录、发消息、看记录

**估时**：10min

---

## R5 — OSS Access Key 明文落盘 → 改 ECS RAM Role

**风险**：`/etc/ai-baby-growth-companion/aliyun_oss_access_key_id` 和 `_secret` 是文件存储的永久 AK，权限 640。一旦 ECS 被入侵或 root 凭证泄露，OSS 所有数据可被读 / 改 / 删。

**已有详细方案**：见本对话历史中"ECS RAM Role 全流程"。摘要：
1. 阿里云控制台创建 RAM 角色 + 最小权限策略 + 绑定 ECS（10min）
2. 代码改 `AttachmentStorageService` 和 `MobileUpdateService` 用 `InstanceProfileCredentialsProvider`（20min）
3. 双轨灰度切换（15min）
4. 24h 观察
5. 删除 ECS 上密钥文件 + 吊销永久 AK

**估时**：1h 工程 + 24h 观察

---

## R6 — `deploy:aliyun` 默认 `SYNC_DATA=1` 会覆盖生产

**风险**：脚本默认 `SYNC_DATA=1`，意味着忘记显式 `SYNC_DATA=0` 时会用本地 `backend/data/` 覆盖生产 SQLite。每次部署都是手雷。

**位置**：[scripts/deploy-aliyun-ecs.sh:15](scripts/deploy-aliyun-ecs.sh)

**修复方案**：
1. 默认改 `SYNC_DATA=0`
2. 想覆盖必须显式 `SYNC_DATA=1`
3. `SYNC_DATA=1` 时再加交互确认（`read -p`）

**估时**：10min

---

## R7 — `App.tsx` 8639 行（God Component）

**风险**：单文件难维护、难单测、难分担给协作者，新功能改动盲区大。

**已完成**：抽出 `frontend/src/utils/{aiUsage,uploadLimits,reminderAssets}.ts`（净减 25 行）。

**剩余拆分路线**：
1. 抽 `[App.tsx:554-1100](frontend/src/App.tsx)` 的 care / reminder / album / trend 纯函数到 `frontend/src/utils/recordHelpers.ts`（~500 行，**下一步**）
2. 抽顶层 `type definitions`（line 338-540）到 `frontend/src/appTypes.ts`
3. 按视图拆主组件：`ChatView` / `AlbumView` / `RecordView` / `ReminderView` / `LedgerView` / `ProfileView`，每个独立 PR

**估时**：每个 PR ~2h，全部完成 ~6h

---

## R8 — 零自动化测试覆盖

**风险**：前后端都没有 `*.test.*` / `*.spec.*` 文件。每次改动只能靠手工 / Playwright smoke。回归保护几乎为零。

**修复方案**（按优先级覆盖）：
1. `AppStateService` 家庭边界测试（`familyQuery` / `privateQuery` 跨家不可达）
2. `AgentRequestGuard` 测试（rate limit 触发 + 月度预算触发）
3. `JwtService` 测试（过期 / 篡改 / 正常签发）
4. `AuthService.refresh` 测试（有效 session / 过期 session）
5. 前端关键 hook 测试

**估时**：持续投入，建议至少先做 1-3

---

## R9 — 监控告警空白

**风险**：rate limit 触发率、月度 token 预算消耗、5xx 错误率、OTA 下载失败率、refresh 失败率，**目前没有任何指标 / 告警**。出问题只能事后看日志。

**修复方案**：
1. 接 Micrometer + Prometheus
2. 自定义 metric：
   - `agent_guard_rate_limit_hits{family_id=...}`
   - `agent_guard_budget_exhausted{family_id=...}`
   - `auth_refresh_failures`
   - `ota_check_requests` / `ota_bundle_serves`
3. Grafana / 钉钉告警：5xx 率 > 1%、月度 token 触顶、refresh 失败率突增

**估时**：4h

---

## R10 — SQLite Schema 无版本化迁移

**风险**：每次改 entity 字段都要赌运气。多实例 / 升级回滚场景脆弱。

**当前现实**：单机 SQLite + 单 caregiver 流量小，**短期内不会被烧到**。

**修复方案**：接 Flyway。详见对话历史中 "Flyway 接入" 段。

**估时**：30min

**优先级**：P3（等真的被烧到再做）

---

## R11 — Capacitor `allowMixedContent` + `cleartext`

**风险**：[capacitor.config.ts:9-14](capacitor.config.ts) 开了 `allowMixedContent=true` + `server.cleartext=true`，Android 9+ 默认禁止 cleartext，开了之后 HTTP 流量在不安全网络可被劫持。

**当前现实**：后端 `http://120.55.188.242:8300` 没 HTTPS，所以必须开这个。

**修复方案**：
1. 给 ECS 配 HTTPS（Nginx 反代 + Let's Encrypt 或阿里云 CDN）
2. 后端切到 HTTPS 后关闭 `cleartext / allowMixedContent`
3. 前端把 `VITE_AGENT_API_BASE_URL` 切到 `https://`

**估时**：2h（取决于域名 / 证书准备）

---

## R12 — 日志写手机号

**风险**：[RequestLoggingFilter.java:62-96](backend/src/main/java/com/xiaobao/babycompanion/config/RequestLoggingFilter.java) 把手机号原文写进日志。如果日志被 ship 到第三方或长期留存，存在 GDPR/CCPA 风险。

**修复方案**：
- 日志里只保留 `userId`（非 PII）
- 或脱敏：`13812345678` → `138****5678`

**估时**：30min

---

## R13 — `AgentRequestGuard` 内存版本

**风险**：现在 rate limit 用 in-memory `ConcurrentHashMap`，重启清零；如果未来横向扩 ECS 实例，每个实例独立计数。

**当前现实**：单实例 + 不频繁重启，**够用**。

**修复方案**（视未来需要）：换 Redis 实现，或用 Guava RateLimiter。

**优先级**：监控显示触发不准时再考虑

---

## R14 — DeepSeek 单点

**风险**：[application.yml:73-76](backend/src/main/resources/application.yml) 默认 `https://api.deepseek.com`，没 fallback。API 宕机时 AI 功能全挂。

**修复方案**：
1. 加 fallback：豆包 / 通义千问做兜底
2. 加 `RetryTemplate` + circuit breaker（Resilience4j）
3. 健康检查包含 LLM 探测

**估时**：长期规划

---

## R15 — `SecurityConfig.csrf.disable()`

**风险**：[SecurityConfig.java:37](backend/src/main/java/com/xiaobao/babycompanion/config/SecurityConfig.java) 整体关 CSRF。JSON API 风险有限（同源策略），但 XSS 一旦发生攻击面更大。

**修复方案**：
- 启用 CSRF 但只对 cookie-based session 强制（JSON Bearer token 路径豁免）
- 或保持 disable 但**确保 JWT 不通过 cookie 发送**（当前是 Authorization header，OK）

**估时**：1h（如果决定改）

---

## R16 — DeepSeek 用量无成本告警

**风险**：[AiUsageLogService.java:26](backend/src/main/java/com/xiaobao/babycompanion/service/AiUsageLogService.java) 有 `SOFT_MONTHLY_TOKEN_THRESHOLD = 500_000` 但只 log warn，没有真实告警 / 邮件 / 钉钉。

**修复方案**：触发阈值时调用 webhook / 邮件。

**估时**：2h

---

## R17 — Frontend `localStorage` 静默失败

**风险**：[storage.ts:5-10](frontend/src/storage.ts) `localStorage` 失败时落到内存，用户感知不到「我的数据没保存」。

**修复方案**：检测 storage quota exceeded 时弹 banner 提示。

**估时**：30min

---

## R18 — 后端单实例 / 单可用区

**风险**：ECS `120.55.188.242` 单机挂了就全挂。无热备 / 异地容灾。

**当前现实**：MVP 阶段可接受。

**修复方案**：未来考虑 SLB + 多 ECS / 跨可用区。

**优先级**：等用户量 / 业务关键度提升再做

---

## 工作流

- 修了某项后：在表格里改 `状态` 为 `完成 (commit-hash)` 并保留行，不要删除（保留历史）
- 新发现的风险：追加到表格末尾，分配新编号
- 季度复审：检查 P3 项是否升级，已完成项是否回归
