# Agent Harness 模型对比报告

日期：2026-06-06
Harness：`harness/agent-model-context-harness.md`
Live runner：`scripts/agent-harness-live-benchmark.mjs`

## 结论摘要

扩展后的 model-context harness 现在已迁移为中文主干，并有一套 24 个场景的跨模型检查，覆盖最近真实用户遇到的问题，以及“记录和陪伴”主线下更广的产品功能边界。

| 模型 / 方法 | 证据强度 | 结果 | 最终报告成本 | 备注 |
| --- | --- | ---: | ---: | --- |
| DeepSeek v4-pro live API | 真实 API 调用，启用 JSON response format | 24/24 PASS | 0.3152 CNY | 结构化输出最稳定，中文 harness 全量复测通过。 |
| 豆包 seed 2.0 pro live API | 真实 Ark API 调用；当前 runner 未启用 JSON response format | 24/24 PASS | 2.5824 CNY | 中文日常语义理解强，中文 harness 全量复测通过。 |
| Codex clean subagent audit | 只读 Codex 子 agent 审阅同一份 harness 和同一组场景预期 | 24/24 PASS predicted | 0 CNY 外部 API 成本 | 适合作为可迁移性审计，但证据强度不等同于外部付费模型 live run。 |

最终记录的中文 harness 两次全量 API 成本：DeepSeek + 豆包 = 2.8976 CNY。迭代过程中还包含 dry-run、一次早期豆包全量运行和一次豆包 5-case 定向复测；观测成本仍明显低于用户设定的 20 CNY 上限。实际计费仍以服务商后台为准。

## 执行命令

```bash
npm run test:agent-harness-live -- --dry-run --provider deepseek --budget-cny 20
npm run test:agent-harness-live -- --provider deepseek --budget-cny 20
npm run test:agent-harness-live -- --dry-run --provider doubao --budget-cny 20
npm run test:agent-harness-live -- --provider doubao --budget-cny 20
```

中间针对豆包风险点做过一次定向复测：

```bash
npm run test:agent-harness-live -- --provider doubao --only growth-ambiguous-weight,vague-health-reminder,growth-measurement-complete,growth-duplicate-boundary,caregiver-fatigue-support --budget-cny 20
```

## 场景矩阵

| 场景 | DeepSeek live | 豆包 live | Codex audit | 覆盖的产品风险 |
| --- | --- | --- | --- | --- |
| `recent-milk-confirmation` | PASS | PASS | PASS predicted | 用户只回复“母乳”时，必须合并上一轮追问，生成一条完整奶量时间线事件。 |
| `midnight-twelve` | PASS | PASS | PASS predicted | 凌晨附近的“十二点”应理解为 `00:00`，不是中午十二点。 |
| `read-only-reminders` | PASS | PASS | PASS predicted | “只看看提醒”不能创建提醒，也不能追问新建提醒。 |
| `feeding-interval-reminder` | PASS | PASS | PASS predicted | 喂奶提醒是 reminder，不是已经发生的喝奶记录，也不是宝宝习惯记忆。 |
| `growth-ambiguous-weight` | PASS | PASS | PASS predicted | 中文语境里的“体重14”必须先确认斤/公斤，再保存。 |
| `expense-reference-price` | PASS | PASS | PASS predicted | 条码价格、参考价格问题是只读查询，不是实际记账。 |
| `ordinary-qa-no-memory` | PASS | PASS | PASS predicted | 普通育儿问答不能污染长期记忆或照护日志。 |
| `private-reminder-share` | PASS | PASS | PASS predicted | 私密提醒同步不能承诺已同步，也不能建议另建一条绕过去。 |
| `mixed-feeding-missing-type` | PASS | PASS | PASS predicted | 混合喂养下，后续泛称“喝奶”仍要确认母乳/奶粉，不能永久继承上一次答案。 |
| `embedded-question-vomit-record` | PASS | PASS | PASS predicted | 记录夹在问题里时，仍要写入具体事件，同时用低焦虑语气回应吐奶。 |
| `feeding-start-no-amount` | PASS | PASS | PASS predicted | 只说“开始吃奶”不能保存 0ml 或虚构奶量。 |
| `sleep-start-no-duration` | PASS | PASS | PASS predicted | 只说“刚睡着”不能虚构完整睡眠时长。 |
| `vague-health-reminder` | PASS | PASS | PASS predicted | “晚点提醒”需要追问具体时间，不能自行编一个提醒时间。 |
| `medicine-reminder-pending` | PASS | PASS | PASS predicted | 药品提醒即使时间明确，也要 pending/ask，不能静默自动创建。 |
| `growth-measurement-complete` | PASS | PASS | PASS predicted | 身高、体重、头围应拆成独立的待确认成长数据草稿。 |
| `growth-out-of-range` | PASS | PASS | PASS predicted | `999cm` 这类异常值应追问确认，不能保存。 |
| `growth-duplicate-boundary` | PASS | PASS | PASS predicted | 当天同类型同值成长数据已存在时，不能再创建一个草稿。 |
| `growth-update-boundary` | PASS | PASS | PASS predicted | 聊天里修改历史成长数据属于能力边界，不能变成新增测量草稿。 |
| `memory-explicit-health` | PASS | PASS | PASS predicted | 用户明确“记住”的健康事实应成为待确认记忆草稿。 |
| `expense-actual-amount` | PASS | PASS | PASS predicted | 真实宝宝消费且有金额时，应生成账本 effect。 |
| `photo-album-save` | PASS | PASS | PASS predicted | 明确要求保存宝宝照片时，只生成相册 effect。 |
| `screenshot-ignore` | PASS | PASS | PASS predicted | App 截图且用户说“别保存”时，不创建任何状态。 |
| `read-only-daily-summary` | PASS | PASS | PASS predicted | 今日总结只能读取已有记录并停止，不能邀请用户新增记录。 |
| `caregiver-fatigue-support` | PASS | PASS | PASS predicted | 照护人疲惫表达只做低焦虑支持，不能转成记录/提醒建议。 |

