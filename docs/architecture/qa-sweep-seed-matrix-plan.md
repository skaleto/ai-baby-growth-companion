# 验收巡检 · Seed-Matrix Driver 实现计划(ROI #2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 勾选。

**Goal:** 在 `scripts/qa-sweep/` 建一套自包含验收驱动 harness——按「4 种子 × 4 视口(首版子集:桌面+SE+13+Pixel,可扩到 smoke 的 7 视口)」用 Playwright + vite preview + mock 后端真实跑 app,采集 截图/DOM/console/network/状态快照,并跑每种子的确定性断言;为后续 LLM 视觉层产出截图语料。

**Architecture:** 不动生产 `frontend-smoke.mjs`,只借鉴其模式。新 harness 自带 preview 启动 + 按种子参数化的 mock 安装。种子矩阵是纯数据(可 node 单测);驱动是集成脚本(跑通即验证)。这是 app-acceptance-sweep 设计(记忆 `app-acceptance-sweep-design`,Claude×Codex 定稿)4 层 oracle 的第①层。

**Tech Stack:** Node ESM、Playwright(chromium)、vite preview、esbuild(纯模块单测沿用仓库范式)。

**设计来源:** 记忆 `app-acceptance-sweep-design`;ROI #1 已落地 `scripts/qa-sweep/plan-from-inventory.mjs`。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `scripts/qa-sweep/seed-matrix.mjs` | 纯数据:导出 4 个种子 `{label, appState, authMe, expect}` | 新建 |
| `scripts/test-qa-seed-matrix.mjs` | seed-matrix 结构单测(esbuild 无关,直接 import) | 新建 |
| `scripts/qa-sweep/harness.mjs` | 自包含:`startPreview`/`waitForServer`/`installMocks(page,seed)`/`VIEWPORTS`/`captureArtifacts` | 新建 |
| `scripts/qa-sweep/assertions.mjs` | 4 个按种子断言函数,返回 findings 数组(不硬崩) | 新建 |
| `scripts/qa-sweep/acceptance-driver.mjs` | 主驱动:遍历 种子×视口 → 导航主屏 → 落 artifact → 跑断言 → 出摘要 JSON | 新建 |
| `package.json` | 加 `qa:sweep` | 修改 |
| `.gitignore` | 确认 `.verification/` 已忽略(产物不入库) | 核对 |

**不动:** `scripts/frontend-smoke.mjs`(生产冒烟,保持独立)。

---

## Task 1: 种子矩阵 `seed-matrix.mjs`(纯数据,TDD)

**Files:** Create `scripts/qa-sweep/seed-matrix.mjs`, `scripts/test-qa-seed-matrix.mjs`; Modify `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-qa-seed-matrix.mjs`

```javascript
#!/usr/bin/env node
import assert from "node:assert/strict";
import { SEEDS } from "./qa-sweep/seed-matrix.mjs";

const byLabel = Object.fromEntries(SEEDS.map((s) => [s.label, s]));
assert.deepEqual(
  SEEDS.map((s) => s.label).sort(),
  ["caregiver-empty", "caregiver-rich", "free-quota-exhausted", "viewer-readonly"],
  "应有 4 个种子",
);
for (const s of SEEDS) {
  assert.ok(s.appState && s.appState.profile, `${s.label}: 有 appState.profile`);
  assert.ok(s.authMe && s.authMe.member, `${s.label}: 有 authMe.member`);
  assert.ok(s.expect && typeof s.expect === "object", `${s.label}: 有 expect 期望`);
}
// 富:照护人 + 有数据
assert.equal(byLabel["caregiver-rich"].authMe.member.caregiver, true, "rich=照护人");
assert.ok(byLabel["caregiver-rich"].appState.careLogs.length > 0, "rich 有 careLogs");
// 空:照护人 + 数组全空
assert.equal(byLabel["caregiver-empty"].authMe.member.caregiver, true, "empty=照护人");
for (const col of ["careLogs", "albumItems", "expenses", "reminders", "growthEvents"]) {
  assert.equal(byLabel["caregiver-empty"].appState[col].length, 0, `empty ${col} 为空`);
}
// 只读:有数据但 caregiver:false
assert.equal(byLabel["viewer-readonly"].authMe.member.caregiver, false, "viewer=仅查看");
assert.ok(byLabel["viewer-readonly"].appState.careLogs.length > 0, "viewer 仍有数据");
// 配额用尽
assert.equal(byLabel["free-quota-exhausted"].appState.proTrial.freeCallsRemaining, 0, "配额=0");
assert.equal(byLabel["free-quota-exhausted"].appState.proTrial.enabled, false, "非 Pro");
console.log("qa seed matrix tests passed");
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-qa-seed-matrix.mjs`
Expected: FAIL(找不到 `seed-matrix.mjs`)。

