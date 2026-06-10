#!/usr/bin/env node
// DOM 级预览手势回归测试(真实浏览器 + 真实组件 + 模拟 pointer 序列)。
// 起因:2026-06-11 线上「点开图卡在过渡态整页卡死」「滑动连跳两张」。
// 覆盖:反复开关不卡死、连续快滑每次恰好翻一张、短划慢拖回弹、视口标题与翻页一致。
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

const previewTitle = (page) => page.locator(".media-preview-topinfo strong").first();

async function openFirstTile(page) {
  await page.locator(".album-photo-thumb").first().click();
  await page.locator(".media-preview").waitFor({ state: "visible", timeout: 3000 });
}

/** 模拟一次水平滑动(pointer 序列):from→to,steps 步,可控速度。 */
async function swipe(page, { fromX, toX, y, steps = 6, stepDelayMs = 9 }) {
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  const dx = (toX - fromX) / steps;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + dx * i, y + (i % 2)); // 微小纵向抖动,贴近真手
    if (stepDelayMs) await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  await page.mouse.up();
}

const server = startServer();
let browser;
try {
  await waitFor(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(4000);
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
    // 卡死的表现:VT 伪元素层吞掉一切交互 → 关闭按钮点不动/预览不消失。
    await page.locator(".preview-close").click({ timeout: 2500 });
    await page.locator(".media-preview").waitFor({ state: "hidden", timeout: 2500 });
  }
  console.log("[A] open/close x8: no deadlock, always interactive ✔");

  // ---- B. 连续快滑 3 次(动画余韵中接连出手):每次恰好前进一张 ----
  await openFirstTile(page);
  assert.match(await previewTitle(page).innerText(), /第五张照片/, "相册倒序:打开第一个 tile 应是最新的第 5 张");
  for (let i = 0; i < 3; i++) {
    await swipe(page, { fromX: 320, toX: 80, y: 420, steps: 6, stepDelayMs: 8 }); // 快滑
    await new Promise((r) => setTimeout(r, 160)); // 不等动画走完就准备下一次(复现「动画中再滑」)
    const probe = await page.evaluate(() => ({
      title: document.querySelector(".media-preview-topinfo strong")?.textContent,
      transform: getComputedStyle(document.querySelector(".media-preview-track")).transform,
    }));
    console.log(`[B:debug] after swipe ${i + 1}:`, JSON.stringify(probe));
  }
  await new Promise((r) => setTimeout(r, 700)); // 等最后一次 settle
  const afterFast = await previewTitle(page).innerText();
  assert.match(afterFast, /第二张照片/, `连续快滑 3 次应恰好前进 3 张(5→2),实际「${afterFast}」(连跳/吞滑会偏离)`);
  console.log("[B] 3 rapid swipes => exactly +3 pages (no double-page, no swallowed swipe) ✔");

  // ---- C. 短划慢拖应回弹,不翻页 ----
  await swipe(page, { fromX: 220, toX: 190, y: 420, steps: 5, stepDelayMs: 40 }); // 30px 慢拖
  await new Promise((r) => setTimeout(r, 600));
  const afterNudge = await previewTitle(page).innerText();
  assert.match(afterNudge, /第二张照片/, `短划慢拖应回弹留在第 2 张,实际「${afterNudge}」`);
  console.log("[C] 30px slow nudge => snap back, no page ✔");

  // ---- D. 反向快滑回到上一张 ----
  await swipe(page, { fromX: 80, toX: 320, y: 420, steps: 6, stepDelayMs: 8 });
  await new Promise((r) => setTimeout(r, 700));
  const afterBack = await previewTitle(page).innerText();
  assert.match(afterBack, /第三张照片/, `反向快滑应回到第 3 张,实际「${afterBack}」`);
  console.log("[D] reverse swipe => back exactly one page ✔");

  // ---- E. 收尾:关闭仍可交互 ----
  await page.locator(".preview-close").click();
  await page.locator(".media-preview").waitFor({ state: "hidden" });
  console.log("[E] final close: interactive ✔");

  console.log("preview gesture DOM simulation tests passed");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await server.stop();
}
