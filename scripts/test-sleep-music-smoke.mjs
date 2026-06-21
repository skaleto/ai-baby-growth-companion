#!/usr/bin/env node
// 哄睡音乐 DOM smoke(Web 回退):入口打开播放页 → 选曲 → 暂停/播放切换 → 选定时 → 停止。
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.SLEEP_MUSIC_PORT || 4333);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [], reminders: [], memories: [], pendingEffects: [], expenses: [], albumItems: [],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};
function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}
async function waitForServer(url, timeoutMs = 30000) { const s = Date.now(); while (Date.now() - s < timeoutMs) { try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {} await new Promise((r) => setTimeout(r, 400)); } throw new Error("server not ready"); }
async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "sleep-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); };
    HTMLMediaElement.prototype.load = function () {};
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" }, family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true }, authenticated: true, onboardingRequired: false }) });
    if (url.pathname === "/api/app/state") return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: appState }) });
    if (url.pathname === "/api/pro/usage") return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, byFeature: [], byModel: [] }) });
    if (url.pathname === "/api/auth/family/members") return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: appState }) });
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

  await page.getByRole("button", { name: "打开哄睡音乐" }).click();
  const screen = page.locator(".sleep-screen");
  await screen.waitFor({ state: "visible", timeout: 6000 });
  assert.ok(await screen.getByText("哄睡音乐").first().isVisible(), "播放页应打开");
  const closeButton = screen.getByRole("button", { name: "关闭" });
  const closeBox = await closeButton.boundingBox();
  assert.ok(closeBox && closeBox.width >= 44 && closeBox.height >= 44, "关闭按钮触摸目标至少 44px");
  console.log("[SM1] entry opens sleep player and close target is tappable ✔");

  await screen.locator(".sleep-tile", { hasText: "白噪音" }).click();
  await page.locator(".sleep-now").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".sleep-now", { hasText: "循环中" }).waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".sleep-pp").click();
  await page.locator(".sleep-now", { hasText: "已暂停" }).waitFor({ state: "visible", timeout: 4000 });
  console.log("[SM2] pick track plays, toggle pauses ✔");

  await screen.locator(".sleep-chip", { hasText: "30" }).click();
  assert.ok(await page.locator(".sleep-chip.on", { hasText: "30" }).isVisible(), "定时 30 应选中");
  await screen.locator(".sleep-stop").click();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await page.locator(".sleep-now").count(), 0, "停止后 now-playing 应消失");
  console.log("[SM3] timer select + stop ✔");

  await closeButton.click();
  await screen.waitFor({ state: "hidden", timeout: 4000 });
  console.log("[SM4] close button dismisses sleep player ✔");

  console.log("sleep music DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
