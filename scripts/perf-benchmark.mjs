#!/usr/bin/env node
// 渲染性能基准(真实浏览器 + 4x CPU 节流模拟中端手机)。
// 同一把尺子量不同版本:--root 指向任一已构建的仓库副本(git worktree),对比即公平。
// 指标:冷启动可交互 / 相册首开 / 返回记录 / 相册二开(重挂载成本)/
//       输入 15 字符的卡顿(整树重渲染探针,D1 核心指标)/ 相册滚动长任务。
// 用法:node scripts/perf-benchmark.mjs --label=HEAD [--root=/path/to/tree] [--runs=3] [--port=4327]
// 输出:stdout 表格 + .verification/perf/<label>.json

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || "true"];
  }),
);
const mainRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const root = path.resolve(args.root || mainRoot);
const runs = Number(args.runs || 3);
const port = Number(args.port || 4327);
const label = args.label || path.basename(root);
const cpuThrottle = Number(args.cpu || 6);
const baseUrl = `http://127.0.0.1:${port}`;

assert.ok(fs.existsSync(path.join(root, "dist", "index.html")), `dist 未构建:${root}(先在该目录 npm run build)`);

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

// 600 项相册(含 54 视频)+ 聊天/照护/提醒/账本数据,把整棵树喂到真实体量。
const albumItems = [];
for (let i = 0; i < 600; i++) {
  const isVideo = i % 11 === 10;
  const month = String(1 + (i % 6)).padStart(2, "0");
  const day = String(1 + (i % 27)).padStart(2, "0");
  const ratios = [[1200, 1600], [1600, 1200], [1080, 1080], [900, 1600], [1600, 900]];
  const [w, h] = ratios[i % ratios.length];
  albumItems.push({
    id: `bench-item-${i}`,
    kind: "media",
    title: `第${i + 1}条记录`,
    date: `2026-${month}-${day}`,
    occurredAt: `2026-${month}-${day}T08:00:00.000Z`,
    category: "daily",
    tags: [],
    attachmentId: `bench-att-${i}`,
    attachment: {
      id: `bench-att-${i}`,
      name: isVideo ? `clip-${i}.mp4` : `photo-${i}.png`,
      kind: isVideo ? "video" : "image",
      url: `/api/uploads/bench-att-${i}`,
      mimeType: isVideo ? "video/mp4" : "image/png",
      width: w,
      height: h,
      createdAt: `2026-${month}-${day}T08:00:00.000Z`,
    },
    source: "manual",
    recordedBy: { label: "妈妈", roleName: "妈妈" },
  });
}

const messages = Array.from({ length: 150 }, (_, i) => ({
  id: `bench-msg-${i}`,
  role: i % 2 ? "assistant" : "parent",
  content: `今天宝宝状态不错,吃奶 ${120 + (i % 60)} 毫升,睡了 ${1 + (i % 3)} 小时,记录序号 ${i}。`,
  createdAt: `2026-06-0${1 + (i % 9)}T0${i % 10}:1${i % 6}:00.000Z`,
}));
const careLogs = Array.from({ length: 60 }, (_, i) => ({
  id: `bench-care-${i}`,
  date: `2026-0${1 + (i % 6)}-${String(1 + (i % 27)).padStart(2, "0")}`,
  feedings: [{ time: "08:00", amountMl: 150 }, { time: "12:00", amountMl: 160 }],
  diapers: [{ time: "09:00", type: "wet" }],
  sleeps: [{ start: "13:00", end: "15:00" }],
}));
const reminders = Array.from({ length: 20 }, (_, i) => ({
  id: `bench-rem-${i}`,
  title: `提醒事项 ${i}`,
  status: i % 4 === 0 ? "done" : "open",
  dueText: "今天 18:00",
}));
const expenses = Array.from({ length: 80 }, (_, i) => ({
  id: `bench-exp-${i}`,
  title: `奶粉/尿布采购 ${i}`,
  amount: 99 + (i % 200),
  category: "daily",
  date: `2026-0${1 + (i % 6)}-${String(1 + (i % 27)).padStart(2, "0")}`,
}));

const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages, growthEvents: [], growthMeasurements: [], careLogs,
  reminders, memories: [], pendingEffects: [], expenses,
  albumItems,
  conversationSummary: null,
  thinkingEnabled: false,
  selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};

