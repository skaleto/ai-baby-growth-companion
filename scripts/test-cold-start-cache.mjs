#!/usr/bin/env node
// 冷启动「本地缓存秒开」DOM 回归(架构债 D11)。
// 沿 test-core-flows.mjs 同款模式:真浏览器 + 真组件 + page.route mock API + IndexedDB 预置缓存。
//
// 场景 A(秒开 + 后台对账):预置 IndexedDB 缓存 → 把 /api/auth/me 与 /api/app/state 各延迟 ~1200ms,
//   断言首页(底栏「相册」按钮 + 预置 careLog 的 250ml 喂奶记录)在网络返回「之前」就已可见(缓存秒开),
//   且网络返回后新数据完成对账(出现仅存在于后端响应里的 999ml 记录,缓存里没有)。
// 场景 B(退出清缓存):登录态正常进入 → 点退出 → 断言秒开缓存被清空(账号键 localStorage 没了 + IDB 空),
//   即下次冷启动不再有秒开。
//
// 用法:node scripts/test-cold-start-cache.mjs(要求 dist 已构建,与 smoke 相同前提)

import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.COLD_START_CACHE_PORT || 4331);
const baseUrl = `http://127.0.0.1:${port}`;

const ACCOUNT_KEY = "u-cold-1"; // = user.id;缓存按账号分键
const CACHE_DB_NAME = "xiaobao-app-state-cache";
const CACHE_STORE = "snapshots";
const CACHE_ACCOUNT_LS_KEY = "baby-companion-app-state-cache-account";
const NETWORK_DELAY_MS = 1200;

const today = new Date();
const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const utcTodayText = new Date().toISOString().slice(0, 10);

// 完整 profile(hasCompleteProfile 通过才会越过 onboarding,直接秒开首页)。
const profile = { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] };

// 缓存里的 state:含一条 250ml 喂奶 careLog —— 秒开时首页时间线应立刻显示它。
const cachedCareLog = {
  id: "care-cached-1",
  date: todayText,
  events: [{ id: "ev-cached-1", type: "milk", amountMl: 250, occurredAt: `${todayText}T08:00:00.000Z` }],
};
const cachedState = {
  profile,
  messages: [],
  growthEvents: [],
  growthMeasurements: [],
  careLogs: [cachedCareLog],
  reminders: [],
  memories: [],
  pendingEffects: [],
  expenses: [],
  albumItems: [],
  conversationSummary: null,
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};

// 后端「新鲜」state:在缓存基础上多一条 999ml 记录 —— 用于验证后台刷新后完成对账。
const freshCareLog = {
  id: "care-fresh-1",
  date: todayText,
  events: [{ id: "ev-fresh-1", type: "milk", amountMl: 999, occurredAt: `${todayText}T09:00:00.000Z` }],
};
const freshState = { ...cachedState, careLogs: [cachedCareLog, freshCareLog] };

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

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "content-type": "application/json",
};

