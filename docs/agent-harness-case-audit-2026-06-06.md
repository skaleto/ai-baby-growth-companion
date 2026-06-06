# Agent Harness Case Audit

日期：2026-06-06
状态：active
范围：AI agent model harness、确定性规则抽取、EffectPolicy、prompt、L2/benchmark 覆盖

## 结论摘要

Agent 不应该把所有规则都搬进模型 harness。更清晰的分层是：

- 留在确定性代码里：副作用权限、schema 完整性、安全门禁、重复/异常值检查、持久化事实、最终归一化。
- 放进 Markdown harness：模型可读的产品语义、真实坏例、上下文使用方式、中文日常表达、用户可见文案边界。
- 放进 capability manifest：系统支持/不支持的产品能力，以及媒体、工具、动作边界。
- prompt 里只保留启动规则：使用 `modelContextHarness`、schema 要求、安全层级、最终 JSON/streaming 规则。

当前 harness 已迁移为中文主干，并覆盖照护记录、提醒、成长数据、账本、记忆、媒体、source precedence、私密/只读边界和低焦虑照护人支持。live benchmark 已用真实 DeepSeek 和豆包 API 在 20 CNY 硬预算内验证；另有一个干净 Codex 子 agent 做可迁移性审计。

## 规则归属矩阵

| 领域 | 代表 case | 当前确定性 owner | Harness owner | 决策 |
| --- | --- | --- | --- | --- |
| Source precedence | 持久化账本/照护事实与模型草稿冲突 | `AgentRuntime`, `EffectPolicy` | Source precedence section | 混合：确定性事实优先；模型被告知不能反驳已持久化事实。 |
| 最近一次确认 | 用户在奶类追问后只回复“母乳” | `EffectPolicy.mixedFeedingClarification`, context | Mixed feeding confirmation bad case | 混合：模型合并上下文；policy 防止字段不完整时 unsafe auto。 |
| 凌晨时间 | 00:21 时，“十二点”应为 00:00 | `RecordSignalExtractor`、frontend `normalizeClockText`、prompt/harness | Relative time bad case | 混合：harness 指导模型；后端和前端本地时间归一化已补 plain 12 near midnight 回归。 |
| 时间线同步 | 奶量总数更新但时间线缺事件 | `CareEventCompletenessPolicy`, `EffectPolicy` merge | Recording result rule | 混合：模型必须输出 event；确定性完整性检查过滤无效 payload。 |
| 问句里的具体记录 | “今天咋样？刚才九点多喝了100奶粉” | `RecordSignalExtractor.questionOnly` | Daily language examples | 混合：确定性 signal 解锁 mutation；harness 防止模型当成纯 Q&A。 |
| 喂奶开始 | “现在开始吃奶”但没有量 | `RecordSignalExtractor.incompleteFeeding` | Care records | 主要留确定性；harness 保留自然语言例子。 |
| 睡眠开始 | “刚睡着”但没有时长 | `RecordSignalExtractor.incompleteSleep` | Care records | 主要留确定性；harness 防止虚构时长。 |
| 混合喂养缺奶类 | 混合喂养宝宝下“喝奶120ml” | `EffectPolicy.mixedFeedingClarification` | Mixed feeding confirmation | 混合；不能把上一次奶类永久当默认值。 |
| 提醒 vs 记录 | “每半小时提醒喂奶” | `RecordSignalExtractor.reminderSignal`, `EffectPolicy.reminderSignalDecision` | Reminders | 混合；模型需要理解提醒不是已经发生的喂奶事件。 |
| 模糊提醒 | “晚点提醒我” | `EffectPolicy.hasUsableScheduleTime` | Reminders | 主要留确定性；harness 降低模型编造 due time 的概率。 |
| 私密提醒分享 | “产后复诊提醒同步给奶奶，不要新建” | `RecordSignalExtractor.privateStateShareRequest`, `EffectPolicy` boundary | Reminders bad case | 混合；live run 曾发现 duplicate-create 建议，已写入 harness。 |
| 成长体重单位歧义 | “体重14” | `RecordSignalExtractor.addMeasurementSignal` | Growth measurements | 主要留确定性；harness 解释中文“斤/公斤”歧义。 |
| 成长历史编辑/删除 | “把上周身高改成...” | `AgentCapabilityContract.unsupportedMutationRequest` | Growth measurements | 主要留确定性；harness 解释 UI 能力边界。 |
| 实际支出 vs 参考价格 | 条码价格问题 vs 已付款金额 | `RecordSignalExtractor.expenseSignal`, expense skill | Expenses | 混合；capability manifest 也应保留实际价格边界。 |
| 普通问答污染记忆 | “宝宝不爱吃辅食怎么办” | `RecordSignalExtractor.explicitMemoryRequest`, `EffectPolicy` | Memories | 主要留确定性 consent gate；harness 避免模型污染记忆。 |
| 截图/媒体 | App 截图不应进入相册/照护日志 | `AgentPlanner`, `AgentRuntime`, `imageBoundaryPolicy` | Media and visual inputs | capability manifest + 确定性 runtime；harness 承载模型行为边界。 |
| 安全语气 | 发烧/药/疫苗/受伤 | `EffectPolicy.highRisk`, skills | Care records/reminders | 安全规则故意多层重复。 |

