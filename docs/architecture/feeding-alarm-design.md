# 喂奶闹钟设计（Feeding Alarm Design）

- 日期：2026-06-15
- 状态：设计已确认，待写实现计划
- 范围：在**已存在**的「间隔提醒（锚定喂奶）+ 原生响铃」引擎之上，补一层产品化 UI——倒计时卡片 + 「已喂」一键，把一个原本藏在通用提醒里的能力变成一眼可见、一键可用的「喂奶闹钟」。
- 发布载体：**纯前端，走 OTA**（复用现有原生响铃引擎，不动原生包）。

## 1. 目标与非目标

**目标（v1）**：
1. **倒计时卡片**：常驻「距上次喂奶 X · 距下次还有 Y」；到点高亮「该喂奶啦 · 已超 N 分」；没设置过时显示「设置喂奶提醒」。
2. **「已喂」一键**：点一下弹快速奶量（`90 / 120 / 150 / 180 ml` + `亲喂·不记量` + `其他…`），落一条喝奶记录（时间=现在）→ 触发现有重锚 → 下次自动顺延。
3. **显眼入口**：卡片挂在记录/喂养页顶部 + 首页一个入口（不新增底部 tab）。
4. **复用引擎**：底层仍是 interval-milk 提醒 + 原生响铃，倒计时卡片与响铃是同一条提醒的「两张脸」，**单一数据源**。

**非目标（v1 不做，留 v2）**：锁屏/桌面小组件；白天/夜间双间隔 + 夜间免打扰；按历史喂养节奏「预测」下次（非固定间隔）；左/右乳追踪。

**调研结论（为什么这么做）**：见下方「附：竞品对比」。一句话——固定间隔锚定上次喂奶的引擎我们已经偏强，且响铃叫醒是友商普遍缺的差异点；真正缺的是友商都主打的「距上次/距下次倒计时 + 一键已喂」这层被动感知 UI。

## 2. 现状（已具备，不要重做）

引擎层基本完整，证据：

| 能力 | 位置 |
|---|---|
| 间隔提醒 + 锚定喂奶事件（`anchorType:"careEvent", careEventType:"milk"`） | `frontend/src/types.ts` `ReminderRepeatRule`；`appStateDomain.ts` `isIntervalMilkReminder`（:555） |
| 下次时间计算（最近一次喝奶 + 间隔，过期则顺推） | `App.tsx` `prepareIntervalReminder`（:1245）、`nextIntervalDueAt` |
| **记一次喝奶后自动重锚 + 重排原生闹钟** | `App.tsx` `useEffect`（:3976，监听 `latestMilkAnchor`） |
| 原生全屏响铃 | `android/.../AlarmReminderPlugin.java / AlarmReceiver.java / AlarmRingingActivity.java`；`frontend/src/nativeAlarm.ts` |
| 提醒页可配「循环间隔 + 响铃音」 | `frontend/src/screens/RemindersScreen.tsx`（:281+）、`reminderDraft.ts` |
| 喂奶记录数据（喝奶事件 + 可选奶量） | `types.ts` `CareLogEvent`（type `"milk"`, 可选 `amountMl`，:176） |

**缺口**：无倒计时卡片、无「已喂」一键、入口埋在通用提醒里（发现性差）。

## 3. 架构

只加 UI + 一个派生计算纯函数，**不新增数据结构、不动原生**。

```
记录/喂养页顶部 ┐
首页入口        ┴─→ <FeedingAlarmCard/>  (memo, 派生值屏内算防 memo 击穿)
                        │ 读
                        ├─ 当前「喂奶闹钟」= 最近 dueAt 的 isIntervalMilkReminder 提醒
                        └─ latestMilkAnchor(careLogs, "milk")
                        │ 派生（纯函数 feedingAlarmView.ts）
                        │   距上次 = now - lastMilk.occurredAt
                        │   距下次 = reminder.dueAt - now（overdue if <0）
                        │ 写（点「已喂」）
                        └─→ 快速奶量 sheet → addCareLogEvent("milk", now, amount?)
                                 └─→ 触发现有 useEffect 重锚（App.tsx:3976）→ 提醒 dueAt 顺延 → 卡片刷新
```

