# Agent Benchmark 自动化测试方案

## 目标

为 Agent 的核心能力建立一套可重复运行的基础 benchmark，避免新增需求时把已有能力打坏。第一版 benchmark 以“稳定、可断言、低成本”为优先级，不直接依赖真实模型输出；真实云端模型回归作为后续可选层。

## 分层策略

### L0 确定性规则层

覆盖 `RecordSignalExtractor`、`EffectPolicy`、`CareEventCompletenessPolicy`、`AgentPlanner` 兜底策略和 `SkillDisclosureService`。这一层不联网、不调用模型，适合每次提交前和 CI 中运行。

准出标准：
- 所有用例必须通过。
- 不能出现误写正式照护日志、误创建提醒、错误闹铃模式、重复记忆等高风险行为。
- 面向用户的追问和原因不能暴露 `milkMl`、`feedingType`、`dueAt`、`intervalMinutes` 等内部字段名。

### L1 模型输出夹具层

用固定的 `AgentChatResponse` 夹具模拟模型“正确、缺字段、乱吐 memory、把循环提醒错写成一次性日程”等输出，再验证策略层是否能纠偏。当前已合并在 `AgentBenchmarkTests` 中。

准出标准：
- 模型返回不完整照护记录时必须转为 `ask`，不能写正式记录。
- 模型把循环喂奶误写成普通日程时，规则层必须强制改成循环闹铃。
- reminder-only 输入中模型乱吐的 profile memory 必须被过滤。

### L2 真实模型回归层

后续可增加可选脚本，使用测试账号向本地或云端 `/api/agent/chat/stream` 发起真实请求，只断言结构化结果和用户可见文案的关键性质，不要求逐字匹配。该层会受模型、网络和服务配置影响，不作为第一版强制准出。

## 当前 Benchmark 用例

| 能力域 | 用例 | 准出标准 |
| --- | --- | --- |
| 时间理解 | 晚上 20:45 说“6点半配方奶120ml” | 解析为 18:30，不误判为 06:30 |
| 喂养记录 | “今天18:30配方奶120ml” | `auto careLog`，时间线含 milk 事件和 120ml |
| 喂养边界 | “现在5:16开始吃奶” | `ask careLog`，不写正式记录 |
| 睡眠记录 | “9点睡了1小时” | `auto careLog`，生成 sleep 事件 |
| 睡眠边界 | “9点睡着了” | `ask careLog`，追问睡了多久 |
| 健康风险 | “体温39.2度” | `pending careLog`，不自动写入 |
| 一次性提醒 | “10:45提醒我喂奶” | `once + notification`，不追问奶量或喂养类型 |
| 循环喂奶 | “每十分钟提醒我喂奶” | `interval + ringing`，间隔 10 分钟，过滤无关 memory |
| 通用循环 | “每两小时提醒我喝水” | 默认 `interval + notification` |
| 通用闹铃 | “每两小时闹钟提醒我喝水” | `interval + ringing` |
| 模糊提醒 | “过会儿提醒我喝奶” | `ask reminder`，自然语言追问具体时间 |
| 记账 | “今天给小宝买奶粉花了268” | `pending expenseItem`，标题奶粉、金额 268、分类 formula |
| 条码查询 | “这个条形码多少钱” | 不自动入账 |
| 撤销边界 | “撤销刚才那条记录” | `ignore`，说明聊天内不能直接撤销 |
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
