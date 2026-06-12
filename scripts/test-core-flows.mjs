#!/usr/bin/env node
// 核心链路 DOM 冒烟(架构债 D8:聊天发送 / 手动记录创建)。
// 沿 gesture 套件同款模式:真浏览器 + 真组件 + page.route mock API + appState 注入。
// 覆盖两条此前无 DOM 级回归的主链路:
//   [N] 聊天发送:AI 助手抽屉 composer 输入 → 发送 → SSE 流式回复落进对话线程
//   [O] 记录创建:手动记录抽屉 → 选奶量 → 保存 → careLogs 持久化 + 时间线可见
// 用法:node scripts/test-core-flows.mjs(要求 dist 已构建,与 smoke 相同前提)

import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.CORE_FLOWS_PORT || 4329);
const baseUrl = `http://127.0.0.1:${port}`;

const today = new Date();
const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [
    {
      id: "flow-msg-1",
      role: "parent",
      text: "宝宝早上喝了一次奶",
      createdAt: `${todayText}T08:00:00.000Z`,
    },
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

const AI_REPLY = "好的，已经帮你记下来啦";
const sseBody = [
  `event: content`,
  `data: ${JSON.stringify({ delta: AI_REPLY })}`,
  ``,
  `event: final`,
  `data: ${JSON.stringify({ aiText: AI_REPLY })}`,
  ``,
  ``,
].join("\n");

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

// 服务端语义最小仿真:upsert 进对应集合并回传整份 state(前端 applyResponse 会整体应用)。
const liveState = JSON.parse(JSON.stringify(appState));
const upserts = [];
let chatStreamCalls = 0;

async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "flow-token");
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
    if (url.pathname === "/api/agent/chat/stream") {
      chatStreamCalls += 1;
      return route.fulfill({ status: 200, headers: { ...headers, "content-type": "text/event-stream" }, body: sseBody });
    }
    const upsertMatch = url.pathname.match(/^\/api\/app\/state\/([a-zA-Z]+)\/([^/]+)$/);
    if (upsertMatch && request.method() === "PUT") {
      const [, collection, id] = upsertMatch;
      const body = JSON.parse(request.postData() || "{}");
      upserts.push({ collection, id: decodeURIComponent(id), body });
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

  // ---- [N] 聊天发送主链路:AI 抽屉 composer → 发送 → 流式回复进入线程 ----
  await page.getByRole("button", { name: "记账" }).click();
  const composer = page.locator(".records-assistant-composer textarea").first();
  await composer.waitFor({ state: "visible", timeout: 8000 });
  await composer.fill("宝宝今天喝了150毫升奶");
  await page.locator(".records-assistant-composer .send-button").click();
  // 家长消息立即出现在对话线程
  await page
    .locator(".records-assistant-message.parent", { hasText: "150毫升奶" })
    .first()
    .waitFor({ state: "visible", timeout: 8000 });
  // AI 流式回复(SSE mock)最终落地
  await page
    .locator(".records-assistant-message.ai", { hasText: AI_REPLY })
    .first()
    .waitFor({ state: "visible", timeout: 8000 });
  assert.equal(chatStreamCalls, 1, `应恰好调用一次 /api/agent/chat/stream,实际 ${chatStreamCalls}`);
  const messageUpserts = upserts.filter((item) => item.collection === "messages");
  assert.ok(messageUpserts.length >= 1, "聊天消息应持久化到 /api/app/state/messages/*");
  console.log("[N] chat send: composer → SSE reply visible in thread, message persisted ✔");
  await page.locator(".records-entry-drawer").getByRole("button", { name: "关闭" }).click();
  await page.locator(".records-entry-scrim").waitFor({ state: "detached", timeout: 5000 });

  // ---- [O] 记录创建主链路:手动记录 → 150ml → 保存 → careLogs 持久化 ----
  await page.getByRole("button", { name: "手动记录" }).click();
  const manualForm = page.locator(".manual-record-form");
  await manualForm.waitFor({ state: "visible", timeout: 8000 });
  await manualForm.getByRole("button", { name: "150ml" }).click();
  await manualForm.getByRole("button", { name: "保存记录" }).click();
  await page.locator(".records-entry-scrim").waitFor({ state: "detached", timeout: 5000 });
  const careUpsert = upserts.find((item) => item.collection === "careLogs");
  assert.ok(careUpsert, "保存后应持久化到 /api/app/state/careLogs/*");
  const milkEvent = (careUpsert.body.events ?? []).find((event) => event.type === "milk");
  assert.ok(milkEvent, `careLog 应包含 milk 事件,实际 ${JSON.stringify(careUpsert.body.events ?? [])}`);
  assert.equal(milkEvent.amountMl, 150, `奶量应为 150ml,实际 ${milkEvent.amountMl}`);
  // 应用内「今天」可能按 UTC 推导(本地凌晨时差一天),两者都算今天
  const utcTodayText = new Date().toISOString().slice(0, 10);
  assert.ok(
    [todayText, utcTodayText].includes(careUpsert.body.date),
    `记录日期应为今天(${todayText} 或 UTC ${utcTodayText}),实际 ${careUpsert.body.date}`,
  );
  // 时间线 DOM 可见(applyResponse 整体应用后,记录出现在当日时间线)
  const timelineHas150 = await page
    .locator(".records-screen")
    .getByText(/150\s*ml/i)
    .first()
    .isVisible()
    .catch(() => false);
  assert.ok(timelineHas150, "保存后当日时间线应显示 150ml 喂奶记录");
  console.log("[O] manual record: 150ml milk saved → careLogs persisted, timeline updated ✔");

  // ---- [P] 契约漂移防护(D10):后端丢失全部集合字段 → 不白屏 + 产生 drift 上报 ----
  const driftReports = [];
  const driftPageErrors = [];
  const driftContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const driftPage = await driftContext.newPage();
  driftPage.on("pageerror", (e) => driftPageErrors.push(e.message));
  await driftPage.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "flow-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
  });
  await driftPage.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/client-errors") {
      driftReports.push(JSON.parse(request.postData() || "{}"));
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ received: true }) });
    }
    if (url.pathname === "/api/app/state") {
      // 漂移仿真:后端重构事故的形状——empty=false 却丢了全部集合字段。
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: { profile: appState.profile } }) });
    }
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
        family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true },
        authenticated: true, onboardingRequired: false }) });
    }
    if (url.pathname === "/api/pro/usage") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
    }
    if (url.pathname === "/api/auth/family/members") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
  });
  await driftPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  // 白屏防护:归一化把缺失集合补成 [],App 必须照常渲染记录页。
  await driftPage.locator(".records-screen").waitFor({ state: "visible", timeout: 30000 });
  await driftPage.waitForTimeout(800); // 上报是 fire-and-forget
  assert.equal(driftPageErrors.length, 0, `漂移响应不应产生未捕获异常:${driftPageErrors.join(" | ")}`);
  const drift = driftReports.find((r) => r.kind === "state_contract_drift");
  assert.ok(drift, `应产生 state_contract_drift 上报,实际收到:${JSON.stringify(driftReports.map((r) => r.kind))}`);
  assert.ok(String(drift.message).includes("albumItems"), "drift 上报应包含缺失字段明细");
  await driftContext.close();
  console.log("[P] contract drift: collections missing → no white screen + drift reported ✔");

  console.log("core flow DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