**新增文件**：
- `frontend/src/feedingAlarmView.ts`（纯模块）：`computeFeedingAlarmView({ reminder, lastMilkAt, now }) → { hasAlarm, sinceLastMs, untilNextMs, overdue, intervalMinutes }`。无 React / 无资源 import（守纯模块红线，可进 node 单测）。
- `frontend/src/components/FeedingAlarmCard.tsx`（memo 组件）：渲染卡片三态（日常 / 到点 / 未设置）+ 触发「已喂」sheet。函数 props 经 ref 稳定（照 AlbumScreen 套路）。
- 「已喂」快速奶量：用现有 `appDialogs` 风格的 antd-mobile sheet/Dialog（chips + 其他…输入）。

**约定（消除歧义）**：
- 一个家庭**只展示一张**喂奶闹钟卡片，绑定「**最近 dueAt 的那条** interval-milk 提醒」。允许存在多条 interval-milk 提醒（通用提醒里），但卡片只反映最近到期的一条；「设置喂奶提醒」创建的是这条 canonical 的。
- 「亲喂·不记量」= 落一条 `amountMl` 为空的 milk 事件（合法，仅计次不计量；重锚照常按 `occurredAt`）。

## 4. 交互流程

1. **日常**：卡片每分钟刷新倒计时（轻量 `setInterval` 或基于 `dueAt` 的派生）。
2. **到点**：`now > dueAt` → 卡片切到珊瑚高亮「该喂奶啦 · 已超 N 分」；原生响铃由现有引擎在 `dueAt` 触发（夜间叫醒）。
3. **已喂**：点按 → sheet 弹奶量 → 选一个 → `addCareLogEvent` → 现有重锚 → `dueAt = 本次 + 间隔`，卡片回到日常态。
4. **未设置**：卡片显示「设置喂奶提醒」→ 简化创建（只问**间隔** + **到点是否响铃**两项，避免进通用提醒全表单）→ 建一条 `scheduleMode:"interval", repeatRule{fixedInterval, anchorType:"careEvent", careEventType:"milk"}, alertMode:"ringing"|"notification"` 的提醒。

## 5. 错误处理 / 降级

- **从没记过奶**：现有逻辑锚到 `now`（`prepareIntervalReminder` 已处理），卡片显示「距下次 = 整个间隔」。
- **原生闹钟不可用**（Web / 未授权 / iOS 未装）：卡片照常显示倒计时（纯 UI 不依赖原生）；响铃降级为 in-app 提醒（现有 `notificationStatus` 已覆盖）。
- **多 caregiver 并发记奶**：以最新 `latestMilkAnchor` 为准重锚（现有逻辑），卡片最终一致。

## 6. 测试

- `feedingAlarmView.ts` 纯函数：node 单测（日常/到点/未设置/无喝奶记录 四态边界）。
- 「已喂 → 记奶 → 重锚 → 卡片刷新」：DOM smoke（复用现有 reminder/careLog mock）。
- 沿用现有 reminder/careLog 既有测试不回归。

## 7. 范围 / 风险 / 待办

- **发布**：纯前端，OTA 即可；不换原生包。
- **风险**：卡片与通用提醒页对「同一条提醒」的展示一致性——靠单一数据源（都读同一 `reminders` 状态）保证，卡片只是视图。
- **内容**：无需新素材。

## 附：竞品对比（2026-06-15 调研）

| 维度 | 友商普遍（Huckleberry / Baby Feed Timer / Feeding Timer / FeedReminder / 国内记录类） | 我们 |
|---|---|---|
| 距上次/距下次倒计时 | ★核心，常驻卡片 + 锁屏/桌面小组件 | v1 补卡片（小组件留 v2） |
| 锚定上次喂奶 + 记一次自动重锚 | 有 | ✓ 已有 |
| 自定义间隔 | 有 | ✓ 已有 |
| 提醒形式 | 多为温和通知 | 全屏响铃（差异点，夜间叫醒/泵奶友好） |
| 一键「已喂」重置 | 有 | v1 补（快速奶量） |
| 白天夜间双间隔 / 历史预测 | 部分有 | 留 v2 |