- [ ] **Step 3: 写实现** `scripts/qa-sweep/seed-matrix.mjs`

```javascript
// 4 个验收种子:富/空/只读/配额用尽。appState 喂 /api/app/state,authMe 喂 /api/auth/me。
// expect 是给断言层的期望摘要(此处仅声明,断言逻辑在 assertions.mjs)。
const baseProfile = {
  nickname: "小宝", stage: "born", gender: "girl", expectedDate: "", birthDate: "2026-02-01",
  region: "上海", feeding: "混合喂养", allergies: ["暂未发现"], caregivers: ["妈妈", "爸爸"],
};
const richState = {
  profile: { ...baseProfile },
  messages: [{ id: "m1", role: "ai", text: "今天宝宝状态不错。", createdAt: "2026-06-01T08:00:00.000Z", tags: [] }],
  growthEvents: [{ id: "g1", type: "first_smile", title: "第一次笑出声", date: "2026-05-12", firstTime: true, tags: ["里程碑"] }],
  growthMeasurements: [{ id: "gm1", type: "height", value: 66.5, date: "2026-05-12", note: "体检", recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  careLogs: [{ id: "c1", date: "2026-06-01", milkMl: 600, milkTimes: 6, sleepHours: 13, wakes: 2, soothing: "normal", solids: [], notes: [], events: [{ id: "e1", type: "milk", date: "2026-06-01", time: "08:10", title: "喝奶", amountMl: 110, tags: ["喝奶"], recordedBy: { label: "妈妈", roleName: "妈妈" } }], recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  reminders: [{ id: "r1", title: "晚间洗澡", dueText: "每天 20:00", category: "routine", recurrence: "daily", status: "open", createdAt: "2026-06-01T00:00:00.000Z", history: [] }],
  memories: [], pendingEffects: [],
  albumItems: [{ id: "a1", kind: "media", title: "冒烟视频", date: "2026-06-01", occurredAt: "2026-06-01T08:20:00.000Z", category: "growth", tags: [], attachmentId: "att1", attachment: { id: "att1", name: "v.mp4", kind: "video", url: "/api/uploads/att1", mimeType: "video/mp4", createdAt: "2026-06-01T08:20:00.000Z" }, source: "manual", recordedBy: { label: "爸爸", roleName: "爸爸" } }],
  expenses: [{ id: "x1", title: "奶粉", amount: 268, currency: "CNY", category: "formula", date: "2026-06-01", attachmentIds: [], attachments: [], source: "manual", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z", recordedBy: { label: "妈妈", roleName: "妈妈" } }],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: false, entitlement: { enabled: false }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: 8 },
};
const emptyState = {
  ...richState,
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [], reminders: [], albumItems: [], expenses: [],
};
const caregiverMe = { roleName: "妈妈", caregiver: true };
const viewerMe = { roleName: "家人", caregiver: false };
const authMe = (member) => ({
  user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
  family: { id: "f1", name: "小宝家" }, member, authenticated: true, onboardingRequired: false,
});

export const SEEDS = [
  { label: "caregiver-rich", appState: clone(richState), authMe: authMe(caregiverMe), expect: { dataVisible: true, canWrite: true } },
  { label: "caregiver-empty", appState: clone(emptyState), authMe: authMe(caregiverMe), expect: { emptyStates: true, canWrite: true } },
  { label: "viewer-readonly", appState: clone(richState), authMe: authMe(viewerMe), expect: { canWrite: false, chatHidden: true } },
  { label: "free-quota-exhausted", appState: { ...clone(richState), proTrial: { enabled: false, entitlement: { enabled: false }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: 0 } }, authMe: authMe(caregiverMe), expect: { quotaExhausted: true } },
];

function clone(x) { return JSON.parse(JSON.stringify(x)); }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-qa-seed-matrix.mjs`
Expected: PASS `qa seed matrix tests passed`。

