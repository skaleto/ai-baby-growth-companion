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

  // 疫苗接种入口在记录tab的"成长"子视图内,需先切换到成长子视图
  await page.getByRole("tab", { name: "成长" }).click();
  await page.locator(".growth-observation-row", { hasText: "疫苗接种" }).click();
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
