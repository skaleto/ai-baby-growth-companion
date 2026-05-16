## 为什么

近期多图支出识别在线上暴露出一个核心问题：同一个用户能力被分散在提示词规则、规划器启发式逻辑、视觉分批、前端附件重试逻辑，以及 `EffectPolicy` 后处理里。这样会导致行为很难解释、测试、追踪和改进。尤其是用户说“把刚才/上面的花费再记录一遍”时，系统既要复用历史图片，又要避免规则澄清覆盖模型已经识别出的金额，当前链路很容易互相打架。

本变更把 `expense-recognition` 作为第一个“可执行 skill worker”落地，让 skill 从被动的提示词片段升级为真实、结构化、可观测、可测试的能力模块。

## 改什么

- 新增可执行的 `expense-recognition` skill worker，用于识别宝宝相关订单、收据、发票、付款截图和消费截图。
- 增加 skill 路由层，明确区分 `execute`、`disclose`、`guard` 三种模式，同时保持现有 `AgentRuntime` 和 `AgentPlanner` 兼容，避免一次性重写。
- 将支出图片 OCR、金额提取、疑似重复提示、禁止联网搜索、澄清生成、支出 effect candidate 生成，收敛到 `expense-recognition` skill 边界内。
- 增加模型 profile 分离，让支出识别使用独立的视觉抽取 profile，支持低温度、独立超时、分批大小和重试策略。
- 新增轻量级 `agent_run` 和 `skill_run` 追踪记录，用于保存规划结果、skill plan、skill 执行状态、模型 profile、耗时、分批数量、effect candidate 摘要和失败原因。
- skill worker 保持无副作用：可以产出结构化 effect candidate 和面向用户的草稿文案，但不能直接写入支出、提醒、护理记录、相册或聊天消息。
- 保留 `EffectPolicy` 作为统一校验和合并入口，由它决定 `auto`、`pending`、`ask`、`ignore`，并防止纯文本规则信号覆盖已经成功的支出 skill 结果。
- 保留当前流式体验，但让状态文案真实反映后台正在做的事情：规划、读取上下文、分析图片、运行支出识别、生成最终回复。
- 增加确定性的后端测试和 Agent benchmark，覆盖单图识别、8 图分批、复用上一次图片、禁止联网搜索、金额已识别时不重复追问，以及 skill trace 创建。

## 能力变更

### 新增能力

- `expense-recognition-skill-worker`：定义可执行支出识别 skill 的契约、路由规则、模型 profile 行为、追踪要求、effect candidate 边界和必要验证。

### 修改能力

- 无。

## 影响范围

后端：

- 在现有 Agent runtime 周围增加 skill 路由和 skill worker 抽象。
- 新增 `ExpenseRecognitionSkill`，以及 skill 输入、输出、证据、澄清和 trace 摘要相关 DTO。
- 增加 planner、final composer、expense recognition 三类模型 profile 配置。
- 增加 SQLite 持久化，用于保存 `agent_run` 和 `skill_run` 轻量 trace。
- 调整 `AgentRuntime`、`AgentPlanner`、`EffectPolicy` 和视觉分析流程，使其消费 skill 结果，同时保持当前 API 行为不变。

前端：

- 继续在“再记录刚才/上面的花费”场景中发送当前附件和被引用的历史附件。
- 在支出 skill 运行时消费更准确的流式状态文案。
- 第一阶段不增加面向用户的 trace UI。

Agent / 模型调用：

- 支出识别使用独立的无工具、低温度视觉抽取 profile。
- 最终回复生成必须把 skill 结果当作证据，不能反转 skill 已确认的事实，也不能在金额已识别时再问“实际花了多少钱”。

数据 / 隐私：

- trace 表不能持久化图片 `dataUrl` 或完整 base64 内容。
- 只保存附件 ID、OCR 摘要、识别字段摘要、状态、耗时和错误码。

验证：

- Agent 行为变化必须运行 `npm run test:agent-benchmark`。
- 聊天 UI 状态或附件重试行为变化必须运行 `npm run verify:frontend`。