## 模型行为差异

DeepSeek 的输出最紧凑、机器可解析性最好。由于 runner 对 DeepSeek 使用了 `response_format=json_object`，它对 JSON 契约的遵守更稳定，缓存命中后成本也很低。早期暴露的问题主要不是结构化能力，而是语义/文案漂移：私密提醒边界下给绕行建议、药品提醒直接 auto-create、只读日报结尾邀请新增记录。现在这些都已经进入 exact harness 规则和 evaluator 检查。

豆包对中文日常表达的理解很好，最终所有语义检查都通过。它的弱点在结构化输出：在 runner 没有 `response_format=json_object` 的情况下，早期一次“身高+体重+头围”场景返回了无效 JSON。后来 runner 明确要求省略 null 字段、保持 compact JSON 后，同一场景和最终 24-case 全量都通过。豆包也帮助暴露了很有价值的可迁移性风险：重复成长数据、照护人疲惫场景里“好心追加记录/提醒建议”的倾向。

Codex clean subagent 是只读审阅，不是外部 live API。它基于同一份 Markdown harness 和场景断言预测 24/24 通过。它对 source precedence、只读边界、多 effect 拆分、能力边界推理会比较强；主要风险也和另外两个模型相同：在只读或情绪支持场景里，回复太“热心”导致追加了不该有的记录/提醒邀请。

## 对产品的含义

- Harness 不必是 JSON。Markdown 更适合作为人类可维护的产品语义层，模型也能稳定吸收。
- Benchmark case 仍应保留 JSON/JS，因为场景上下文、断言和成本守门需要确定性结构。
- 本次真实用户遇到的关键坏例已经进入模型可见语境：母乳确认、时间线同步、凌晨十二点、混合喂养确认、只读不变更、成长数据维护、低疲劳陪伴。
- live benchmark 证明的是模型在这份 harness 下的遵从度；它不能替代后端持久化、重复校验、schema 校验、L2 app-state 测试和前端体验验证。

## Harness 语言结论

Harness 不必须用英文，中文完全可以，而且这个项目后续更适合“中文主干 + 英文字段/Schema 保留”的写法。

原因：

- 产品用户输入、坏例和 UI 文案都是中文，用中文写 harness 能减少语义损耗。
- “刚才”“十二点”“奶”“母乳/奶粉”“晚点”“别新增”这类表达，本来就应该以中文原句沉淀。
- 模型对中文规则理解没有问题；DeepSeek、豆包、Codex 都能处理中文语义规则。
- 英文保留在少数地方即可：JSON 字段名、effect 类型、mutation 枚举、脚本参数、代码标识符。

当前 harness 已经迁移为中文主干，并保留 `effect` 类型、`mutation` 枚举、JSON 字段、脚本参数和代码标识符等英文机器结构。迁移后已重跑 Java benchmark、DeepSeek 24-case live benchmark 和豆包 24-case live benchmark，均未出现行为漂移。

## 下一步覆盖重点

1. 把最关键的 live case 镜像到 L2 stream/app-state：母乳确认后时间线同步、凌晨 `12点`、只读日报 no-nudge。
2. 继续控制模型运行成本：先 dry-run、不启用 judge、thinking disabled，默认 24-case，除非明确提高预算和 case 数。
3. 新增产品功能时，同步补一个正向 case 和一个边界/no-mutation case 到 live harness 或 L2 矩阵。
