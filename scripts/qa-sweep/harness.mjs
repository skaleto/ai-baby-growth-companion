import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "iphone-se-375x667", width: 375, height: 667, mobile: true },
  { name: "iphone-13-390x844", width: 390, height: 844, mobile: true },
  { name: "android-pixel-412x915", width: 412, height: 915, mobile: true },
];

export function startPreview(port, host = "127.0.0.1") {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { child, stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}

export async function waitForServer(url, timeoutMs = 30000) {
  const s = Date.now();
  while (Date.now() - s < timeoutMs) { try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {} await new Promise((r) => setTimeout(r, 400)); }
  throw new Error("preview server not ready: " + url);
}

// 按种子装 mock。返回 ctx:{ upserts, consoleErrors, pageErrors, requests, state }。
export async function installMocks(page, seed) {
  const state = JSON.parse(JSON.stringify(seed.appState));
  const ctx = { upserts: [], consoleErrors: [], pageErrors: [], requests: [], state };
  page.on("console", (m) => { if (m.type() === "error") ctx.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => ctx.pageErrors.push(e.message));
  page.on("requestfinished", (req) => { try { const u = new URL(req.url()); if (u.pathname.startsWith("/api/")) ctx.requests.push({ method: req.method(), path: u.pathname }); } catch {} });
  await page.addInitScript(() => { window.localStorage.setItem("baby-companion-auth-token", "qa-token"); window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true)); });
  // 疫苗数据走 OSS(非 /api/),mock 成空集——否则真实跨域 403 会污染每条 trace 的 consoleErrors
  // (该 trace 语料是后续视觉层 + console-clean 断言的输入,必须干净)。参照 frontend-smoke 的同款处理。
  await page.route(/vaccine-data\.json(\?|$)/, (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ version: "qa", asOf: "qa", doses: [], prices: [] }) }));
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    const json = (body, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    const parseBody = () => { try { const v = JSON.parse(req.postData() || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return json(seed.authMe);
    if (url.pathname === "/api/pro/usage") return json({ days: 30, requestCount: 0, byFeature: [], byModel: [] });
    if (url.pathname === "/api/auth/family/members") return json({ members: [{ userId: "u1", roleName: seed.authMe.member.roleName, caregiver: seed.authMe.member.caregiver, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] });
    if (url.pathname.startsWith("/api/uploads/")) return route.fulfill({ status: 200, headers: { ...headers, "content-type": "application/octet-stream" }, body: "" });
    // 写入回写 state + 记 upserts:当前驱动只读导航不触发写入,此能力为后续「写入型断言」(打钩/记一笔→验真入库)预留。
    if (url.pathname === "/api/app/state") {
      if (method === "PUT") { const body = parseBody(); ctx.upserts.push({ collection: "(full-state)", id: "default", body }); Object.assign(state, body); }
      return json({ empty: false, state });
    }
    const sub = url.pathname.match(/^\/api\/app\/state\/([^/]+)\/([^/]+)$/);
    if (sub) {
      const collection = decodeURIComponent(sub[1]); const id = decodeURIComponent(sub[2]);
      if (method === "PUT") {
        const body = parseBody();
        ctx.upserts.push({ collection, id, body });
        if (collection === "profile") state.profile = body;
        else if (Array.isArray(state[collection])) state[collection] = [...state[collection].filter((e) => e?.id !== id), { ...body, id }];
        return json({ empty: false, state });
      }
      if (method === "DELETE") {
        ctx.upserts.push({ collection, id, deleted: true });
        if (Array.isArray(state[collection])) state[collection] = state[collection].filter((e) => e?.id !== id);
        return json({ empty: false, state });
      }
    }
    console.warn("[harness] 未处理的 API 路由:", method, url.pathname);
    return json({ ok: true, empty: false, state });
  });
  return ctx;
}

export async function captureArtifacts(page, seedLabel, viewportName, ctx) {
  const dir = path.join(rootDir, ".verification/acceptance", seedLabel, viewportName);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, "screen.png"), fullPage: false });
  const html = await page.content();
  await writeFile(path.join(dir, "dom.html"), html);
  await writeFile(path.join(dir, "trace.json"), JSON.stringify({ consoleErrors: ctx.consoleErrors, pageErrors: ctx.pageErrors, requests: ctx.requests, upserts: ctx.upserts, state: ctx.state }, null, 2));
  return dir;
}
