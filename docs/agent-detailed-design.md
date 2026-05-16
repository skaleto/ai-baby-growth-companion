# Agent 模块详细设计文档

更新时间：2026-05-13

## 1. 设计目标

小宝记 Agent 的目标不是“模型说什么就执行什么”，而是让 AI 在真实能力边界内帮助家庭完成记录、提醒、相册和账本整理。

核心设计原则：

- **规则优先兜底**：时间、喂养、睡眠、提醒、账本等关键动作先由确定性规则抽取。
- **模型负责理解和表达**：模型做规划、补充语义、多模态描述和自然回复，但不能绕过准入策略。
- **效果决策显式化**：所有写入动作都转成 `EffectDecision`，由 `auto/pending/ask/ignore` 表示真实执行状态。
- **家庭共享与账号私有分离**：Agent 构建上下文时读取共享事实和当前账号私有聊天/提醒/记忆。
- **渐进式 Skill 披露**：育儿知识不是每次都塞进 Prompt，只在问题需要时加载对应小节。
- **可回归测试**：Agent benchmark 覆盖 P0 语义和边界，防止新增需求破坏旧能力。

## 2. 总体链路

![Agent 执行链路图](assets/architecture/agent-flow.svg)

入口：

- `POST /api/agent/chat`
- `POST /api/agent/chat/stream`
- `POST /api/agent/conversation-summary/compress`

权限：

- `AgentController` 在入口调用 `currentUser.requireCaregiver()`。
- 非照护人不能调用 Agent、ASR、上传和状态写入。

主要代码：

| 模块 | 文件 |
| --- | --- |
| Controller | `backend/src/main/java/com/xiaobao/babycompanion/controller/AgentController.java` |
| Runtime | `backend/src/main/java/com/xiaobao/babycompanion/agent/AgentRuntime.java` |
| Planner | `backend/src/main/java/com/xiaobao/babycompanion/agent/AgentPlanner.java` |
| 规则信号 | `RecordSignalExtractor.java`、`RecordSignals.java`、`ReminderSignal.java`、`ExpenseSignal.java` |
| 上下文 | `AgentContextService.java`、`AgentContextSnapshot.java` |
| Skill | `SkillRegistry.java`、`SkillDisclosureService.java`、`SkillDefinition.java`、`SkillSection.java` |
| 工具 | `ToolRegistry.java`、`WebSearchTool.java` |
| 效果决策 | `EffectPolicy.java`、`CareEventCompletenessPolicy.java` |
| DTO | `dto/agent/*` |
| 测试 | `AgentBenchmarkTests.java`、`scripts/agent-benchmark.mjs` |

## 3. 请求模型

前端提交的核心请求类型是 `AgentChatRequest`，包含：

| 字段 | 说明 |
| --- | --- |
| `message` | 用户文本或 ASR 最终转写文本。 |
| `model` | DeepSeek/Doubao 模型选择。 |
| `lowLatencyEnabled` | 豆包低延迟 service tier 开关，默认关闭。 |
| `babyProfile` | 前端当前小宝资料。 |
| `careLogs`、`growthEvents`、`reminders`、`memories` | 前端快照上下文。 |
| `recentMessages` | 最近聊天消息，用于连续语义和“刚才的视频保存到相册”。 |
| `attachments` | 当前消息的图片/视频/音频附件。 |

模型能力由 `RuntimeModel` 解析：

- `deepseek-v4-pro`
- `deepseek-v4-flash`
- `doubao-seed-2.0-pro`
- `doubao-seed-2.0-lite`

豆包模型支持图片/视频输入；DeepSeek 不开放视觉输入。低延迟只对豆包有效，并由后端设置 service tier。

## 4. 规则信号层

`RecordSignalExtractor` 是 Agent 的第一道稳定性保障，它不依赖模型，负责从用户输入中提取：

| 信号 | 用途 |
| --- | --- |
| `topics` | feeding、sleep、poop、temperature、growth、reminder、expense 等主题。 |
| `targetDates` | 今天/昨天/具体日期。 |
| `careLogPatch` | 规则抽取出的照护日志草稿。 |
| `reminderSignal` | 循环提醒、时间提醒、闹钟语义。 |
| `expenseSignal` | 账本标题、金额、分类线索。 |
| `riskHints` | fever、medicine、vaccine、allergy、breathing、injury 等风险。 |
| `unsupportedMutationRequest` | 撤销、删除、修改历史记录这类当前不支持的聊天内动作。 |

时间相关规则：

- 使用 `Clock` 和 `app.time-zone=Asia/Shanghai`，避免 ECS UTC 导致今天/昨天错位。
- 用户用 12 小时制时，结合当前时间判断最近已经发生过的候选时间。
- “每半小时/每 10 分钟/每 3 小时”归为循环提醒，不是一次性日程。

