# 跨域 AI 今日发现（Daily Summary v2）

- 创建日期：2026-05-26
- 状态：设计已确认，待写实施计划
- 关联：升级现有 `DailySummaryService` 从 deterministic 拼接 → 跨域 AI 关联挖掘
- 范围：仅 daily summary 升级；不含 IA 重做、月报、Pro 围墙

## 1. 背景与定位

### 1.1 上下文

小宝记当前是综合家庭育儿 App（聊天 / 记录 / 账本 / 相册 / 提醒 / 我的 6 个底部 Tab），但跨域价值没串起来 —— 账本、相册、careLog、提醒各自孤岛。本次目标是做一个**跨域 AI 杀手锏**，让"只在综合 App 才能做的事"显形，作为产品差异化的第一个证明点。

经过 brainstorming 评估的几条路径（月报先行 / 日报先行 / 闭环全做），选择**日报先行**：

- 数据飞轮上更合理（月报本质是日报的累加）
- 日活有抓手（每天能用到）
- 工程量小（现有 daily summary 骨架已齐）

### 1.2 核心定位句

> **「今日发现」—— AI 看了今天家里所有人记录的所有事，告诉你你可能没注意到的细节、关联和变化。**

**用户心里的那句话**：「原来还有这件事」（信息发现型，不是预警型、温馨叙事型或行动指引型）。

**核心场景**：上班族家长晚上回家了解白天 / 配偶之间同步 / 老人远程关注。默认主用户视角是**「非第一现场的家庭成员」**。

## 2. 产品形态

### 2.1 用户看到的样子（mock 示例）

```
今日发现 · 5 月 25 日

宝宝今天
喝奶 5 次共 580ml，睡了 14 小时（含两次 1.5h 午睡）。

你可能没注意到
· 下午 3 点你出门后，宝宝又哭了 25 分钟，妈妈用白噪音哄睡
· 今天买的飞鹤 1 段，是上月同款，单价贵了 ¥12（账本 #045）
· 妈妈发的这张照片里，他可能第一次扶着沙发站了 → [标记里程碑]

需要你看一眼
· 晚 8 点洗澡提醒还没标完成（你设的）
· 明天 9:30 社区医院疫苗（妈妈设的）

漏掉了吗
· 今天还没记便便和体温，需要补一下吗？
```

### 2.2 4 模块 schema

| 模块 | 数据源 | 生成方式 |
|---|---|---|
| 今日数据 | careLog | deterministic 拼接（保留现状） |
| **你可能没注意到** | careLog + 账本历史 + 相册 + 聊天 + 完成的提醒 | **AI 关联挖掘**（本次重点） |
| 需要你看一眼 | reminders（账号私有 + 家庭共享） | 规则筛选 |
| 漏掉了吗 | missingItems | 规则检测（保留现状） |

### 2.3 设计原则

1. **「发现」才是 AI 的重心**，其它三块尽量 deterministic，省 token、降误判
2. **不做主观建议**（不会说"应该减少奶量"），只做事实关联（"今天奶量比上周低 25%"是观察，"你应该…"不写）
3. **用真实角色名**（妈妈/爸爸/爷爷），不是冷冰冰的"另一位家长"
4. **可点击 finding → action**（"标记里程碑"、"去查看账本"）—— 把发现变成跨域跳转，强化综合 App 体感

## 3. 数据与生成策略

### 3.1 生成策略：单轮 + 结构化 JSON 输出

```
DailySummaryService.buildSummary()
   ↓
1. 收集结构化数据（已有 service）
2. 计算跨周聚合（新增，纯 SQL）
3. 调一次 DeepSeek V4 Pro → 直接输出 JSON Array of Findings
4. 失败时 fallback 到现有 deterministic 拼接（已有逻辑）
```

不做多轮（先抽 facts → rank → 写文本）—— 那种策略 token 翻倍但 quality 不显著好。

### 3.2 模型输出 schema

```json
{
  "findings": [
    {
      "type": "family_action_continuity",
      "text": "下午 3 点你出门后，宝宝又哭了 25 分钟，妈妈用白噪音哄睡",
      "related": {"careLogEventIds": ["evt-x"], "memberIds": ["member-mom"]},
      "action": null
    },
    {
      "type": "expense_price_compare",
      "text": "今天买的飞鹤 1 段，上月同款单价贵了 ¥12",
      "related": {"expenseIds": ["exp-045"], "comparedTo": ["exp-022"]},
      "action": {"label": "去账本", "target": "ledger:exp-045"}
    },
    {
      "type": "media_milestone_candidate",
      "text": "妈妈发的这张照片里，他可能第一次扶着沙发站了",
      "related": {"albumItemIds": ["alb-x"]},
      "action": {"label": "标记里程碑", "target": "milestone:first_stand"}
    }
  ]
}
```