const meBody = JSON.stringify({
  user: { id: ACCOUNT_KEY, phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
  family: { id: "f1", name: "小宝家" },
  member: { roleName: "妈妈", caregiver: true },
  authenticated: true,
  onboardingRequired: false,
});

// 在浏览器里预置 localStorage(token + consent + 缓存账号键)与 IndexedDB 缓存记录。
// 写法对齐 appStateCache.ts:记录形如 { accountKey, savedAt, snapshot },key = 账号键。
function seedScript(accountKey, dbName, store, lsKey, state) {
  return `(${(key, db, st, ls, snap) => {
    window.localStorage.setItem("baby-companion-auth-token", "cold-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
    window.localStorage.setItem(ls, key);
    window.__coldCacheSeeded = new Promise((resolve) => {
      try {
        const req = indexedDB.open(db, 1);
        req.onupgradeneeded = () => {
          const idb = req.result;
          if (!idb.objectStoreNames.contains(st)) idb.createObjectStore(st);
        };
        req.onsuccess = () => {
          const idb = req.result;
          const tx = idb.transaction(st, "readwrite");
          tx.objectStore(st).put({ accountKey: key, savedAt: Date.now(), snapshot: snap }, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }})(${JSON.stringify(accountKey)}, ${JSON.stringify(dbName)}, ${JSON.stringify(store)}, ${JSON.stringify(lsKey)}, ${JSON.stringify(state)});`;
}

const server = startServer();
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();

  // ============ 场景 A:缓存秒开 + 后台对账 ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    let meResolvedAt = 0;
    let stateResolvedAt = 0;
    let stateCalls = 0;

    await page.addInitScript(seedScript(ACCOUNT_KEY, CACHE_DB_NAME, CACHE_STORE, CACHE_ACCOUNT_LS_KEY, cachedState));

    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
      if (url.pathname === "/api/auth/me") {
        await new Promise((r) => setTimeout(r, NETWORK_DELAY_MS)); // 延迟模拟弱网首个往返
        meResolvedAt = Date.now();
        return route.fulfill({ status: 200, headers: CORS, body: meBody });
      }
      if (url.pathname === "/api/app/state" && request.method() === "GET") {
        stateCalls += 1;
        await new Promise((r) => setTimeout(r, NETWORK_DELAY_MS)); // 延迟模拟弱网状态拉取
        stateResolvedAt = Date.now();
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ empty: false, state: freshState }) });
      }
      if (url.pathname === "/api/pro/usage") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
      }
      if (url.pathname === "/api/auth/family/members") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ members: [{ userId: ACCOUNT_KEY, roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
      }
      return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, empty: false, state: freshState }) });
    });

    // 等预置 IndexedDB 写完再导航,确保冷启动能命中缓存。
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__coldCacheSeeded);
    await page.reload({ waitUntil: "domcontentloaded" });

    const navStart = Date.now();
    // 秒开断言:底栏「相册」按钮必须在网络返回「之前」可见(给足渲染余量但远小于 1200ms)。
    await page.locator(".mobile-tabbar").getByRole("button", { name: "相册" }).waitFor({ state: "visible", timeout: NETWORK_DELAY_MS - 400 });
    const albumVisibleAt = Date.now();
    // 缓存里的 250ml 记录也应即时出现在首页(证明是「数据秒开」而非空壳)。
    const cached250Visible = await page
      .locator(".records-screen")
      .getByText(/250\s*ml/i)
      .first()
      .isVisible()
      .catch(() => false);
    assert.ok(cached250Visible, "秒开时首页应立即显示缓存里的 250ml 喂奶记录");

    // 关键时序断言:首页可见时,两个被延迟的网络请求都还没返回 —— 证明没等网络。
    assert.equal(meResolvedAt, 0, `首页应在 /api/auth/me 返回前就可见(秒开),但 me 已于 ${meResolvedAt} 返回`);
    assert.equal(stateResolvedAt, 0, `首页应在 /api/app/state 返回前就可见(秒开),但 state 已于 ${stateResolvedAt} 返回`);
    assert.ok(albumVisibleAt - navStart < NETWORK_DELAY_MS, `首页应在网络延迟(${NETWORK_DELAY_MS}ms)内就绪,实际 ${albumVisibleAt - navStart}ms`);
    console.log(`[A1] instant paint: home + cached 250ml visible at ~${albumVisibleAt - navStart}ms, before network resolved ✔`);

    // 后台对账:等延迟的网络返回后,仅存在于后端响应里的 999ml 记录应出现在首页。
    await page
      .locator(".records-screen")
      .getByText(/999\s*ml/i)
      .first()
      .waitFor({ state: "visible", timeout: 8000 });
    assert.ok(meResolvedAt > 0 && stateResolvedAt > 0, "后台刷新应已真正发生(me/state 均已返回)");
    assert.ok(stateCalls >= 1, "应至少拉取一次 /api/app/state 做后台刷新");
    // 250ml(缓存)与 999ml(后端)并存,说明是「先缓存后对账」而非整页重挂丢数据。
    const still250 = await page.locator(".records-screen").getByText(/250\s*ml/i).first().isVisible().catch(() => false);
    assert.ok(still250, "对账后缓存里的 250ml 记录仍应在(后端响应也含它)");
    assert.equal(pageErrors.length, 0, `秒开 + 对账全程不应有未捕获异常:${pageErrors.join(" | ")}`);
    console.log("[A2] reconcile: fresh 999ml from backend rendered after network resolved ✔");

    await context.close();
  }

  // ============ 场景 B:退出登录清空秒开缓存 ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.addInitScript(seedScript(ACCOUNT_KEY, CACHE_DB_NAME, CACHE_STORE, CACHE_ACCOUNT_LS_KEY, cachedState));
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
      if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers: CORS, body: meBody });
      if (url.pathname === "/api/auth/logout") return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true }) });
      if (url.pathname === "/api/app/state" && request.method() === "GET") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ empty: false, state: freshState }) });
      }
      if (url.pathname === "/api/pro/usage") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
      }
      if (url.pathname === "/api/auth/family/members") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ members: [{ userId: ACCOUNT_KEY, roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
      }
      return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, empty: false, state: freshState }) });
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__coldCacheSeeded);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".records-screen").waitFor({ state: "visible", timeout: 30000 });

    // 进入「我的」页并退出登录。
    await page.locator(".mobile-tabbar").getByRole("button", { name: "我的" }).click();
    await page.locator(".profile-logout-button").waitFor({ state: "visible", timeout: 8000 });
    await page.locator(".profile-logout-button").click();
    // 退出后应回到登录页(未登录态)。
    await page.locator(".auth-panel").waitFor({ state: "visible", timeout: 8000 });

    // 断言秒开缓存被清:localStorage 账号键没了,且 IDB 里该账号记录已删除。
    const cacheState = await page.evaluate(
      ([db, st, ls, key]) =>
        new Promise((resolve) => {
          const lsValue = window.localStorage.getItem(ls);
          try {
            const req = indexedDB.open(db, 1);
            req.onsuccess = () => {
              const idb = req.result;
              if (!idb.objectStoreNames.contains(st)) return resolve({ lsValue, record: undefined });
              const getReq = idb.transaction(st, "readonly").objectStore(st).get(key);
              getReq.onsuccess = () => resolve({ lsValue, record: getReq.result });
              getReq.onerror = () => resolve({ lsValue, record: "error" });
            };
            req.onerror = () => resolve({ lsValue, record: "open-error" });
          } catch (e) {
            resolve({ lsValue, record: `throw:${String(e)}` });
          }
        }),
      [CACHE_DB_NAME, CACHE_STORE, CACHE_ACCOUNT_LS_KEY, ACCOUNT_KEY],
    );
    assert.equal(cacheState.lsValue, null, `退出后缓存账号键应被清空,实际 ${cacheState.lsValue}`);
    assert.equal(cacheState.record, undefined, `退出后该账号的 IDB 快照应被删除,实际 ${JSON.stringify(cacheState.record)}`);
    console.log("[B] logout clears cache: account-key + IDB snapshot gone → next cold start has no instant paint ✔");

    await context.close();
  }

  // ============ 场景 C:损坏缓存按未命中处理,绝不白屏(D10 契约) ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // 预置一份「损坏」缓存:profile 不是对象、集合字段类型全错 —— normalizeAppStateResponse
    // 应判定它不可直接秒开(profile 不完整),从而退回网络路径,而不是拿脏数据白屏。
    const corruptState = { profile: 12345, careLogs: "not-an-array", albumItems: { bad: true } };
    await page.addInitScript(seedScript(ACCOUNT_KEY, CACHE_DB_NAME, CACHE_STORE, CACHE_ACCOUNT_LS_KEY, corruptState));

    let stateResolvedAt = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
      if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers: CORS, body: meBody });
      if (url.pathname === "/api/app/state" && request.method() === "GET") {
        stateResolvedAt = Date.now();
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ empty: false, state: freshState }) });
      }
      if (url.pathname === "/api/pro/usage") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
      }
      if (url.pathname === "/api/auth/family/members") {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ members: [{ userId: ACCOUNT_KEY, roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
      }
      return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, empty: false, state: freshState }) });
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__coldCacheSeeded);
    await page.reload({ waitUntil: "domcontentloaded" });

    // 损坏缓存不秒开,但走完网络后仍正常渲染首页(无白屏)、且 999ml 新数据落地。
    await page.locator(".records-screen").waitFor({ state: "visible", timeout: 30000 });
    await page.locator(".records-screen").getByText(/999\s*ml/i).first().waitFor({ state: "visible", timeout: 8000 });
    assert.ok(stateResolvedAt > 0, "损坏缓存应退回网络路径(/api/app/state 被真正请求)");
    assert.equal(pageErrors.length, 0, `损坏缓存不应引发未捕获异常(白屏):${pageErrors.join(" | ")}`);
    console.log("[C] corrupt cache: treated as miss → no white screen, network path renders home ✔");

    await context.close();
  }

  console.log("cold-start cache DOM tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
