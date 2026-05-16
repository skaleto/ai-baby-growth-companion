## 1. Trace 持久化

- [x] 1.1 增加 `agent_run` 的 SQLite 表初始化或迁移。
- [x] 1.2 增加 `skill_run` 的 SQLite 表初始化或迁移。
- [x] 1.3 增加轻量级 Agent / skill trace 记录的持久化实体、服务和 DTO。
- [x] 1.4 确保 trace payload 只保存附件 ID 和摘要，不能保存图片 `dataUrl`、视频字节或 base64 内容。
- [x] 1.5 增加后端测试，覆盖成功和失败的 `agent_run` / `skill_run` trace 创建。

## 2. Skill 契约和路由

- [x] 2.1 增加通用 skill mode 类型：`execute`、`disclose`、`guard`。
- [x] 2.2 增加可与当前 `AgentPlan` 共存的 `SkillPlan` 契约。
- [x] 2.3 实现规则优先的 skill router，在当前支出图片场景中以 `execute` 模式选择 `expense-recognition`。
- [x] 2.4 扩展路由：当历史附件可用时，对“刚才/上面/再记录”这类历史支出图片引用选择 `expense-recognition`。
- [x] 2.5 保持 `pediatric-care-guide` 和现有 YAML skill disclosure 与 `disclose` / `guard` 语义兼容。
- [x] 2.6 增加 router 测试，覆盖支出图片执行、历史图片重试、儿科指导 disclosure、纯结构化护理记录抑制。

## 3. 模型 Profile 配置

- [x] 3.1 增加 planner、final composer、expense recognition 三类模型 profile 配置。
- [x] 3.2 将现有模型设置映射到新的 planner 和 final composer profile，且不改变默认行为。
- [x] 3.3 为支出识别配置无工具、低温度、batch size、超时和重试相关设置。
- [x] 3.4 增加测试，验证每个 profile 可解析，并保持现有 DeepSeek / Doubao 模型行为不变。

## 4. 支出识别 Skill Worker

- [x] 4.1 增加 `ExpenseRecognitionSkill` 输入和输出 DTO，包括 status、`aiTextDraft`、`userFacingError`、effect candidate、clarification、evidence 和 trace summary。
- [x] 4.2 将现有多图视觉分批行为迁移到支出 skill 内，或抽成由 skill 路径拥有的可复用服务。
- [x] 4.3 使用支出识别模型 profile 实现单图和小批量视觉抽取。
- [x] 4.4 实现大批量视觉抽取和批次摘要合成。
- [x] 4.5 确保支出 skill 提示词禁止联网搜索、参考价查询、不受支持的假设，以及编造不可读字段。
- [x] 4.6 只有在实际支付金额、宝宝相关用途 / 标题、分类、日期和证据都可用时，才产出 pending `expenseItem` candidate。
- [x] 4.7 当必填支出字段缺失时，产出自然中文澄清。
- [x] 4.8 为超时、provider 错误、图片不可读、引用附件缺失、无法识别金额证据等情况产出具体失败状态。
- [x] 4.9 为成功、澄清和失败结果记录 `skill_run` trace。

## 5. AgentRuntime 集成

- [x] 5.1 在 planner / context 读取之后、构建 final composer 请求之前插入 skill 路由。
- [x] 5.2 对选中的支出图片任务，在最终生成之前执行 `expense-recognition` skill。
- [x] 5.3 将 skill 结果注入 final composer 上下文，并明确最终文案不能反转 skill 事实。
- [x] 5.4 保留其他图片 / 视频提示词的非支出视觉分析行为。
- [x] 5.5 保留当前流式事件，并为支出 skill 分析和失败增加具体状态文案。
- [x] 5.6 保持公开 `/api/agent/chat` 和 `/api/agent/chat/stream` 请求 / 响应兼容。
- [x] 5.7 确保 `agent_run` trace 包含 planner 摘要、skill plan 摘要、effect 摘要、最终状态和错误。

## 6. EffectPolicy 和最终文案

- [x] 6.1 更新 `EffectPolicy`，把支出 skill candidate 作为一等候选输入接收。
- [x] 6.2 确保完整 skill candidate 不会被纯文本支出规则 ask 覆盖。
- [x] 6.3 确保 skill candidate 已包含实际支付金额时，最终文案不会再追问实际金额。
- [x] 6.4 保留对金额、标题 / 用途、分类、日期和宝宝相关支出边界的集中校验。
- [x] 6.5 增加测试，覆盖成功 skill candidate 保留、不完整 candidate 澄清，以及与当前文本规则信号冲突。

## 7. 前端兼容

- [x] 7.1 保留当前历史支出图片的引用附件重试行为。
- [x] 7.2 仅当新增支出 skill 状态事件名时，更新聊天流式状态处理。
- [x] 7.3 第一阶段保持当前 pending effect 和账本确认 UI 不变。
- [x] 7.4 验证超时和失败文案能指出图片分析或支出识别阶段。

## 8. Benchmark 和验证

- [x] 8.1 增加 Agent benchmark，覆盖单图支出识别并生成 pending 支出草稿。
- [x] 8.2 增加 Agent benchmark，覆盖 8 图支出识别分批处理且不联网搜索。
- [x] 8.3 增加 Agent benchmark，覆盖历史图片重试能路由到 `expense-recognition`。
- [x] 8.4 增加 Agent benchmark，覆盖金额已识别时不会重复追问金额。
- [x] 8.5 增加后端测试，覆盖 `agent_run` / `skill_run` trace 创建和失败记录。
- [x] 8.6 运行 `npm run test:agent-benchmark`。
- [x] 8.7 运行 Agent runtime、planner / router、expense skill、effect policy 和 trace persistence 的目标后端测试。
- [x] 8.8 如果修改了流式状态或附件重试 UI 行为，运行 `npm run verify:frontend`。
- [x] 8.9 运行 `git diff --check`。

## 9. 发布和交接

- [x] 9.1 更新 `harness/feature_list.json`，记录验证证据。
- [x] 9.2 更新 `harness/claude-progress.md`，记录完成状态、运行命令和已知风险。
- [x] 9.3 如果前端行为或移动端 bundle 资源发生变化，构建并发布 OTA。（本次无前端 bundle 变更，未发布 OTA。）
- [x] 9.4 使用 `SYNC_DATA=0` 部署后端，并验证云端 `/api/health`。
- [x] 9.5 如果发布 OTA，验证 OTA 检查和签名下载 checksum。（本次未发布 OTA。）
- [x] 9.6 如果用户要求，在实现和验证完成后提交并推送。（本次未要求提交或推送。）
