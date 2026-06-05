## Context

小宝记当前是 React + Capacitor 移动端、Spring Boot 后端、本地/云端 SQLite 数据库、阿里云 ECS + OSS 存储的家庭宝宝记录工具。已有能力包括家庭邀请码、角色权限、照护记录、相册、提醒、账本、Agent、ASR、图片/视频附件、OTA 更新和移动端原生通知。

商业化文档已将版本策略拆成 Lite / Free / Pro，并明确第一阶段以 Pro 内测验证为主。经过讨论，Pro 第一付费锚点收敛为：

> 少输入、少遗漏、自动整理。

这意味着第一阶段不应先做复杂会员系统，而应做一个小而完整的 Pro 内测闭环：申请、白名单、今日小结、漏项轻提醒、AI usage 记录和成本观察。

## Goals / Non-Goals

**Goals:**

- 支持家庭提交极简 Pro 内测申请。
- 支持按家庭开通 Pro 白名单权益。
- 所有家庭成员能看到家庭 Pro 状态。
- 照护人能在记录 Tab 今日页生成今日小结；仅查看成员只能阅读。
- 今日小结家庭共享，按日期保存最新一版。
- 今日小结只使用家庭共享数据生成。
- 晚上轻提醒用户检查漏项并确认生成，不自动烧模型。
- 漏项检查先支持保守规则：绝对空缺、未完成事项、说了但未形成记录。
- 记录每次 AI 调用 token usage 明细。
- 先记录和后台软告警，预留周/月硬限制。

**Non-Goals:**

- 不做真实支付和订阅。
- 不做会员价格页和复杂权益页。
- 不做后台审核管理页面。
- 不做用户可见 token、模型、provider 或成本展示。
- 不做智能历史规律漏项。
- 不把今日小结写入照护时间线。
- 不读取账号私有聊天或私有提醒生成家庭共享小结。
- 不做自动后台生成日报。
- 不做完整周报/月报体系。

## Product Decisions

### Pro Value Anchor

Pro 第一阶段文案应围绕“少输入、少遗漏、自动整理”。不要把“多模态 AI”或“家庭交接”作为主锚点。

推荐表达：

- 喂完奶来不及记，也能之后轻松补上。
- 每天帮你检查可能漏掉的记录。
- 把零散记录整理成当天小结。
- 照片、视频和语音都能帮你整理成回忆和记录。

### Pro Trial Application

申请应极简。用户看到功能说明和一个按钮，而不是问卷。

显示内容：

- 少输入：语音、图片、视频辅助整理。
- 少遗漏：每日轻提醒检查可能漏记。
- 自动整理：今日小结、周照护复盘。
- 当前是免费内测，有额度限制。
- 申请后人工开通。

提交后文案：

> 已收到你的 Pro 内测申请。我们会优先邀请小范围家庭体验“少输入、少遗漏、自动整理”的能力，开通后会在 App 内提示你。

申请记录必须持久化，避免仅靠日志丢失申请人。

### Pro Entitlement

Pro 权益按家庭维度，不按账号维度。家庭所有成员都能看到“本家庭已开通 Pro 内测”。照护人可触发生成类能力；仅查看成员只能阅读生成结果。

### Daily Summary

今日小结展示在记录 Tab 今日页。它不是照护事实本身，不能混入时间线事件。

页面结构建议：

- 今日数据和图表。
- 今日时间线事实事件。
- 今日小结卡片。
- 可能漏项卡片。

今日小结卡片应带清晰标签：

- `AI 小结`
- `基于今日记录整理`
- `可能不完整，请以原始记录为准`
- `有新记录，可重新生成`

### Daily Summary Persistence

今日小结按家庭和日期保存最新一版。用户补录后可以重新生成并覆盖，不做版本历史。

需要保存：

- 小结正文。
- 漏项信息。
- 生成时间。
- 生成人。
- 来源指纹，用于判断生成后是否新增或修改过记录。

### Data Boundary

今日小结家庭共享，但生成只能读取家庭共享数据：

- 宝宝资料。
- 照护记录。
- 成长事件。
- 相册中已保存的家庭媒体。
- 账本。

不得读取：

- 账号私有聊天。
- 账号私有提醒。
- 账号私有待确认。
- 账号私有记忆。
- 会话摘要。

漏项卡片可以是混合视图：

- 家庭级漏项：喂养、睡眠等关键记录空缺。
- 账号级漏项：当前账号自己的提醒、待确认、相册确认卡。

### Daily Reminder

每日小结提醒是账号级设置：

- 是否接收提醒：账号级。
- 提醒时间：账号级。
- 默认时间：`21:30`。

提醒只提示用户确认生成，不自动调用模型。

建议推送文案：

> 要不要整理一下小宝今天的一天？我可以先帮你看看有没有可能漏掉的记录。

### Missing Item Rules

第一阶段做 `A + C + D`：

- A. 绝对空缺：今天完全没有某类关键记录。
- C. 未完成事项：提醒未完成、待确认未处理、相册确认未处理。
- D. 用户明确说了但未形成记录：聊天/Agent 过程中产生 ask/pending，但没有正式记录。