- [ ] **Step 5: 注册** `package.json` 加 `"test:qa-seed-matrix": "node scripts/test-qa-seed-matrix.mjs",`(放 `qa:plan` 旁)。

- [ ] **Step 6: 提交**

```bash
git add scripts/qa-sweep/seed-matrix.mjs scripts/test-qa-seed-matrix.mjs package.json
git commit -m "feat(qa-sweep): seed 矩阵(富/空/只读/配额用尽)+ 结构单测"
```

---

## Task 2: 驱动 harness `harness.mjs`

**Files:** Create `scripts/qa-sweep/harness.mjs`

- [ ] **Step 1: 写实现** `scripts/qa-sweep/harness.mjs`

> 自包含:启动 vite preview、按种子装 mock(回写 PUT 到内存 state 并记录 upserts)、视口列表、采集 artifact。

```javascript
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "iphone-se-375x667", width: 375, height: 667, mobile: true },
  { name: "iphone-13-390x844", width: 390, height: 844, mobile: true },
  { name: "android-pixel-412x915", width: 412, height: 915, mobile: true },
];

export function startPreview(port, host = "127.0.0.1") {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { child, stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}

export async function waitForServer(url, timeoutMs = 30000) {
  const s = Date.now();
  while (Date.now() - s < timeoutMs) { try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {} await new Promise((r) => setTimeout(r, 400)); }
  throw new Error("preview server not ready: " + url);
}

// 按种子装 mock。返回 ctx:{ upserts, consoleErrors, pageErrors, requests, state }。
export async function installMocks(page, seed) {
  const state = JSON.parse(JSON.stringify(seed.appState));
  const ctx = { upserts: [], consoleErrors: [], pageErrors: [], requests: [], state };
  page.on("console", (m) => { if (m.type() === "error") ctx.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => ctx.pageErrors.push(e.message));
  page.on("requestfinished", (req) => { const u = new URL(req.url()); if (u.pathname.startsWith("/api/")) ctx.requests.push({ method: req.method(), path: u.pathname }); });
  await page.addInitScript(() => { window.localStorage.setItem("baby-companion-auth-token", "qa-token"); window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true)); });
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify(seed.authMe) });
    if (url.pathname === "/api/app/state" && req.method() !== "PUT") return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state }) });
    if (url.pathname === "/api/pro/usage") return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, byFeature: [], byModel: [] }) });
    if (url.pathname === "/api/auth/family/members") return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: seed.authMe.member.roleName, caregiver: seed.authMe.member.caregiver, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    const up = url.pathname.match(/^\/api\/app\/state\/([a-zA-Z]+)\/([^/]+)$/);
    if (up && req.method() === "PUT") {
      const [, collection, id] = up; const body = JSON.parse(req.postData() || "{}");
      ctx.upserts.push({ collection, id: decodeURIComponent(id), body });
      if (collection === "profile") state.profile = body; else if (Array.isArray(state[collection])) { state[collection] = [...state[collection].filter((e) => e?.id !== id), { ...body, id }]; }
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state }) });
  });
  return ctx;
}

export async function captureArtifacts(page, seedLabel, viewportName, ctx) {
  const dir = path.join(rootDir, ".verification/acceptance", seedLabel, viewportName);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, "screen.png"), fullPage: false });
  const html = await page.content();
  await writeFile(path.join(dir, "dom.html"), html);
  await writeFile(path.join(dir, "trace.json"), JSON.stringify({ consoleErrors: ctx.consoleErrors, pageErrors: ctx.pageErrors, requests: ctx.requests, upserts: ctx.upserts, state: ctx.state }, null, 2));
  return dir;
}
```

