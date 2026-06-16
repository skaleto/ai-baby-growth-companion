# 疫苗接种清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加一个疫苗接种清单页:一类(全国统一)+ 省级增补(5省)+ 二类(各省精确参考价),按宝宝月龄给每针算窗口状态、可打钩"已接种"、入口角标提醒"别漏别晚"。

**Architecture:** 纯前端,照「成长里程碑」范式(静态数据集 + view + 打钩 + 免责)。疫苗数据走 OSS JSON + 内置兜底 + localStorage 缓存;省份与接种记录存进 `profile`(JSON 直存,后端零改动)。**纯 OTA、零后端部署。**

**Tech Stack:** React/TS,lucide-react,esbuild(纯模块 node 单测),Playwright + vite preview(DOM smoke)。

**设计稿:** `docs/architecture/vaccine-checklist-design.md`

---

## ⚠️ 两个必须注意的集成点(来自代码勘探)

1. **`normalizeBabyProfile` 会丢弃未知字段** —— 必须显式给它加上 `vaccineRegion` / `vaccineRecords` 的保留,否则每次加载就被抹掉(Task 4)。
2. `BabyProfile` 已有一个自由文本 `region` 字段(`types.ts:108-122`),**不要复用**——新建 `vaccineRegion`(省码)避免语义冲突。

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `frontend/src/data/vaccineSchedule.fallback.ts` | 纯:类型 + 内置兜底数据(一类全量 + 省增补 + 二类 + 价格) | 新建 |
| `frontend/src/vaccineStatus.ts` | 纯:`computeDoseStatus`(5态) + `vaccineDosesForRegion`(叠省增补) | 新建 |
| `frontend/src/vaccineData.ts` | 数据层:OSS 拉 `vaccine-data.json` + localStorage 缓存 + 版本门控 + 内置兜底 | 新建 |
| `frontend/src/types.ts` | `BabyProfile` 加 `vaccineRegion?` / `vaccineRecords?` | 修改 |
| `frontend/src/appStateDomain.ts` | `normalizeBabyProfile` 保留新字段 | 修改 |
| `frontend/src/views/VaccineView.tsx` | 清单页(照 MilestonesView) | 新建 |
| `frontend/src/components/RegionPicker.tsx` | 接种地省份选择 | 新建 |
| `frontend/src/styles/mobile-app.css` | 样式追加 | 修改 |
| `frontend/src/App.tsx` | 入口按钮 + 全屏 view 挂载 + profile 读写处理器 | 修改 |
| `scripts/test-vaccine-fallback.mjs` | 数据集 node 单测 | 新建 |
| `scripts/test-vaccine-status.mjs` | 状态 5 态 node 单测 | 新建 |
| `scripts/test-vaccine-view.mjs` | DOM smoke | 新建 |
| `scripts/upload-vaccine-data.mjs` | OSS 上传(公开读;ops/内容任务) | 新建 |
| `package.json` | 注册 3 个测试脚本并挂进 verify:frontend | 修改 |

---

## Task 1: 类型 + 内置兜底数据集(纯,TDD)

**Files:** Create `frontend/src/data/vaccineSchedule.fallback.ts`, `scripts/test-vaccine-fallback.mjs`; Modify `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-vaccine-fallback.mjs`

```javascript
#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-vaccine-fallback-"));
try {
  const out = path.join(tempDir, "f.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/data/vaccineSchedule.fallback.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const m = await import(pathToFileURL(out).href);
  const data = m.VACCINE_FALLBACK;
  assert.ok(data && typeof data.version === "string" && typeof data.asOf === "string", "应有 version/asOf");
  assert.ok(Array.isArray(data.doses) && data.doses.length >= 5, "应有 doses");
  const ids = data.doses.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "doseId 必须唯一");
  const REGIONS = new Set(["national", "BJ", "SH", "GD", "ZJ", "JS"]);
  const KLASS = new Set(["nip", "provincial", "optional"]);
  for (const d of data.doses) {
    assert.ok(d.id && d.vaccine && typeof d.doseNo === "number", `字段完备: ${d.id}`);
    assert.ok(d.ageMonthMin <= d.ageMonthMax, `窗口合法: ${d.id}`);
    assert.ok(KLASS.has(d.klass), `klass 合法: ${d.id}`);
    assert.ok(REGIONS.has(d.region), `region 合法: ${d.id}`);
    assert.ok(typeof d.intro === "string" && d.intro, `有简介: ${d.id}`);
  }
  assert.ok(data.doses.some((d) => d.klass === "nip" && d.region === "national"), "应有一类 national");
  assert.ok(data.doses.some((d) => d.klass === "optional"), "应有二类");
  // 价格只对二类,且引用的苗名在 doses 里存在
  const vacNames = new Set(data.doses.map((d) => d.vaccine));
  for (const p of data.prices) {
    assert.ok(REGIONS.has(p.region), `价格 region 合法: ${p.doseVaccine}`);
    assert.ok(typeof p.price === "number" && p.price > 0, `价格为正: ${p.doseVaccine}`);
    assert.ok(vacNames.has(p.doseVaccine), `价格引用的苗存在: ${p.doseVaccine}`);
  }
  console.log("vaccine fallback dataset tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-vaccine-fallback.mjs`