前端按 `type` 渲染样式 + 按 `action` 渲染跳转按钮。模型只管文本和关联，视觉/交互逻辑全在前端可控。

### 3.3 数据输入范围（一次调用的 context）

| 输入块 | 内容 | token 估算 |
|---|---|---|
| profile | 月龄、喂养方式、家庭成员名+角色 | ~150 |
| today | 今日 careLog events、growthEvents、albumItems metadata、expenses、reminders 完成情况 | ~300-500 |
| 7-day aggregate | 过去 7 天 careLog 滑动均值（奶量、睡眠、夜醒次数） | ~200 |
| 账本对比 | 本月新增商品的"最近 3 个月同类价格" | ~200 |
| 长期记忆 | 当前 family 的 memory entries | ~200 |

**单次约 1100 输入 + 300 输出 tokens ≈ ¥0.01-0.02**。100 家庭 × 30 天 ≈ ¥60/月。1000 家庭 ≈ ¥600/月。验证阶段成本可控。

### 3.4 AI 要挖掘的 6 类 Finding（prompt 任务清单）

prompt 中明确告诉模型只能输出这 6 类，不允许自由发挥：

1. **family_action_continuity** —— 一个成员做了什么、另一个成员接力做了什么
2. **cross_domain_link** —— 账本 + careLog 关联（"今天买的奶粉今天就用了"）
3. **expense_price_compare** —— 账本同类商品的最近价格对比
4. **trend_anomaly** —— 7 天滑动均值的异常（奶量、睡眠、夜醒）；用语必须是观察，不下结论
5. **media_milestone_candidate** —— 相册照片可能对应里程碑（基于已有 album tag 推测，不调视觉）
6. **memory_recall** —— 长期记忆里的偏好/过敏被今天的事触发

某类没东西可说就跳过，宁缺勿滥。

### 3.5 视觉模型：不用

理由：
- albumItems 上传时已经过相册准入判断，已有 tags + category metadata
- 复用现有 metadata 即可
- 单独为日报再调一次视觉 = 双倍成本，价值边际很低

例外：「标记里程碑」这种用户主动 action 时，再单独调视觉模型做确认（不在本次范围）。

### 3.6 冷启动策略

| 场景 | 处理 |
|---|---|
| 新家庭第 1 天 | 不生成 AI 版，退化为现有 deterministic |
| 数据 < 3 条 | 同上 |
| 第 1 周（没有 7 天对比基线） | 生成 AI 版但跳过 `trend_anomaly` 类 |
| 账本商品没有历史对比 | 跳过 `expense_price_compare` 类 |

### 3.7 失败兜底

模型超时 / JSON 解析失败 / 模型不可用 → **直接走现有 deterministic 拼接**（findings 为空，其它字段不退化）。不向用户提示"AI 不可用"。

### 3.8 触发时机：保持现状

- 用户在「记录」Tab 点"生成今日小结"按钮 → 触发
- Pro trial 中的 21:30 推送提醒 → 点击进入 App → 用户主动点生成
- **不做后台自动生成**（省钱、避免无效调用）

推送文案改成"今天的发现已就绪"，调度逻辑不动。

## 4. 商业化策略（本次明确不做围墙）

### 4.1 决策：全员免费、不做 Pro 围墙

- 所有家庭直接看完整 AI 发现，不分 Free / Pro
- 不做"每周 1 次试吃"、不做内容遮罩、不做 upsell 弹层
- AI 成本由我们出（成本估算见 3.3）
- 验证阶段优先验证产品价值，商业化时机由产品方拍板

### 4.2 现有 Pro Trial 设施：保留代码 + 默认全通过

| 设施 | 处理 |
|---|---|
| `ProTrialService.isPro(familyId)` | 改为永远返回 true（保持方法签名不变，未来重启 Pro 时只改这一处） |
| Pro 申请 UI | 隐藏入口，代码保留 |
| `daily_summary` 表 | 保持 |
| `ai_usage_log` | 持续记录每次小结的 token / 模型 / 家庭分布 |
| 21:30 推送提醒 | 保留，改文案 |

未来要重新启用 Pro 时反向开关即可，不需要重写。

### 4.3 验证指标：暂不强制定义

不做指标 dashboard。商业化时机和验证标准由产品方主观判断。`ai_usage_log` 持续记录原始数据，未来需要时可回溯分析。

## 5. 工程改造范围

### 5.1 后端改造