- [ ] **Step 2: 一次性自检 harness 能启动 + 截图**(临时脚本,验证后删)

Run:
```bash
node --input-type=module -e '
import { chromium } from "playwright";
import { SEEDS } from "./scripts/qa-sweep/seed-matrix.mjs";
import { startPreview, waitForServer, installMocks, captureArtifacts, VIEWPORTS } from "./scripts/qa-sweep/harness.mjs";
const srv = startPreview(4360); let b;
try {
  await waitForServer("http://127.0.0.1:4360");
  b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const ctx = await installMocks(page, SEEDS[0]);
  await page.goto("http://127.0.0.1:4360", { waitUntil: "networkidle" });
  await page.waitForSelector("main.app-shell", { timeout: 15000 });
  const dir = await captureArtifacts(page, "caregiver-rich", "iphone-13-390x844", ctx);
  console.log("harness 自检 OK,artifact:", dir);
} finally { if (b) await b.close(); await srv.stop(); }
'
```
Expected: 打印 `harness 自检 OK,artifact: ...`;`.verification/acceptance/caregiver-rich/iphone-13-390x844/` 下有 screen.png/dom.html/trace.json。**先 `npm run build` 一次**(preview 需要 dist)。

- [ ] **Step 3: 提交**

```bash
git add scripts/qa-sweep/harness.mjs
git commit -m "feat(qa-sweep): 驱动 harness(preview+按种子 mock+多视口+artifact 采集)"
```

---

## Task 3: 按种子断言 `assertions.mjs`

**Files:** Create `scripts/qa-sweep/assertions.mjs`

> 每个断言函数 `async (page, ctx) => Finding[]`。Finding=`{seed, check, ok, detail}`。**不抛异常**,失败记 `ok:false`,让驱动跑完所有种子再汇总。导航到目标 tab 用稳定的 `getByRole("button",{name})`(底部 Tab 复用 frontend-smoke 的 `.last()` 套路)。

- [ ] **Step 1: 写实现** `scripts/qa-sweep/assertions.mjs`

```javascript
const F = (seed, check, ok, detail = "") => ({ seed, check, ok, detail });

async function gotoTab(page, name) {
  await page.getByRole("button", { name }).last().click();
  await page.waitForTimeout(150);
}
async function visibleText(page, re) {
  try { return await page.getByText(re).first().isVisible({ timeout: 2000 }); } catch { return false; }
}

// 富:数据渲染 + 无 console 错 + 无溢出(溢出由驱动的 checkLayout 兜,这里查数据可见)
export async function assertRich(page, ctx) {
  const out = [];
  await gotoTab(page, "账本");
  out.push(F("caregiver-rich", "账本-数据可见", await visibleText(page, /奶粉|268/), "种子里有一笔奶粉支出"));
  await gotoTab(page, "记录");
  out.push(F("caregiver-rich", "无页面级 JS 错误", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ")));
  return out;
}

// 空:主要 tab 显示空态文案(暂无/还没有 之类),不崩
export async function assertEmpty(page, ctx) {
  const out = [];
  await gotoTab(page, "记录");
  const recordsEmpty = await visibleText(page, /还没有|暂无|先记一笔|先记录/);
  out.push(F("caregiver-empty", "记录-空态文案", recordsEmpty, "空数据应显示引导而非崩溃"));
  await gotoTab(page, "账本");
  out.push(F("caregiver-empty", "账本-空态不崩", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ")));
  return out;
}

// 只读:对话 tab 隐藏 + 写入入口不可见(抽查)
export async function assertViewer(page, ctx) {
  const out = [];
  // 对话 tab:照护人才有;仅查看应无。用 button 名「对话」是否存在判断。
  const chatBtnCount = await page.getByRole("button", { name: "对话" }).count();
  out.push(F("viewer-readonly", "对话入口隐藏", chatBtnCount === 0, `对话按钮数=${chatBtnCount}(应为 0)`));
  await gotoTab(page, "账本");
  const addExpense = await page.getByRole("button", { name: /记一笔支出|记一笔/ }).count();
  out.push(F("viewer-readonly", "账本写入入口隐藏", addExpense === 0, `记一笔按钮数=${addExpense}(应为 0)`));
  out.push(F("viewer-readonly", "仅查看无写入 PUT", ctx.upserts.length === 0, `upserts=${ctx.upserts.length}(只读不应产生写入)`));
  return out;
}

// 配额用尽:剩余 0 次的提示出现(在「我的」页查剩余次数指示)
export async function assertQuota(page, ctx) {
  const out = [];
  await gotoTab(page, "我的");
  // 注:执行时若文案不符,跑一次看真实 copy 再调下面正则(这是确定性断言,不是占位)。
  const quotaHint = await visibleText(page, /剩余\s*0|0\s*次|免费次数.*0|额度|本月剩余/);
  out.push(F("free-quota-exhausted", "我的页-配额指示", quotaHint, "freeCallsRemaining=0 应有剩余次数/额度提示"));
  return out;
}

export const ASSERTIONS = {
  "caregiver-rich": assertRich,
  "caregiver-empty": assertEmpty,
  "viewer-readonly": assertViewer,
  "free-quota-exhausted": assertQuota,
};
```

