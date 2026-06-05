## Why

当前 Agent 能力里既有模型规划、规则兜底、工具调用，也有 executable skill worker。最近的支出识别问题暴露出一个核心缺口：如果某条路径绕过 skill plan，最终模型就可能直接生成待确认草稿、重复追问分类或金额，导致交互和持久化结果不一致。

我们需要把 Agent 能力统一到一条成熟契约上：模型负责选择和编排 skill，后端 runtime 负责执行 skill、权限校验、结构化验收、安全边界、幂等持久化和最终展示兜底。

## What Changes

- 建立统一 Agent Skill Runtime Contract，要求所有可执行 Agent 能力都通过 `skill plan -> runtime execute -> effect decision -> persistence gate` 链路。
- Planner/Router 必须把用户输入、附件、最近消息和上下文转成显式 skill plan；最终回复模型不得绕过 executable skill 自行承诺写库或制造待确认卡片。
- Runtime 必须执行被选中的 skill，并记录 trace；执行结果必须进入最终模型上下文和 EffectPolicy/AppStateService。
- Runtime 必须保留结构化兜底：权限、数据边界、分类/字段规范、重复写入、幂等确认、错误文案和用户可见状态不能只依赖模型自觉。
- 支出识别作为第一条落地路径：上一轮图片重试必须重新路由到 `expense-recognition` skill；分类不确定不能成为用户确认阻断项。
- Agent 行为变化必须更新 deterministic benchmark，并把线上故障或交互回归写入 harness evidence。

## Capabilities

### New Capabilities

- `agent-skill-runtime-contract`: 定义 Agent 能力如何由模型选择 skill、后端 runtime 执行、结构化兜底和持久化。

### Modified Capabilities

- `development-workflow`: Agent 能力变更必须验证 skill plan、runtime execution、effect decision 和 persistence gate，而不只验证最终回复文本。

## Impact

- 后端 Agent 模块：`AgentPlanner`、`SkillRouter`、`AgentRuntime`、`EffectPolicy`、具体 executable skill worker、trace 记录。
- 前端聊天提交：上一轮附件引用、stream 状态、effect card 展示和 pending/auto 行为。
- 测试与质量门禁：`AgentBenchmarkTests`、skill worker 单测、controller/state 持久化测试、`npm run test:agent-benchmark`。
- 文档：`docs/agent-detailed-design.md`、harness 记录、OpenSpec capability。
