#!/usr/bin/env node
// RecordsScreen memo 守卫(架构债 D1/Records 轮:打字不再重渲记录树)。
// 沿 test-core-flows.mjs 同款模式:真浏览器 + 真组件 + page.route mock API + appState 注入。
// 不变量:记录页打字所在的 AI composer 抽屉已 createPortal 并被提升为 <RecordsScreen/> 的兄弟节点,
//   故草稿(input/composerMode/语音)逐键 setState 只重渲 App,绝不触达 React.memo 的 RecordsScreen。
//   置 window.__COUNT_RECORDS_RENDERS,清零 __recordsRenders,敲 ~30 字,断言记录树渲染次数 ≤ 1。
//   （回归基线:拆分前同样输入会逐键重渲 30 次;此守卫钉住「~0」,函数 props 引用一旦失稳即变红。）
// 用法:node scripts/test-records-memo.mjs(要求 dist 已构建,与 smoke 相同前提)

import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.RECORDS_MEMO_PORT || 4332);
const baseUrl = `http://127.0.0.1:${port}`;

const today = new Date();
const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [
    { id: "memo-msg-1", role: "parent", text: "宝宝早上喝了一次奶", createdAt: `${todayText}T08:00:00.000Z` },
  ],
  growthEvents: [],
  growthMeasurements: [],
  careLogs: [],
  reminders: [],
  memories: [],
  pendingEffects: [],
  expenses: [],
  albumItems: [],
  conversationSummary: null,
  thinkingEnabled: false,
  selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};

function startServer() {
  const child = spawn(
    "npx",
    ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } },
  );
  return {
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill("SIGTERM");
        setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref();
      }),
  };
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready: ${url}`);
}

const liveState = JSON.parse(JSON.stringify(appState));

async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "memo-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    const upsertMatch = url.pathname.match(/^\/api\/app\/state\/([a-zA-Z]+)\/([^/]+)$/);
    if (upsertMatch && request.method() === "PUT") {
      const [, collection] = upsertMatch;
      const body = JSON.parse(request.postData() || "{}");
      const list = Array.isArray(liveState[collection]) ? liveState[collection] : [];
      const index = list.findIndex((item) => item && item.id === body.id);
      if (index >= 0) list[index] = body;
      else list.push(body);
      liveState[collection] = list;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: liveState }) });
    }
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
          family: { id: "f1", name: "小宝家" },
          member: { roleName: "妈妈", caregiver: true },
          authenticated: true,
          onboardingRequired: false,
        }),
      });
    }
    if (url.pathname === "/api/app/state") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: liveState }) });
    }
    if (url.pathname === "/api/pro/usage") {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }),
      });
    }
    if (url.pathname === "/api/auth/family/members") {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }),
      });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: liveState }) });
  });
}

const server = startServer();
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installMocks(page);

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".records-screen").waitFor({ state: "visible", timeout: 30000 });

  // 打开 AI 自动记录抽屉(composer 即打字处;它 createPortal 到 body,是 RecordsScreen 的兄弟节点)。
  await page.getByRole("button", { name: "AI 自动记录" }).click();
  const composer = page.locator(".records-assistant-composer textarea").first();
  await composer.waitFor({ state: "visible", timeout: 8000 });

  // 开启渲染探针并清零计数。探针 IIFE 位于 RecordsScreen 根:仅当记录树渲染时自增。
  await page.evaluate(() => {
    window.__COUNT_RECORDS_RENDERS = true;
    window.__recordsRenders = 0;
    window.__COUNT_APP_RENDERS = true;
    window.__appRenders = 0;
  });

  // 逐键敲入 ~30 个字符。input 已移入 features/chat/composerInput 的 external store,
  // App 本体不应随击键重渲(__appRenders≤1);即便 App 重渲,memo 化的 RecordsScreen 也不应重渲(__recordsRenders≤1)。
  const typed = "宝宝今天中午喝了一百五十毫升奶睡了两个小时还发烧三十七度五"; // 28 字
  await composer.focus();
  await page.keyboard.type(typed, { delay: 12 });

  const value = await composer.inputValue();
  assert.equal(value, typed, `composer 应收下逐键输入(${typed.length} 字),实际「${value}」`);

  const renders = await page.evaluate(() => window.__recordsRenders || 0);
  assert.ok(
    renders <= 1,
    `打字 ${typed.length} 字应 ≤1 次记录树渲染(memo 生效;拆分前基线为 30),实际 ${renders} 次` +
      `——若 ~等于字符数,说明传给 RecordsScreen 的函数 props 引用不稳定(检查 recordsScreenHandlers 的 ref 包装)。`,
  );
  console.log(`[memo] records typing: ${typed.length} chars → __recordsRenders=${renders} (≤1) ✔`);

  const appRenders = await page.evaluate(() => window.__appRenders || 0);
  assert.ok(
    appRenders <= 1,
    `打字 ${typed.length} 字应 ≤1 次 App 重渲(input 已移入 composerInput external store;拆分前基线为 30),实际 ${appRenders} 次` +
      `——若 ~等于字符数,说明 input 又回到了 App 状态(检查 features/chat/composerInput 与 <ComposerTextarea>)。`,
  );
  console.log(`[memo] app body typing: ${typed.length} chars → __appRenders=${appRenders} (≤1) ✔`);

  console.log("records + composer memo guard test passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
