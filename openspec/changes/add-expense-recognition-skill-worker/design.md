## 背景

当前 Agent 实现是一个务实的 workflow-style agent 系统。一次请求会经过规则信号提取、模型规划、后端上下文读取、可选工具执行、视觉分析、最终模型生成、安全评估，以及 `EffectPolicy` 后处理。这个架构已经支撑了护理记录、提醒、相册保存和早期记账能力，但支出识别的职责已经散得太开：

- `AgentPlanner` 会判断支出截图场景是否应该禁止联网搜索。
- `AgentRuntime` 负责视觉分批和最终提示词拼装。
- `AgentPrompts` 包含支出相关行为规则。
- `EffectPolicy` 合并规则和模型产出的支出结果，并可能追加澄清问题。
- 前端会通过重新附带最近视觉附件，支持用户对历史支出图片说“再记录一遍”。
- 线上排查需要同时关联聊天消息、pending effect、上传附件、日志和 AI usage 记录。

这次讨论后确定的产品方向是：skill 应该成为可执行、可测试、可观测的能力模块。skill 可以产出结构化 effect candidate 和草稿回复，但不能直接写业务数据。

## 目标 / 非目标

**目标：**

- 将 `expense-recognition` 作为第一个可执行 skill worker 落地。
- 在增加 skill worker 编排的同时，保持当前 `AgentRuntime` API 和流式行为兼容。
- 明确三种 skill 模式：`execute`、`disclose`、`guard`。
- 将支出截图识别、禁止联网搜索策略、视觉 OCR 摘要、澄清输出和支出 effect candidate 放到 skill 边界内。
- 为支出识别增加独立模型 profile。
- 增加轻量级 `agent_run` 和 `skill_run` 追踪记录。
- 保留 `EffectPolicy` 作为唯一负责校验、合并和授权 effect 决策的地方。
- 保留已有成功流程的用户可见行为，同时提升可追踪性和失败原因的具体度。

**非目标：**

- 本阶段不把整个 Agent runtime 重写成新框架。
- 本阶段不引入 LangGraph、OpenAI Agents SDK 或其他编排依赖。
- 不允许 skill worker 直接写入 `expense_item`、`pending_effect`、`chat_message` 或其他业务表。
- 第一阶段不新增前端 trace 查看器。
- 本变更不切换模型厂商或 provider。
- 本阶段不迁移所有 skill 类型；护理记录、提醒、相册和儿科指导后续再迁移。

## 设计决策

### 保留 AgentRuntime，在内部增加 skill 编排

决策：在现有 `AgentRuntime` 流程内部增加一层小型 skill 编排，而不是替换整个 runtime。

理由：当前 runtime 已经承载了线上行为、流式事件、测试、用量记录、云端部署流程和多次安全补丁。直接重写会放大回归风险。兼容式编排层可以放在 planner / context 之后、最终回复生成之前。

备选方案：用图运行时整体替换 `AgentRuntime`。第一阶段拒绝，因为范围会过大，而且很难证明线上等价。

### skill 模式必须显式

决策：skill plan 区分三种模式：

- `execute`：实际运行 skill worker，并产出结构化结果。
- `disclose`：把知识或上下文注入最终模型提示词。
- `guard`：提供校验、边界或安全规则，不执行模型工作流。

理由：当前 `selectedSkills` 混合了“可用 skill 目录”和“实际使用能力”。显式模式可以让支出识别成为真正的 worker，同时让 `pediatric-care-guide` 继续以 disclose / guard 为主。

备选方案：继续只做 progressive disclosure。拒绝原因是它无法拥有 OCR、trace、effect candidate 和模型 profile 行为。

### ExpenseRecognitionSkill 必须无副作用

决策：`ExpenseRecognitionSkill` 返回 `ExpenseRecognitionSkillResult`，包含 `status`、`aiTextDraft`、`userFacingError`、`effectCandidates`、`clarifications`、`evidence`、`traceSummary`，但不直接持久化业务记录。

理由：写入统一交给 `EffectPolicy` 和现有 pending-effect 确认机制，可以保持撤销、确认、权限和审计语义一致。

备选方案：允许 skill 直接写 pending 支出。拒绝原因是会复制 policy 逻辑，产生隐藏副作用，并增加回滚难度。

### EffectPolicy 仍然是最终 effect 闸口

决策：skill candidate 只有经过 `EffectPolicy` 校验并与模型 / 规则输出合并后，才能转成普通 effect decision。

理由：当前应用有很多领域安全规则：护理记录需要必填字段，混合喂养可能需要澄清，支出需要实际支付金额和宝宝相关用途，高风险健康内容仍然要 pending。skill 不应该绕过这些约束。

备选方案：完全信任支出 skill 输出。拒绝原因是模型抽取仍可能不完整或自相矛盾。

### 支出识别使用独立模型 profile

决策：增加 `planner`、`finalComposer`、`expenseRecognition` 等模型 profile。支出 profile 使用低温度、无工具、支持视觉输入，并可配置分批大小、超时和重试策略。

