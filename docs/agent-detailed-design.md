# Agent 模块详细设计文档

更新时间：2026-06-06

本文记录当前 Agent 实现和下一步迁移目标。历史版本强调“确定性规则优先 + EffectPolicy 合并副作用”；该路径已经在真实用户路径中暴露多次“AI 说已记录，但系统没有记录/待确认项”的问题。后续记录/账本迁移以 tool-first action tools 为准。

## 1. 当前目标

Agent 的目标是帮助照护人低负担完成记录和回看，而不是让模型自由决定系统状态。

当前边界：

- P0 只做记录和账本工具化。
- 不给模型暴露 AI 提醒/待办写入工具。
- 不做专家问诊、诊断、用药建议或知识付费。
- 最终回复必须基于后端工具执行结果。

## 2. 当前入口

| 入口 | 用途 |
| --- | --- |
| `POST /api/agent/chat` | 非流式 Agent 请求 |
| `POST /api/agent/chat/stream` | SSE 流式 Agent 请求 |
| `GET /api/agent/harness` | 登录态只读 harness 元信息核验 |
| `POST /api/agent/conversation-summary/compress` | 会话摘要压缩 |

所有写入类 Agent 请求必须要求 caregiver 权限。仅查看成员不可调用 Agent、ASR、上传或状态写入。

## 3. 当前问题链路

旧链路大致是：

```text
用户消息
  -> RecordSignalExtractor
  -> AgentPlanner
  -> 少量外部工具，例如 web_search
  -> 最终模型 JSON
  -> EffectPolicy.decide(...)
  -> effectDecisions
  -> 前端二次组装 pendingEffects / 写入状态
```

已确认的问题：

- 模型文案能说对，但 `effectDecisions` 可能为空。
- 成长测量等结构不在最终模型 schema 的权威字段里，只能靠规则抽取。
- `EffectPolicy` 会重新生成副作用，导致模型理解和真实写入脱节。
- 前端二次组装 pending effect，增加了“后端说有、前端没显示、数据库没落”的裂缝。

## 4. 目标链路：Tool-first Agent Actions

目标链路：

```text
用户消息 / ASR / 附件
  -> AgentRuntime 构造上下文
  -> 模型选择 action tool
  -> AgentActionExecutor 执行工具
  -> AgentMutationService 写入或创建 pending
  -> AgentActionResult
  -> Final Composer 基于 actionResults 生成回复
  -> 前端刷新 app state
```

P0 工具：

| Tool | 行为 | 结果 |
| --- | --- | --- |
| `record_feeding_event` | 母乳/配方奶等字段完整、低风险喂养直接写入 | `applied` |
| `create_growth_measurement_pending` | 身高、体重、头围等成长测量创建待确认项 | `pending_created` |
| `create_expense_pending` | 文本账本请求创建待确认支出 | `pending_created` |

后续 P1 工具：

- `record_sleep_event`
- `record_diaper_event`
- `record_temperature_event`
- `create_growth_event_pending`
- `recognize_expense_image_pending`
- `read_family_records`
- `read_family_ledger`

## 5. Tool 技术形态

Action tools 不是 CLI，也不是前端/公网 API。它们是后端 Agent Runtime 内部注册给模型 function calling 的受控函数。

建议接口：

```java
public interface AgentActionTool {
    String name();
    String displayName();
    DeepSeekTool definition();
    AgentActionResult execute(AgentActionCall call, AgentActionContext context);
}
```

核心类：

| 类 | 职责 |
| --- | --- |
| `AgentActionTool` | 单个记录/账本工具接口 |
| `AgentActionRegistry` | Spring 注入并按名称索引 action tools |
| `AgentActionExecutor` | 解析模型 tool calls、执行工具、记录 trace |
| `AgentActionValidator` | JSON schema 后的业务校验 |
| `AgentMutationService` | 事务内写 `care_log` 或 `pending_effect`，做幂等 |
| `AgentActionResult` | 工具执行事实，供最终回复和前端同步 |

幂等键：

```text
familyId + userId + traceId + toolCallId + toolName + normalizedPayloadHash
```

## 6. Pending 语义

`pending` 不是模型草稿，也不是前端临时卡。它必须：

- 写入后端 `pending_effect`。
- 有稳定 id、owner user、family、source message、tool trace。
- 前端刷新 `/api/app/state` 后仍可见。
- 用户确认后进入最终集合。
- 用户取消或过期后仍能查 trace。

## 7. 日期和上下文语义

工具和模型都必须拿到：

- 当前时间和时区。
- 用户原话中的 `dateSourceText` / `timeSourceText`。
- 最近消息、最近记录、已有 pending 待确认项。
- 宝宝资料和家庭/用户身份。

硬边界：

- 2026-06-06 这天，“这周二”可解析为 2026-06-02。
- 2026-06-06 这天，“上周”只有周范围，成长测量必须追问具体日期，不能落到 2026-06-02。
- “刚才/前面那条”是上下文引用，不是日期本身。
- 当前消息里有新日期表达时，当前消息优先于上下文借日期。

## 8. Benchmark 要求

Agent 行为变化必须运行：

```bash
npm run test:agent-benchmark
```

Tool-first 迁移新增或迁移 case：

- `tool-routing-uses-specific-action-tool-not-generic-care-bag`
- `tool-growth-this-week-tuesday-multi-measurement`
- `tool-growth-last-week-needs-exact-date`
- `tool-growth-replay-recent-measurements`
- `tool-growth-text-tool-result-consistency`
- `tool-feeding-complete-auto-apply`
- `tool-feeding-mixed-needs-type`
- `tool-feeding-followup-type-completes-record`
- `tool-expense-text-pending`
- `tool-expense-missing-amount-needs-input`
- `tool-expense-price-query-no-pending`
- `tool-no-claim-without-tool-result`
- `tool-reminder-request-no-tool-no-mutation`

L2 app-state 验证必须证明：

- AI 回复后 `pending_effect` 真实新增，接口可见。
- 确认 pending 后进入最终集合。
- 喂养自动写入后时间线和今日统计一致。
- 工具失败或 `needs_input` 不增长最终集合。

## 9. 不应继续做的事

- 不继续为成长/喂养/账本 bad case 堆自然语言正则作为主写入路径。
- 不让最终回复绕过工具结果承诺“已记录”。
- 不由前端从未持久化的 `effectDecisions` 构造 pending effect。
- 不在本轮暴露提醒/待办 action tools。