## 5. Planner 设计

`AgentPlanner` 的职责是让模型生成 `AgentPlan`，不直接生成用户回复。

输出字段：

| 字段 | 说明 |
| --- | --- |
| `intent` | `record/question/reminder/mixed/smalltalk` |
| `topics` | 主题列表 |
| `targetDates` | 目标日期 |
| `contextNeeds` | 需要资料、照护历史、成长历史、提醒、记忆、联网等 |
| `toolRequests` | web_search 等工具请求 |
| `skillRequests` | 可执行 skill 请求，例如 `expense-recognition` 的 `execute` 模式 |
| `riskHints` | 健康/用药/疫苗等风险线索 |
| `mediaAction` | 保存相册、描述媒体、目标附件范围 |

兜底策略：

- Planner JSON 解析失败时使用 `heuristic()`。
- 如果模型返回空工具列表，但规则判断需要联网，会补回 fallback `web_search`。
- 如果模型或兜底判断选择了 executable skill，后续由 runtime 执行和验收，最终回复模型不能绕过 skill 自行生成同类结构化效果。
- mediaAction 只代表保存意图，不代表已保存，真正保存由系统执行。

## 6. 上下文构建

`AgentContextService` 根据当前家庭和账号构建上下文：

| 数据 | 来源 | 边界 |
| --- | --- | --- |
| 小宝资料 | `baby_profile` | 家庭共享 |
| 照护日志 | `care_log` | 家庭共享 |
| 成长事件 | `growth_event` | 家庭共享 |
| 相册 | `album_item` | 家庭共享 |
| 账本 | `expense_item` | 家庭共享 |
| 聊天消息 | `chat_message` | 当前账号私有 |
| 提醒 | `reminder` | 当前账号私有 |
| 记忆 | `memory_item` | 当前账号私有 |
| 摘要 | `conversation_summary` | 当前账号私有 |

上下文会派生：

- `currentDateTime/currentTime/currentDate`
- 宝宝年龄、月龄、是否满月等字段
- 最近照护记录、最近媒体、最近提醒

这些派生字段会进入 Prompt，要求模型优先使用系统提供的年龄和时间，不自行猜测。

## 7. Skill Harness

资源化 skill 位于：

- `backend/src/main/resources/agent-skills/default-baby-companion.yml`
- `backend/src/main/resources/agent-skills/pediatric-care-guide.yml`

设计分为两层：

| 层 | 行为 |
| --- | --- |
| `selectedSkills` | 常驻进入上下文，只表示“可用技能目录”。 |
| `disclosedSkillContexts` | 只有当问题需要时才披露具体 section 正文。 |

`SkillDisclosureService` 的选择依据：

- Planner topics。
- 规则信号 topics。
- riskHints。
- 用户文本 trigger。
- 是否是问题/政策/健康风险。

纯结构化记录，例如“今天 18:30 配方奶 120ml”，不会加载育儿知识正文。

单次披露有数量和字符上限，避免百科内容污染普通记录。

可执行 skill 使用另一条契约：

| 阶段 | 责任 |
| --- | --- |
| Planner | 根据当前输入、最近消息、最近媒体候选和用户意图选择 `skillRequests`。 |
| SkillRouter | 只允许已登记、已授权的 skill 进入执行计划，并保留安全兜底。 |
| AgentRuntime | 读取当前或历史附件证据，执行 skill，记录 trace，把结果交给 EffectPolicy 和持久化闸口。 |
| Final composer | 只负责解释和汇总 skill 结果，不再平行生成同类结构化候选。 |

当前已落地的 executable skill 是 `expense-recognition`。用户说“刚才/上面那些花费再记录一下”时，前端只提交最近消息和附件元数据；是否引用上一轮图片、是否执行支出识别，由 planner 和 runtime 在后端完成。后端读取附件时必须受 familyId 边界约束，不能依赖前端正则转发图片。

## 8. 工具调用

工具由 `ToolRegistry` 管理，目前重点是 `web_search`。

触发场景：

- 最新/官方/政策/流程。
- 地点、电话、天气。
- 商品信息、参考价格。
- 需要外部资料验证的问题。

流式模式下，工具状态通过 SSE 发送给前端：

- `tool` status=`running`
- `tool` status=`completed`
- `tool` status=`failed`

模型最终回答必须基于 `toolResults`，不能把未查到的内容说成确认事实。

## 9. 模型运行

`AgentRuntime` 构造模型请求时注入：

- system prompt：角色、能力边界、JSON schema、记录准入、提醒策略、相册边界、账本边界。
- user content：用户输入、上下文、规则信号、Planner 结果、Skill 披露、工具结果、附件。

流式接口事件：