理由：OCR 式抽取和对话式回复生成的可靠性要求不同。独立 profile 能避免把普通聊天请求和图片抽取的延迟、温度、超时绑定在一起。

备选方案：复用 final composer 模型设置。拒绝原因是它会让 OCR 延迟、温度和超时耦合到普通聊天行为。

### trace 持久化保持轻量

决策：新增 `agent_run` 和 `skill_run` 记录，保存标识符、状态、耗时、模型 profile、planner / skill 摘要、错误码、分批数量和 effect candidate 摘要。默认不保存图片 `dataUrl`、base64 内容或完整原始模型响应。

理由：最近的线上排查证明需要可回放的证据链。轻量 trace 能提升可解释性，同时避免保存敏感或过重的媒体载荷。

备选方案：只写日志。拒绝原因是日志保留时间和关联能力弱于结构化 DB 记录。

### 最终回复由 final composer 负责

决策：支出 skill 可以产出 `aiTextDraft` 或 `userFacingError`，但最终 `aiText` 仍由 final composer 生成。final composer 不能反转 skill 事实，不能在 skill 失败时宣称成功，也不能追问 skill 已经抽取出的字段。

理由：用户之后可能在一条消息里混合支出、提醒、护理记录等意图，需要多个 skill 结果被组织成一条连贯回复。独立 composer 能保证回复统一，同时保留 skill 事实。

备选方案：直接返回 skill 文案。拒绝原因是它不利于未来组合 reminder / care / album 等 skill 结果。

## 目标运行时形态

```text
Agent request
  -> RecordSignalExtractor
  -> AgentPlanner（兼容现有输出，同时生成或派生 SkillPlan）
  -> AgentContextService
  -> SkillRouter（第一阶段规则优先，后续可模型辅助）
  -> ExpenseRecognitionSkill execute
  -> 允许的工具执行
  -> Final composer model
  -> SafetyGuard
  -> EffectPolicy
  -> 前端 pending effect / auto effect 处理
```

第一版可以保留 `intent`、`topics`、`contextNeeds`、`toolRequests`、`mediaAction` 等 planner 字段。新的 `SkillPlan` 可以先由规则和 planner 输出派生，后续再升级为 planner 的一等输出。

## 数据模型

### `agent_run`

用途：每次 Agent 请求一行。

建议字段：

- `id`
- `trace_id`
- `family_id`
- `user_id`
- `message_id`
- `status`
- `input_type`
- `planner_model`
- `final_model`
- `planner_result_json`
- `skill_plan_json`
- `effect_summary_json`
- `error_code`
- `started_at`
- `completed_at`
- `created_at`

### `skill_run`

用途：每次被执行的 skill 一行。

建议字段：

- `id`
- `trace_id`
- `agent_run_id`
- `skill_id`
- `mode`
- `status`
- `model_profile`
- `model`
- `batch_count`
- `attachment_ids_json`
- `input_summary_json`
- `result_summary_json`
- `effect_candidate_summary_json`
- `user_facing_error`
- `error_code`
- `latency_ms`
- `started_at`
- `completed_at`
- `created_at`

## 风险 / 取舍

- skill 编排可能和 planner 逻辑重复：第一阶段从现有 planner 和规则派生 `SkillPlan`，后续再逐步迁移职责。
- trace 表可能增长较快：只保存轻量摘要，不保存 base64，后续增加保留周期清理。
- 支出 skill 输出可能和规则信号冲突：当 skill candidate 证据完整时，`EffectPolicy` 应优先保留成功 skill candidate，而不是让纯文本支出 ask 覆盖它。
- 增加模型调用会增加成本：通过现有 AI usage、模型 profile 记录、分批和重试上限控制。
- 视觉 OCR 仍可能因图片质量失败：通过具体的 skill `status` 和 `userFacingError` 告知真实阶段，而不是泛化成“AI 服务不可用”。
- final composer 仍可能措辞不佳：通过 benchmark 断言“skill 已成功识别金额时，不得重复追问金额”。

## 迁移计划

1. 增加 trace 持久化的数据模型和服务，并接入正常 runtime 路径。
2. 增加 skill DTO、skill mode 和 `ExpenseRecognitionSkill`，不改变公开 API。
3. 只把支出图片任务路由到新 skill，并把现有视觉分批能力保留或迁移到 skill 内。
4. 将 skill 结果注入 final prompt 和 `EffectPolicy`。
5. 增加新路径的测试和 benchmark。
6. 使用 `SYNC_DATA=0` 部署后端和 OTA，然后验证云端健康与关键行为。

回滚策略：

- 通过 feature flag 或 runtime fallback 保留旧的非 skill 支出路径。
- 如果 skill 路径异常失败，回退到原有通用视觉分析 / final composer 行为，同时仍记录失败 trace。

## 未决问题

- trace 保留策略应该按时间、按家庭数量上限，还是两者结合？
- 开发环境是否保存完整原始模型响应？生产环境是否支持对指定 trace ID 做短期抓取？
- 未来 skill worker 应共享一个通用 `SkillResult` schema，还是保持领域特定结果类型，并用 common envelope 包一层？