function startServer() {
  const child = spawn("npx", ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" },
  });
  return {
    stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }),
  };
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready: ${url}`);
}

async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "bench-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
    window.__longtasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longtasks.push({ d: Math.round(entry.duration), t: Math.round(entry.startTime) });
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch { /* longtask unsupported → 指标为空 */ }
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.startsWith("/api/uploads/")) {
      if (url.pathname.includes("bench-att") && url.pathname.match(/bench-att-\d+$/) && albumItems.find((i) => url.pathname.endsWith(i.attachmentId))?.attachment.kind === "video") {
        return route.fulfill({ status: 200, headers: { ...headers, "content-type": "video/mp4" }, body: "" });
      }
      return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/png" }, body: PNG_BYTES });
    }
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
        family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true },
        authenticated: true, onboardingRequired: false }) });
    }
    if (url.pathname === "/api/app/state") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: appState }) });
    }
    if (url.pathname === "/api/pro/usage") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
    }
    if (url.pathname === "/api/auth/family/members") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: appState }) });
  });
}

const settleFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const takeLongtasks = (page) => page.evaluate(() => { const t = window.__longtasks; window.__longtasks = []; return t; });
const blockedMs = (tasks) => tasks.reduce((sum, t) => sum + Math.max(0, t.d - 50), 0);

async function benchOnce(runIndex) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  await installMocks(page);

  const metrics = {};
  const recordsScreen = page.locator(".records-screen");
  const albumTab = page.getByRole("button", { name: "相册" }).last();
  const recordsTab = page.getByRole("button", { name: "记录" }).last();

  // 1) 冷启动 → 记录页可交互
  let t0 = Date.now();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await recordsScreen.waitFor({ state: "visible", timeout: 30000 });
  await settleFrames(page);
  metrics.boot_ms = Date.now() - t0;
  await takeLongtasks(page);

  // 2) 相册首开 → 首屏 tile 的真实媒体元素可见(窗口化后 tile 壳先于媒体出现,等 img 才公平)
  t0 = Date.now();
  await albumTab.click();
  await page.locator(".album-photo-thumb img").nth(11).waitFor({ state: "visible", timeout: 30000 });
  await settleFrames(page);
  metrics.album_first_open_ms = Date.now() - t0;
  metrics.album_open_blocked_ms = blockedMs(await takeLongtasks(page));
  // D3 验收证据:首开时挂载的媒体元素数(全量 DOM 版 ≈ 数据集大小;窗口化版 ≈ 可视区±2屏)
  metrics.album_mounted_media_first = await page.evaluate(
    () => document.querySelectorAll(".album-photo-thumb img, .album-photo-thumb video, .album-photo-thumb .album-video-poster").length,
  );

  // 3) 相册滚动:连续滚 8 屏,统计长任务阻塞
  await page.evaluate(() => {
    const candidates = [document.querySelector(".album-screen"), document.querySelector("main"), document.scrollingElement];
    window.__scroller = candidates.find((el) => el && el.scrollHeight > el.clientHeight + 100) || document.scrollingElement;
  });
  await takeLongtasks(page);
  t0 = Date.now();
  for (let i = 1; i <= 8; i++) {
    await page.evaluate((step) => { window.__scroller.scrollTop = step * 700; }, i);
    await page.waitForTimeout(120);
  }
  await settleFrames(page);
  metrics.album_scroll_ms = Date.now() - t0;
  const scrollTasks = await takeLongtasks(page);
  metrics.album_scroll_longtasks = scrollTasks.length;
  metrics.album_scroll_blocked_ms = blockedMs(scrollTasks);
  metrics.album_mounted_media_after_scroll = await page.evaluate(
    () => document.querySelectorAll(".album-photo-thumb img, .album-photo-thumb video, .album-photo-thumb .album-video-poster").length,
  );

  // 4) 返回记录页
  t0 = Date.now();
  await recordsTab.click();
  await recordsScreen.waitFor({ state: "visible", timeout: 15000 });
  await settleFrames(page);
  metrics.back_to_records_ms = Date.now() - t0;
  await takeLongtasks(page);

  // 5) 输入 15 字符(相册已挂载的前提下):整树重渲染探针 —— D1 的核心指标
  // 借用记录页「记账」快捷入口的 composer(冒烟同款路径,新旧版本一致存在)。
  await page.getByRole("button", { name: "记账" }).click();
  const drawerComposer = page.locator(".records-assistant-composer textarea").first();
  await drawerComposer.waitFor({ state: "visible", timeout: 8000 });
  await drawerComposer.fill("");
  await drawerComposer.click();
  // 记录子树渲染计数:打字前开探针并清零,统计这串击键里记录树被重渲多少次(D1 直接指标)。
  await page.evaluate(() => { window.__COUNT_RECORDS_RENDERS = true; window.__recordsRenders = 0; window.__COUNT_APP_RENDERS = true; window.__appRenders = 0; });
  await takeLongtasks(page);
  t0 = Date.now();
  await page.keyboard.type("宝宝今天第一次翻身啦真是太棒了宝宝今天第一次翻身啦真是太棒了", { delay: 0 });
  await settleFrames(page);
  metrics.typing_30chars_ms = Date.now() - t0;
  metrics.records_renders_on_typing = await page.evaluate(() => window.__recordsRenders || 0);
  metrics.app_renders_on_typing = await page.evaluate(() => window.__appRenders || 0);
  const typeTasks = await takeLongtasks(page);
  metrics.typing_blocked_ms = blockedMs(typeTasks);
  await page.locator(".records-entry-drawer").getByRole("button", { name: "关闭" }).click();
  await page.locator(".records-entry-scrim").waitFor({ state: "detached", timeout: 5000 });

  // 6) 相册二开(旧版会整网格重挂载,新版应接近免费)
  t0 = Date.now();
  await albumTab.click();
  await page.locator(".album-photo-thumb img").nth(11).waitFor({ state: "visible", timeout: 30000 });
  await settleFrames(page);
  metrics.album_reopen_ms = Date.now() - t0;
  metrics.album_reopen_blocked_ms = blockedMs(await takeLongtasks(page));

  await browser.close();
  console.log(`  run#${runIndex + 1}`, JSON.stringify(metrics));
  return metrics;
}

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const server = startServer();
try {
  await waitForServer(baseUrl);
  console.log(`[perf] label=${label} root=${root} runs=${runs} cpu=${cpuThrottle}x`);
  const all = [];
  for (let i = 0; i < runs; i++) all.push(await benchOnce(i));
  const keys = Object.keys(all[0]);
  const summary = Object.fromEntries(keys.map((k) => [k, median(all.map((r) => r[k]))]));
  const outDir = path.join(mainRoot, ".verification", "perf");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ label, root, runs, cpuThrottle, dataset: { albumItems: albumItems.length }, summary, all }, null, 2));
  console.log(`\n[perf] ${label} 中位数(${runs} 轮,CPU ${cpuThrottle}x):`);
  for (const k of keys) console.log(`  ${k.padEnd(26)} ${summary[k]}`);
  console.log(`[perf] 写入 ${outFile}`);
} finally {
  await server.stop();
}