| SSE 事件 | 用途 |
| --- | --- |
| `planning` | 前端展示“理解记录中”。 |
| `retrieving_context` | 展示“查找相关记录”。 |
| `tool` | 展示工具活动。 |
| `reasoning` | 展示思考/推理片段。 |
| `content` | 展示正文增量。 |
| `final` | 最终结构化结果。 |
| `error` | 错误信息。 |

非流式接口直接返回 `AgentChatResponse`。

## 10. 输出模型

`AgentChatResponse` 主要包含：

| 字段 | 说明 |
| --- | --- |
| `aiText` | 用户可见回复。 |
| `tags` | UI 标签。 |
| `growthEvent` | 成长事件候选。 |
| `careLogPatch` | 照护日志候选。 |
| `reminders` | 提醒候选。 |
| `memories` | 记忆候选。 |
| `expenses` | 账本候选。 |
| `sources` | 联网来源。 |
| `safetyAlerts` | 安全提示。 |
| `usedSkills` | 实际披露并使用的 skill。 |
| `effectDecisions` | 系统最终准入决策。 |

重要约束：

- 用户可见文字不能暴露 `milkMl`、`feedingType`、`dueAt`、`intervalMinutes` 等技术字段。
- 模型不能承诺“已撤销/已删除/已保存到相册”，除非系统真实支持并有对应 effect。
- 图片/视频描述、相册保存、照护记录是三件独立的事。

## 11. EffectDecision 设计

`EffectDecision` 是前端和后端共同理解“AI 这次到底要做什么”的关键结构。

### 11.1 mode

| mode | 含义 | 前端行为 |
| --- | --- | --- |
| `auto` | 可自动写正式记录 | 显示自动记录卡片，写入后端，可撤销。 |
| `pending` | 需要用户确认 | 显示待确认卡片，用户确认后写入。 |
| `ask` | 信息不完整 | 显示补充信息卡片，不写库。 |
| `ignore` | 闲聊、胡话或不支持动作 | 不写库，只展示边界文案。 |

### 11.2 type

| type | 写入位置 |
| --- | --- |
| `careLog` | 家庭共享 `care_log` |
| `growthEvent` | 家庭共享 `growth_event` |
| `albumItem` | 家庭共享 `album_item` |
| `expenseItem` | 家庭共享 `expense_item` |
| `reminder` | 当前账号私有 `reminder` |
| `memory` | 当前账号私有 `memory_item` |

## 12. 照护记录准入

`CareEventCompletenessPolicy` 负责阻止“AI 什么都记”的问题。

| 类型 | 自动记录最低条件 |
| --- | --- |
| 喂奶 | 必须有奶量；混合喂养时还要明确母乳/亲喂/配方奶等类型。 |
| 喂奶开始 | “开始吃奶/准备喂奶/要喝奶”不记录，只追问喝完后奶量。 |
| 睡眠 | 必须有睡眠时长，或明确开始/结束可推导时长。 |
| 睡眠开始 | “睡着了/开始睡了”不记录，只追问醒来后睡了多久。 |
| 体温高风险 | 高烧等进入 pending 或安全提示，不自动正式写入。 |
| 多事件 | 同一句话内拆分多条事件，并按日期/时间/类型去重。 |

## 13. 提醒策略

提醒已经统一为两组独立字段：

| 字段 | 取值 | 含义 |
| --- | --- | --- |
| `scheduleMode` | `once/interval` | 一次性还是循环。 |
| `alertMode` | `notification/ringing` | 普通通知还是全屏闹铃。 |

规则：

- “三分钟后提醒我喂奶 / 10:45 提醒我喂奶” → `once + notification`。
- “每 10 分钟提醒我喂奶” → `interval + ringing`。
- “每 2 小时提醒我喝水” → `interval + notification`。
- “每 2 小时闹钟提醒我喝水” → `interval + ringing`。
- “过会儿提醒我” → `ask`，追问具体时间。

循环喂奶提醒使用：

```json
{
  "mode": "fixedInterval",
  "intervalMinutes": 180,
  "anchorType": "careEvent",
  "careEventType": "milk"
}
```

其他循环默认 `anchorType=now`。

## 14. 相册和媒体边界

Agent 对媒体有三种行为：

| 行为 | 说明 |
| --- | --- |
| 描述 | 用户问“这图/视频里有什么”时，只描述，不写记录。 |
| 保存到相册 | 用户明确说保存，或系统准入判断为值得保存，生成 `albumItem`。 |
| 照护记录 | 不能仅凭图片/视频生成，必须有用户文本/语音明确字段。 |

不自动进相册：

- App 截图。
- 网页截图。
- 聊天截图。
- 记录页面截图。
- 纯 UI / 纯文字图片。

