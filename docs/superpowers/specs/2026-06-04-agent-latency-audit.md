# Agent 回复耗时审计（立项）

- 创建日期：2026-06-04
- 状态：Phase 1 完成（用现有生产埋点定位），待决策 Phase 2/3
- 触发：用户反馈"AI 回复慢"；相册修复时发现"进相册不该等 AI"已解耦，但"AI 回复本身慢"是独立问题
- 方法：systematic-debugging（性能问题）—— 先用生产真实数据定位，不猜瓶颈

## 背景

聊天发消息走 `AgentRuntime.streamAgentResponse`，一个请求最多串联：
```
recordSignal抽取(本地) → planner(模型1) → context构建(DB) → expense/visual分析(模型2,豆包视觉)
→ executePlannedTools(可能联网) → final composer(模型3,流式) → 持久化
```
即 2-4 次模型调用 + 可能联网 + DB。现有埋点 `agent_run.started_at/completed_at` 只有**整体耗时**，无各步细粒度。

## Phase 1 发现（生产真实数据，强证据）

### 整体耗时 by input_type（生产 agent_run）

| input_type | 次数 | 平均 | 最大 |
|---|---|---|---|
| **text** | 8 | **78.9s** | **219.5s** |
| image | 14 | 35.7s | 93.3s |
| video | 3 | 13.0s | 18.0s |

### 两个颠覆性发现（排除法）

**发现 1：慢的不是视觉分析。**
- text（**无任何图片**）平均 79s、最大 220s，比 image（36s）还慢
- video（13s）比 image（36s）快——若视觉是瓶颈，video 不该最快（待确认 video 是否跳过全视觉分析）
- → 视觉串行分批**不是主瓶颈**（之前我和用户都误判为大头）

**发现 2：慢的不是联网工具。**
- 最慢的两条 text（219.5s / 205.1s）：`toolRequestCount = 0`（没联网）、`intent = record`（普通记录）、`contextNeeds = ["profile"]`（最简单上下文）
- → 排除联网/工具、排除复杂上下文

### 头号嫌疑：final composer（doubao-seed-2.0-pro）

所有慢请求的共同点：**`final_model = doubao-seed-2.0-pro`**（planner 用的是快的 deepseek-v4-flash）。

text（无图、无工具、简单上下文）仍能跑到 220s，唯一能解释的就是 **final composer 这一步本身慢**，可能因为：
1. **doubao-seed-2.0-pro 生成慢**（pro 档比 lite 慢）
2. **深度思考模式（thinkingEnabled）** 让模型思考很久
3. 生成回复过长

> ⚠️ 这是基于"整体耗时 + 排除法"的**强推断**，不是直接测量。要量化 final composer 占总耗时的比例，必须加细粒度埋点（见 Phase 2）。

## 现有埋点缺口

`agent_run` 只有整体 started/completed。要定位瓶颈占比，缺：
- `planner_ms`（planner 模型调用）
- `context_ms`（DB 上下文构建）
- `visual_ms`（视觉分析，分批合计）
- `tools_ms`（工具/联网）
- `final_ms`（final composer 模型调用）
- 以及 `thinking_enabled` 标志（验证深度思考是否元凶）

## Phase 2：细粒度埋点（建议先做）

在 `agent_run` 加一列 `timing_json TEXT`，在 `streamAgentResponse` 各步用 `System.nanoTime()` 计时，完成时写入：
```json
{"planner_ms":1200,"context_ms":300,"visual_ms":8000,"tools_ms":0,"final_ms":60000,"thinking":true,"final_chars":420}
```
- 侵入小：只在已有各步前后取时间戳 + 一个新列，不改业务逻辑
- 部署后跑 3-7 天，拿真实各步占比分布
- 验证头号嫌疑（final composer 是否占大头）

## Phase 3：优化候选（按嫌疑排序，待 Phase 2 数据确认）

| 候选 | 针对 | effort | 风险 | 备注 |
|---|---|---|---|---|
| **final 流式提前吐字** | 感知耗时 | S | 低 | 已是 stream，但首字延迟可能晚；让用户尽早看到"AI 在写"消除干等焦虑（符合低焦虑战略） |
| **深度思考默认关 / 可选** | final_ms | S | 中 | 若 thinking 是元凶，普通记录类请求关掉思考能大幅提速；保留用户可手动开 |
| **final 换更快模型档** | final_ms | M | 中 | 简单记录/描述用 doubao-lite，复杂问答才用 pro；需分流逻辑 |
| **planner + 视觉/context 并行** | 串行总时 | M | 中 | 现在是顺序串行，部分可并行 |
| **视觉分析有限并行** | image 场景 | M | 中 | 当初串行是"怕 provider 并发过载"，需重新评估（但已知非主瓶颈，优先级降低） |

## 两条推进路径（需你决策）

**路径 A：先埋点量化，再优化（严谨）**
- 做 Phase 2 埋点 → 部署 → 拿一周数据 → 用数据确认 final composer 占比 → 再定 Phase 3 优先级
- 优点：用数据说话，不误投
- 缺点：慢一周

**路径 B：基于现有强证据，先试低风险优化（务实）**
- 现有证据已强指向 final composer。先做最低风险的两个：① final 流式提前吐字（消除干等焦虑）② 普通记录类请求默认关深度思考
- 同时加埋点（顺手）
- 优点：用户一周内就能感知变快
- 缺点：万一不是 final composer，部分白做（但流式吐字无论如何都有价值）

**我的建议：B。** 流式提前吐字符合低焦虑战略且无论瓶颈在哪都有价值；深度思考关闭是基于强证据的高性价比试探；埋点顺手加上，下一轮用数据精修。

## 验收标准

- Phase 2：`agent_run.timing_json` 写入各步耗时，能查询出 final composer 占比
- Phase 3（若走 B）：普通 text 记录类请求 P50 耗时显著下降；用户感知"AI 很快开始回复"
- 不破坏现有 benchmark（26 tests）+ build/smoke

## 待确认的小问题

- video 为何快（13s）？是否跳过全视觉分析只取缩略图？（影响视觉优化价值判断）
- text 是否默认开了深度思考？（agent_run 当前未记 thinking 标志，埋点补上即可确认）