第一阶段不做“相比最近几天明显偏少”，避免误判和制造焦虑。

关键漏项类型：

- 喂养。
- 睡眠。
- 提醒/待办。
- 待确认信息。

漏项文案必须避免审判式结论：

- 不说“你今天漏记了睡眠”。
- 改成“今天还没看到睡眠记录，要补一下吗？”
- 不说“喂奶次数异常偏少”。
- 不做偏少判断。

漏项动作：

- `补一下`
- `今天不用记`
- `以后别提醒这个`

偏好粒度：

- 小结推送开关：账号级。
- 小结提醒时间：账号级。
- 不再提醒某类漏项：账号级。
- 家庭关键记录类型：家庭级，第一阶段可先提供默认值和后端字段，前端设置可后置。

### Daily Summary Content Style

今日小结使用“事实 + 温和观察”：

- 可以总结事实：今日喂奶次数、总量、睡眠段数、提醒完成情况、相册新增、账本支出。
- 可以提醒补记：今天还没看到睡眠记录，可能需要补一下。
- 不做诊断。
- 不给强处置建议。
- 不说“奶量不足”“睡眠异常”“应该调整喂奶间隔”。

### Access Control

- Pro 内测申请：登录用户可提交。
- Pro 状态：家庭所有成员可见。
- 今日小结读取：家庭所有成员可读。
- 今日小结生成/重新生成：照护人可用。
- 今日小结删除或覆盖：照护人可用。
- Pro 生成能力：仅照护人可触发。

### Quota Strategy

现阶段不限制每日小结生成次数。原因是内测范围小，真正高成本风险主要来自图片/视频和长上下文多轮模型调用。

Token 策略：

- 每次 AI 调用记录明细。
- 后台按家庭统计周/月 token。
- 第一阶段先软告警，不影响用户。
- 预留硬限制开关。
- 如果发现异常消耗，再将 Pro 高成本能力降级。

用户侧不展示 token。

### Over-Limit Fallback

如果后续开启硬限制，超限后采用降级策略，而不是冷冰冰拒绝：

- 图片理解额度用完：图片仍可上传和查看，但不做 AI 理解或自动准入。
- 视频理解额度用完：视频仍可上传和播放，但不做 AI 理解。
- 今日小结高成本能力受限：今日页仍显示基础统计和时间线。
- 周报受限：仍可看趋势图，不生成 AI 周复盘。
- Token 周/月额度超限：高成本模型暂停，基础文本能力继续走免费模型或提示稍后再试。

用户文案：

> 今天的 Pro 试用额度已用完，基础记录和查看功能不受影响。

## Data Model

### `pro_trial_application`

Purpose: 保存用户的 Pro 内测申请。

Fields:

- `id`
- `family_id`
- `user_id`
- `phone`
- `source`
- `status`
- `created_at`
- `updated_at`

Statuses:

- `pending`
- `approved`
- `rejected`
- `cancelled`

First implementation may only create `pending`; approval can be handled by SQL/script.

### `pro_trial_entitlement`

Purpose: 保存家庭级 Pro 内测权益和后续额度配置。

Fields:

- `id`
- `family_id`
- `enabled`
- `starts_at`
- `expires_at`
- `daily_image_limit`
- `weekly_video_limit`
- `weekly_report_limit`
- `weekly_token_limit`
- `monthly_token_limit`
- `hard_limit_enabled`
- `created_at`
- `updated_at`
- `note`

Daily summary count is intentionally not hard-limited in this phase.

### `ai_usage_log`

Purpose: 每次模型调用都记明细，再按需聚合。

Fields:

- `id`
- `family_id`
- `user_id`
- `request_id`
- `provider`
- `model`
- `feature`
- `input_type`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `success`
- `error_code`
- `pro_required`
- `quota_counted`
- `created_at`

Do not store `estimated_cost` or `currency` in phase one. First collect real token usage shape; cost estimation can follow later.

Feature examples:

- `chat`
- `care_record`
- `reminder`
- `album_image`
- `album_video`
- `daily_summary`
- `weekly_report`
- `expense`
- `trend_insight`

Input type examples:

- `text`
- `image`
- `video`
- `audio`
- `mixed`

### `daily_summary`

Purpose: 保存家庭每日 AI 小结最新一版。

Fields:

- `id`
- `family_id`
- `date`
- `summary_text`
- `missing_items_json`
- `source_fingerprint`
- `generated_by_user_id`
- `generated_at`
- `created_at`
- `updated_at`

Unique constraint:

- `family_id + date`

### Summary Settings

Recommended storage:

- Account-level setting for current user:
  - daily summary reminder enabled.
  - reminder time, default `21:30`.
  - ignored missing item types.
- Family-level setting:
  - critical record types, default feeding and sleep.

Implementation can store these as JSON in an existing settings/profile structure if that fits current AppState patterns, but the boundary must remain account-level vs family-level.