不确定素材显示确认卡，由用户点“保存到相册”后再写入。

## 15. 账本设计

账本是家庭共享数据。文本中缺少核心字段时，Agent 创建待确认草稿；可执行支出识别 skill 已经识别出完整支出且用户明确要求记账时，后端可以直接保存，并返回 saved/duplicate/needs-input 的真实结果。

| 场景 | 行为 |
| --- | --- |
| “今天给小宝买奶粉花了 268” | 生成 `pending expenseItem`。 |
| “这个条码多少钱” | 可以查询/回答候选信息，但不自动入账。 |
| 缺商品或金额 | `ask`，用自然语言追问。 |
| 上传订单/小票/支付截图并要求记账 | 走 `expense-recognition`，完整候选直接保存，重复候选跳过，不完整候选只追问缺失核心字段。 |
| 只要求识别支出图片 | 走 `expense-recognition` 只读识别，不写入账本。 |

字段：

- 标题、金额、币种、分类、日期。
- 数量、单价、商家、备注、品牌、规格。
- 附件 ID。
- 来源：`manual` 或 `agent`。

## 16. 会话摘要

`compressConversationSummary()` 用于把旧聊天压缩成当前账号私有摘要。

触发条件：

- 新消息数量达到阈值。
- 新消息字符数达到阈值。

摘要保留：

- 宝宝基础情况。
- 喂养/睡眠/护理规律。
- 健康和过敏线索。
- 照护人分工。
- 已确认的重要提醒或偏好。
- 反复出现的担忧。

摘要不保留：

- 寒暄。
- 重复表达。
- 无结论临时过程。
- 已被结构化记录覆盖的流水。

## 17. 前端落地行为

前端收到 `final` 后：

1. 合并 AI 正文、reasoning、toolActivities、sources、safetyAlerts。
2. 渲染 `effectDecisions` 卡片。
3. 对 `auto` careLog 等动作写入后端并展示撤销按钮。
4. 对 `pending` 生成确认/编辑/丢弃卡片。
5. 对 `ask` 展示“需要补充一点信息”卡片。
6. 应用后端返回的 canonical state，避免本地重复合并导致假状态。

## 18. 测试与回归

Agent benchmark 文档：

- `docs/agent-benchmark-plan.md`
- `docs/agent-benchmark-results.md`

运行命令：

```bash
npm run test:agent-benchmark
```

当前覆盖：

- 12 小时制时间理解。
- 喂奶完整记录和开始喂奶追问。
- 混合喂养追问。
- 睡眠完整记录和睡着了追问。
- 高风险体温 pending。
- 一次性提醒和循环闹铃。
- 通用循环提醒。
- 模糊提醒追问。
- 账本支出待确认。
- 条码/价格查询不入账。
- 撤销边界。
- Planner 联网兜底。
- Skill 渐进披露。

准出要求：

- 修改 Agent 行为必须跑 benchmark。
- 修复线上 Agent bug 时，先把 bug 复现成 benchmark，再改实现。
- 不应发布后端或 OTA 如果 L0/L1 benchmark 失败。

## 19. 扩展规范

新增 Agent 能力时遵循：

1. 先定义真实系统能力，更新 `AgentCapabilityContract`。
2. 在 `RecordSignalExtractor` 增加确定性识别。
3. 在 `AgentPlanner` prompt/heuristic 中加入规划语义。
4. 在 `AgentRuntime` schema 中加入模型输出字段。
5. 在 `EffectPolicy` 中做准入和模式转换。
6. 在 `AppStateService` 或对应领域服务中明确共享/私有边界。
7. 前端只根据 `EffectDecision` 渲染/写入，不靠 AI 正文关键词推断动作。
8. 增加 benchmark 正向用例和边界用例。

新增 skill 时遵循：

1. 如果是知识披露 skill，资源文件放在 `backend/src/main/resources/agent-skills/`，默认使用渐进披露，不把大段知识每轮塞进 Prompt。
2. 如果是可执行 skill，先定义 skill input/output、mode、trace、错误文案和 effect contract，再接入 `AgentPlanner`、`SkillRouter`、`AgentRuntime`、`EffectPolicy`。
3. 可执行 skill 不直接写库；写入必须通过 runtime/AppStateService 的权限、幂等和重复保护。
4. 不引入受版权保护文本的逐字复述。

## 20. 当前风险

- `frontend/src/App.tsx` 承载大量页面、弹层和状态逻辑，后续维护成本较高。
- 真机闹铃、通知、ASR、视频预览仍强依赖平台能力，浏览器验证不能完全替代。
- 真实模型输出不可完全确定，必须依赖规则层、准入层和 benchmark。
- 云端仍是单机 SQLite，适合当前家庭私有/小规模测试，不适合高并发多租户。