Expected: FAIL(esbuild 找不到 `vaccineSchedule.fallback.ts`)。

- [ ] **Step 3: 写实现** `frontend/src/data/vaccineSchedule.fallback.ts`

> 内置兜底:**一类 national 给到位**(覆盖主要苗),省增补与二类先放**代表性样例**(完整 5 省 + 全二类 + 全价格是 Task 7 的内容任务,核对官方 2025 程序)。

```typescript
// 疫苗清单内置兜底(纯模块,无 React/资源 import)。离线/首启/OSS 拉取失败时用这份。
// 完整数据(全5省增补+全二类+各省价)由 OSS vaccine-data.json 覆盖;此处保证可用 + 结构正确。
export type VaccineDoseClass = "nip" | "provincial" | "optional"; // 一类 / 省级增补 / 二类自费
export type RegionCode = "national" | "BJ" | "SH" | "GD" | "ZJ" | "JS";
export type DoseStatus = "done" | "overdue" | "closing" | "due" | "upcoming";

export type VaccineDose = {
  id: string;
  vaccine: string;
  doseNo: number;
  ageMonthMin: number;
  ageMonthMax: number;
  klass: VaccineDoseClass;
  region: RegionCode;
  intro: string;
  recommend?: "recommended" | "optional";
};
export type VaccinePrice = { doseVaccine: string; region: RegionCode; tier?: "domestic" | "imported"; price: number };
export type VaccineData = { version: string; asOf: string; doses: VaccineDose[]; prices: VaccinePrice[] };

const nip = (id: string, vaccine: string, doseNo: number, min: number, max: number, intro: string): VaccineDose =>
  ({ id, vaccine, doseNo, ageMonthMin: min, ageMonthMax: max, klass: "nip", region: "national", intro });

export const VACCINE_FALLBACK: VaccineData = {
  version: "2026-06-fallback",
  asOf: "2026年6月",
  doses: [
    // —— 一类(全国统一,核对官方 2025 程序;百白破为 2025 新程序 2/4/6/18月+6岁)——
    nip("bcg-1", "卡介苗", 1, 0, 1, "预防重症结核病。"),
    nip("hepb-1", "乙肝疫苗", 1, 0, 1, "预防乙型肝炎(出生 24h 内第 1 剂)。"),
    nip("hepb-2", "乙肝疫苗", 2, 1, 2, "预防乙型肝炎。"),
    nip("hepb-3", "乙肝疫苗", 3, 6, 8, "预防乙型肝炎。"),
    nip("ipv-1", "脊灰疫苗", 1, 2, 3, "预防脊髓灰质炎。"),
    nip("ipv-2", "脊灰疫苗", 2, 3, 4, "预防脊髓灰质炎。"),
    nip("opv-3", "脊灰疫苗", 3, 4, 5, "预防脊髓灰质炎。"),
    nip("opv-4", "脊灰疫苗", 4, 48, 50, "预防脊髓灰质炎(4 岁加强)。"),
    nip("dtap-1", "百白破", 1, 2, 3, "预防百日咳、白喉、破伤风。"),
    nip("dtap-2", "百白破", 2, 4, 5, "预防百日咳、白喉、破伤风。"),
    nip("dtap-3", "百白破", 3, 6, 7, "预防百日咳、白喉、破伤风。"),
    nip("dtap-4", "百白破", 4, 18, 24, "预防百日咳、白喉、破伤风。"),
    nip("dtap-5", "百白破", 5, 72, 74, "预防百日咳、白喉、破伤风(6 岁)。"),
    nip("mmr-1", "麻腮风", 1, 8, 9, "预防麻疹、流行性腮腺炎、风疹。"),
    nip("mmr-2", "麻腮风", 2, 18, 24, "预防麻疹、流行性腮腺炎、风疹。"),
    nip("je-1", "乙脑", 1, 8, 9, "预防流行性乙型脑炎。"),
    nip("je-2", "乙脑", 2, 24, 26, "预防流行性乙型脑炎。"),
    nip("mena-1", "流脑A群", 1, 6, 7, "预防 A 群流脑。"),
    nip("mena-2", "流脑A群", 2, 9, 10, "预防 A 群流脑。"),
    nip("menac-1", "流脑A+C群", 1, 36, 38, "预防 A+C 群流脑。"),
    nip("menac-2", "流脑A+C群", 2, 72, 74, "预防 A+C 群流脑(6 岁)。"),
    nip("hepa-1", "甲肝", 1, 18, 24, "预防甲型肝炎。"),
    // —— 省级增补(代表性样例;完整 5 省见内容任务)——
    { id: "varicella-bj-1", vaccine: "水痘", doseNo: 1, ageMonthMin: 12, ageMonthMax: 18, klass: "provincial", region: "BJ", intro: "预防水痘(北京对本市适龄儿童免费)。" },
    // —— 二类(自费可选;代表性样例)——
    { id: "pcv13-1", vaccine: "13价肺炎", doseNo: 1, ageMonthMin: 2, ageMonthMax: 3, klass: "optional", region: "national", intro: "预防 13 种血清型肺炎球菌感染。", recommend: "recommended" },
    { id: "rota-1", vaccine: "轮状病毒", doseNo: 1, ageMonthMin: 2, ageMonthMax: 7, klass: "optional", region: "national", intro: "口服,预防轮状病毒腹泻。", recommend: "recommended" },
    { id: "ev71-1", vaccine: "手足口(EV71)", doseNo: 1, ageMonthMin: 6, ageMonthMax: 12, klass: "optional", region: "national", intro: "预防 EV71 所致重症手足口;非高发区可降低优先级。", recommend: "optional" },
  ],
  prices: [
    { doseVaccine: "13价肺炎", region: "national", tier: "domestic", price: 600 },
    { doseVaccine: "13价肺炎", region: "national", tier: "imported", price: 900 },
    { doseVaccine: "轮状病毒", region: "national", price: 300 },
    { doseVaccine: "手足口(EV71)", region: "national", price: 200 },
  ],
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-vaccine-fallback.mjs`
Expected: PASS `vaccine fallback dataset tests passed`。