## Backend Design

### Auth / Membership Context

Backend must expose enough current context for UI:

- family Pro status.
- current member caregiver flag.
- current user's Pro application status if already applied.
- daily summary reminder settings.

### App State

`GET /api/app/state` should include:

- `dailySummaries` or today's `dailySummary`.
- family Pro entitlement status.
- current user's Pro application status.
- daily summary reminder settings.
- missing item preference/settings.

Write APIs should enforce caregiver permissions for summary generation and Pro-only high-cost actions.

### Pro Application API

Options:

- Reuse state collection style if it already supports typed collections.
- Or add a small auth/app controller endpoint:
  - `POST /api/pro-trial/applications`
  - `GET /api/pro-trial/status`

Implementation should follow existing auth/session/family permission patterns.

### Daily Summary Generation

The summary generation endpoint/action must:

1. Validate user is logged in and belongs to the family.
2. Validate family has enabled Pro trial.
3. Validate user is caregiver.
4. Build context from family-shared data only.
5. Generate fact + gentle observation summary.
6. Detect missing items using family and current account context.
7. Save or overwrite `daily_summary` for the family/date.
8. Record AI usage.
9. Return canonical persisted summary.

### AI Usage Logging

Model runtime wrappers must capture provider usage if returned:

- input/prompt tokens.
- output/completion tokens.
- total tokens.

If provider does not return usage:

- store nulls or zeros consistently.
- still log provider/model/feature/success/error.
- do not invent user-visible token values.

### Soft Warning

Backend should expose a service method to aggregate weekly/monthly usage by family. First phase can log warnings when thresholds are exceeded; hard enforcement is feature-flagged for later.

## Frontend Design

### Record Today Page

Add a Pro daily summary section:

- If family has Pro:
  - Show current daily summary if available.
  - Show stale indicator if source fingerprint changed.
  - Caregivers see generate/regenerate action.
  - Read-only members only see summary.
- If family does not have Pro:
  - Show concise Pro value card and `申请 Pro 内测`.

### Missing Items Card

Show in today's record page near daily summary:

- "今天还没看到睡眠记录，要补一下吗？"
- "还有 2 个提醒没标记完成，要一起看下吗？"
- "刚才那条喝奶信息还差一点点，补上后我就能整理进今天的小结。"

Actions:

- `补一下`
- `今天不用记`
- `以后别提醒这个`

### My Page

Show Pro status:

- Not applied: `申请 Pro 内测`
- Applied pending: `已收到申请，等待人工开通`
- Enabled: `本家庭已开通 Pro 内测`

### Image / Video Trigger

When a non-Pro family triggers AI image/video understanding:

- Do not call high-cost model.
- Show Pro internal trial card.
- Still allow ordinary upload/save paths.

### Daily Reminder

Use existing local notification/native reminder helpers where possible.

Behavior:

- Account-level enable/disable.
- Default time `21:30`.
- Notification opens record today page.
- User confirms generation manually.
- No background AI generation.

## Testing Strategy

### Backend Tests

- Pro application creates pending record with family/user/phone/source.
- Same user/family duplicate application returns existing pending/approved state or is idempotent.
- Pro entitlement is family-scoped and visible to all family members.
- Caregiver can generate daily summary for Pro family.
- Non-caregiver cannot generate daily summary.
- Non-Pro family cannot generate daily summary.
- Daily summary generation only uses family-shared data.
- Private chat/reminder/pending/memory data does not appear in summary context.
- Daily summary overwrites same family/date row.
- AI usage log records success, failure, provider, model, feature, input type, and tokens when available.
- Soft usage aggregation works by family/week/month.

### Agent Benchmark

Add deterministic benchmark cases for:

- daily summary generation prompt boundaries.
- missing feeding/sleep records as gentle observations.
- no medical diagnosis or strong advice in summary.
- no private chat/reminder content in shared summary.

### Frontend Tests / Verification

- `npm run build`
- `npm run verify:frontend`
- Pro cards render in record today page, My page, and image/video trigger entry.
- Caregiver sees generate/regenerate; read-only member does not.
- Pending application state is displayed.
- Daily reminder setting UI works and does not create horizontal overflow.
- Missing item actions are reachable on mobile viewports.

### Mobile Tests

If reminder scheduling code changes:

- `npm run mobile:sync`
- `npm run build:android:debug`
- `npm run build:ios:debug` when local Xcode environment supports it.

Real-device validation remains needed for native notifications.

## Risks / Trade-offs

- Daily summary can become too generic -> Keep prompt grounded in today's facts and missing item list.
- Missing item prompts can annoy users -> Use conservative A/C/D rules, gentle wording, and ignore actions.
- Token tracking may be incomplete if provider usage is absent -> Log null usage and record request metadata rather than hiding the call.
- Pro status can confuse free users -> Keep entry points limited and avoid global popups.
- Shared summary can leak private content -> Strictly build summary from family-shared data only.
- No hard token limit initially could exceed budget -> Start with soft warning and add hard limit flag before broader rollout.
