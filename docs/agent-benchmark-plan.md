# Agent Benchmark 自动化测试方案

## 目标

为 Agent 的核心能力建立一套可重复运行的基础 benchmark，避免新增需求时把已有能力打坏。第一版 benchmark 以“稳定、可断言、低成本”为优先级，不直接依赖真实模型输出；真实云端模型回归作为后续可选层。

## 分层策略

### L0 受控工具与防漂移层

覆盖 `AgentActionTool`、`AgentMutationService`、`AgentActionResponseGuard`、`AgentPlanner` 兜底策略、`SkillDisclosureService` 和 capability manifest 防漂移。这一层不联网、不调用模型，适合每次提交前和 CI 中运行。

准出标准：
- 所有用例必须通过。
- 不能出现未经过 action tool 的正式照护日志写入、未持久化却声称待确认、AI 创建提醒/待办、错误闹铃模式、重复记忆等高风险行为。
- 面向用户的追问和原因不能暴露 `milkMl`、`feedingType`、`dueAt`、`intervalMinutes` 等内部字段名。

### L1 模型输出夹具层

用固定的 `AgentChatResponse` / `AgentActionResult` 夹具模拟模型“正确调用工具、缺字段、无工具却声称已记录、尝试写禁用能力”等输出，再验证 runtime 和 response guard 是否能纠偏。当前已合并在 `AgentBenchmarkTests` 中。

准出标准：
- 没有 `applied` 工具结果时，最终回复不能说“已记录”。
- 没有 `pending_created` 工具结果时，最终回复不能说“待确认草稿已创建”。
- AI reminder/todo 和 memory 写入不在当前 action tool 列表中，不能产生 app state mutation。

### L2 真实模型回归层

后续可增加可选脚本，使用测试账号向本地或云端 `/api/agent/chat/stream` 发起真实请求，只断言结构化结果和用户可见文案的关键性质，不要求逐字匹配。该层会受模型、网络和服务配置影响，不作为第一版强制准出。

## 当前 Benchmark 用例

| 能力域 | 用例 | 准出标准 |
| --- | --- | --- |
| 工具清单 | 当前保留的记录/账本 action tools | capability manifest 与后端实现一致 |
| 工具 schema | 所有写工具 function definition | 严格 JSON schema，禁用额外字段 |
| 喂养记录 | “今天18:30配方奶120ml” | `record_feeding_event` 返回 `applied` 后才允许说已记录 |
| 混合喂养边界 | 混合喂养下只说“喝奶120ml” | `needs_input`，追问母乳/配方奶，不写正式记录 |
| 成长测量 | 身高/体重/头围具体值 | `create_growth_measurement_pending` 创建持久化 pending |
| 记账 | “今天给小宝买奶粉花了268” | `create_expense_pending` 创建持久化 pending |
| 最终回复防护 | 模型无工具结果却说“已记好” | `AgentActionResponseGuard` 改写为未完成/需补充 |
| 提醒边界 | “提醒我两小时后喂奶” | 不暴露 AI reminder tool，不产生 mutation |
| 联网兜底 | planner 返回空工具但问题需要政策查询 | 自动补 `web_search` |
| Skill 披露 | 纯记录不披露育儿 skill；发热问答披露体温和风险小节 | 渐进披露符合边界 |

## 命令

```bash
npm run test:agent-benchmark
```

脚本会运行后端 `AgentBenchmarkTests`，并把结果写入：

```text
docs/agent-benchmark-results.md
```

## 维护规则

- 新增 Agent 能力时，必须至少补一条正向用例和一条边界用例。
- 修复线上 Agent bug 时，先把 bug 复现成 benchmark，再改实现。
- 对真实模型响应只断言结构化语义，不做逐字匹配。
- L0/L1 benchmark 失败时，不应发布后端或 OTA。
