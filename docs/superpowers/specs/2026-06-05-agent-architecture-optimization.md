# Agent 架构优化：能力矩阵 + tool use + 快慢路径 + caching（立项）

- 创建日期：2026-06-05
- 状态：P0 落地中
- 触发：用户提出"系统能力是否写死 prompt？需要一份给 AI 看的产品能力矩阵，类 skill、随产品迭代更新，避免 AI 说能做但系统没实现"
- 方法：现状 code review（有证据）+ 竞品/最佳实践 research（带来源）→ 分阶段落地，benchmark 当安全网
- 关联：`2026-06-04-agent-latency-audit.md`（分流）、`2026-06-04-agent-capability-benchmark.md`（L2 benchmark + coverage）

## 现状结论（code review，每条有代码证据）

链路：`recordSignal(规则)` → `planner(deepseek-flash)` → `context build(DB)` → `视觉分析(豆包pro)` → `web_search(planner预定)` → `final composer(doubao lite/pro, json_object)`

| 维度 | 现状 | 证据 |
|---|---|---|
| 能力暴露 | 静态 Java 写死 + 全量注入 | `AgentCapabilityContract`（supported/unsupported/replyRules）注入 `AgentRuntime:2300/2336` |
| 工具调用 | 假 tool：`DeepSeekChatRequest.tools` 字段定义了但全链路从未填充；记录靠 `json_object`(:1417) 吐 effectDecisions + EffectPolicy 解析 | grep `new DeepSeekTool` 为空 |
| 路由 | planner 每次都跑（无规则快路径） | `runPlanner` 无条件执行 |
| caching | ❌ 每次全发 | grep `cache_control` 为空 |
| 图片压缩 | ✅ 已做 | `resizeImageDataUrlForAgent` canvas 多档 |
| 流式异步 | ✅ 已做 | `extractAiTextPreview` + 相册落库解耦 |
| 视频抽帧 | ❌ 原始 video_url 直传 | `AgentRuntime:2433` |

## 设计原则（research 背书，带来源）

1. **双层防线**（杜绝"AI 说能做但没实现"的核心）：
   - 层1 grounding — 能力矩阵注入 prompt，约束"别在自然语言里吹牛"
   - 层2 schema 硬约束 — function calling，约束"动作层只能调真实存在的能力"
   - 依据：tool schema = capability contract，模型"only select from predefined tools"；但 tool_choice 只约束输出不约束推理 → 两者必须并用。https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
2. **渐进式披露**（避免上下文稀释）：常驻只放「能力标题 + 一句话」，详情/schema 按需加载。依据：Anthropic Skills 三级披露。https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
3. **单一事实源（SSOT）**：一份 manifest 同时驱动 agent 运行时 + benchmark 覆盖 + 文档 → 改一处同步三处。
4. **能力多了再上 defer_loading / Tool Search**（58 工具 token -85%）。https://www.anthropic.com/engineering/advanced-tool-use

## Capability Manifest 设计（P0 核心 SSOT）

文件：`backend/src/main/resources/agent/capability-manifest.json`（后端打包进 classpath；benchmark 读同一文件）。

每张能力卡片字段：
- `id` — 稳定标识（未来即 tool name，如 `log_care_feeding`）
- `name` — 中文能力名
- `effectType` — 对应真实落库类型（careLog/growthMeasurement/reminder/memory/expenseItem/albumItem/growthEvent），或 `null`（如纯视觉描述/联网）
- `eventType` — careLog 的子类（milk/sleep/poop/…），可选
- `trigger` — 何时触发（刻意写得略 push，模型倾向 undertrigger）
- `summary` — 一句话（**常驻披露层**）
- `requiredFields` — 必需输入（**详情层**，未来即 tool schema 的 required）
- `modes` — auto/ask/pending
- `can` / `cannot` — 能与不能（**详情层**，杜绝幻觉承诺）
- `enabled` — 是否上线（false = 已知未实现，benchmark 据此标 known-gap）
- `benchmark` — 关联 L2 场景 id（连接 coverage）

另含 `globalBoundaries`（跨能力边界 + 用户文案）、`imageBoundary`、`replyRules`——平滑承接现有 `AgentCapabilityContract` 的全部内容。

## 分阶段落地

