#!/usr/bin/env node
// DOM 级预览集成回归测试(真实浏览器 + 真实组件,PhotoSwipe 版)。
// 手势物理(跟手/惯性/缩放)由 PhotoSwipe 库承担,这里验证集成层:
// 反复开关不卡死、翻页与标题一致、慢网即点开不卡死、reload 后已浏览图零网络(缓存)。
// 用法:node scripts/test-preview-gestures.mjs(要求 dist 已构建,与 smoke 相同前提)

import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.PREVIEW_GESTURE_PORT || 4319);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

// 1x1 红色 PNG(相册图片字节)
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

const albumItems = ["第一张照片", "第二张照片", "第三张照片", "第四张照片", "第五张照片"].map((title, i) => ({
  id: `gesture-album-${i + 1}`,
  kind: "media",
  title,
  date: "2026-06-0" + (i + 1),
  occurredAt: `2026-06-0${i + 1}T08:00:00.000Z`,
  category: "daily",
  tags: [],
  attachmentId: `gesture-att-${i + 1}`,
  attachment: {
    id: `gesture-att-${i + 1}`,
    name: `photo-${i + 1}.png`,
    kind: "image",
    url: `/api/uploads/gesture-att-${i + 1}`,
    mimeType: "image/png",
    width: 1,
    height: 1,
    createdAt: `2026-06-0${i + 1}T08:00:00.000Z`,
  },
  source: "manual",
  recordedBy: { label: "妈妈", roleName: "妈妈" },
}));

const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [],
  reminders: [], memories: [], pendingEffects: [], expenses: [],
  albumItems,
  conversationSummary: null,
  thinkingEnabled: false,
  selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};

function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" },
  });
  return {
    stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }),
  };
}

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready: ${url}`);
}

let uploadDelayMs = 0;
let uploadHits = 0;
const setUploadDelay = (ms) => { uploadDelayMs = ms; };
const getUploadHits = () => uploadHits;

async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "gesture-test-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.startsWith("/api/uploads/")) {
      uploadHits += 1;
      if (uploadDelayMs) await new Promise((r) => setTimeout(r, uploadDelayMs));
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
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [
        { userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" },
      ] }) });
    }
    // 与 smoke 相同的兜底:带 state,避免未知端点解析出 undefined 字段。
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: appState }) });
  });
}

const previewTitle = (page) => page.locator(".pswp-album-info strong").first();

async function openFirstTile(page) {
  await page.locator(".album-photo-thumb").first().click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
}

async function closePreview(page) {
  await page.locator(".pswp__button--close").click({ timeout: 2500 });
  await page.locator(".pswp").waitFor({ state: "detached", timeout: 3500 });
}

const server = startServer();
let browser;
try {
  await waitFor(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(4000);
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 240)); });
  await installMocks(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const vtSupported = await page.evaluate(() => typeof document.startViewTransition === "function");
  console.log(`[env] View Transitions supported in this browser: ${vtSupported}`);

  // 进相册 tab(与 smoke 相同:页面存在多个同名按钮,取 tab 栏的最后一个)
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });

  // ---- A. 反复点开/关闭 8 次:每次都必须在时限内可交互,绝不卡死 ----
  for (let i = 0; i < 8; i++) {
    await openFirstTile(page);
    await closePreview(page);
  }
  console.log("[A] open/close x8: no deadlock, always interactive ✔");

  // ---- B. 连续快速翻页 3 次(动画余韵中接连出手):每次恰好前进一张,标题同步 ----
  await openFirstTile(page);
  assert.match(await previewTitle(page).innerText(), /第五张照片/, "相册倒序:打开第一个 tile 应是最新的第 5 张");
  for (let i = 0; i < 3; i++) {
    await page.locator(".pswp__button--arrow--next").click({ timeout: 2000 });
    await new Promise((r) => setTimeout(r, 150)); // 不等动画走完就下一次
  }
  await new Promise((r) => setTimeout(r, 500));
  const afterFast = await previewTitle(page).innerText();
  assert.match(afterFast, /第二张照片/, `连续翻页 3 次应恰好前进 3 张(5→2),实际「${afterFast}」`);
  console.log("[B] 3 rapid next => exactly +3 pages, title in sync ✔");

  // ---- D. 反向翻页恰好回到上一张 ----
  await page.locator(".pswp__button--arrow--prev").click({ timeout: 2000 });
  await new Promise((r) => setTimeout(r, 500));
  const afterBack = await previewTitle(page).innerText();
  assert.match(afterBack, /第三张照片/, `反向翻页应回到第 3 张,实际「${afterBack}」`);
  console.log("[D] prev => back exactly one page ✔");

  // ---- E. 收尾:关闭仍可交互 ----
  await closePreview(page);
  console.log("[E] final close: interactive ✔");

  // ---- F. 慢网络下「瀑布流未渲染好就点开」:绝不卡死(线上卡死复现路径) ----
  setUploadDelay(700);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  for (let i = 0; i < 6; i++) {
    // 不等任何图片加载完成,立即点开
    await page.locator(".album-photo-thumb").first().click();
    await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
    await closePreview(page);
  }
  console.log("[F] open-before-masonry-ready x6 under slow network: no deadlock ✔");

  // ---- G. 「杀进程后缓存生效」:浏览过的图 reload 后零网络请求 ----
  setUploadDelay(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  await new Promise((r) => setTimeout(r, 1800)); // 等全网格图加载并后台落库(IndexedDB)
  const hitsBeforeReload = getUploadHits();
  await page.reload({ waitUntil: "domcontentloaded" }); // ≈ 杀进程重进(IndexedDB 持久,内存清空)
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  await new Promise((r) => setTimeout(r, 2000)); // 网格渲染 + IDB 命中窗口
  const reloadDelta = getUploadHits() - hitsBeforeReload;
  assert.equal(reloadDelta, 0, `重进后已缓存的图不应发任何网络请求,实际新增 ${reloadDelta} 个 /api/uploads 请求`);
  console.log("[G] after reload, previously viewed images load with ZERO network requests ✔");

  console.log("preview gesture DOM simulation tests passed");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await server.stop();
}
