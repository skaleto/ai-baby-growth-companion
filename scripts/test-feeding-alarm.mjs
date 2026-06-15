#!/usr/bin/env node
// 喂奶闹钟 DOM smoke:记录页顶部卡片倒计时;点「已喂」→选 180 → 落 milk careLog。
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
// 本地(非 UTC)日期/时间,保证「100 分钟前」在任何时区都落在过去。
const pad = (n) => String(n).padStart(2, "0");
const localYmd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const localHm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const milkAt = now - 100 * 60000; // 100 分钟前喂过(间隔 180 → 还有 ~80 分,不到点)
const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [],
  careLogs: [{
    id: "care-seed", date: localYmd(milkAt), solids: [], notes: [],
    events: [{ id: "ev-milk-1", type: "milk", date: localYmd(milkAt), time: localHm(milkAt), title: "喝奶", amountMl: 150 }],
  }],
  reminders: [{
    id: "rem-milk", title: "喂奶提醒", reminderKind: "alarm", scheduleMode: "interval", alertMode: "ringing",
    dueText: "每 3 小时 喂奶提醒", dueAt: iso(now + 80 * 60000), category: "care",
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
  assert.equal(await page.locator(".feeding-alarm-card.is-empty").count(), 0, "已设闹钟卡片不应是未设置态");
  console.log("[FA1] card shows countdown when a milk reminder exists ✔");

  // 点「已喂」→ 选 180 → 落一条 milk careLog(amountMl 180)
  await card.getByRole("button", { name: "已喂" }).click();
  await page.locator(".fa-sheet").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".fa-chip", { hasText: "180" }).click();
  await new Promise((r) => setTimeout(r, 700));
  const careUpsert = [...upserts].reverse().find((u) => u.collection === "careLogs");
  assert.ok(careUpsert, "已喂后应 PUT 持久化 careLogs");
  const milkEvents = (careUpsert.body.events ?? []).filter((e) => e.type === "milk");
  assert.ok(milkEvents.some((e) => e.amountMl === 180), "应新增一条 180ml 的 milk 事件");
  console.log("[FA2] 已喂 → 180ml milk careLog persisted ✔");

  console.log("feeding alarm DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