## Harness 新增内容

扩展后的中文 Markdown harness 现在覆盖：

- Source precedence：持久化事实、skill result、applied effect 优先于模型草稿。
- 确定性边界：模型草稿受本地安全、权限、校验和持久化约束。
- 照护记录完整性：喂奶/睡眠开始不能生成虚假的完整记录。
- 混合喂养确认链：短回复要合并上一轮追问，但不能成为永久默认值。
- 提醒语义：interval vs one-time、模糊时间、高风险提醒、私密分享，以及用户明确不要重建时不能建议 duplicate workaround。
- 成长语义：测量值 vs 里程碑、中文体重单位歧义、重复/异常值、聊天编辑/删除边界。
- 账本语义：实际付款金额 vs 参考价格/条码查询。
- 记忆 consent：只有明确“记住/以后注意”才进入记忆草稿。
- 媒体边界：截图和 UI 截图不能变成宝宝相册记忆或照护记录。
- 中文日常表达例子：用于 live benchmark 和后续坏例沉淀。

## Benchmark 覆盖

| 层级 | 证明什么 | 当前证据 |
| --- | --- | --- |
| L0/L1 Java benchmark | 确定性抽取、policy、planner/runtime prompt 注入、harness 文本覆盖 | `npm run test:agent-benchmark` |
| Model harness live benchmark | 真实 DeepSeek 和豆包在注入 Markdown harness 后、预算受控情况下的响应 | `npm run test:agent-harness-live -- --provider deepseek --budget-cny 20`; `npm run test:agent-harness-live -- --provider doubao --budget-cny 20` |
| L2 app-state benchmark | 后端 stream endpoint、预置 app state、结构化 effects、state diff、可选 judge | `npm run test:agent-l2` |
| Codex comparison | 同一份 harness 和同一组场景预期下的模型可迁移性检查 | 干净 Codex 子 agent，只读 |

最终 live-model 快照：

- DeepSeek v4-pro：24/24 PASS，最终 API usage estimate 0.3152 CNY。
- 豆包 seed 2.0 pro：24/24 PASS，最终 API usage estimate 2.5824 CNY。
- Codex clean subagent：24/24 PASS predicted，是只读审计，不是付费 live API。

## 已知后续

- plain “12点” near midnight 已补后端 `RecordSignalExtractor` 与前端 `normalizeClockText` 本地回归；后续仍建议在 L2 app-state 镜像一次，验证 stream/effect/apply 全链路。
- capability manifest 后续可以吸收一些现在在 prompt/harness 里重复的薄边界，尤其是 reminder 默认值、实际支出 vs 参考价格、媒体边界。
- live benchmark 默认应保持受控。当前是 24 个场景；如要增加 calls，需要 `ALLOW_MORE_LIVE_CALLS=1` 和明确预算决策。
- L2 场景后续应镜像最高风险 live cases：最近一次母乳确认后的时间线同步、midnight twelve、只读日报 no-nudge。
