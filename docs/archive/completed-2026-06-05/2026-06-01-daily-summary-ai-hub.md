# Daily Summary AI 中枢升级（档 A 3 件事）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「今日发现」从记录页里的一个文字块，升级成命名化、可视化、数据整合的 AI 中枢卡片——落地竞品评审 spec 中「先动的 3 件事」。

**Architecture:** 纯前端改动，零后端 / 零数据模型变更。三件事全部收敛到 `DailySummaryView` 组件：① 给跨域发现加品牌化头部 +「记得越多越准」反馈提示；② 把「宝宝今天」文字升级为 3 张色彩编码 stat card；③ 把成长测量（身高/体重/头围）的最新值接入卡片。数据源 `selectedCareLog`（含 milkMl/milkTimes/sleepHours）与 `growthMeasurements` 已在 App.tsx 就绪，仅需作为新 props 透传；统计计算用 `utils/dailySummary.ts` 里的纯函数完成。

**Tech Stack:** React 18 + TypeScript + Vite，lucide-react 图标，Capacitor OTA。验证沿用项目既有体系：`npm run build`（类型检查）+ `npm run smoke:frontend`（7 视口 Playwright 布局）+ `scripts/probe-daily-summary-view.mjs`（视觉截图）。本项目前端无 jest/vitest，不新引入测试框架；纯函数靠类型检查 + 视觉截图验证（与本仓库既往 30+ commit 一致）。

**Current Strategy Source:** `harness/app-development-roadmap.md`

**Historical Reference Spec:** `docs/research-archive/mother-baby-strategy-2026-06-02/2026-06-01-cross-app-design-review.md`（archived; use only as evidence, not as current product direction）

**Execution Note:** Before implementing this plan, align the work with the current roadmap's Phase 0 scope: low-friction recording, low-anxiety anti-fatigue copy, `小宝今日观察` branding, record-success feedback, stat cards, and growth latest values. Do not reintroduce archived strategy directions that conflict with the roadmap.

---

## 战略对应（为什么是这 3 件事，不是随便挑的）

| 件 | 治哪层问题 | AI 中枢方向 |
|---|---|---|
| ① 命名 + 反馈提示 | L3 价值层（AI 隐形） | 输出显化 + 飞轮闭环 |
| ② 色彩编码 stat card | L1 表现层（视觉粗糙） | 输出可视化 |
| ③ 成长接入今日发现 | L2 结构层（功能孤岛） | 输入整合 |

一条主线（今日发现=AI 中枢），三个方向各打一拳。

---

## File Structure

| 文件 | 改动 | 职责 |
|---|---|---|
| `frontend/src/utils/dailySummary.ts` | 修改 | 新增纯函数 `buildCareStats` / `buildGrowthStats` / `countTodayDataPoints` + stat 颜色/标签常量 |
| `frontend/src/styles/daily-summary.css` | 修改 | stat card / 成长条 / 品牌头部 / 反馈提示样式 |
| `frontend/src/views/DailySummaryView.tsx` | 修改 | 新增 props（careLog/growthMeasurements），渲染品牌头部 + 反馈提示 + stat card + 成长条 |
| `frontend/src/App.tsx` | 修改 | 把 `selectedCareLog` + `growthMeasurements` 作为 props 传入 DailySummaryView（单处，~2 行） |
| `scripts/probe-daily-summary-view.mjs` | 修改 | fixture 加今日 careLog + 成长测量，让 stat 路径在截图里有数据 |

不动：后端、types.ts（已有 CareLog/GrowthMeasurement 类型）、smoke fixture（layout-only，无需改）。

---

## Task 1: 纯统计函数 + stat 常量（utils/dailySummary.ts）

**Files:**
- Modify: `frontend/src/utils/dailySummary.ts`

- [ ] **Step 1: 在文件顶部 import 区补类型**

`frontend/src/utils/dailySummary.ts` 第 1 行现在是：
```ts
import type { Finding, FindingType } from "../types";
```
改为：
```ts
import type { CareLog, Finding, FindingType, GrowthMeasurement, GrowthMeasurementType } from "../types";
```

- [ ] **Step 2: 在文件末尾追加 stat 类型 + 纯函数**

把下面整段追加到 `frontend/src/utils/dailySummary.ts` 末尾（`findingsByType` 函数之后）：

