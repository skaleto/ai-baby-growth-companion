## Context

小宝记 Agent 已经有 planner、规则信号、skill disclosure、tool registry、effect policy 和第一个 executable skill worker：`expense-recognition`。当前缺口不是“有没有 skill”，而是能力链路还没有成为硬契约：某些连续对话或最终回复路径可以绕过 executable skill，让模型直接生成待确认草稿、追问本应自动处理的分类，或给出与持久化状态不一致的文案。

用户确认的目标形态是：模型选择 skill，后端作为 runtime 执行 skill 并做安全/结构化兜底。这个形态需要成为所有 Agent 能力的统一实现策略。

## Goals / Non-Goals

**Goals:**

- 把 Agent 能力统一成 `planner chooses skill -> runtime executes skill -> EffectPolicy/AppStateService gates effects`。
- 让最终回复模型只负责表达和汇总，不直接替代 executable skill 做写库候选生成。
- 让 runtime 对权限、数据边界、结构化字段、幂等性、重复写入和用户可见状态承担最终责任。
- 先修复支出识别路径：上一轮图片重试、分类推断、自动保存/确认状态都必须走 `expense-recognition` 的可追踪链路。
- 为后续照护、提醒、相册等 executable skill 提供一致接入约束。

**Non-Goals:**

- 不在本 change 内把所有现有能力一次性重写成 executable skill。
- 不取消规则信号；规则仍作为 planner 输入、fallback 和 safety guard。
- 不让模型拥有直接写库权限。
- 不把前端作为唯一的附件重试路由来源；前端可以辅助，后端 runtime 必须能兜底。

## Decisions

### Decision 1: Skill 选择由模型 planner 表达，runtime 做确定性验收

Planner 应在上下文里看到可用 skill、当前附件、最近消息和最近媒体候选，并输出可执行意图。Runtime 可以基于规则信号和安全策略修正或拒绝不合法 plan，但不能让最终回复模型绕过 skill plan 自行写效果候选。

Alternative considered: 只用后端硬编码规则选择 skill。这个方式稳定但会把语义决策分散在代码里，难以扩展到复杂多 skill 编排。

### Decision 2: Executable skill 结果是唯一的一等结构化事实来源

对已经有 executable skill 的能力，例如支出图片识别，最终模型不得再平行生成同类 pending expense candidates。最终模型可以解释 skill result、合并文案、提示缺失信息，但结构化候选以 skill output 和 runtime persistence result 为准。

Alternative considered: 同时保留 skill candidates 和 model expenses 再去重。历史上这个方向已经产生过重复确认、重复写入和覆盖风险。

### Decision 3: Runtime 必须处理跨轮上下文引用

当用户说“刚才/上面/之前这些图片再记录一下”，runtime 不能只看当前请求是否带附件。它必须结合 recentMessages/recentMediaCandidates 找到上一轮可用视觉证据，并重新进入对应 executable skill。前端可以主动转发附件，但后端不能依赖前端正确匹配。

Alternative considered: 完全由前端转发上一轮附件。这个方案对热更新友好，但任何前端匹配漏词都会让后端退化到自由模型回复。

### Decision 4: Classification is a normalization field, not a user-blocking field

账本分类用于展示和统计，不应阻断已识别出金额、商品/用途、日期和证据的支出。Runtime 或 skill worker 必须按商品名/用途推断分类；仍不确定时使用 `other`，而不是追问用户“月子鞋/月子服/摇奶器属于什么分类”。

Alternative considered: 让模型追问所有不确定分类。这个方式理论上更精确，但对用户体验伤害大，且分类可后续在明细里手动编辑。

## Risks / Trade-offs

- Model planner 可能选错 skill -> Runtime 保留规则 fallback、capability allowlist 和 benchmark 覆盖。
- 后端拉取上一轮附件会增加实现复杂度 -> 先限制为同家庭、最近消息、最多 8 个视觉附件，并复用现有附件权限和存储读取能力。
- 分类兜底可能不完美 -> 以 `other` 作为安全兜底，用户可在账本明细编辑；不阻断记录。
- Skill contract 扩展到所有能力需要分阶段完成 -> 本 change 只把契约和支出路径落地，后续 executable skill 按同一规范迭代。