**修改 `DailySummaryService.java`**（432 行 → 预计 +200 行）
- `buildSummary()` 拆成两段：
  - 先走 deterministic 拼接产出 facts/observations/missingItems（**完全保留现有代码**）
  - 再调 AI 模型产出 findings，追加到 DTO
- 失败兜底：AI 调用失败时 findings 为空，其它字段不受影响

**新增 `DailySummaryPrompts.java`**（仿照 `AgentPrompts.java`）
- 集中所有 prompt 文本和 6 类 finding type 的描述
- prompt 评审 / 调优独立进行

**修改 `DailySummaryDto.java`**
- 增加 `List<FindingDto> findings` 字段
- payload_json 向后兼容：老数据反序列化时 findings 默认空数组
- **不需要 DB migration**

**新增 `FindingDto`（DTO schema 明确定义）**

```java
public record FindingDto(
    String type,                    // 6 类枚举之一，见 3.4
    String text,                    // 中文展示文案
    FindingRelated related,         // 关联实体 id（用于校验和跳转）
    FindingAction action            // 可选，前端按钮；null 时不渲染按钮
) {}

public record FindingRelated(
    List<String> careLogEventIds,   // 任意一个为空数组即"不关联此类"
    List<String> growthEventIds,
    List<String> albumItemIds,
    List<String> expenseIds,
    List<String> reminderIds,
    List<String> memberIds,
    List<String> memoryIds,
    List<String> comparedTo         // 用于 expense_price_compare 的对照 id
) {}

public record FindingAction(
    String label,                   // 按钮文案，如"标记里程碑"
    String target                   // 格式 "<domain>:<id>"，domain ∈ {ledger, album, milestone, reminder}
) {}
```

`target` 解析规则在前端 `utils/dailySummary.ts` 集中维护，新增 domain 时只改 utils。

**新增跨周聚合方法（挂在现有 services 上）**
- `CareLogRecordService.getRecentDaysAggregate(familyId, days)` —— 参数化天数，便于后续扩展到月度
- `ExpenseItemRecordService.getRecentSimilarExpenses(familyId, productName, months)` —— fuzzy match 同类商品
- 纯 SQL 计算，不引入新依赖

**不动的后端代码**
- `ProTrialController` / `ProTrialService` —— 保留（Pro 设施）
- `AgentRuntime` / `SkillRouter` —— 日小结不走 agent 主链路（避免引入 stream / planner 复杂度）
- `AttachmentStorageService` / OSS —— 不动
- 认证、权限、家庭共享逻辑 —— 不动

### 5.2 前端改造

**新增 `frontend/src/views/DailySummaryView.tsx`**（仿照 `LedgerView` / `MilestonesView`）
- 4 个模块的渲染（今日数据 / 你可能没注意到 / 需要你看一眼 / 漏掉了吗）
- 6 类 finding 各自的 UI 样式 + action 跳转
- 失败兜底：findings 为空时该模块整块隐藏（不显示"AI 不可用"）

**新增 `frontend/src/utils/dailySummary.ts`**
- finding 渲染辅助：根据 `related.albumItemIds[0]` 找缩略图等
- action 路由：`milestone:first_stand` 跳转到 MilestonesView 并预填、`ledger:exp-045` 跳到账本明细等

**修改 `App.tsx`**
- 只在「记录」Tab 的今日页加 `<DailySummaryView />` 挂载点 + 透传 props
- 预计净增 30-50 行，不动其它结构
- **避免 App.tsx 继续涨**：所有 daily summary 业务逻辑都在 view + utils 文件里

**不动的前端代码**
- Tab 导航结构（IA 重做留待下一步）
- 聊天 / 账本 / 相册 / 提醒主路径 —— 不动
- AppStateDomain / AppStateApi —— 只是新增 DTO 字段，已有 normalize 代码自动适配

### 5.3 模型与成本

| 项 | 选择 |
|---|---|
| 模型 | DeepSeek V4 Pro（不需视觉、便宜、JSON 输出稳定） |
| 调用方式 | Standalone client，**不走 AgentRuntime stream**（小结是一次性请求） |
| Timeout | 30s 硬上限，超时直接走 fallback |
| 重试 | 不重试（小结非关键路径） |
| 计费记录 | 写 `ai_usage_log`，label = `daily_summary_ai`（区别于现有的 `daily_summary` deterministic 标签） |

## 6. 测试策略

| 层 | 测试内容 |
|---|---|
| 后端单测 | DailySummaryService 的拼接、跨周聚合 SQL、JSON 解析失败 fallback、6 类 finding 的 prompt 模板 |
| Agent benchmark | 新增至少 2 case：「信息发现型小结生成」+「模型失败时 fallback 到 deterministic」 |
| 前端 verify | `npm run verify:frontend` 加 daily summary 渲染样例（mock fixture 已支持） |
| 手工验证 | 用 1 个真实家庭 1 周数据手动跑一次，肉眼检查 6 类 finding 的 quality |

