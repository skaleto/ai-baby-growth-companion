#!/usr/bin/env node
// 守卫:apiFetch 的「401 → 会话失效」判定必须按「请求是否携带 Authorization token」来分流,
// 而不是按 path 白名单。背景(2026-07-01 生产事故复盘):
//   - 登录时前端自动 GET /api/auth/invite/roles 校验邀请码;坏邀请码后端返回 401(业务错误)。
//   - 旧逻辑「401 且 path 非 /api/auth/login 即会话失效」会把这个业务 401 误判为 token 过期,
//     clearAuthToken + 派发 AUTH_EXPIRED,清掉秒开缓存/token 并踢回登录——错误且有害。
//   - 正确语义:只有「确实带了 Authorization 的已鉴权请求」收到 401 才是会话过期;
//     预鉴权端点(login / invite/roles)不带 token,其 401 交调用方 .catch 处理。
// 本测试用 esbuild 打包真实 authApi.ts 并驱动 apiFetch 的三条路径,防此行为回退。

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-auth-401-"));
const bundlePath = path.join(tempDir, "authApi.mjs");

await build({
  entryPoints: [path.join(rootDir, "frontend/src/authApi.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: bundlePath,
  define: { "import.meta.env.VITE_AGENT_API_BASE_URL": JSON.stringify("http://test.local") },
});

// ---- 最小全局 stub(window/localStorage/fetch);crypto/performance/Headers/Response/EventTarget 用 Node 自带 ----
const store = new Map();
const win = new EventTarget();
win.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = win;

// fetch 恒返回 401(模拟坏邀请码 / 过期 token)
globalThis.fetch = async () =>
  new Response(JSON.stringify({ code: "AUTH_FAILED", message: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

const { apiFetch, setAuthToken, getAuthToken, authHeaders, AUTH_EXPIRED_EVENT } = await import(
  pathToFileURL(bundlePath).href
);

let expiredCount = 0;
win.addEventListener(AUTH_EXPIRED_EVENT, () => {
  expiredCount += 1;
});

// A) 预鉴权 GET(无 Authorization)收到 401 → 不派发 AUTH_EXPIRED、不清 token
setAuthToken("tok-A");
expiredCount = 0;
await apiFetch("http://test.local/api/auth/invite/roles?inviteCode=BADCODE1");
assert.equal(expiredCount, 0, "预鉴权 invite/roles 的 401(无 Authorization)不应派发 AUTH_EXPIRED");
assert.equal(getAuthToken(), "tok-A", "预鉴权 401 不应清 token");
console.log("[401-gate] 预鉴权 invite/roles 401 → 不踢登录、不清 token ✔");

// B) 已鉴权 GET(带 Authorization)收到 401 → 派发一次 AUTH_EXPIRED、清 token
setAuthToken("tok-B");
expiredCount = 0;
await apiFetch("http://test.local/api/auth/me", { headers: authHeaders() });
assert.equal(expiredCount, 1, "已鉴权 /api/auth/me 的 401(带 Authorization)应派发一次 AUTH_EXPIRED");
assert.equal(getAuthToken(), "", "已鉴权 401 应清 token");
console.log("[401-gate] 已鉴权 /api/auth/me 401 → 派发 AUTH_EXPIRED、清 token ✔");

// C) 登录端点 POST(无 Authorization)收到 401 → 仍不踢登录(header 规则天然覆盖旧的 login 路径豁免)
setAuthToken("tok-C");
expiredCount = 0;
await apiFetch("http://test.local/api/auth/login", { method: "POST" });
assert.equal(expiredCount, 0, "登录端点 401 不应派发 AUTH_EXPIRED");
assert.equal(getAuthToken(), "tok-C", "登录端点 401 不应清 token");
console.log("[401-gate] 登录端点 401 → 不踢登录 ✔");

console.log("auth 401 gate test passed");