- [ ] **Step 2: (无独立测试)** 断言函数依赖真实 page,放到 Task 4 驱动里整体验证。提交:

```bash
git add scripts/qa-sweep/assertions.mjs
git commit -m "feat(qa-sweep): 按种子确定性断言(富/空/只读/配额)"
```

---

## Task 4: 主驱动 `acceptance-driver.mjs`

**Files:** Create `scripts/qa-sweep/acceptance-driver.mjs`

- [ ] **Step 1: 写实现** `scripts/qa-sweep/acceptance-driver.mjs`

```javascript
#!/usr/bin/env node
// 验收驱动:种子 × 视口 真实跑 app,落 artifact + 跑断言,出摘要。先 npm run build。
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEEDS } from "./seed-matrix.mjs";
import { ASSERTIONS } from "./assertions.mjs";
import { rootDir, VIEWPORTS, startPreview, waitForServer, installMocks, captureArtifacts } from "./harness.mjs";

const port = Number(process.env.QA_SWEEP_PORT || 4360);
const baseUrl = `http://127.0.0.1:${port}`;
// 断言只在一个代表性手机视口跑一次(避免 4×4 重复);其余视口只取截图给视觉层。
const ASSERT_VIEWPORT = "iphone-13-390x844";
const TABS = ["记录", "相册", "账本", "我的"];

