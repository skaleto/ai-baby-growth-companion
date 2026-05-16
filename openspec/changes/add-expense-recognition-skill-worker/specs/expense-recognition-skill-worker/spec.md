## ADDED Requirements

### Requirement: 支出识别必须通过可执行 skill worker
系统 SHALL 将宝宝相关订单、收据、发票、付款截图和消费截图识别，路由到可执行的 `expense-recognition` skill worker。

#### Scenario: 用户提交当前支出图片
- **WHEN** 照护者发送一个或多个图片附件或视频缩略图，并要求识别、记录或整理宝宝相关支出
- **THEN** Agent MUST 为本次请求执行 `expense-recognition` skill worker

#### Scenario: 用户引用之前的支出图片
- **WHEN** 照护者使用“刚才”“上面”“之前”“这些”“再记录”等表达，要求基于之前图片记录或重试支出识别
- **THEN** 如果这些视觉附件可用，Agent MUST 将被引用的附件路由到 `expense-recognition` skill worker

#### Scenario: 支出图片任务原本可能触发联网查询
- **WHEN** 当前请求是支出图片识别任务
- **THEN** Agent MUST NOT 为该支出识别任务调用联网搜索

### Requirement: skill 模式必须显式
系统 SHALL 使用显式模式表达 skill 使用方式：`execute`、`disclose`、`guard`。

#### Scenario: 选择支出识别 skill
- **WHEN** skill plan 为支出图片任务选择 `expense-recognition`
- **THEN** skill plan MUST 将它标记为 `execute`

#### Scenario: 选择纯知识型指导
- **WHEN** 某个 skill 只贡献信息上下文或安全边界
- **THEN** skill plan MUST 将它标记为 `disclose` 或 `guard`，并且 MUST NOT 把它当作已执行 worker

### Requirement: 支出 skill 输出必须无副作用
`expense-recognition` skill worker SHALL 产出结构化输出，但 MUST NOT 直接写入业务记录。

#### Scenario: skill 识别到完整支出
- **WHEN** skill 从图片或用户文本中提取出标题或用途、实际支付金额、分类、日期和证据
- **THEN** 它 MUST 返回一个 `expenseItem` effect candidate，包含 `mode=pending`、payload 字段、证据、置信度和来源 skill 元数据

#### Scenario: skill 需要澄清
- **WHEN** skill 无法识别实际支付金额、支出用途、分类或日期等必填字段
- **THEN** 它 MUST 返回一条自然中文澄清文案，并且 MUST NOT 创建完整的 pending 支出 candidate

#### Scenario: skill 产生面向用户的草稿
- **WHEN** skill 产出 `aiTextDraft` 或 `userFacingError`
- **THEN** final composer MAY 为语气和连贯性改写文案，但 MUST NOT 反转 skill 状态或事实

#### Scenario: skill 试图持久化记录
- **WHEN** skill worker 产出结果
- **THEN** 它 MUST NOT 直接在 `expense_item`、`pending_effect`、`chat_message`、`care_log`、`reminder` 或 `album_item` 中插入、更新、删除、确认或丢弃记录

### Requirement: EffectPolicy 必须保留最终 effect 闸口职责
系统 SHALL 在暴露 pending 或 automatic effect 之前，把支出 skill candidate 交给统一 effect 校验和合并逻辑处理。

#### Scenario: skill candidate 完整
- **WHEN** `expense-recognition` 返回带证据的完整 pending 支出 candidate
- **THEN** 除非更严格的安全或校验规则拒绝它，`EffectPolicy` MUST 保留该 candidate

#### Scenario: 规则提取器只看到重试措辞
- **WHEN** 当前用户文本引用之前的支出，但文本本身不包含新的金额
- **THEN** 纯文本支出规则信号 MUST NOT 覆盖成功的 `expense-recognition` candidate

#### Scenario: 金额已经被识别
- **WHEN** 支出 candidate 已包含实际支付金额
- **THEN** 最终用户回复 MUST NOT 对同一个 candidate 再询问“实际花了多少钱”

### Requirement: 支出识别必须使用独立模型 profile
系统 SHALL 为 `expense-recognition` skill worker 使用独立模型 profile。

#### Scenario: 构建支出 skill 模型请求
- **WHEN** `expense-recognition` skill 调用模型
- **THEN** 它 MUST 使用已配置的支出识别模型 profile、低温度、无工具和结构化抽取提示词