```ts
// ── 今日发现 AI 中枢：careLog stat cards ──────────────────────────

export type CareStat = {
  key: "milk" | "sleep" | "feedingTimes";
  label: string;
  /** 已格式化的主数值文本，如 "580" / "14.0" / "5"；无数据为 null */
  value: string | null;
  unit: string;
  /** 色彩编码（对标 Glow：奶橙 / 睡蓝 / 喂养绿） */
  color: string;
};

/**
 * 从当天 careLog 计算 3 张 stat card 的展示数据。
 * careLog 缺失或字段缺失时 value 为 null（UI 显示「—」）。
 */
export function buildCareStats(careLog: CareLog | undefined | null): CareStat[] {
  const milkMl = careLog?.milkMl;
  const milkTimes = careLog?.milkTimes;
  const sleepHours = careLog?.sleepHours;
  return [
    {
      key: "milk",
      label: "奶量",
      value: typeof milkMl === "number" && milkMl > 0 ? String(milkMl) : null,
      unit: "ml",
      color: "#e8a45e",
    },
    {
      key: "sleep",
      label: "睡眠",
      value: typeof sleepHours === "number" && sleepHours > 0 ? sleepHours.toFixed(1) : null,
      unit: "h",
      color: "#7eafd8",
    },
    {
      key: "feedingTimes",
      label: "喂养",
      value: typeof milkTimes === "number" && milkTimes > 0 ? String(milkTimes) : null,
      unit: "次",
      color: "#8ac4a8",
    },
  ];
}

// ── 今日发现 AI 中枢：成长 stat 条 ────────────────────────────────

export type GrowthStat = {
  type: GrowthMeasurementType;
  label: string;
  /** 最新一次测量值（按日期取最新）；无记录为 null */
  value: number | null;
  unit: string;
};

const GROWTH_STAT_META: Record<GrowthMeasurementType, { label: string; unit: string }> = {
  height: { label: "身高", unit: "cm" },
  weight: { label: "体重", unit: "kg" },
  headCircumference: { label: "头围", unit: "cm" },
};

/**
 * 取每个测量项的最新值（按 date 字符串升序排，取末位）。
 */
export function buildGrowthStats(measurements: GrowthMeasurement[]): GrowthStat[] {
  const order: GrowthMeasurementType[] = ["height", "weight", "headCircumference"];
  return order.map((type) => {
    const items = measurements
      .filter((m) => m.type === type)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = items[items.length - 1];
    const meta = GROWTH_STAT_META[type];
    return {
      type,
      label: meta.label,
      value: latest ? latest.value : null,
      unit: meta.unit,
    };
  });
}

// ── 今日发现 AI 中枢：「记得越多越准」反馈闭环 ────────────────────

/**
 * 统计当天有多少条结构化数据点（喂养次数 + 睡眠 + 事件 + 当天成长测量）。
 * 用于「基于今天 N 条记录生成」的反馈提示，把 AI 质量绑定到记录行为。
 */
export function countTodayDataPoints(
  careLog: CareLog | undefined | null,
  measurements: GrowthMeasurement[],
  date: string,
): number {
  let count = 0;
  if (careLog) {
    if (typeof careLog.milkTimes === "number" && careLog.milkTimes > 0) count += careLog.milkTimes;
    else if (typeof careLog.milkMl === "number" && careLog.milkMl > 0) count += 1;
    if (typeof careLog.sleepHours === "number" && careLog.sleepHours > 0) count += 1;
    if (Array.isArray(careLog.events)) count += careLog.events.length;
  }
  count += measurements.filter((m) => m.date === date).length;
  return count;
}
```

- [ ] **Step 3: 类型检查通过**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run build 2>&1 | tail -5`
Expected: `✓ built in ...`，无 TS 报错。

> 说明：本项目前端无单测 runner，纯函数靠 TS 类型检查 + 后续 probe 视觉验证。`buildCareStats`/`buildGrowthStats`/`countTodayDataPoints` 都是无副作用纯函数，逻辑简单（取值/格式化/排序取末位/计数），正确性由 Task 5 的截图人眼确认。

- [ ] **Step 4: Commit**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add frontend/src/utils/dailySummary.ts
git commit -m "feat(daily-summary): add careStat/growthStat/dataPoint pure helpers for AI hub"
```

---

## Task 2: stat card / 成长条 / 品牌头部 / 反馈提示 CSS

**Files:**
- Modify: `frontend/src/styles/daily-summary.css`