### 🔴 P0（本轮，低风险，不动 effectDecisions 链路）
- [ ] P0-1a 创建 `capability-manifest.json`（SSOT），覆盖现有 AgentCapabilityContract 全部内容 + 能力卡片维度
- [ ] P0-1b `AgentCapabilityContract` 改为从 manifest 加载（loader），保持现有注入行为不变
- [ ] P0-1c benchmark 加一个 gate：manifest 中 `enabled` 能力必须有 `benchmark` 覆盖或显式 known-gap；effectType 必须在真实 EffectPolicy 支持集合内
- [ ] P0-1d agent 注入改为渐进披露：常驻只注入能力卡片的 `id+name+summary`，`can/cannot/requiredFields` 按相关性注入（先按 inputType/intent 粗筛）
- [ ] P0-2a 确认豆包 seed-2.0 透明前缀缓存生效条件；把 `system + 能力矩阵摘要 + (未来 tools)` 放 prompt 稳定前缀
- [ ] P0-2b 验证缓存命中（豆包返回 `cached_token`），记录 TTFT 变化
- 验收：43 个 L0/L1 + L2 benchmark 不破；manifest gate 通过；能力描述行为等价；缓存命中可观测

### 🟠 P1（结构性，benchmark 保护下灰度）
- [ ] P1-1 快/慢路径分流：recordSignal 规则拍板简单单事件 → 跳过 planner；抽取自带 needs_followup 升级
- [ ] P1-2 原生 tool use 迁移：能力卡片 → tool schema，记录走 function calling；灰度并行 + benchmark 对比
- 验收：简单记录 P50 延迟显著下降；tool use 路径与 effectDecisions 路径 benchmark 等价

### 🟡 P2（后续）
- [ ] 视频自适应关键帧（非每秒抽）
- [ ] 能力多了上 defer_loading / Tool Search
- [ ] 上下文摘要化

## 风险与安全网

- **benchmark 当安全网**：每步跑 43 个 L0/L1 + L2 核心场景，行为回归即停
- **P0 不碰 effectDecisions/EffectPolicy 链路**：只改"能力描述的数据源 + 注入方式 + 缓存位置"，最终输出形状不变
- **tool use 迁移（P1-2）渐进**：不一次性切换，灰度对比，现有链路保底
- **manifest 与代码一致性**：靠 P0-1c 的 gate 强制（enabled 能力 effectType 必须真实支持），防止 manifest 漂移成又一份过期文档

## Claude×Codex 交叉 review 共识（2026-06-05）

经与 Codex 两轮交叉 review，本 spec 与发布硬化 spec（`2026-06-05-release-readiness-improvement-design.md`）协调到**一条统一发布路线**。四点关键修正：

### 1. 反向可达校验 gate（Codex 补强，并入 R0.5）
原 gate（P0-1c）只验 `manifest ↔ benchmark ↔ effectType` 三向。Codex 指出这**不证明能力真实可达**——manifest 可能声明一个有 effectType、有 benchmark、但前端根本没入口的能力，AI 仍会承诺它。补：**`enabled=true` 且会写数据的能力，必须有真实的前端入口 + 后端 effect 落点 + 状态落点**，否则 gate 红。这把"AI 说能做但没实现"从提示层堵到**结构层**——能力矩阵成为 `manifest ↔ benchmark ↔ 真实端到端入口` 的三向活契约。

### 2. 快路径安全约束（与快路径绑定，不可分离）
P1-1 快路径若实现，**任何医疗/高风险/隐私语境信号一律强制走慢路径**，快路径只接明确低风险单事件记录。可后置的只是快慢路径的**性能优化**；安全约束必须与快路径同时上线，不能分离（否则会把模糊医疗语境当普通记录吞掉）。

### 3. tool use 上架前只 shadow
P1-2 原生 tool use 迁移在系统已稳定（43 L0/L1 + 124 后端测试）时，上架前**只做 shadow 对比、不切流量**，避免引入模型选 tool / schema 兼容 / 失败重试的新风险。

### 4. agent 优化在统一发布路线中的位置
| 发布阶段 | agent 相关项 |
|---|---|
| **R0.5 最小可内测** | 能力矩阵 grounding（P0-1 ✅）+ **反向校验 gate**（待实现）—— 属上架可信度硬化，不是"新功能" |
| R1 扩大灰度 | —（让位于短信/Pro/监控/真机）|
| R2 渠道灰度 | — |
| **R2 之后 / 技术债** | tool use 迁移、快慢路径分流、prompt caching、渐进披露 |

> **共识核心**：能力矩阵 grounding 是**上架信任硬化**的一部分（AI 承诺幻觉 = 上架风险），优先做；纯性能/架构优化（tool use / 快路径 / caching）推到灰度稳定之后。

## 验收标准（整体）

- 能力矩阵是单一事实源：改 manifest 即同步 agent 感知 + benchmark 覆盖
- agent 不再承诺 manifest 里 `enabled=false` 或不存在的能力（grounding 生效）
- prompt 稳定前缀可缓存，TTFT 下降可观测
- 全程不破坏 43 L0/L1 + L2 benchmark