- [ ] **Step 5: 注册** `package.json` 加 `"test:vaccine-fallback": "node scripts/test-vaccine-fallback.mjs",` 并挂进 `verify:frontend`(早段纯测里,接在 `test:sleep-controller` 之后 ` && npm run test:vaccine-fallback`)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/data/vaccineSchedule.fallback.ts scripts/test-vaccine-fallback.mjs package.json
git commit -m "feat(vaccine): 疫苗数据类型 + 内置兜底数据集(含单测)"
```

---

## Task 2: 窗口状态 `vaccineStatus.ts`(纯,TDD)

**Files:** Create `frontend/src/vaccineStatus.ts`, `scripts/test-vaccine-status.mjs`; Modify `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-vaccine-status.mjs`

```javascript
#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-vaccine-status-"));
try {
  const out = path.join(tempDir, "s.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/vaccineStatus.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const { computeDoseStatus, vaccineDosesForRegion } = await import(pathToFileURL(out).href);

  const w = { ageMonthMin: 2, ageMonthMax: 4 };
  assert.equal(computeDoseStatus({ ageMonths: 6, ...w, doneDate: "2026-06-01" }), "done", "有日期=done");
  assert.equal(computeDoseStatus({ ageMonths: 6, ...w, doneDate: null }), "overdue", "过窗未打=overdue");
  assert.equal(computeDoseStatus({ ageMonths: 3, ...w, doneDate: null }), "due", "窗口中部=due");
  assert.equal(computeDoseStatus({ ageMonths: 3.5, ...w, doneDate: null }), "closing", "近窗口末(≤1月)=closing");
  assert.equal(computeDoseStatus({ ageMonths: 1, ...w, doneDate: null }), "upcoming", "未到窗口=upcoming");
  assert.equal(computeDoseStatus({ ageMonths: null, ...w, doneDate: null }), "upcoming", "无生日=upcoming");

  // 区域叠加:national + 选中省的 provincial,过滤掉别省
  const doses = [
    { id: "n1", klass: "nip", region: "national" },
    { id: "bj1", klass: "provincial", region: "BJ" },
    { id: "sh1", klass: "provincial", region: "SH" },
    { id: "o1", klass: "optional", region: "national" },
  ];
  const bj = vaccineDosesForRegion(doses, "BJ").map((d) => d.id);
  assert.ok(bj.includes("n1") && bj.includes("bj1") && bj.includes("o1") && !bj.includes("sh1"), "BJ 叠加正确");
  const none = vaccineDosesForRegion(doses, "national").map((d) => d.id);
  assert.ok(none.includes("n1") && none.includes("o1") && !none.includes("bj1"), "national 不含任何省增补");

  console.log("vaccine status tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-vaccine-status.mjs`
Expected: FAIL(找不到 `vaccineStatus.ts`)。

- [ ] **Step 3: 写实现** `frontend/src/vaccineStatus.ts`

```typescript
// 疫苗窗口状态(纯函数,可 node 测)。5 态互斥;区域叠加。
import type { DoseStatus, RegionCode, VaccineDose } from "./data/vaccineSchedule.fallback";

const CLOSING_MONTHS = 1; // 距窗口末 ≤1 月 = 尽快约

export function computeDoseStatus(input: {
  ageMonths: number | null;
  ageMonthMin: number;
  ageMonthMax: number;
  doneDate: string | null;
}): DoseStatus {
  const { ageMonths, ageMonthMin, ageMonthMax, doneDate } = input;
  if (doneDate) return "done";
  if (ageMonths == null) return "upcoming"; // 没填生日:当纯参考
  if (ageMonths > ageMonthMax) return "overdue";
  if (ageMonths < ageMonthMin) return "upcoming";
  // 在窗口内
  return ageMonthMax - ageMonths <= CLOSING_MONTHS ? "closing" : "due";
}

// national 永远显示;某省只显示 national + 该省 provincial;optional 看其 region(national 或某省)。
export function vaccineDosesForRegion<T extends { region: RegionCode }>(doses: T[], region: RegionCode): T[] {
  return doses.filter((d) => d.region === "national" || d.region === region);
}

// 「本阶段待安排」计数:due + closing + overdue。
export function pendingCount(statuses: DoseStatus[]): number {
  return statuses.filter((s) => s === "due" || s === "closing" || s === "overdue").length;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-vaccine-status.mjs`
Expected: PASS `vaccine status tests passed`。

- [ ] **Step 5: 注册** `package.json` 加 `"test:vaccine-status": "node scripts/test-vaccine-status.mjs",` 挂进 `verify:frontend`(接在 `test:vaccine-fallback` 之后)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/vaccineStatus.ts scripts/test-vaccine-status.mjs package.json
git commit -m "feat(vaccine): 窗口状态 computeDoseStatus(5态)+ 区域叠加(含单测)"
```

---

## Task 3: 数据层 `vaccineData.ts`(OSS 拉取 + 缓存 + 兜底)

**Files:** Create `frontend/src/vaccineData.ts`

- [ ] **Step 1: 写实现** `frontend/src/vaccineData.ts`

> 简单 fetch + localStorage 缓存 + 版本门控 + 内置兜底(不用 mediaCache 那套大块二进制缓存)。OSS URL 由 `import.meta.env.VITE_VACCINE_DATA_URL` 注入,缺省用一个常量。

```typescript
// 疫苗数据层:启动拉 OSS vaccine-data.json → localStorage 缓存;离线/失败/首启回退内置兜底。
// 改数据 = 重传 OSS JSON(不发版)。
import { VACCINE_FALLBACK, type VaccineData } from "./data/vaccineSchedule.fallback";

const CACHE_KEY = "baby-companion-vaccine-data-v1";
const OSS_URL =
  (import.meta.env.VITE_VACCINE_DATA_URL as string | undefined) ||
  "https://ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com/baby-companion/data/vaccine-data.json";

const isVaccineData = (x: unknown): x is VaccineData =>
  !!x && typeof x === "object" &&
  typeof (x as VaccineData).version === "string" &&
  Array.isArray((x as VaccineData).doses) &&
  Array.isArray((x as VaccineData).prices);

function readCache(): VaccineData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isVaccineData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 同步:先给缓存或兜底(供首帧),后台再拉新版更新缓存(下次进入生效)。
export function getVaccineDataSync(): VaccineData {
  return readCache() ?? VACCINE_FALLBACK;
}

// 后台刷新:拉 OSS,版本不同则写缓存。失败静默(继续用缓存/兜底)。
export async function refreshVaccineData(): Promise<void> {
  try {
    const res = await fetch(OSS_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    if (!isVaccineData(data)) return;
    const current = readCache();
    if (!current || current.version !== data.version) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    /* 离线/跨域/失败:保持缓存或兜底 */
  }
}
```

- [ ] **Step 2: 构建确认编译**

Run: `npm run build`
Expected: `✓ built`,无 `error TS`。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/vaccineData.ts
git commit -m "feat(vaccine): 数据层 vaccineData(OSS 拉取 + localStorage 缓存 + 内置兜底)"
```

---

## Task 4: profile 加字段 + 保留(关键:别被 normalize 抹掉)

**Files:** Modify `frontend/src/types.ts`, `frontend/src/appStateDomain.ts`

- [ ] **Step 1: `types.ts` 给 `BabyProfile` 加两字段**

在 `frontend/src/types.ts` 的 `BabyProfile` 接口(约 :108-122)末尾(`caregivers: string[];` 之后)加:
```typescript
  vaccineRegion?: string; // 接种地省码:national/BJ/SH/GD/ZJ/JS
  vaccineRecords?: { doseId: string; date: string }[]; // 已接种记录
```

- [ ] **Step 2: `normalizeBabyProfile` 保留新字段**(否则每次加载被抹掉)

在 `frontend/src/appStateDomain.ts` 找到 `normalizeBabyProfile`(grep `export const normalizeBabyProfile` 或 `function normalizeBabyProfile`),在它**返回的对象里**补上:
```typescript
    vaccineRegion: typeof source.vaccineRegion === "string" ? source.vaccineRegion : undefined,
    vaccineRecords: Array.isArray(source.vaccineRecords)
      ? source.vaccineRecords
          .filter((r: unknown): r is { doseId: string; date: string } =>
            !!r && typeof (r as { doseId?: unknown }).doseId === "string" && typeof (r as { date?: unknown }).date === "string")
          .map((r) => ({ doseId: r.doseId, date: r.date }))
      : [],
```
(`source` 是该函数里被规整的入参对象名;若叫别的名按实际改。)

- [ ] **Step 3: 构建确认编译**

Run: `npm run build`
Expected: `✓ built`,无 `error TS`。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/types.ts frontend/src/appStateDomain.ts
git commit -m "feat(vaccine): BabyProfile 加 vaccineRegion/vaccineRecords 并在 normalize 里保留"
```

---

## Task 5: 清单页 + 省份选择 + 入口 + App 接线

**Files:** Create `frontend/src/views/VaccineView.tsx`, `frontend/src/components/RegionPicker.tsx`; Modify `frontend/src/styles/mobile-app.css`, `frontend/src/App.tsx`

- [ ] **Step 1: 省份选择** `frontend/src/components/RegionPicker.tsx`

```tsx
import { memo } from "react";
import type { RegionCode } from "../data/vaccineSchedule.fallback";

const REGIONS: { code: RegionCode; label: string }[] = [
  { code: "national", label: "全国(仅一类)" },
  { code: "BJ", label: "北京" }, { code: "SH", label: "上海" }, { code: "GD", label: "广东" },
  { code: "ZJ", label: "浙江" }, { code: "JS", label: "江苏" },
];

export const RegionPicker = memo(function RegionPicker({ value, onChange, disabled }: {
  value: RegionCode; onChange: (code: RegionCode) => void; disabled?: boolean;
}) {
  return (
    <div className="vaccine-region">
      <span className="vaccine-region__label">接种地</span>
      <div className="vaccine-region__chips">
        {REGIONS.map((r) => (
          <button key={r.code} type="button" disabled={disabled}
            className={`vaccine-region__chip${value === r.code ? " on" : ""}`}
            onClick={() => onChange(r.code)}>{r.label}</button>
        ))}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: 清单页** `frontend/src/views/VaccineView.tsx`(照 MilestonesView)

```tsx
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { getVaccineDataSync } from "../vaccineData";
import { computeDoseStatus, pendingCount, vaccineDosesForRegion } from "../vaccineStatus";
import type { DoseStatus, RegionCode, VaccineDose } from "../data/vaccineSchedule.fallback";
import { RegionPicker } from "../components/RegionPicker";
import { monthsBetween } from "../utils/babyAge";
import type { BabyProfile } from "../types";

const STATUS_LABEL: Record<DoseStatus, string> = {
  done: "已接种", overdue: "已过期·建议补", closing: "窗口将过·尽快约", due: "现在可约", upcoming: "还没到",
};
const STATUS_ORDER: Record<DoseStatus, number> = { closing: 0, overdue: 1, due: 2, upcoming: 3, done: 4 };

export type VaccineViewProps = {
  profile: BabyProfile;
  canCaregive: boolean;
  onClose: () => void;
  onSetRegion: (code: RegionCode) => void;
  onToggleDose: (doseId: string, done: boolean) => void;
};

export function VaccineView({ profile, canCaregive, onClose, onSetRegion, onToggleDose }: VaccineViewProps) {
  const data = getVaccineDataSync();
  const region = (profile.vaccineRegion as RegionCode) || "national";
  const ageMonths = useMemo(() => monthsBetween(profile.birthDate) ?? null, [profile.birthDate]);
  const doneById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of profile.vaccineRecords ?? []) map.set(r.doseId, r.date);
    return map;
  }, [profile.vaccineRecords]);

  const rows = useMemo(() => {
    const doses = vaccineDosesForRegion(data.doses, region);
    const withStatus = doses.map((dose) => {
      const doneDate = doneById.get(dose.id) ?? null;
      const status = computeDoseStatus({ ageMonths, ageMonthMin: dose.ageMonthMin, ageMonthMax: dose.ageMonthMax, doneDate });
      return { dose, status, doneDate };
    });
    withStatus.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dose.ageMonthMin - b.dose.ageMonthMin);
    return withStatus;
  }, [data, region, ageMonths, doneById]);

  const pending = pendingCount(rows.map((r) => r.status));
  const priceText = (dose: VaccineDose): string => {
    if (dose.klass !== "optional") return "";
    const ps = data.prices.filter((p) => p.doseVaccine === dose.vaccine && (p.region === region || p.region === "national"));
    if (!ps.length) return "咨询接种点";
    return ps.map((p) => `¥${p.price}${p.tier === "domestic" ? "(国产)" : p.tier === "imported" ? "(进口)" : ""}`).join(" / ");
  };

  return (
    <section className="vaccine-screen" aria-label="疫苗接种清单">
      <div className="milestone-head">
        <button type="button" className="milestone-back" onClick={onClose} aria-label="返回"><ChevronLeft size={20} /></button>
        <div><p className="eyebrow">疫苗接种</p><h2>{profile.nickname || "小宝"}的接种清单</h2></div>
      </div>

      <RegionPicker value={region} onChange={onSetRegion} disabled={!canCaregive} />

      <div className="vaccine-summary">
        <span>{profile.birthDate ? `当前月龄约 ${ageMonths ?? "-"} 月` : "未设生日,仅作参考"}</span>
        {pending > 0 ? <span className="vaccine-summary__pending">本阶段 {pending} 针待安排</span> : null}
      </div>

      <p className="milestone-disclaimer"><ShieldAlert size={14} />
        <span>本清单仅供参考,各地程序与价格略有差异,以当地接种点 / 居住地疾控安排为准,不构成医疗建议。</span></p>

      <div className="vaccine-list">
        {rows.map(({ dose, status, doneDate }) => (
          <article key={dose.id} className={`vaccine-card ${status} klass-${dose.klass}`}>
            <div className="vaccine-card__main">
              <div className="vaccine-card__head">
                <span className="vaccine-card__name">{dose.vaccine} · 第{dose.doseNo}剂</span>
                <span className="vaccine-card__tag">{dose.klass === "nip" || dose.klass === "provincial" ? "免费" : "自费"}</span>
              </div>
              <p className="vaccine-card__intro">{dose.intro}</p>
              <div className="vaccine-card__meta">
                <span>{dose.ageMonthMin}-{dose.ageMonthMax} 月龄</span>
                <span className={`vaccine-card__status ${status}`}>{STATUS_LABEL[status]}{status === "done" && doneDate ? ` · ${doneDate}` : ""}</span>
                {dose.klass === "optional" ? <span className="vaccine-card__price">{priceText(dose)}</span> : null}
              </div>
            </div>
            {canCaregive ? (
              <button type="button" className={`vaccine-card__cta${status === "done" ? " undo" : ""}`}
                onClick={() => onToggleDose(dose.id, status !== "done")}>
                {status === "done" ? "撤销" : "已接种"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 样式追加** 到 `frontend/src/styles/mobile-app.css` 末尾

```css
/* 疫苗接种清单 */
.vaccine-screen { padding: 16px 16px calc(env(safe-area-inset-bottom) + 16px); }
.vaccine-region { display: grid; gap: 8px; margin: 8px 0 12px; }
.vaccine-region__label { font-size: 12px; color: var(--muted, #7d8585); }
.vaccine-region__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.vaccine-region__chip { border: 1px solid var(--line, #eadfd0); border-radius: 999px; padding: 6px 12px; font-size: 12px; background: #fff; color: var(--ink, #2d3137); }
.vaccine-region__chip.on { background: #4d7d60; color: #fff; border-color: #4d7d60; }
.vaccine-summary { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; color: var(--muted, #7d8585); margin-bottom: 8px; }
.vaccine-summary__pending { color: #d9543c; font-weight: 600; }
.vaccine-list { display: grid; gap: 10px; }
.vaccine-card { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--line, #eadfd0); border-radius: 14px; background: #fffdf8; }
.vaccine-card.overdue, .vaccine-card.closing { border-color: rgba(236, 143, 125, 0.7); background: #fff6ef; }
.vaccine-card.done { opacity: 0.7; }
.vaccine-card__main { flex: 1; min-width: 0; }
.vaccine-card__head { display: flex; align-items: center; gap: 8px; }
.vaccine-card__name { font-size: 15px; font-weight: 600; color: var(--ink, #2d3137); }
.vaccine-card__tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: rgba(77,125,96,0.12); color: #4d7d60; }
.vaccine-card.klass-optional .vaccine-card__tag { background: rgba(223,169,71,0.16); color: #b07d18; }
.vaccine-card__intro { margin: 3px 0 4px; font-size: 12px; color: var(--muted, #7d8585); }
.vaccine-card__meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11.5px; color: var(--muted, #7d8585); }
.vaccine-card__status.due, .vaccine-card__status.closing, .vaccine-card__status.overdue { color: #d9543c; font-weight: 600; }
.vaccine-card__status.done { color: #4d7d60; }
.vaccine-card__price { color: #b07d18; }
.vaccine-card__cta { flex: none; border: 0; border-radius: 12px; padding: 9px 15px; font-size: 13px; font-weight: 600; background: #4d7d60; color: #fff; }
.vaccine-card__cta.undo { background: transparent; border: 1px solid rgba(120,95,60,0.2); color: #6b6354; }
```

- [ ] **Step 4: App 接线** `frontend/src/App.tsx`

(a) import 区加:
```typescript
import { VaccineView } from "./views/VaccineView";
import type { RegionCode } from "./data/vaccineSchedule.fallback";
import { refreshVaccineData } from "./vaccineData";
```
(b) 与 `milestonesViewOpen` 同处加开关 + 处理器(放 `closeMilestones`(:5427)附近):
```typescript
const [vaccineViewOpen, setVaccineViewOpen] = useState(false);
const openVaccine = useCallback(() => { setActiveMobileTab("records"); setRecordsAssistantOpen(false); setVaccineViewOpen(true); }, []);
const closeVaccine = useCallback(() => setVaccineViewOpen(false), []);
const setVaccineRegion = useCallback((code: RegionCode) => {
  const next = { ...profile, vaccineRegion: code };
  setProfile(() => next);
  void persistRecord("profile", "default", next, { applyResponse: true }).catch(() => setStorageStatus("offline"));
}, [profile]);
const toggleVaccineDose = useCallback((doseId: string, done: boolean) => {
  if (!canCaregive) return;
  const rest = (profile.vaccineRecords ?? []).filter((r) => r.doseId !== doseId);
  const records = done ? [...rest, { doseId, date: todayISO() }] : rest;
  const next = { ...profile, vaccineRecords: records };
  setProfile(() => next);
  void persistRecord("profile", "default", next, { applyResponse: true }).catch(() => setStorageStatus("offline"));
  hapticSuccess();
}, [profile, canCaregive]);
```
(c) 启动刷新 OSS 数据(放任一现有顶层 useEffect 旁):
```typescript
useEffect(() => { void refreshVaccineData(); }, []);
```
(d) 全屏挂载:在 `milestonesViewOpen ? (<MilestonesView .../>)` 那条链(:7758)里,`milestonesViewOpen` 分支**之前**加一支:
```tsx
) : vaccineViewOpen ? (
  <VaccineView profile={profile} canCaregive={canCaregive} onClose={closeVaccine}
    onSetRegion={setVaccineRegion} onToggleDose={toggleVaccineDose} />
```
(e) 入口按钮:在「成长观察」按钮(:8627)**之后**加一个同款:
```tsx
<button type="button" className="growth-observation-row" onClick={openVaccine}>
  <span className="growth-observation-icon" aria-hidden="true"><Syringe size={16} /></span>
  <span className="growth-observation-copy"><strong>疫苗接种</strong><small>按月龄看该打哪些苗,别漏别晚</small></span>
  <ChevronRight size={16} aria-hidden="true" />
</button>
```
(`Syringe`/`ChevronRight` 已在 App.tsx import,沿用。)

- [ ] **Step 5: 构建**

Run: `npm run build`
Expected: `✓ built` 无 `error TS`。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/VaccineView.tsx frontend/src/components/RegionPicker.tsx frontend/src/styles/mobile-app.css frontend/src/App.tsx
git commit -m "feat(vaccine): 清单页 + 省份选择 + 入口 + App 接线(读写 profile,启动刷新 OSS)"
```

---

## Task 6: DOM smoke

**Files:** Create `scripts/test-vaccine-view.mjs`; Modify `package.json`

- [ ] **Step 1: 写测试** `scripts/test-vaccine-view.mjs`(照 test-core-flows / test-feeding-alarm 套路)

```javascript
#!/usr/bin/env node
// 疫苗清单 DOM smoke:入口打开清单 → 选省叠加增补 → 打钩"已接种"→ 状态变 + 持久化到 profile。
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.VACCINE_PORT || 4335);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
// 宝宝 3 月龄左右 → 百白破第1剂(2-3月)应"现在可约/将过"
const birthISO = new Date(Date.now() - 95 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const appState = {
  profile: { nickname: "小宝", stage: "born", gender: "unknown", expectedDate: "", birthDate: birthISO, region: "", feeding: "", allergies: [], caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [], reminders: [], memories: [], pendingEffects: [], expenses: [], albumItems: [],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};
const liveState = JSON.parse(JSON.stringify(appState));
const upserts = [];
function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}
async function waitForServer(url, t = 30000) { const s = Date.now(); while (Date.now() - s < t) { try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {} await new Promise((r) => setTimeout(r, 400)); } throw new Error("server not ready"); }
async function installMocks(page) {
  await page.addInitScript(() => { window.localStorage.setItem("baby-companion-auth-token", "vac-token"); window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true)); });
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" }, family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true }, authenticated: true, onboardingRequired: false }) });
    if (url.pathname === "/api/app/state") return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: liveState }) });
    if (url.pathname === "/api/pro/usage") return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, byFeature: [], byModel: [] }) });
    if (url.pathname === "/api/auth/family/members") return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    const up = url.pathname.match(/^\/api\/app\/state\/([a-zA-Z]+)\/([^/]+)$/);
    if (up && req.method() === "PUT") {
      const [, collection, id] = up; const body = JSON.parse(req.postData() || "{}");
      upserts.push({ collection, id: decodeURIComponent(id), body });
      if (collection === "profile") liveState.profile = body;
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

  await page.getByRole("button", { name: "疫苗接种" }).first().click();
  const screen = page.locator(".vaccine-screen");
  await screen.waitFor({ state: "visible", timeout: 6000 });
  assert.ok(await screen.getByText("接种清单").first().isVisible(), "清单页应打开");
  assert.ok((await page.locator(".vaccine-card").count()) >= 5, "应渲染多条疫苗");
  console.log("[VAC1] entry opens vaccine checklist ✔");

  // 选北京 → 出现"水痘"省级增补
  await page.locator(".vaccine-region__chip", { hasText: "北京" }).click();
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(await page.getByText("水痘", { exact: false }).first().isVisible(), "选北京应叠加水痘增补");
  console.log("[VAC2] region overlay adds provincial dose ✔");

  // 给第一针打钩 → PUT profile 带 vaccineRecords
  await page.locator(".vaccine-card__cta", { hasText: "已接种" }).first().click();
  await new Promise((r) => setTimeout(r, 500));
  const profUpsert = [...upserts].reverse().find((u) => u.collection === "profile");
  assert.ok(profUpsert && Array.isArray(profUpsert.body.vaccineRecords) && profUpsert.body.vaccineRecords.length >= 1, "打钩应写入 profile.vaccineRecords");
  assert.equal(profUpsert.body.vaccineRegion, "BJ", "省份应持久化为 BJ");
  console.log("[VAC3] check-off persists to profile.vaccineRecords + region ✔");

  console.log("vaccine checklist DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
```

- [ ] **Step 2: 构建后跑测试确认通过**

Run: `npm run build && node scripts/test-vaccine-view.mjs`
Expected: `[VAC1]` `[VAC2]` `[VAC3]` + `vaccine checklist DOM smoke tests passed`。

- [ ] **Step 3: 注册** `package.json` 加 `"test:vaccine-view": "node scripts/test-vaccine-view.mjs",` 挂进 `verify:frontend` 末尾(` && npm run test:vaccine-view`)。

- [ ] **Step 4: 提交**

```bash
git add scripts/test-vaccine-view.mjs package.json
git commit -m "test(vaccine): DOM smoke——入口/省份叠加/打钩持久化到 profile"
```

---

## Task 7: 全量验证 + OSS 数据上传 + 内容任务

**Files:** Create `scripts/upload-vaccine-data.mjs`(ops);内容任务

- [ ] **Step 1: 全量前端验证**

Run: `npm run verify:frontend`
Expected: 既有用例全绿 + `vaccine fallback dataset tests passed` + `vaccine status tests passed` + `vaccine checklist DOM smoke tests passed`。贴真实输出。

- [ ] **Step 2: 真机/预览自查**(手动)
- 入口「疫苗接种」打开清单;切省份增补条目增减;打钩"已接种"→ 状态变 done、角标 N 减 1;无生日时降级为纯参考;某二类缺价显「咨询接种点」。

- [ ] **Step 3: OSS 数据上传脚本**(ops/内容任务) `scripts/upload-vaccine-data.mjs`

把 `frontend/src/data/vaccine-data.json`(由内容任务产出的完整数据)以**公开读**上传到 OSS `baby-companion/data/vaccine-data.json`,复用 `upload-mobile-update-oss.sh` 的 OSS 凭据/客户端机制(同一 bucket/endpoint,ACL=public-read)。首版未上传也不影响——前端用内置兜底。

- [ ] **Step 4: 内容任务(发布前补全)**
1. **疫苗程序**:把 `vaccineSchedule.fallback.ts` 扩成完整一类 + 5 省增补 + 全二类,**核对官方 2025 程序**(百白破新程序),标 `asOf`;同步产出首版 `vaccine-data.json` 上 OSS。
2. **各省二类价格**:**先验证 5 省价格来源/可得性**;拿不到精确的该苗留空 → UI 自动显「咨询接种点」。**只用可核实来源,标日期。**

- [ ] **Step 5: 发 OTA**(纯前端;严格按 `AGENTS.md`)

```bash
VERSION="0.1.0-$(date +%Y%m%d%H%M%S)"
VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_VERSION="$VERSION" npm run build:mobile:update
grep -r "localhost:8080" dist/assets/ | wc -l   # 必须 0
```
再 OSS 上传 + 同步 manifest + 校验(见 `docs/ops/mobile-updates.md`)。**不发原生包、不动后端。**

---

## Self-Review

- **Spec 覆盖**:一类/省增补/二类(Task 1 数据 + Task 5 分区显示)✓;5 态窗口(Task 2)✓;打钩追踪→profile(Task 4/5)✓;入口角标"本阶段N针"(Task 2 `pendingCount` + Task 5)✓;OSS+兜底+缓存(Task 3)✓;省份选择→profile(Task 5)✓;各省精确价 + 缺价"咨询接种点"(Task 5 `priceText`)✓;免责(Task 5)✓;纯 OTA 零后端(Task 4 复用 profile JSON + Task 7)✓。非目标(详情页/推送/>5省)未做。
- **占位扫描**:无 TODO/TBD 当占位;`fallback` 数据集是"代表性样例 + 内容任务补全",已显式标注(Task 1/7),非代码占位。`normalizeBabyProfile` 的 `source` 形参名标了"按实际改"。
- **类型一致**:`VaccineDose/VaccinePrice/VaccineData/DoseStatus/RegionCode` 在 Task 1 定义,Task 2/3/5 一致引用;`computeDoseStatus({ageMonths,ageMonthMin,ageMonthMax,doneDate})` 签名 Task 2 定义、测试与 View 调用一致;`vaccineDosesForRegion(doses,region)`、`pendingCount(statuses)` 一致;`profile.vaccineRegion/vaccineRecords` 在 Task 4 定义、Task 5 读写一致;`VaccineViewProps`(onClose/onSetRegion/onToggleDose)Task 5 定义并由 App 提供一致。