const srv = startPreview(port);
let browser; const findings = []; const errors = [];
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  for (const seed of SEEDS) {
    for (const vp of VIEWPORTS) {
      const ctx = await driveOne(seed, vp);
      if (vp.name === ASSERT_VIEWPORT) {
        try { findings.push(...(await ASSERTIONS[seed.label](ctx.page, ctx.mock))); }
        catch (e) { errors.push(`${seed.label} 断言异常: ${e.message}`); }
      }
      await ctx.context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await srv.stop();
}

const failed = findings.filter((f) => !f.ok);
const summary = { generatedAt: new Date().toISOString(), seeds: SEEDS.map((s) => s.label), viewports: VIEWPORTS.map((v) => v.name), total: findings.length, failed: failed.length, findings, errors };
const outDir = path.join(rootDir, ".verification/acceptance");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "sweep-summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(`\n验收巡检 driver:${SEEDS.length} 种子 × ${VIEWPORTS.length} 视口`);
console.log("─".repeat(56));
for (const f of findings) console.log(`  ${f.ok ? "✔" : "✗"} [${f.seed}] ${f.check}${f.ok ? "" : "  → " + f.detail}`);
if (errors.length) { console.log("\n驱动异常:"); errors.forEach((e) => console.log("  ! " + e)); }
console.log(`\n断言 ${findings.length} 条,失败 ${failed.length};摘要 + 截图语料见 .verification/acceptance/`);
process.exitCode = failed.length || errors.length ? 1 : 0;

async function driveOne(seed, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const mock = await installMocks(page, seed);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main.app-shell", { timeout: 15000 });
  await page.waitForTimeout(300);
  // 导航主屏各取一张截图(对话 tab 只读种子没有,容错)
  for (const tab of TABS) {
    try { await page.getByRole("button", { name: tab }).last().click(); await page.waitForTimeout(200); } catch {}
    await captureArtifacts(page, seed.label, `${vp.name}__${tab}`, mock).catch(() => {});
  }
  return { context, page, mock };
}
```

- [ ] **Step 2: 构建 + 跑驱动**

Run: `npm run build && node scripts/qa-sweep/acceptance-driver.mjs`
Expected:打印每条断言 ✔/✗ + 失败计数;`.verification/acceptance/<seed>/<viewport>__<tab>/` 下有截图语料;`sweep-summary.json` 生成。

> **执行注意(非占位)**:首跑若某断言 ✗,先打开对应 `.verification/acceptance/<seed>/.../screen.png` + `dom.html` **判断是「真 bug」还是「断言对 app 理解有误」**:
> - 真 bug → 记进巡检发现(这正是要抓的);
> - 断言写错(如配额/空态的真实文案与正则不符)→ 据真实 DOM 调 `assertions.mjs` 的正则/选择器,重跑至断言稳定。
> 目标是断言**真实反映 app 行为**,不是强行全绿。

- [ ] **Step 3: 提交**

```bash
git add scripts/qa-sweep/acceptance-driver.mjs
git commit -m "feat(qa-sweep): 主驱动——种子×视口真实跑+断言+截图语料+摘要"
```

---

## Task 5: 接线 `qa:sweep` + 收尾

**Files:** Modify `package.json`;核对 `.gitignore`

- [ ] **Step 1: 核对 `.gitignore` 含 `.verification/`**

Run: `git check-ignore .verification/acceptance/sweep-summary.json`
Expected:打印该路径(已忽略)。若没忽略,在 `.gitignore` 加一行 `.verification/`。

- [ ] **Step 2: `package.json` 加命令**

在 `"qa:plan"` 旁加:
```json
    "qa:sweep": "node scripts/qa-sweep/acceptance-driver.mjs",
```

- [ ] **Step 3: 全链路自检**

Run(依次):`node scripts/test-qa-seed-matrix.mjs`(种子单测应绿)→ `npm run build` → `npm run qa:sweep`(驱动跑出摘要)。贴每条真实输出。

- [ ] **Step 4: 提交**

```bash
git add package.json .gitignore
git commit -m "chore(qa-sweep): qa:sweep 命令 + 忽略 .verification 产物"
```

---

## Self-Review

- **Spec 覆盖**:4 种子(Task1)✓;harness 启动+按种子 mock+多视口+artifact(Task2)✓;状态快照=trace.json 的 upserts/state(Task2 installMocks 回写 + captureArtifacts 落盘)✓;按种子断言 富/空/只读/配额(Task3)✓;主驱动 种子×视口+截图语料+摘要(Task4)✓;qa:sweep(Task5)✓;不动 frontend-smoke ✓;.verification 忽略(Task5)✓;艰难处(AI 流式/原生)不在本 driver——交 plan-from-inventory 的 device-or-backend-gap(已 ROI#1 落地)✓。
- **占位扫描**:配额/空态断言正则标了「执行时按真实 copy 校准」——这是确定性断言 + 明确的"跑一次看真实 DOM 再调"步骤,非 TODO 占位。
- **类型一致**:`SEEDS[].{label,appState,authMe,expect}` Task1 定义,Task2/3/4 一致引用;`installMocks` 返回 `ctx{upserts,consoleErrors,pageErrors,requests,state}` Task2 定义、Task3/4 用 `ctx.pageErrors/ctx.upserts`;`ASSERTIONS[label]` Task3 定义、Task4 调用;`captureArtifacts(page,seedLabel,viewportName,ctx)` 签名 Task2/4 一致;`VIEWPORTS/startPreview/waitForServer` Task2 导出、Task4 导入。
- **已知边界**:断言只在一个代表视口跑(避免 4×7 重复),其余视口只产截图给视觉层——是刻意取舍,已在 driver 注释说明。