- [ ] **Step 1: 追加样式到文件末尾**

把下面整段追加到 `frontend/src/styles/daily-summary.css` 末尾：

```css
/* ── 今日发现 AI 中枢：品牌头部 ────────────────────────── */
.daily-summary__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.daily-summary__brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: linear-gradient(135deg, #e8a45e 0%, #d88276 100%);
  color: #fff;
  flex-shrink: 0;
}

.daily-summary__brand-text h3 {
  margin: 0;
  font-size: 15px;
  color: #333;
  font-weight: 600;
}

.daily-summary__brand-nudge {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: #a08a6d;
  line-height: 1.4;
}

/* ── 今日发现 AI 中枢：色彩编码 stat cards ───────────────── */
.daily-summary__stats {
  display: flex;
  gap: 8px;
}

.daily-summary__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 4px;
  border-radius: 12px;
  background: rgba(255, 248, 230, 0.6);
  border-top: 3px solid var(--stat-color, #ccc);
}

.daily-summary__stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  line-height: 1.1;
}

.daily-summary__stat-value .unit {
  font-size: 12px;
  font-weight: 500;
  color: #888;
  margin-left: 1px;
}

.daily-summary__stat-value.is-empty {
  color: #c9bca8;
}

.daily-summary__stat-label {
  font-size: 12px;
  color: #888;
}

/* ── 今日发现 AI 中枢：成长 stat 条 ──────────────────────── */
.daily-summary__growth {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.daily-summary__growth-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: 10px;
  background: rgba(184, 148, 212, 0.1);
}

.daily-summary__growth-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.daily-summary__growth-value .unit {
  font-size: 11px;
  font-weight: 500;
  color: #999;
  margin-left: 1px;
}

.daily-summary__growth-value.is-empty {
  color: #c9bca8;
}

.daily-summary__growth-label {
  font-size: 11px;
  color: #888;
}

.daily-summary__growth-link {
  font-size: 12px;
  color: #8367a8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 2: 类型/构建检查**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run build 2>&1 | tail -3`
Expected: `✓ built in ...`（CSS 改动不影响 TS，构建通过即可）。