## 7. 已知风险与缓解

| 风险 | 缓解 |
|---|---|
| 模型编造事实（hallucinate） | prompt 强制要求"只能引用输入数据里出现的 ID / 数字 / 名字"；JSON 解析后校验 `related.ids` 是否真实存在，伪造的 finding 丢弃 |
| 模型输出 JSON 不规范 | 用 `objectMapper` 严格解析，失败即 fallback；输出 schema 越简单越好（嵌套 ≤ 2 层） |
| 隐私边界泄漏（账号私有数据进入家庭共享小结） | prompt 输入数据严格按家庭共享数据过滤（沿用现有 `familyMissingItems` vs `accountMissingItems` 分流） |
| AI finding 把 trend_anomaly 写成医学诊断 | prompt 明确禁词："应该 / 建议 / 可能是病 / 异常"等；违反即 finding 丢弃 |
| 跨域 action 跳转链路坏掉 | DailySummaryView 渲染时校验 target 是否能解析，解不出的 action 不渲染按钮 |

## 8. 本次明确不做的事

| 不做 | 理由 |
|---|---|
| IA 4-Tab 重做（今天/成长/日常/我） | 留给下一步，触发条件见 8.2 |
| 月报 / 周报 | v2 工作，daily 跑稳后再做（衔接路径见 9） |
| Pro 围墙 / Trial 限制 | 验证阶段全员免费 |
| 视觉模型调用 daily summary | 成本不值，复用 albumItem 现有 metadata |
| App.tsx 拆解（除 DailySummaryView 抽取） | 留给 IA 重做时一并做 |
| 推送通知文案 / 时间调整（除小结提醒文案） | 现有 21:30 提醒只改文案，不动调度逻辑 |
| 「快速记录」按钮 | IA 重做的一部分 |
| 跨家庭 / 多宝宝 | 现状只支持单宝宝、单家庭，本次不变 |

### 8.1 月报 v2 衔接路径（不本次做，但约束本次写法）

- **数据 schema 复用**：月报 = 30 天 daily findings 聚合 + 跨周/月对比，当前 DailySummaryDto.findings[] 是 v2 输入
- **跨周聚合复用**：`getRecentDaysAggregate(days)` 传 30 / 90 就是月度 / 季度，方法不需要重写
- **prompt 复用**：6 类 finding 在月报里变成"本月 top picks"，prompt 模板 70% 复用
- **UI 复用**：finding 渲染组件原样用，月报只是外层 wrapper 不同

落实到本次工作：**所有代码按"能扩展到月度"的方式写**（参数化天数、聚合函数泛化），不写死 day=1。

### 8.2 IA 重做的触发条件（预先约定）

出现以下任一信号 → 启动 IA 4-Tab 重做项目：

- 本次 daily summary 上线后，用户反馈"找不到在哪里看"（IA 摩擦显性化）
- 计划再加 2 个以上新功能（疫苗本 / AI 问答 / 辅食 / ...），现有 6 Tab 装不下
- App.tsx 因为新功能涨到 10000+ 行

不满足以上信号前，保持现有 6 Tab。

## 9. 落地时间预估

1 人 + Claude 协作：

| 阶段 | 内容 | 天数 |
|---|---|---|
| 后端 | DTO + service 拆分 + prompts + 跨周聚合 + 单测 | 3-4 天 |
| 前端 | DailySummaryView + 6 类 finding 渲染 + utils + verify | 3-4 天 |
| 集成 | Agent benchmark 新 case + 手工 1 家庭 1 周验证 + OTA 发布 | 2 天 |
| **合计** | | **8-10 天** |

不含真机回归（不动原生，OTA 即可）。

## 10. 验收标准

实现完成的判断标准：

- [ ] DailySummaryDto.findings 字段后端返回正确，前端 4 模块渲染对齐 mock 示例
- [ ] 6 类 finding 各有 ≥ 1 个真实样例通过手工验证
- [ ] 模型失败 / 数据稀疏时 fallback 到 deterministic，用户看到完整小结（无 findings 块）
- [ ] `npm run verify:frontend` 全量通过
- [ ] `npm run test:agent-benchmark` 包含新 2 case 全部通过
- [ ] 后端 mvn test 全量通过
- [ ] OTA 发布到 Aliyun，cloud `/api/health` ok
- [ ] 真实家庭 1 周数据生成的 daily summary 中，hallucinate / 隐私越界 / 医学诊断 finding 数量 = 0