#### Scenario: 配置模型 profile
- **WHEN** 后端启动
- **THEN** 它 MUST 支持为 planner、final composer 和 expense recognition 分别配置模型 profile

#### Scenario: 支出 skill 超时
- **WHEN** 支出识别模型请求超时或失败
- **THEN** skill MUST 返回或暴露支出场景专属的失败状态和面向用户的错误文案，而不是泛化成无关状态

### Requirement: 多图支出识别必须分批处理
当视觉输入数量超过配置的 batch size 时，`expense-recognition` skill worker SHALL 通过图片分析分批来支持多图识别。

#### Scenario: 用户提交 8 张图片
- **WHEN** 用户提交 8 个视觉附件用于支出识别，且配置的 batch size 为 4
- **THEN** skill MUST 分两批分析图片，并把批次结果合成为一个 skill result

#### Scenario: 用户提交不超过 4 张图片
- **WHEN** 用户提交的视觉附件数量不超过配置的 batch size
- **THEN** skill MAY 使用一次视觉抽取请求，不需要预先分批

#### Scenario: 使用批次摘要
- **WHEN** 图片批次已经产出 OCR 或视觉摘要
- **THEN** 最终生成步骤 MUST 使用这些批次摘要，并且 MUST NOT 要求用户重新确认摘要中已经识别出的字段

### Requirement: Agent 和 skill 运行必须可追踪
系统 SHALL 为 Agent run 和已执行 skill run 持久化轻量 trace 记录。

#### Scenario: Agent 请求开始
- **WHEN** Agent chat 或 stream 请求开始
- **THEN** 系统 MUST 创建或更新一条 `agent_run` trace，包含 trace ID、family ID、user ID、输入类型、planner 摘要、skill plan 摘要、状态和耗时

#### Scenario: 支出 skill 执行
- **WHEN** `expense-recognition` 执行
- **THEN** 系统 MUST 创建一条 `skill_run` trace，包含 skill ID、模式、状态、模型 profile、分批数量、附件 ID、输入摘要、结果摘要、effect candidate 摘要、耗时和错误码

#### Scenario: trace 保存媒体引用
- **WHEN** trace 数据引用上传媒体
- **THEN** 系统 MUST 保存附件 ID 或摘要，并且 MUST NOT 在 trace 记录中持久化图片 `dataUrl`、视频 payload 字节或完整 base64 内容

#### Scenario: skill 失败
- **WHEN** `expense-recognition` 因超时、图片不可读、引用附件缺失、provider 错误或校验失败而失败
- **THEN** `skill_run` trace MUST 记录可用于线上排查的失败状态和原因

### Requirement: 流式状态必须反映真实 skill 工作
系统 SHALL 发出与当前 Agent 阶段匹配的用户可见流式状态。

#### Scenario: 支出 skill 正在分析图片
- **WHEN** `expense-recognition` 正在分析当前图片或被引用的历史图片
- **THEN** 流式状态 MUST 表达图片分析或支出分析，而不是泛化的“查找相关记录”

#### Scenario: 支出 skill 失败
- **WHEN** 支出 skill 在最终生成之前失败
- **THEN** 面向用户的消息 MUST 标明相关阶段，例如图片分析超时、图片不可读、引用附件缺失或缺少金额证据

### Requirement: 支出 skill 行为必须有 benchmark 覆盖
系统 SHALL 为支出识别 skill 行为增加确定性测试和 Agent benchmark 覆盖。

#### Scenario: Agent 行为变化后运行 benchmark
- **WHEN** 支出 skill 路由、模型 profile、trace、输出契约、最终回复生成或 effect policy 集成发生变化
- **THEN** `npm run test:agent-benchmark` MUST 通过，并覆盖受影响行为

#### Scenario: 前端附件重试行为变化
- **WHEN** 前端修改聊天附件重试、流式状态或支出识别 UI 行为
- **THEN** 交付前 `npm run verify:frontend` MUST 通过

#### Scenario: 增加支出 skill 回归用例
- **WHEN** 第一版实现落地
- **THEN** 测试 MUST 覆盖单图识别、8 图分批、复用上一轮图片、禁止联网搜索、金额已识别时不重复追问，以及 skill trace 创建
