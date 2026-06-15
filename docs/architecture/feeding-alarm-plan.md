# 喂奶闹钟 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在记录页顶部加一张「喂奶闹钟」卡片(距上次/距下次倒计时、到点高亮)+「已喂」快速奶量一键,复用已存在的 interval-milk 提醒引擎与原生响铃。

**Architecture:** 纯前端,复用现状。新增一个纯函数派生模块(`feedingAlarmView.ts`)+ 一个 memo 卡片组件(`FeedingAlarmCard.tsx`);在 `App.tsx` 里算出"最近到期的喂奶提醒"喂给卡片,「已喂」落一条 milk careLog 事件 → 触发现有重锚(`App.tsx` 的 `latestMilkAnchor` useEffect)自动顺延下次。卡片每 30s 本地 tick 重算倒计时(派生值屏内算,不触发 App 重渲染)。

**Tech Stack:** React + TypeScript,lucide-react 图标,esbuild(纯模块 node 单测),Playwright + vite preview(DOM smoke)。无新依赖、不动原生 → 走 OTA。

**设计稿:** `docs/architecture/feeding-alarm-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `frontend/src/feedingAlarmView.ts` | 纯函数:由 dueAt/间隔/上次喂奶/now 算出 {距上次,距下次,是否到点};时长格式化 | 新建 |
| `frontend/src/components/FeedingAlarmCard.tsx` | memo 卡片:三态(日常/到点/未设置)+「已喂」快速奶量 sheet | 新建 |
| `frontend/src/styles/mobile-app.css` | 卡片样式(暖色,视觉后续 codex 打磨) | 追加 |
| `frontend/src/App.tsx` | `recordQuickMilk` / `pickOtherMilkAmount` / `createMilkReminderShortcut` 处理器;`feedingAlarm` useMemo;ref 稳定 handlers;在记录页顶部挂卡 | 修改 |
| `scripts/test-feeding-alarm-view.mjs` | 纯函数 node 单测 | 新建 |
| `scripts/test-feeding-alarm.mjs` | DOM smoke(卡片倒计时 + 已喂记奶 + 未设置创建) | 新建 |
| `package.json` | 注册两个测试脚本并挂进 `verify:frontend` | 修改 |

**约定**(消除歧义,来自设计稿):一个家庭只展示一张卡片,绑定「**最近 dueAt 的** `isIntervalMilkReminder` 提醒」;「亲喂·不记量」= 落一条 `amountMl` 为空的 milk 事件。无独立首页 → 卡片挂记录页(默认 tab)顶部即覆盖"首页/记录区入口"。

---

## Task 1: 纯函数派生模块 `feedingAlarmView.ts`(TDD)

**Files:**
- Create: `frontend/src/feedingAlarmView.ts`
- Test: `scripts/test-feeding-alarm-view.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-feeding-alarm-view.mjs`

```javascript
#!/usr/bin/env node
// 喂奶闹钟派生纯函数单测(esbuild 打包后在 node 跑,守纯模块红线)。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-feeding-alarm-"));
const bundlePath = path.join(tempDir, "feedingAlarmView.mjs");
try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/feedingAlarmView.ts")],
    bundle: true, platform: "node", format: "esm", outfile: bundlePath, logLevel: "silent",
  });
  const m = await import(pathToFileURL(bundlePath).href);
  assert.equal(typeof m.computeFeedingAlarmView, "function", "应导出 computeFeedingAlarmView");
  assert.equal(typeof m.formatDurationCompact, "function", "应导出 formatDurationCompact");

  const now = 1_000_000_000_000;
  const daily = m.computeFeedingAlarmView({ dueAtMs: now + 100 * 60000, intervalMinutes: 180, lastMilkAtMs: now - 80 * 60000, nowMs: now });
  assert.equal(daily.hasAlarm, true);
  assert.equal(daily.overdue, false);
  assert.equal(daily.untilNextMs, 100 * 60000);
  assert.equal(daily.sinceLastMs, 80 * 60000);

  const due = m.computeFeedingAlarmView({ dueAtMs: now - 15 * 60000, intervalMinutes: 180, lastMilkAtMs: now - 195 * 60000, nowMs: now });
  assert.equal(due.overdue, true, "dueAt 已过应 overdue");
  assert.ok(due.untilNextMs < 0, "过点 untilNextMs 应为负");

  const none = m.computeFeedingAlarmView({ dueAtMs: null, intervalMinutes: null, lastMilkAtMs: now - 60 * 60000, nowMs: now });
  assert.equal(none.hasAlarm, false, "无闹钟 hasAlarm=false");
  assert.equal(none.untilNextMs, null);

  const noMilk = m.computeFeedingAlarmView({ dueAtMs: now + 60 * 60000, intervalMinutes: 180, lastMilkAtMs: null, nowMs: now });
  assert.equal(noMilk.sinceLastMs, null, "无喝奶记录 sinceLastMs=null");

  assert.equal(m.formatDurationCompact(80 * 60000), "1小时20分");
  assert.equal(m.formatDurationCompact(45 * 60000), "45分");
  assert.equal(m.formatDurationCompact(120 * 60000), "2小时");
  assert.equal(m.formatDurationCompact(30 * 1000), "刚刚");

  console.log("feeding alarm view tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-feeding-alarm-view.mjs`
Expected: FAIL(esbuild 找不到 `frontend/src/feedingAlarmView.ts`,报 build error / Could not resolve)。

- [ ] **Step 3: 写最小实现** `frontend/src/feedingAlarmView.ts`

```typescript
// 喂奶闹钟卡片的派生计算(纯函数,无 React / 无资源 import,可进 node 单测)。
// 卡片每 30s 用最新 now 调一次,算出"距上次 / 距下次 / 是否到点"。

export type FeedingAlarmView = {
  hasAlarm: boolean;
  intervalMinutes: number | null;
  sinceLastMs: number | null; // 距上次喂奶(无记录则 null)
  untilNextMs: number | null; // 距下次提醒(到点为 0,过点为负;无闹钟为 null)
  overdue: boolean;
};

export function computeFeedingAlarmView(input: {
  dueAtMs: number | null;
  intervalMinutes: number | null;
  lastMilkAtMs: number | null;
  nowMs: number;
}): FeedingAlarmView {
  const { dueAtMs, intervalMinutes, lastMilkAtMs, nowMs } = input;
  const hasAlarm = dueAtMs != null && intervalMinutes != null;
  const sinceLastMs = lastMilkAtMs != null ? Math.max(0, nowMs - lastMilkAtMs) : null;
  const untilNextMs = hasAlarm && dueAtMs != null ? dueAtMs - nowMs : null;
  const overdue = untilNextMs != null && untilNextMs <= 0;
  return { hasAlarm, intervalMinutes: hasAlarm ? intervalMinutes : null, sinceLastMs, untilNextMs, overdue };
}

// 毫秒 → "1小时20分" / "45分" / "2小时" / "刚刚"。
export function formatDurationCompact(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 1) return "刚刚";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}分`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-feeding-alarm-view.mjs`
Expected: PASS,打印 `feeding alarm view tests passed`。

- [ ] **Step 5: 注册到 package.json**

在 `package.json` 的 `"scripts"` 加一行(放在其它 `test:*` 旁):
```json
"test:feeding-alarm-view": "node scripts/test-feeding-alarm-view.mjs",
```
并把它接进 `verify:frontend`(在该串命令末尾追加 ` && npm run test:feeding-alarm-view`)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/feedingAlarmView.ts scripts/test-feeding-alarm-view.mjs package.json
git commit -m "feat(feeding-alarm): 派生纯函数 computeFeedingAlarmView + formatDurationCompact(含单测)"
```

---

## Task 2: 卡片组件 `FeedingAlarmCard.tsx` + 样式

**Files:**
- Create: `frontend/src/components/FeedingAlarmCard.tsx`
- Modify: `frontend/src/styles/mobile-app.css`(追加)

- [ ] **Step 1: 写组件** `frontend/src/components/FeedingAlarmCard.tsx`

```tsx
// 喂奶闹钟卡片(从记录页顶部挂载)。memo:函数 props 由 App 经 ref 稳定。
// 派生值屏内算(每 30s tick),不向上触发 App 重渲染。视觉后续由 codex 出图打磨(#37)。
import { memo, useEffect, useState } from "react";
import { BellRing, Clock3 } from "lucide-react";
import { computeFeedingAlarmView, formatDurationCompact } from "../feedingAlarmView";

const QUICK_AMOUNTS = [90, 120, 150, 180];

export type FeedingAlarmCardProps = {
  canCaregive: boolean;
  dueAtMs: number | null;
  intervalMinutes: number | null;
  lastMilkAtMs: number | null;
  onFed: (amountMl: number | null) => void; // null = 亲喂不记量
  onPickOther: () => void; // 自定义奶量(App 侧 appPrompt)
  onSetup: () => void;
};

export const FeedingAlarmCard = memo(function FeedingAlarmCard({
  canCaregive, dueAtMs, intervalMinutes, lastMilkAtMs, onFed, onPickOther, onSetup,
}: FeedingAlarmCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const view = computeFeedingAlarmView({ dueAtMs, intervalMinutes, lastMilkAtMs, nowMs });

  if (!view.hasAlarm) {
    return (
      <section className="feeding-alarm-card is-empty" aria-label="喂奶闹钟">
        <span className="fa-orb" aria-hidden="true"><Clock3 size={20} /></span>
        <div className="fa-body">
          <p className="fa-label">喂奶闹钟</p>
          <p className="fa-sub">设置喂奶间隔,到点提醒、卡片倒计时</p>
        </div>
        {canCaregive ? <button type="button" className="fa-setup" onClick={onSetup}>设置</button> : null}
      </section>
    );
  }

  const overdue = view.overdue;
  const untilText = view.untilNextMs != null ? formatDurationCompact(Math.abs(view.untilNextMs)) : "";
  const sinceText = view.sinceLastMs != null ? `距上次 ${formatDurationCompact(view.sinceLastMs)}` : "还没有喂奶记录";
  const intervalText = view.intervalMinutes ? `每 ${formatDurationCompact(view.intervalMinutes * 60000)}` : "";
  const pick = (amount: number | null) => { setSheetOpen(false); onFed(amount); };

  return (
    <section className={`feeding-alarm-card${overdue ? " is-due" : ""}`} aria-label="喂奶闹钟">
      <span className="fa-orb" aria-hidden="true">{overdue ? <BellRing size={20} /> : <Clock3 size={20} />}</span>
      <div className="fa-body">
        <p className="fa-label">{overdue ? "该喂奶啦" : "下次喂奶"}</p>
        <p className="fa-count">{overdue ? `已超 ${untilText}` : `还有 ${untilText}`}</p>
        <p className="fa-sub">{sinceText}{intervalText ? ` · ${intervalText}` : ""}</p>
      </div>
      {canCaregive ? <button type="button" className="fa-fed" onClick={() => setSheetOpen(true)}>已喂</button> : null}

      {sheetOpen ? (
        <div className="fa-sheet-scrim" onClick={() => setSheetOpen(false)}>
          <div className="fa-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="记一次喂奶">
            <p className="fa-sheet-title">记一次喂奶 · 现在</p>
            <div className="fa-chips">
              {QUICK_AMOUNTS.map((amt) => (
                <button type="button" className="fa-chip" key={amt} onClick={() => pick(amt)}>{amt} ml</button>
              ))}
              <button type="button" className="fa-chip alt" onClick={() => pick(null)}>亲喂 · 不记量</button>
              <button type="button" className="fa-chip more" onClick={() => { setSheetOpen(false); onPickOther(); }}>其他…</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
});
```

- [ ] **Step 2: 追加样式** 到 `frontend/src/styles/mobile-app.css` 末尾

```css
/* 喂奶闹钟卡片(记录页顶部)。暖色,视觉后续由 codex 出图打磨。 */
.feeding-alarm-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 0 0 12px;
  padding: 14px 16px;
  border: 1px solid rgba(190, 225, 211, 0.9);
  border-radius: 16px;
  background: #fffdf8;
}
.feeding-alarm-card.is-due { border-color: rgba(236, 143, 125, 0.7); background: #fff6ef; }
.feeding-alarm-card .fa-orb {
  flex: none; display: grid; place-items: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(77, 125, 96, 0.12); color: #4d7d60;
}
.feeding-alarm-card.is-due .fa-orb { background: rgba(236, 143, 125, 0.16); color: #d9543c; }
.feeding-alarm-card .fa-body { flex: 1; min-width: 0; }
.feeding-alarm-card .fa-label { margin: 0; font-size: 12px; color: var(--muted, #7d8585); }
.feeding-alarm-card.is-due .fa-label { color: #d9543c; }
.feeding-alarm-card .fa-count { margin: 1px 0 2px; font-size: 19px; font-weight: 600; color: var(--ink, #2d3137); }
.feeding-alarm-card.is-due .fa-count { color: #d9543c; }
.feeding-alarm-card .fa-sub { margin: 0; font-size: 12px; color: var(--muted, #7d8585); }
.feeding-alarm-card .fa-fed,
.feeding-alarm-card .fa-setup {
  flex: none; border: 0; border-radius: 12px;
  padding: 10px 16px; font-size: 14px; font-weight: 600;
  background: #4d7d60; color: #fff;
}
.feeding-alarm-card.is-due .fa-fed { background: #e2624b; }
.feeding-alarm-card .fa-setup { background: transparent; border: 1px solid rgba(120, 95, 60, 0.2); color: #6b6354; }
/* 已喂快速奶量 sheet */
.fa-sheet-scrim {
  position: fixed; inset: 0; z-index: 1200;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(28, 24, 18, 0.32);
}
.fa-sheet {
  width: 100%; max-width: 460px;
  margin: 0 8px calc(env(safe-area-inset-bottom) + 12px);
  padding: 16px; border-radius: 18px; background: #fff;
  box-shadow: 0 16px 40px rgba(57, 45, 31, 0.22);
}
.fa-sheet-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--ink, #2d3137); }
.fa-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.fa-chip {
  border: 1px solid rgba(190, 225, 211, 0.9); border-radius: 999px;
  padding: 9px 15px; font-size: 14px; color: var(--ink, #2d3137); background: #fffdf9;
}
.fa-chip.alt { color: #4d7d60; border-color: rgba(77, 125, 96, 0.35); background: rgba(77, 125, 96, 0.08); }
.fa-chip.more { color: var(--muted, #7d8585); }
```

- [ ] **Step 3: 构建确认无类型错误**

Run: `npm run build`
Expected: `✓ built`,无 `error TS`(组件未挂载也应能编译;若报 `FeedingAlarmCard` 未使用属正常,下一 Task 挂载)。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/FeedingAlarmCard.tsx frontend/src/styles/mobile-app.css
git commit -m "feat(feeding-alarm): FeedingAlarmCard 组件(三态 + 已喂快速奶量 sheet)+ 样式"
```

---

## Task 3: 接入 `App.tsx`(处理器 + 选闹钟 + 挂卡)

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: import 组件**

在 `App.tsx` 顶部 import 区(与其它 `./components/*` 同处)加:
```typescript
import { FeedingAlarmCard } from "./components/FeedingAlarmCard";
```
确认 `isIntervalMilkReminder` 已在 App.tsx import(应已存在,见 `App.tsx:193`);若无则从 `./appStateDomain` 补 import。

- [ ] **Step 2: 加处理器 + useMemo**(放在其它 careLog/reminder 处理器附近,如 `saveManualCareEvent`(:5846)之后)

```typescript
// 「已喂」一键:落一条 milk careLog 事件(今天·现在),触发现有 latestMilkAnchor useEffect 重锚下次闹钟。
const recordQuickMilk = (amountMl: number | null) => {
  if (!canCaregive) return;
  const baseLog =
    careLogs.find((log) => log.date === todayDate) ??
    normalizeCareLog({ id: makeId("care"), date: todayDate, solids: [], notes: [], events: [] }, 0);
  const nextEvent = normalizeCareLogEvent(
    {
      id: makeId("care-event"),
      type: "milk",
      date: todayDate,
      time: currentClockText(),
      title: canonicalCareEventTitle("milk"),
      amountMl: amountMl ?? undefined,
    },
    (baseLog.events ?? []).length,
    todayDate,
  );
  const nextLog = careLogWithEventStats({ ...baseLog, events: [...(baseLog.events ?? []), nextEvent] });
  setCareLogs((current) => {
    const has = current.some((item) => item.id === nextLog.id);
    return has ? current.map((item) => (item.id === nextLog.id ? nextLog : item)) : [...current, nextLog];
  });
  void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() =>
    setStorageStatus("offline"),
  );
  hapticSuccess();
};

// 「其他…」自定义奶量(复用 appPrompt)。
const pickOtherMilkAmount = async () => {
  const text = await appPrompt({ title: "奶量(ml)", placeholder: "例如 130" });
  if (text == null) return;
  const amount = Number(text.trim());
  recordQuickMilk(Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null);
};

// 「设置喂奶提醒」:一键建一条默认 3 小时、响铃、锚定喝奶的循环提醒(间隔后续可在提醒页调)。
const createMilkReminderShortcut = async () => {
  if (!canCaregive) return;
  const draft = createReminderDraft(new Date());
  draft.title = "喂奶提醒"; // reminderFromDraft 内 /奶|喂奶|喝奶|吃奶/ 命中 → anchorType:careEvent, careEventType:milk
  draft.category = "care";
  draft.scheduleMode = "interval";
  draft.alertMode = "ringing";
  draft.intervalMinutes = "180";
  const baseReminder = reminderFromDraft(draft);
  const [scheduled] = await scheduleNativeReminders([baseReminder], { careLogs });
  const nextReminder = scheduled ?? baseReminder;
  setReminders((current) => {
    const byId = new Map(current.map((item) => [item.id, item]));
    byId.set(nextReminder.id, nextReminder);
    return Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
  });
  void persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() =>
    setStorageStatus("offline"),
  );
  hapticSuccess();
};

// 选「最近 dueAt 的喂奶提醒」喂给卡片(纯原语,组件不碰 Reminder 类型)。
const feedingAlarm = useMemo(() => {
  const milk = reminders
    .filter(isIntervalMilkReminder)
    .sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity))[0];
  if (!milk) return { dueAtMs: null as number | null, intervalMinutes: null as number | null };
  return {
    dueAtMs: milk.dueAt ? Date.parse(milk.dueAt) : null,
    intervalMinutes: milk.repeatRule?.intervalMinutes ?? null,
  };
}, [reminders]);
```

- [ ] **Step 3: ref 稳定 handlers**(照 `albumScreenHandlers` 套路;放在 `recordQuickMilk` 等声明**之后**,避免 TDZ)

```typescript
const feedingAlarmActionsRef = useRef({ recordQuickMilk, pickOtherMilkAmount, createMilkReminderShortcut });
feedingAlarmActionsRef.current = { recordQuickMilk, pickOtherMilkAmount, createMilkReminderShortcut };
const [feedingAlarmHandlers] = useState(() => ({
  onFed: (amountMl: number | null) => feedingAlarmActionsRef.current.recordQuickMilk(amountMl),
  onPickOther: () => { void feedingAlarmActionsRef.current.pickOtherMilkAmount(); },
  onSetup: () => { void feedingAlarmActionsRef.current.createMilkReminderShortcut(); },
}));
```

- [ ] **Step 4: 挂卡到记录页顶部**

在 `App.tsx` 里找到记录页时间线块的起点(grep `{recordView === "today" || recordView === "calendar" ? (`,约 `:8297`),在它**正前方**(仍在 `records-screen` section 内)插入:
```tsx
<FeedingAlarmCard
  canCaregive={canCaregive}
  dueAtMs={feedingAlarm.dueAtMs}
  intervalMinutes={feedingAlarm.intervalMinutes}
  lastMilkAtMs={latestMilkAnchor ? latestMilkAnchor.occurredAt.getTime() : null}
  onFed={feedingAlarmHandlers.onFed}
  onPickOther={feedingAlarmHandlers.onPickOther}
  onSetup={feedingAlarmHandlers.onSetup}
/>
```

- [ ] **Step 5: 构建**

Run: `npm run build`
Expected: `✓ built`,无 `error TS`。若报某辅助函数(`canonicalCareEventTitle` / `currentClockText` / `createReminderDraft` / `reminderFromDraft` / `scheduleNativeReminders` / `normalizeCareLog` / `normalizeCareLogEvent` / `careLogWithEventStats` / `reminderDate`)未定义,它们均已存在于 App.tsx;确认拼写与作用域(都在组件函数体内可见)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/App.tsx
git commit -m "feat(feeding-alarm): 接入 App——已喂记奶/其他奶量/一键设置 + 选最近喂奶提醒 + 记录页顶部挂卡"
```

---

## Task 4: DOM smoke(卡片倒计时 + 已喂记奶 + 未设置创建)

**Files:**
- Create: `scripts/test-feeding-alarm.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写测试** `scripts/test-feeding-alarm.mjs`(照 `scripts/test-core-flows.mjs` 的 vite preview + route mock 套路)

```javascript
#!/usr/bin/env node
// 喂奶闹钟 DOM smoke:记录页顶部卡片倒计时;点「已喂」→选 150 → 落 milk careLog;未设置→设置→建提醒。
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.FEEDING_ALARM_PORT || 4331);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const hhmm = (ms) => new Date(ms).toTimeString().slice(0, 5);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

// 已设喂奶闹钟 + 一条 100 分钟前的喝奶 → 卡片应显示倒计时(间隔 180 → 还有 ~80 分)。
const milkAt = now - 100 * 60000;
const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [],
  careLogs: [{
    id: "care-today", date: ymd(now), solids: [], notes: [],
    events: [{ id: "ev-milk-1", type: "milk", date: ymd(milkAt), time: hhmm(milkAt), title: "喝奶", amountMl: 150 }],
  }],
  reminders: [{
    id: "rem-milk", title: "喂奶提醒", reminderKind: "alarm", scheduleMode: "interval", alertMode: "ringing",
    dueText: "每 3 小时 喂奶提醒", dueAt: iso(milkAt + 180 * 60000), category: "care",
    repeatRule: { mode: "fixedInterval", intervalMinutes: 180, anchorType: "careEvent", careEventType: "milk" },
    soundId: "soft_chime", status: "open", createdAt: iso(now - 86400000), history: [],
  }],
  memories: [], pendingEffects: [], expenses: [], albumItems: [],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};
const liveState = JSON.parse(JSON.stringify(appState));
const upserts = [];

function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"],
    { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}
async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready: ${url}`);
}
async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "feeding-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" }, family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true }, authenticated: true, onboardingRequired: false }) });
    if (url.pathname === "/api/app/state") return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: liveState }) });
    if (url.pathname === "/api/pro/usage") return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, byFeature: [], byModel: [] }) });
    if (url.pathname === "/api/auth/family/members") return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    const upsertMatch = url.pathname.match(/^\/api\/app\/state\/([a-zA-Z]+)\/([^/]+)$/);
    if (upsertMatch && request.method() === "PUT") {
      const [, collection, id] = upsertMatch;
      const body = JSON.parse(request.postData() || "{}");
      upserts.push({ collection, id: decodeURIComponent(id), body });
      const list = Array.isArray(liveState[collection]) ? liveState[collection] : [];
      const index = list.findIndex((item) => item && item.id === body.id);
      if (index >= 0) list[index] = body; else list.push(body);
      liveState[collection] = list;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: liveState }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: liveState }) });
  });
}

const server = startServer();
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  await installMocks(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  // 记录是默认 tab → 卡片应在顶部,显示「下次喂奶」倒计时(非到点)
  const card = page.locator(".feeding-alarm-card");
  await card.waitFor({ state: "visible", timeout: 8000 });
  assert.ok(await card.getByText("下次喂奶").isVisible(), "已设闹钟应显示「下次喂奶」");
  assert.equal(await card.locator(".is-empty").count(), 0, "已设闹钟卡片不应是未设置态");
  console.log("[FA1] card shows countdown when a milk reminder exists ✔");

  // 点「已喂」→ 选 150 → 落一条 milk careLog(amountMl 150)
  await card.getByRole("button", { name: "已喂" }).click();
  await page.locator(".fa-sheet").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".fa-chip", { hasText: "150" }).click();
  await page.waitForFunction(() => true, { timeout: 100 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const careUpsert = [...upserts].reverse().find((u) => u.collection === "careLogs");
  assert.ok(careUpsert, "已喂后应 PUT 持久化 careLogs");
  const milkEvents = (careUpsert.body.events ?? []).filter((e) => e.type === "milk");
  assert.ok(milkEvents.some((e) => e.amountMl === 150), "应新增一条 150ml 的 milk 事件");
  console.log("[FA2] 已喂 → 150ml milk careLog persisted ✔");

  console.log("feeding alarm DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
```

- [ ] **Step 2: 构建后跑测试确认通过**

Run: `npm run build && node scripts/test-feeding-alarm.mjs`
Expected: 打印 `[FA1]`、`[FA2]` 与 `feeding alarm DOM smoke tests passed`。
(若 `[FA2]` 偶发慢,适当上调 `setTimeout` 到 800ms;断言以 `upserts` 最后一条 careLogs 为准。)

- [ ] **Step 3: 注册 + 挂进 verify**

`package.json` `"scripts"` 加:
```json
"test:feeding-alarm": "node scripts/test-feeding-alarm.mjs",
```
并在 `verify:frontend` 末尾追加 ` && npm run test:feeding-alarm`。

- [ ] **Step 4: 提交**

```bash
git add scripts/test-feeding-alarm.mjs package.json
git commit -m "test(feeding-alarm): DOM smoke——卡片倒计时 + 已喂记 150ml"
```

---

## Task 5: 全量验证 + OTA 准备

**Files:** 无(验证 + 文档)

- [ ] **Step 1: 跑全量前端验证**

Run: `npm run verify:frontend`
Expected: 既有用例全绿 + 新增 `feeding alarm view tests passed`、`feeding alarm DOM smoke tests passed`。把真实输出贴出来确认(不许只说"绿了")。

- [ ] **Step 2: 真机/预览自查清单**(手动)

- 记录页顶部出现卡片;有喂奶提醒 + 近期喝奶 → 显示「下次喂奶 还有 X」;
- 点「已喂」→ 选 150 → 卡片「距上次」归零、「距下次」顺延到 +间隔;
- 无喂奶提醒时显示「设置」→ 点击后卡片变为倒计时态(默认每 3 小时);
- 「其他…」→ 输入自定义奶量可记录。

- [ ] **Step 3: 发 OTA**(纯前端,不换原生包;严格按 `AGENTS.md` 流程)

```bash
VERSION="0.1.0-$(date +%Y%m%d%H%M%S)"
VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_VERSION="$VERSION" npm run build:mobile:update
grep -r "localhost:8080" dist/assets/ | wc -l   # 必须 0
```
然后 OSS 上传 + 同步 manifest + 校验 check API/checksum(见 `docs/ops/mobile-updates.md`)。

---

## Self-Review(写计划后自查)

- **Spec 覆盖**:倒计时卡片(Task 2/3)✓;到点高亮(`is-due`,Task 2)✓;已喂快速奶量 B 档 90/120/150/180+亲喂+其他(Task 2/3)✓;复用引擎自动重锚(Task 3 靠现有 `latestMilkAnchor` useEffect)✓;未设置→简化创建(Task 3 `createMilkReminderShortcut`)✓;入口(记录页顶部=首页,Task 3)✓;OTA(Task 5)✓。设计稿"非目标"(小组件/双间隔/预测)未做,符合 v1。
- **占位扫描**:无 TODO/TBD;每步含完整代码或精确命令。
- **类型一致**:`computeFeedingAlarmView` 入参 `{dueAtMs,intervalMinutes,lastMilkAtMs,nowMs}` 在 Task 1 定义、Task 2 组件内同名调用一致;`FeedingAlarmCardProps`(`onFed`/`onPickOther`/`onSetup`)在 Task 2 定义、Task 3 `feedingAlarmHandlers` 同名提供一致;`recordQuickMilk(amountMl: number | null)` 签名 Task 3 内一致。