- [ ] **Step 3: Commit**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add frontend/src/styles/daily-summary.css
git commit -m "feat(daily-summary): styles for stat cards, growth strip, brand header"
```

---

## Task 3: DailySummaryView 渲染品牌头部 + stat card + 成长条

**Files:**
- Modify: `frontend/src/views/DailySummaryView.tsx`

- [ ] **Step 1: 更新 import**

`frontend/src/views/DailySummaryView.tsx` 顶部 import 区，把现有：
```tsx
import type { DailySummary, Finding } from "../types";
import { Skeleton } from "../components/Skeleton";
import heroRecordsToday from "../assets/illustrations/hero-records-today.png";
import {
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  parseActionTarget,
} from "../utils/dailySummary";
```
替换为：
```tsx
import { Sparkles } from "lucide-react";
import type { CareLog, DailySummary, Finding, GrowthMeasurement } from "../types";
import { Skeleton } from "../components/Skeleton";
import heroRecordsToday from "../assets/illustrations/hero-records-today.png";
import {
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  buildCareStats,
  buildGrowthStats,
  countTodayDataPoints,
  parseActionTarget,
} from "../utils/dailySummary";
```

- [ ] **Step 2: 扩展 props 类型**

把现有：
```tsx
export type DailySummaryViewProps = {
  summary: DailySummary | null;
  onActionClick: (domain: string, id: string) => void;
  loading?: boolean;
};
```
替换为：
```tsx
export type DailySummaryViewProps = {
  summary: DailySummary | null;
  onActionClick: (domain: string, id: string) => void;
  loading?: boolean;
  /** 当前所选日期的 careLog，用于 stat cards */
  careLog?: CareLog | null;
  /** 家庭成长测量记录，用于成长 stat 条 */
  growthMeasurements?: GrowthMeasurement[];
  /** 所选日期 YYYY-MM-DD，用于「基于今天 N 条记录」反馈 */
  date?: string;
  /** 点「记录成长」时打开成长录入页 */
  onOpenGrowth?: () => void;
};
```

- [ ] **Step 3: 更新组件签名 + 计算派生数据**

把现有：
```tsx
export function DailySummaryView({ summary, onActionClick, loading = false }: DailySummaryViewProps) {
  if (!summary && loading) return <DailySummarySkeleton />;
  if (!summary) return null;

  const hasFindings = summary.findings && summary.findings.length > 0;
  const hasMissing = summary.missingItems && summary.missingItems.length > 0;
  const hasObservations = summary.observations && summary.observations.length > 0;
```
替换为：
```tsx
export function DailySummaryView({
  summary,
  onActionClick,
  loading = false,
  careLog = null,
  growthMeasurements = [],
  date = "",
  onOpenGrowth,
}: DailySummaryViewProps) {
  if (!summary && loading) return <DailySummarySkeleton />;
  if (!summary) return null;

  const hasFindings = summary.findings && summary.findings.length > 0;
  const hasMissing = summary.missingItems && summary.missingItems.length > 0;
  const hasObservations = summary.observations && summary.observations.length > 0;

  const careStats = buildCareStats(careLog);
  const growthStats = buildGrowthStats(growthMeasurements);
  const dataPoints = countTodayDataPoints(careLog, growthMeasurements, date);
  const hasGrowth = growthStats.some((stat) => stat.value !== null);
```

- [ ] **Step 4: 替换「宝宝今天」文字块为色彩编码 stat cards（② 可视化）**

把现有：
```tsx
      {summary.facts && summary.facts.length > 0 && (
        <div className="daily-summary__section fade-in-up">
          <h3>宝宝今天</h3>
          <p className="daily-summary__facts">{summary.facts.join("；")}</p>
        </div>
      )}
```
替换为：
```tsx
      <div className="daily-summary__section fade-in-up">
        <h3>宝宝今天</h3>
        <div className="daily-summary__stats">
          {careStats.map((stat) => (
            <div
              key={stat.key}
              className="daily-summary__stat"
              style={{ ["--stat-color" as string]: stat.color }}
            >
              <span className={`daily-summary__stat-value${stat.value === null ? " is-empty" : ""}`}>
                {stat.value ?? "—"}
                {stat.value !== null && <span className="unit">{stat.unit}</span>}
              </span>
              <span className="daily-summary__stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
```

> 说明：原 `facts` 文字（如「喂养记录：5 次，共 580ml」）的信息已被 3 张 stat card 覆盖；不再展示拼接文字，避免重复。

- [ ] **Step 5: 给「你可能没注意到」加品牌头部 + 反馈提示（① 命名 + 闭环）**

把现有：
```tsx
      {hasFindings && (
        <div className="daily-summary__section fade-in-up">
          <h3>你可能没注意到</h3>
          {summary.findings.map((finding, idx) => (
            <FindingRow
              key={`${finding.type}-${idx}`}
              finding={finding}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}
```
替换为：
```tsx
      {hasFindings && (
        <div className="daily-summary__section fade-in-up">
          <div className="daily-summary__brand">
            <span className="daily-summary__brand-icon" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="daily-summary__brand-text">
              <h3>今日发现</h3>
              <p className="daily-summary__brand-nudge">
                记得越多，发现越准 · 基于今天 {dataPoints} 条记录
              </p>
            </div>
          </div>
          {summary.findings.map((finding, idx) => (
            <FindingRow
              key={`${finding.type}-${idx}`}
              finding={finding}
              onActionClick={onActionClick}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 6: 在「需要你看一眼」之前插入成长 stat 条（③ 整合）**

紧接 Step 5 那段 `{hasFindings && (...)}` 之后、`{hasObservations && (...)}` 之前，插入：
```tsx
      <div className="daily-summary__section fade-in-up">
        <h3>宝宝成长</h3>
        <div className="daily-summary__growth">
          {growthStats.map((stat) => (
            <div className="daily-summary__growth-item" key={stat.type}>
              <span className={`daily-summary__growth-value${stat.value === null ? " is-empty" : ""}`}>
                {stat.value ?? "—"}
                {stat.value !== null && <span className="unit">{stat.unit}</span>}
              </span>
              <span className="daily-summary__growth-label">{stat.label}</span>
            </div>
          ))}
        </div>
        {!hasGrowth && onOpenGrowth && (
          <button type="button" className="daily-summary__growth-link" onClick={onOpenGrowth}>
            记一笔身高 / 体重 →
          </button>
        )}
      </div>
```

- [ ] **Step 7: 类型检查 + 构建**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run build 2>&1 | tail -5`
Expected: `✓ built in ...`，无 TS 报错。若报 `--stat-color` 类型错误，确认 Step 4 用的是 `style={{ ["--stat-color" as string]: stat.color }}`（CSS 变量需此写法）。

- [ ] **Step 8: Commit**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add frontend/src/views/DailySummaryView.tsx
git commit -m "feat(daily-summary): branded findings header, color-coded stat cards, growth strip"
```

---

## Task 4: App.tsx 透传 careLog + growthMeasurements 到 DailySummaryView

**Files:**
- Modify: `frontend/src/App.tsx`（mount 点约在 7066-7072 行）

- [ ] **Step 1: 确认现有 mount 块**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && grep -n "<DailySummaryView" frontend/src/App.tsx`
现有（约 7067 行起）：
```tsx
            <DailySummaryView
              summary={selectedDailySummary}
              onActionClick={handleFindingActionClick}
              loading={isGeneratingDailySummary}
            />
```

- [ ] **Step 2: 补 4 个 props**

替换为：
```tsx
            <DailySummaryView
              summary={selectedDailySummary}
              onActionClick={handleFindingActionClick}
              loading={isGeneratingDailySummary}
              careLog={selectedCareLog}
              growthMeasurements={growthMeasurements}
              date={selectedDate}
              onOpenGrowth={openGrowthEntry}
            />
```

> 校验：`selectedCareLog`（App.tsx:3005）、`growthMeasurements`（App.tsx:2043）、`selectedDate`（state）、`openGrowthEntry`（本会话 IA 重构时加的回调）均已在 App 作用域内存在，无需新增。

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run build 2>&1 | tail -5`
Expected: `✓ built in ...`，无 TS 报错。

- [ ] **Step 4: Commit**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add frontend/src/App.tsx
git commit -m "feat(daily-summary): wire careLog + growth + date into DailySummaryView"
```

---

## Task 5: probe fixture 更新 + 全量视觉验证

**Files:**
- Modify: `scripts/probe-daily-summary-view.mjs`（fixture 加今日 careLog + 成长，让 stat 路径有数据）

- [ ] **Step 1: 给 probe fixture 加今日 careLog + 成长测量**

打开 `scripts/probe-daily-summary-view.mjs`，找到 `loadSmokeState()` 里返回的 state 对象（约在文件中段，含 `growthMeasurements: []` 与 `careLogs: []`）。

将 `careLogs: []` 替换为（用今天日期，让 `selectedCareLog` 命中）：
```js
    careLogs: [
      {
        id: "probe-care-today",
        date: new Date().toISOString().slice(0, 10),
        milkMl: 580,
        milkTimes: 5,
        sleepHours: 14.0,
        wakes: 2,
        solids: [],
        notes: [],
        events: [
          { id: "probe-evt-1", type: "milk", date: new Date().toISOString().slice(0, 10), time: "08:00", title: "喝奶" },
          { id: "probe-evt-2", type: "sleep", date: new Date().toISOString().slice(0, 10), time: "13:00", title: "午睡" },
        ],
      },
    ],
```

将 `growthMeasurements: []` 替换为：
```js
    growthMeasurements: [
      { id: "probe-gm-1", type: "height", value: 69.5, date: "2026-02-15" },
      { id: "probe-gm-2", type: "weight", value: 8.2, date: "2026-02-15" },
      { id: "probe-gm-3", type: "headCircumference", value: 44.0, date: "2026-02-15" },
    ],
```

> 注意：`loadSmokeState()` 内联 fixture 里 dailySummary 必须仍有 `findings`（保持原样不动），否则品牌头部不渲染。

- [ ] **Step 2: 构建**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run build 2>&1 | tail -3`
Expected: `✓ built in ...`

- [ ] **Step 3: 跑 7 视口 smoke（布局无溢出）**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && npm run smoke:frontend 2>&1 | tail -10`
Expected: `Frontend smoke passed.` + 7 行视口。若 iPhone SE (375px) 报 stat card 溢出，检查 `.daily-summary__stats` 的 `gap` 是否过大（3 张卡 flex:1 应自适应，正常不溢出）。

- [ ] **Step 4: 跑 probe 出截图**

Run: `cd /Users/bytedance/Documents/ai-baby-growth-companion && node scripts/probe-daily-summary-view.mjs 2>&1 | tail -3`
Expected: 截图保存成功。

- [ ] **Step 5: 人眼检查截图**

读 `.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png`，确认：
- 「宝宝今天」下方出现 3 张色彩编码 stat card（奶量 580ml 橙顶 / 睡眠 14.0h 蓝顶 / 喂养 5次 绿顶）
- 「今日发现」有 Sparkles 图标品牌头部 + "记得越多，发现越准 · 基于今天 N 条记录"
- 「宝宝成长」条出现 3 项最新值（身高 69.5cm / 体重 8.2kg / 头围 44.0cm）
- 整体无溢出、无重叠

若视觉有问题，回到 Task 2/3 调 CSS 或布局后重跑 Step 2-5。

- [ ] **Step 6: Commit**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add scripts/probe-daily-summary-view.mjs
git commit -m "test(daily-summary): probe fixture with today careLog + growth for stat verification"
```

---

## Task 6: OTA 发布 + Aliyun 部署 + push

**Files:** 无（发布操作）

- [ ] **Step 1: 构建 OTA bundle**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
MOBILE_UPDATE_MESSAGE='今日发现升级为AI中枢：stat卡片+成长接入+命名' \
  MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 \
  VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 \
  npm run build:mobile:update 2>&1 | tail -5
```
Expected: 打印新版本号 `0.1.0-<timestamp>` 与 bundle 路径。

- [ ] **Step 2: 上传 OSS**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
unset HTTP_PROXY HTTPS_PROXY
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  bash scripts/upload-mobile-update-oss.sh 2>&1 | tail -3
```
Expected: `Mobile update OSS object key: baby-companion/mobile-updates/app-0.1.0-<timestamp>.zip`

> 坑提醒：必须 `export PATH` 把 JDK 17 放最前（系统默认 mvn/javac 是 JDK 8，inline OSS uploader 用了 `String.isBlank()` 会编译失败）；必须 `unset` 代理（SSH 会被 127.0.0.1:7897 代理拦截）。

- [ ] **Step 3: 同步 manifest 到 ECS（纯前端改动，跳过 backend rebuild）**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
unset HTTP_PROXY HTTPS_PROXY
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 SKIP_BACKEND_BUILD=1 \
  ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  npm run deploy:aliyun 2>&1 | tail -5
```
Expected: 部署完成，无报错。

- [ ] **Step 4: 验证云端 + OTA check**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
unset HTTP_PROXY HTTPS_PROXY
curl -sS http://120.55.188.242:8300/api/health && echo ""
curl -sS -X POST http://120.55.188.242:8300/api/mobile-updates/check \
  -H 'Content-Type: application/json' \
  -d '{"platform":"ios","currentBundleVersion":"0.1.0"}' | head -1
```
Expected: `ok` + OTA check 返回新版本号 + message `今日发现升级为AI中枢...`。

- [ ] **Step 5: push 到 GitHub**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git push origin main 2>&1 | tail -3
```
Expected: push 成功。

- [ ] **Step 6: 更新 harness 进度**

在 `harness/claude-progress.md` 的 `## Session Log` 下、最新 session 之前插入一段新 session 记录（标题 `### Session 2026-06-01 Daily Summary AI Hub`），写明：3 件事（命名+反馈/stat卡片/成长接入）、验证（build/smoke/probe）、OTA 版本号、known limitation（真机未验、shimmer 未触发）。然后：

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
git add harness/claude-progress.md
git commit -m "chore: record daily summary AI hub session"
git push origin main 2>&1 | tail -2
```

---

## Self-Review Notes

- [ ] **Spec 覆盖**：Part 5 三件事 → Task 3 的 Step 4（②stat card）/ Step 5（①命名+闭环）/ Step 6（③成长接入）逐一对应 ✓
- [ ] **无 placeholder**：每步含完整可粘贴代码，无 TBD ✓
- [ ] **类型一致**：`CareStat`/`GrowthStat`/`buildCareStats`/`buildGrowthStats`/`countTodayDataPoints` 在 Task 1 定义、Task 3 消费，签名一致 ✓
- [ ] **数据源真实**：`selectedCareLog`/`growthMeasurements`/`selectedDate`/`openGrowthEntry` 均已在 App.tsx 现存（已核） ✓

## 不在本计划（需你单独决策，见 spec Open Questions）

- ❌ 成长曲线图（需决策解禁 + CDC 数据，effort L）
- ❌ 今日发现免费 vs Pro 付费墙
- ❌ 推送/锁屏 Live Activities 多触点（原生改动，需真机）
- ❌ 趋势页周对比图表
- ❌ 1 岁后月龄延展
