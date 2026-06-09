# 管理后台实现计划（Admin Backend Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给「小宝记」做一个完全独立的 Node/Express 管理后台,部署到 ECS:8400,把内测申请/兑换码/Pro 权益/AI 用量的运营动作图形化。

**Architecture:** 独立 Node 进程(Express),与主后端(Spring Boot:8300)进程隔离,直接读写同一个 SQLite(`better-sqlite3`,WAL + busy_timeout)。鉴权独立:手机号白名单 + 密码 → HMAC 短时令牌。所有写库语义与主后端 `ProTrialService` 严格对齐。

**Tech Stack:** Node ≥18(ESM)、Express 4、better-sqlite3、node:test、node:crypto(HMAC)。前端零构建(原生 HTML/JS/CSS)。

**前置:** 分支 `feat/admin-backend` 已建;spec 见 `docs/architecture/admin-backend-design.md`。

---

## 文件结构

```
admin/
  package.json            依赖与 scripts(start / test)
  server.mjs              Express:静态目录 + /admin-api 路由 + 鉴权中间件 + 启动
  lib/
    config.mjs            从 env 读配置(DB 路径、白名单、密码、令牌密钥、端口)
    db.mjs                打开共享 SQLite(WAL,busy_timeout),导出单例
    auth.mjs              手机白名单+密码校验、HMAC 令牌签发/校验、登录限流
    repo.mjs              所有读写(权益/兑换码/申请/家庭/用量),写语义对齐后端
    schema.mjs            测试用:在临时 DB 建所需表(子集,copy 自 DatabaseInitializer)
  routes/
    applications.mjs      内测申请:list / approve / reject
    redeemCodes.mjs       兑换码:list / generate / disable
    entitlements.mjs      Pro 权益:findFamily / grant / revoke
    usage.mjs             AI 用量:overview / family usage
  public/
    index.html            登录 + 4 Tab 单页
    app.js                fetch /admin-api/*、渲染、令牌管理
    style.css             简洁样式
  test/
    auth.test.mjs
    repo.test.mjs
    api.test.mjs
scripts/deploy-admin.sh   部署到 ECS:8400(装 Node + rsync + systemd)
```

每个文件单一职责:`config`(配置)、`db`(连接)、`auth`(鉴权)、`repo`(数据)、`routes/*`(HTTP)、`server`(装配)。

---

## Task 1: 脚手架 + 健康检查

**Files:**
- Create: `admin/package.json`, `admin/lib/config.mjs`, `admin/server.mjs`
- Test: `admin/test/api.test.mjs`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "ai-baby-admin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node server.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.19.2"
  }
}
```

- [ ] **Step 2: 写 config.mjs**

```js
// admin/lib/config.mjs —— 全部配置从 env 读,带安全默认值
export const config = {
  port: Number(process.env.ADMIN_PORT || 8400),
  dbPath: process.env.ADMIN_DB_PATH
    || "/var/lib/ai-baby-growth-companion/baby-companion.sqlite",
  adminPhones: (process.env.ADMIN_PHONES || "18915618653")
    .split(",").map((s) => s.trim()).filter(Boolean),
  adminPassword: process.env.ADMIN_PASSWORD || "123456",
  tokenSecret: process.env.ADMIN_TOKEN_SECRET || "dev-insecure-secret-change-me",
  tokenTtlMs: Number(process.env.ADMIN_TOKEN_TTL_MS || 8 * 60 * 60 * 1000),
  grantDays: Number(process.env.ADMIN_GRANT_DAYS || 90),
};
```

- [ ] **Step 3: 写最小 server.mjs(仅 /admin-api/health + 静态目录占位)**

```js
// admin/server.mjs
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./lib/config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.get("/admin-api/health", (_req, res) => res.json({ status: "ok" }));
  app.use(express.static(join(__dirname, "public")));
  return app;
}

// 仅在直接运行时监听(测试里只 import createApp)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(config.port, () => console.log(`admin on :${config.port}`));
}
```

- [ ] **Step 4: 写失败测试 api.test.mjs**

```js
// admin/test/api.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

async function start() {
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

test("health 返回 ok", async () => {
  const { base, close } = await start();
  const res = await fetch(`${base}/admin-api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
  await close();
});
```

- [ ] **Step 5: 装依赖并跑测试**

Run: `cd admin && npm install && npm test`
Expected: 1 test pass(`health 返回 ok`)。better-sqlite3 走预编译二进制,无需编译链。

- [ ] **Step 6: 提交**

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
printf 'node_modules/\n' > admin/.gitignore
git add admin/package.json admin/package-lock.json admin/.gitignore admin/lib/config.mjs admin/server.mjs admin/test/api.test.mjs
git commit -m "feat(admin): 脚手架 + /admin-api/health"
```

---

## Task 2: db.mjs —— 打开共享 SQLite + 测试建表辅助

**Files:**
- Create: `admin/lib/db.mjs`, `admin/lib/schema.mjs`
- Test: `admin/test/repo.test.mjs`(本任务先建 DB 烟雾测试)

- [ ] **Step 1: 写 db.mjs**

```js
// admin/lib/db.mjs
import Database from "better-sqlite3";
import { config } from "./config.mjs";

export function openDb(path = config.dbPath) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

let singleton = null;
export function db() {
  if (!singleton) singleton = openDb();
  return singleton;
}
```

- [ ] **Step 2: 写 schema.mjs(测试用,建所需表的子集——copy 自后端 DatabaseInitializer)**

```js
// admin/lib/schema.mjs —— 仅供测试在临时 DB 建表;生产表由主后端创建。
export function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_user (id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS auth_family (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS auth_family_member (
      id TEXT PRIMARY KEY, family_id TEXT NOT NULL, user_id TEXT NOT NULL, role_name TEXT);
    CREATE TABLE IF NOT EXISTS pro_trial_application (
      id TEXT PRIMARY KEY, family_id TEXT, user_id TEXT, phone TEXT,
      status TEXT, source TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS pro_trial_entitlement (
      id TEXT PRIMARY KEY, family_id TEXT NOT NULL UNIQUE, enabled TEXT,
      starts_at TEXT, expires_at TEXT, plan_code TEXT, note TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS redeem_code (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, plan_code TEXT, expires_at TEXT,
      max_uses INTEGER, used_count INTEGER, note TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id TEXT PRIMARY KEY, family_id TEXT, user_id TEXT, feature TEXT, total_tokens INTEGER,
      success TEXT, quota_counted TEXT, created_at TEXT);
  `);
}
```

- [ ] **Step 3: 写烟雾测试 repo.test.mjs**

```js
// admin/test/repo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.mjs";
import { createSchema } from "../lib/schema.mjs";

export function memDb() {
  const db = openDb(":memory:");
  createSchema(db);
  return db;
}

test("内存 DB 建表成功", () => {
  const db = memDb();
  const n = db.prepare(
    "SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='redeem_code'").get().c;
  assert.equal(n, 1);
});
```

- [ ] **Step 4: 跑测试**

Run: `cd admin && npm test`
Expected: 2 tests pass。

- [ ] **Step 5: 提交**

```bash
git add admin/lib/db.mjs admin/lib/schema.mjs admin/test/repo.test.mjs
git commit -m "feat(admin): 共享 SQLite 连接(WAL)+ 测试建表辅助"
```

---

## Task 3: auth.mjs —— 白名单+密码、HMAC 令牌、限流

**Files:**
- Create: `admin/lib/auth.mjs`
- Test: `admin/test/auth.test.mjs`

- [ ] **Step 1: 写失败测试 auth.test.mjs**

```js
// admin/test/auth.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, verifyToken, resetThrottle } from "../lib/auth.mjs";

const cfg = { adminPhones: ["18915618653"], adminPassword: "123456",
  tokenSecret: "test-secret", tokenTtlMs: 3600_000 };

test("白名单外手机号拒登", () => {
  resetThrottle();
  assert.equal(login("13900000000", "123456", "1.1.1.1", cfg).ok, false);
});
test("错密码拒登", () => {
  resetThrottle();
  assert.equal(login("18915618653", "wrong", "1.1.1.1", cfg).ok, false);
});
test("对的放行并签发可校验令牌", () => {
  resetThrottle();
  const r = login("18915618653", "123456", "1.1.1.1", cfg);
  assert.equal(r.ok, true);
  assert.equal(verifyToken(r.token, cfg).phone, "18915618653");
});
test("篡改令牌拒绝", () => {
  resetThrottle();
  const r = login("18915618653", "123456", "1.1.1.1", cfg);
  assert.equal(verifyToken(r.token + "x", cfg), null);
});
test("过期令牌拒绝", () => {
  resetThrottle();
  const r = login("18915618653", "123456", "1.1.1.1", { ...cfg, tokenTtlMs: -1 });
  assert.equal(verifyToken(r.token, cfg), null);
});
test("同 IP 连续失败触发限流", () => {
  resetThrottle();
  for (let i = 0; i < 10; i++) login("18915618653", "wrong", "9.9.9.9", cfg);
  const r = login("18915618653", "123456", "9.9.9.9", cfg);
  assert.equal(r.ok, false);
  assert.match(r.error, /稍后/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd admin && node --test test/auth.test.mjs`
Expected: FAIL(`login` 未定义)。

- [ ] **Step 3: 写 auth.mjs**

```js
// admin/lib/auth.mjs
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 10;
export function resetThrottle() { attempts.clear(); }

function throttled(ip, now) {
  const e = attempts.get(ip);
  if (!e || now > e.resetAt) { attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS }); return false; }
  return e.count >= MAX_PER_WINDOW;
}
function recordFailure(ip, now) {
  const e = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  e.count += 1; attempts.set(ip, e);
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sign(payloadB64, secret) {
  return b64u(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

export function login(phone, password, ip, cfg, now = Date.now()) {
  if (throttled(ip, now)) return { ok: false, error: "尝试过于频繁,请稍后再试。" };
  const okPhone = cfg.adminPhones.includes(String(phone || "").trim());
  const okPass = timingSafeEqual(String(password || ""), cfg.adminPassword);
  if (!okPhone || !okPass) { recordFailure(ip, now); return { ok: false, error: "手机号或密码不正确。" }; }
  const payload = b64u(JSON.stringify({ phone: String(phone).trim(), exp: now + cfg.tokenTtlMs }));
  return { ok: true, token: `${payload}.${sign(payload, cfg.tokenSecret)}` };
}

export function verifyToken(token, cfg, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  if (!timingSafeEqual(sig, sign(payloadB64, cfg.tokenSecret))) return null;
  let data; try { data = JSON.parse(fromB64u(payloadB64).toString()); } catch { return null; }
  if (!data || typeof data.exp !== "number" || now > data.exp) return null;
  if (!cfg.adminPhones.includes(data.phone)) return null;
  return { phone: data.phone };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd admin && node --test test/auth.test.mjs`
Expected: 6 tests PASS。

- [ ] **Step 5: 提交**

```bash
git add admin/lib/auth.mjs admin/test/auth.test.mjs
git commit -m "feat(admin): 鉴权——手机白名单+密码、HMAC 令牌、登录限流"
```

---

## Task 4: 登录端点 + 鉴权中间件

**Files:**
- Modify: `admin/server.mjs`
- Test: `admin/test/api.test.mjs`

- [ ] **Step 1: 在 api.test.mjs 追加测试**

```js
import { config } from "../lib/config.mjs";

test("登录成功拿令牌,受保护端点带令牌可访问、无令牌 401", async () => {
  const { base, close } = await start();
  const login = await (await fetch(`${base}/admin-api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: config.adminPhones[0], password: config.adminPassword }),
  })).json();
  assert.ok(login.token);
  const noauth = await fetch(`${base}/admin-api/overview`);
  assert.equal(noauth.status, 401);
  const ok = await fetch(`${base}/admin-api/overview`,
    { headers: { Authorization: `Bearer ${login.token}` } });
  assert.notEqual(ok.status, 401);
  await close();
});
```

- [ ] **Step 2: 改 server.mjs——加 login 路由 + requireAuth 中间件 + 挂占位 overview**

```js
// 在 createApp() 里、static 之前加:
import { login as doLogin, verifyToken } from "./lib/auth.mjs";

// (createApp 内)
app.post("/admin-api/login", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const r = doLogin(req.body?.phone, req.body?.password, ip, config);
  if (!r.ok) return res.status(401).json({ error: r.error });
  res.json({ token: r.token });
});

const requireAuth = (req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  const session = m && verifyToken(m[1], config);
  if (!session) return res.status(401).json({ error: "未登录或登录已过期。" });
  req.admin = session;
  next();
};

// 占位,Task 9 会替换为真实 overview
app.get("/admin-api/overview", requireAuth, (_req, res) => res.json({ ok: true }));
```

> 把 `requireAuth` 导出或置于 createApp 作用域,后续路由复用。建议:`createApp` 内定义后,挂载各 router 时传入。

- [ ] **Step 3: 跑测试**

Run: `cd admin && node --test test/api.test.mjs`
Expected: 2 tests PASS。

- [ ] **Step 4: 提交**

```bash
git add admin/server.mjs admin/test/api.test.mjs
git commit -m "feat(admin): 登录端点 + Bearer 令牌鉴权中间件"
```

---

## Task 5: repo.mjs —— 数据读写(语义对齐后端)

**Files:**
- Create: `admin/lib/repo.mjs`
- Test: `admin/test/repo.test.mjs`(追加)

> 时间戳用 `new Date().toISOString()`(格式 `2026-06-09T09:42:06.288Z`,与后端 `Instant.toString()` 一致)。

- [ ] **Step 1: 追加失败测试(覆盖 grant/revoke/codes/applications/family/usage)**

```js
import { makeRepo } from "../lib/repo.mjs";

function seedFamily(db, { fid = "fam-1", uid = "user-1", phone = "13800000000" } = {}) {
  db.prepare("INSERT INTO auth_user (id, phone) VALUES (?,?)").run(uid, phone);
  db.prepare("INSERT INTO auth_family (id) VALUES (?)").run(fid);
  db.prepare("INSERT INTO auth_family_member (id, family_id, user_id, role_name) VALUES (?,?,?,?)")
    .run("m-1", fid, uid, "妈妈");
  return { fid, uid, phone };
}

test("grantEntitlement 开通且不缩短已有更长有效期", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid } = seedFamily(db);
  repo.grantEntitlement(fid, "internal-trial", 90);
  let e = repo.entitlement(fid);
  assert.equal(e.enabled, "true");
  const longExpiry = e.expires_at;
  repo.grantEntitlement(fid, "internal-trial", 1); // 更短,不应缩短
  assert.equal(repo.entitlement(fid).expires_at, longExpiry);
});

test("permanent 开通 expires_at 为空", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid } = seedFamily(db);
  repo.grantEntitlement(fid, "internal-trial", null);
  assert.equal(repo.entitlement(fid).expires_at, null);
});

test("revoke 关闭权益", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid } = seedFamily(db);
  repo.grantEntitlement(fid, "internal-trial", 90);
  repo.revokeEntitlement(fid);
  assert.equal(repo.entitlement(fid).enabled, "false");
});

test("生成兑换码 + 停用即过期", () => {
  const db = memDb(); const repo = makeRepo(db);
  const codes = repo.generateCodes({ count: 3, maxUses: 1, expiresDays: 30, planCode: "internal-trial" });
  assert.equal(codes.length, 3);
  assert.equal(repo.listCodes().length, 3);
  repo.disableCode(codes[0]);
  const row = repo.listCodes().find((c) => c.code === codes[0]);
  assert.ok(row.expires_at <= new Date().toISOString());
});

test("按手机号查家庭", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid, phone } = seedFamily(db);
  const found = repo.findFamiliesByPhone(phone);
  assert.equal(found[0].family_id, fid);
});

test("批准申请 → 开通 + status=approved", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid, uid, phone } = seedFamily(db);
  db.prepare("INSERT INTO pro_trial_application (id, family_id, user_id, phone, status, created_at) VALUES (?,?,?,?,?,?)")
    .run("app-1", fid, uid, phone, "pending", new Date().toISOString());
  repo.approveApplication(fid);
  assert.equal(repo.entitlement(fid).enabled, "true");
  assert.equal(db.prepare("SELECT status FROM pro_trial_application WHERE id='app-1'").get().status, "approved");
});

test("monthlyCalls 只数顶层成功回合", () => {
  const db = memDb(); const repo = makeRepo(db); const { fid, uid } = seedFamily(db);
  const ins = db.prepare("INSERT INTO ai_usage_log (id, family_id, user_id, feature, total_tokens, success, quota_counted, created_at) VALUES (?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();
  ins.run("u1", fid, uid, "agent_chat", 100, "true", "true", now);
  ins.run("u2", fid, uid, "agent_stream", 50, "true", "true", now);
  ins.run("u3", fid, uid, "agent_planner", 30, "true", "true", now); // 子步,不计
  assert.equal(repo.monthlyCalls(fid), 2);
});
```

- [ ] **Step 2: 跑确认失败**

Run: `cd admin && node --test test/repo.test.mjs`
Expected: FAIL(`makeRepo` 未定义)。

- [ ] **Step 3: 写 repo.mjs**

```js
// admin/lib/repo.mjs
import crypto from "node:crypto";

const nowIso = () => new Date().toISOString();
const plusDaysIso = (days) => new Date(Date.now() + days * 86400_000).toISOString();
const TOP = ["agent_chat", "agent_stream"];
const randCode = () => {
  const raw = crypto.randomBytes(9).toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12).padEnd(12, "0");
  return `XB-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

export function makeRepo(db) {
  const entitlement = (familyId) =>
    db.prepare("SELECT * FROM pro_trial_entitlement WHERE family_id=?").get(familyId) || null;

  function grantEntitlement(familyId, planCode = "internal-trial", days = 90) {
    const now = nowIso();
    const existing = entitlement(familyId);
    let expires = days == null ? null : plusDaysIso(days);
    // 不缩短已有更长有效期(null=永久,视为最长)
    if (existing) {
      if (existing.expires_at == null) expires = null;
      else if (expires != null && existing.expires_at > expires) expires = existing.expires_at;
    }
    db.prepare(`
      INSERT INTO pro_trial_entitlement (id, family_id, enabled, starts_at, expires_at, plan_code, note, created_at, updated_at)
      VALUES (@id, @family_id, 'true', @starts_at, @expires_at, @plan_code, @note, @now, @now)
      ON CONFLICT(family_id) DO UPDATE SET
        enabled='true', expires_at=@expires_at, plan_code=@plan_code, note=@note, updated_at=@now
    `).run({
      id: `pro-entitlement-${familyId}`, family_id: familyId,
      starts_at: existing?.starts_at || now, expires_at: expires,
      plan_code: planCode, note: "admin grant", now,
    });
    return entitlement(familyId);
  }

  function revokeEntitlement(familyId) {
    db.prepare("UPDATE pro_trial_entitlement SET enabled='false', updated_at=? WHERE family_id=?")
      .run(nowIso(), familyId);
    return entitlement(familyId);
  }

  function generateCodes({ count, maxUses = 1, expiresDays = 30, planCode = "internal-trial" }) {
    const now = nowIso();
    const expires = expiresDays > 0 ? plusDaysIso(expiresDays) : null;
    const stmt = db.prepare(`INSERT OR IGNORE INTO redeem_code
      (id, code, plan_code, expires_at, max_uses, used_count, note, created_at, updated_at)
      VALUES (?,?,?,?,?,0,?,?,?)`);
    const made = [];
    for (let i = 0; i < count; i++) {
      const code = randCode();
      const r = stmt.run(`redeem-${crypto.randomUUID()}`, code, planCode, expires, maxUses, "admin batch", now, now);
      if (r.changes) made.push(code);
    }
    return made;
  }

  const listCodes = () =>
    db.prepare("SELECT code, plan_code, expires_at, max_uses, used_count, created_at FROM redeem_code ORDER BY created_at DESC LIMIT 200").all();

  const disableCode = (code) =>
    db.prepare("UPDATE redeem_code SET expires_at=?, updated_at=? WHERE code=?").run(nowIso(), nowIso(), code);

  const findFamiliesByPhone = (phone) =>
    db.prepare(`SELECT m.family_id, u.id AS user_id, u.phone, m.role_name
      FROM auth_user u JOIN auth_family_member m ON m.user_id=u.id WHERE u.phone=?`).all(phone);

  const listPendingApplications = () =>
    db.prepare(`SELECT id, family_id, phone, source, created_at FROM pro_trial_application
      WHERE status='pending' ORDER BY created_at DESC LIMIT 200`).all();

  function approveApplication(familyId) {
    grantEntitlement(familyId, "internal-trial", 90);
    db.prepare("UPDATE pro_trial_application SET status='approved', updated_at=? WHERE family_id=? AND status='pending'")
      .run(nowIso(), familyId);
  }
  const rejectApplication = (familyId) =>
    db.prepare("UPDATE pro_trial_application SET status='rejected', updated_at=? WHERE family_id=? AND status='pending'")
      .run(nowIso(), familyId);

  const since30 = () => new Date(Date.now() - 30 * 86400_000).toISOString();
  const monthlyCalls = (familyId) =>
    db.prepare(`SELECT COUNT(*) c FROM ai_usage_log WHERE family_id=? AND success='true'
      AND quota_counted='true' AND feature IN ('agent_chat','agent_stream') AND created_at>=?`)
      .get(familyId, since30()).c;
  const monthlyTokens = (familyId) =>
    db.prepare(`SELECT COALESCE(SUM(total_tokens),0) t FROM ai_usage_log
      WHERE family_id=? AND quota_counted='true' AND created_at>=?`).get(familyId, since30()).t;

  function overview() {
    const one = (sql) => db.prepare(sql).get().n;
    return {
      families: one("SELECT COUNT(*) n FROM auth_family"),
      proFamilies: one("SELECT COUNT(*) n FROM pro_trial_entitlement WHERE enabled='true'"),
      pendingApplications: one("SELECT COUNT(*) n FROM pro_trial_application WHERE status='pending'"),
      monthlyTokensTotal: db.prepare(
        `SELECT COALESCE(SUM(total_tokens),0) t FROM ai_usage_log WHERE quota_counted='true' AND created_at>=?`)
        .get(since30()).t,
    };
  }

  return { entitlement, grantEntitlement, revokeEntitlement, generateCodes, listCodes,
    disableCode, findFamiliesByPhone, listPendingApplications, approveApplication,
    rejectApplication, monthlyCalls, monthlyTokens, overview, TOP };
}
```

- [ ] **Step 4: 跑确认通过**

Run: `cd admin && node --test test/repo.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add admin/lib/repo.mjs admin/test/repo.test.mjs
git commit -m "feat(admin): repo 数据层(权益/兑换码/申请/家庭/用量),语义对齐后端"
```

---

## Task 6: 路由装配 —— 4 个 router 挂到 server

**Files:**
- Create: `admin/routes/applications.mjs`, `redeemCodes.mjs`, `entitlements.mjs`, `usage.mjs`
- Modify: `admin/server.mjs`
- Test: `admin/test/api.test.mjs`(追加端到端)

- [ ] **Step 1: 写四个 router(每个导出 `(repo) => express.Router()`)**

```js
// admin/routes/applications.mjs
import { Router } from "express";
export default (repo) => {
  const r = Router();
  r.get("/", (_req, res) => res.json({ items: repo.listPendingApplications() }));
  r.post("/:familyId/approve", (req, res) => { repo.approveApplication(req.params.familyId); res.json({ ok: true }); });
  r.post("/:familyId/reject", (req, res) => { repo.rejectApplication(req.params.familyId); res.json({ ok: true }); });
  return r;
};
```

```js
// admin/routes/redeemCodes.mjs
import { Router } from "express";
export default (repo) => {
  const r = Router();
  r.get("/", (_req, res) => res.json({ items: repo.listCodes() }));
  r.post("/", (req, res) => {
    const count = Math.max(1, Math.min(200, Number(req.body?.count) || 1));
    const maxUses = Math.max(1, Number(req.body?.maxUses) || 1);
    const expiresDays = Number(req.body?.expiresDays ?? 30);
    const planCode = (req.body?.planCode || "internal-trial").trim();
    res.json({ codes: repo.generateCodes({ count, maxUses, expiresDays, planCode }) });
  });
  r.post("/:code/disable", (req, res) => { repo.disableCode(req.params.code); res.json({ ok: true }); });
  return r;
};
```

```js
// admin/routes/entitlements.mjs
import { Router } from "express";
export default (repo) => {
  const r = Router();
  r.get("/family", (req, res) => {
    const phone = String(req.query.phone || "").trim();
    if (!phone) return res.status(400).json({ error: "请输入手机号。" });
    const families = repo.findFamiliesByPhone(phone).map((f) => ({
      ...f, entitlement: repo.entitlement(f.family_id),
      usedThisMonth: repo.monthlyCalls(f.family_id) }));
    res.json({ items: families });
  });
  r.post("/", (req, res) => {
    const familyId = String(req.body?.familyId || "").trim();
    if (!familyId) return res.status(400).json({ error: "缺少 familyId。" });
    const days = req.body?.permanent ? null : Math.max(1, Number(req.body?.days) || 90);
    res.json({ entitlement: repo.grantEntitlement(familyId, "internal-trial", days) });
  });
  r.post("/:familyId/revoke", (req, res) => res.json({ entitlement: repo.revokeEntitlement(req.params.familyId) }));
  return r;
};
```

```js
// admin/routes/usage.mjs
import { Router } from "express";
export default (repo) => {
  const r = Router();
  r.get("/overview", (_req, res) => res.json(repo.overview()));
  r.get("/family", (req, res) => {
    const familyId = String(req.query.familyId || "").trim();
    if (!familyId) return res.status(400).json({ error: "缺少 familyId。" });
    res.json({ familyId, usedThisMonth: repo.monthlyCalls(familyId), monthlyTokens: repo.monthlyTokens(familyId) });
  });
  return r;
};
```

- [ ] **Step 2: 改 server.mjs——createApp 接受可选 db,挂 router,overview 用真实数据**

```js
// server.mjs 顶部追加
import { db as defaultDb } from "./lib/db.mjs";
import { makeRepo } from "./lib/repo.mjs";
import applications from "./routes/applications.mjs";
import redeemCodes from "./routes/redeemCodes.mjs";
import entitlements from "./routes/entitlements.mjs";
import usage from "./routes/usage.mjs";

// createApp 改签名:export function createApp({ db } = {})
//   const repo = makeRepo(db || defaultDb());
//   删除占位 overview;在 requireAuth 之后挂:
app.use("/admin-api", requireAuth, usage(repo));           // /overview, /family
app.use("/admin-api/applications", requireAuth, applications(repo));
app.use("/admin-api/redeem-codes", requireAuth, redeemCodes(repo));
app.use("/admin-api/entitlements", requireAuth, entitlements(repo));
```

> 注意:`createApp` 默认连真实 DB;测试传 `createApp({ db: memDb() })` 用内存库。需把 Task 1/4 的 `start()` 改成可注入 db(见下步)。

- [ ] **Step 3: 改 api.test.mjs 的 start() 注入内存 DB + 加端到端流程测试**

```js
import { openDb } from "../lib/db.mjs";
import { createSchema } from "../lib/schema.mjs";

async function start() {
  const db = openDb(":memory:"); createSchema(db);
  const server = createApp({ db }).listen(0);
  await new Promise((r) => server.once("listening", r));
  return { db, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}
async function token(base) {
  const r = await (await fetch(`${base}/admin-api/login`, { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: config.adminPhones[0], password: config.adminPassword }) })).json();
  return r.token;
}

test("端到端:发码→列出→停用", async () => {
  const { base, close } = await start(); const t = await token(base);
  const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const gen = await (await fetch(`${base}/admin-api/redeem-codes`, { method: "POST", headers: auth, body: JSON.stringify({ count: 2 }) })).json();
  assert.equal(gen.codes.length, 2);
  const list = await (await fetch(`${base}/admin-api/redeem-codes`, { headers: auth })).json();
  assert.equal(list.items.length, 2);
  await close();
});
```

- [ ] **Step 4: 跑全部测试**

Run: `cd admin && npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add admin/routes admin/server.mjs admin/test/api.test.mjs
git commit -m "feat(admin): 四模块 API 路由(申请/兑换码/权益/用量)"
```

---

## Task 7: 前端单页(登录 + 4 Tab)

**Files:**
- Create: `admin/public/index.html`, `admin/public/app.js`, `admin/public/style.css`

> 前端无单元测试;靠部署后手工 smoke(Task 9)。代码完整给出。

- [ ] **Step 1: index.html**

```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>小宝记 · 管理后台</title><link rel="stylesheet" href="style.css" /></head>
<body>
<div id="login" class="card hidden">
  <h1>小宝记 管理后台</h1>
  <input id="phone" placeholder="管理员手机号" inputmode="numeric" />
  <input id="password" type="password" placeholder="密码" />
  <button id="loginBtn">登录</button>
  <p id="loginErr" class="err"></p>
</div>
<div id="app" class="hidden">
  <header><strong>小宝记 管理后台</strong>
    <span id="overview" class="overview"></span>
    <button id="logout">退出</button></header>
  <nav>
    <button data-tab="applications" class="tab active">内测申请</button>
    <button data-tab="codes" class="tab">兑换码</button>
    <button data-tab="entitlements" class="tab">Pro 权益</button>
    <button data-tab="usage" class="tab">AI 用量</button>
  </nav>
  <main id="view"></main>
</div>
<script src="app.js"></script></body></html>
```

- [ ] **Step 2: app.js**

```js
const TOKEN_KEY = "admin_token";
let token = sessionStorage.getItem(TOKEN_KEY) || "";
const $ = (s) => document.querySelector(s);
const show = (el, on) => el.classList.toggle("hidden", !on);

async function api(path, opts = {}) {
  const res = await fetch(`/admin-api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error("登录已过期"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data;
}

function logout() { token = ""; sessionStorage.removeItem(TOKEN_KEY); render(); }

async function doLogin() {
  $("#loginErr").textContent = "";
  try {
    const r = await (await fetch("/admin-api/login", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: $("#phone").value, password: $("#password").value }) })).json();
    if (!r.token) throw new Error(r.error || "登录失败");
    token = r.token; sessionStorage.setItem(TOKEN_KEY, token); render();
  } catch (e) { $("#loginErr").textContent = e.message; }
}

const tabs = {
  async applications(view) {
    const { items } = await api("/applications");
    view.innerHTML = items.length ? "" : "<p>没有待处理的申请。</p>";
    items.forEach((a) => view.append(row(`${a.phone || a.family_id} · ${a.created_at?.slice(0,10)}`, [
      btn("批准", async () => { await api(`/applications/${a.family_id}/approve`, { method: "POST" }); refresh(); }),
      btn("驳回", async () => { await api(`/applications/${a.family_id}/reject`, { method: "POST" }); refresh(); }, "ghost"),
    ])));
  },
  async codes(view) {
    view.innerHTML = `<div class="bar">
      <input id="cnt" type="number" value="20" min="1" max="200" /> 个,每码可用
      <input id="mu" type="number" value="1" min="1" /> 次,
      <input id="exp" type="number" value="30" min="0" /> 天过期
      <button id="genBtn">生成</button></div><pre id="genOut"></pre><div id="codeList"></div>`;
    $("#genBtn").onclick = async () => {
      const r = await api("/redeem-codes", { method: "POST", body: JSON.stringify({
        count: +$("#cnt").value, maxUses: +$("#mu").value, expiresDays: +$("#exp").value }) });
      $("#genOut").textContent = "新生成:\n" + r.codes.join("\n"); loadCodes();
    };
    const loadCodes = async () => {
      const { items } = await api("/redeem-codes");
      $("#codeList").innerHTML = "";
      items.forEach((c) => $("#codeList").append(row(
        `${c.code} · ${c.used_count}/${c.max_uses} · ${c.expires_at ? c.expires_at.slice(0,10) : "永久"}`,
        [btn("停用", async () => { await api(`/redeem-codes/${c.code}/disable`, { method: "POST" }); loadCodes(); }, "ghost")])));
    };
    loadCodes();
  },
  async entitlements(view) {
    view.innerHTML = `<div class="bar"><input id="ph" placeholder="手机号" /><button id="findBtn">查家庭</button></div><div id="famList"></div>`;
    $("#findBtn").onclick = async () => {
      const { items } = await api(`/entitlements/family?phone=${encodeURIComponent($("#ph").value.trim())}`);
      $("#famList").innerHTML = items.length ? "" : "<p>没找到这个手机号对应的家庭。</p>";
      items.forEach((f) => {
        const pro = f.entitlement?.enabled === "true";
        $("#famList").append(row(
          `${f.family_id} · ${f.role_name || ""} · ${pro ? "Pro 至 " + (f.entitlement.expires_at?.slice(0,10) || "永久") : "Free"} · 本月 ${f.usedThisMonth} 次`,
          [ btn(pro ? "续 90 天" : "开通 90 天", async () => { await api("/entitlements", { method: "POST", body: JSON.stringify({ familyId: f.family_id, days: 90 }) }); $("#findBtn").click(); }),
            btn("撤销", async () => { await api(`/entitlements/${f.family_id}/revoke`, { method: "POST" }); $("#findBtn").click(); }, "ghost") ]));
      });
    };
  },
  async usage(view) {
    const o = await api("/overview");
    view.innerHTML = `<div class="stats">
      <div><b>${o.families}</b><span>家庭</span></div>
      <div><b>${o.proFamilies}</b><span>Pro</span></div>
      <div><b>${o.pendingApplications}</b><span>待处理申请</span></div>
      <div><b>${(o.monthlyTokensTotal/1000).toFixed(1)}k</b><span>近30天 token</span></div></div>`;
  },
};

function row(text, actions) {
  const el = document.createElement("div"); el.className = "listrow";
  const span = document.createElement("span"); span.textContent = text; el.append(span);
  const box = document.createElement("div"); actions.forEach((a) => box.append(a)); el.append(box);
  return el;
}
function btn(label, onClick, cls = "") {
  const b = document.createElement("button"); b.textContent = label; if (cls) b.className = cls;
  b.onclick = async () => { b.disabled = true; try { await onClick(); } catch (e) { alert(e.message); } finally { b.disabled = false; } };
  return b;
}

let current = "applications";
async function refresh() {
  try {
    const o = await api("/overview");
    $("#overview").textContent = `家庭 ${o.families} · Pro ${o.proFamilies} · 待办 ${o.pendingApplications}`;
    await tabs[current]($("#view"));
  } catch (e) { /* 401 已处理 */ }
}
function render() {
  const authed = !!token;
  show($("#login"), !authed); show($("#app"), authed);
  if (authed) refresh();
}

document.addEventListener("click", (e) => {
  if (e.target.matches(".tab")) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active"); current = e.target.dataset.tab; refresh();
  }
});
$("#loginBtn").onclick = doLogin;
$("#password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
$("#logout").onclick = logout;
render();
```

- [ ] **Step 3: style.css**

```css
* { box-sizing: border-box; } body { margin: 0; font-family: system-ui, sans-serif; background: #f5f7f6; color: #25302d; }
.hidden { display: none; }
.card { max-width: 340px; margin: 12vh auto; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.08); display: grid; gap: 12px; }
.card h1 { font-size: 18px; margin: 0 0 4px; }
input, button { font: inherit; min-height: 40px; border-radius: 8px; border: 1px solid #cfdad5; padding: 0 12px; }
button { background: #2f7957; color: #fff; border-color: #2f7957; font-weight: 700; cursor: pointer; }
button.ghost { background: #fff; color: #2f7957; }
button:disabled { opacity: .5; }
.err { color: #b3261e; font-size: 13px; min-height: 18px; margin: 0; }
header { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #e3eae7; }
header .overview { color: #6b7672; font-size: 13px; margin-left: auto; }
nav { display: flex; gap: 6px; padding: 12px 18px 0; }
nav .tab { background: #fff; color: #4b5a55; border-color: #e3eae7; }
nav .tab.active { background: #2f7957; color: #fff; border-color: #2f7957; }
main { padding: 18px; display: grid; gap: 10px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bar input { width: 80px; } .bar input#ph { width: 160px; }
.listrow { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; background: #fff; border: 1px solid #e3eae7; border-radius: 10px; }
.listrow > div { display: flex; gap: 8px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stats div { background: #fff; border: 1px solid #e3eae7; border-radius: 10px; padding: 16px; text-align: center; }
.stats b { font-size: 24px; display: block; } .stats span { color: #6b7672; font-size: 12px; }
pre { background: #f0f4f2; padding: 12px; border-radius: 8px; overflow: auto; }
```

- [ ] **Step 4: 本地起服务手测一眼**

Run: `cd admin && ADMIN_DB_PATH=":memory:" node server.mjs`
打开 `http://localhost:8400`,确认登录框出现(因 :memory: 无数据,功能空属正常)。Ctrl-C 退出。

- [ ] **Step 5: 提交**

```bash
git add admin/public
git commit -m "feat(admin): 前端单页(登录 + 申请/兑换码/权益/用量 四 Tab)"
```

---

## Task 8: 部署脚本 deploy-admin.sh

**Files:**
- Create: `scripts/deploy-admin.sh`

- [ ] **Step 1: 写 deploy-admin.sh**

```bash
#!/usr/bin/env bash
# 部署独立管理后台到 ECS:8400(systemd: ai-baby-admin)。与主后端进程隔离,共享同一 SQLite。
# 用法: ECS_HOST=120.55.188.242 SSH_KEY=~/.ssh/ai_baby_aliyun bash scripts/deploy-admin.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECS_HOST="${ECS_HOST:-${1:-120.55.188.242}}"
ECS_USER="${ECS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_baby_aliyun}"
APP_DIR="${REMOTE_ADMIN_DIR:-/opt/ai-baby-admin}"
CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
DB_PATH="${REMOTE_DB:-/var/lib/ai-baby-growth-companion/baby-companion.sqlite}"
PORT="${ADMIN_PORT:-8400}"
ADMIN_PHONES="${ADMIN_PHONES:-18915618653}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123456}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "${ECS_USER}@${ECS_HOST}")

echo "Deploying admin to ${ECS_USER}@${ECS_HOST}:${PORT}"

# 1) 装 Node(若缺)
"${SSH[@]}" 'command -v node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)'

# 2) 同步代码(排除 node_modules)
"${SSH[@]}" "mkdir -p '$APP_DIR' '$CONFIG_DIR'"
rsync -az --delete -e "ssh -i $SSH_KEY -o BatchMode=yes" \
  --exclude node_modules --exclude .gitignore \
  "$ROOT_DIR/admin/" "${ECS_USER}@${ECS_HOST}:$APP_DIR/"

# 3) 装依赖(better-sqlite3 走 linux-x64 预编译)
"${SSH[@]}" "cd '$APP_DIR' && npm ci --omit=dev"

# 4) 写 env(若不存在则用默认;已存在则保留,不覆盖既有密钥)
"${SSH[@]}" "test -f '$CONFIG_DIR/admin.env' || cat > '$CONFIG_DIR/admin.env' <<EOF
ADMIN_PORT=$PORT
ADMIN_DB_PATH=$DB_PATH
ADMIN_PHONES=$ADMIN_PHONES
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_TOKEN_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 '$CONFIG_DIR/admin.env'"

# 5) systemd 单元
"${SSH[@]}" "cat > /etc/systemd/system/ai-baby-admin.service <<EOF
[Unit]
Description=AI Baby Admin Backend
After=network.target
[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONFIG_DIR/admin.env
ExecStart=/usr/bin/node $APP_DIR/server.mjs
Restart=on-failure
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ai-baby-admin && systemctl restart ai-baby-admin"

# 6) 健康检查
echo "Waiting for health..."
for i in $(seq 1 15); do
  if "${SSH[@]}" "curl -fsS http://127.0.0.1:$PORT/admin-api/health" >/dev/null 2>&1; then
    echo "Admin healthy: http://${ECS_HOST}:${PORT}/"; break; fi; sleep 2; done

echo "提醒:在阿里云安全组放行 ${PORT} 端口才能从公网访问。"
echo "默认登录:手机号 ${ADMIN_PHONES%%,*} / 密码 ${ADMIN_PASSWORD}(请尽快改 ${CONFIG_DIR}/admin.env 的 ADMIN_PASSWORD)。"
```

- [ ] **Step 2: 本地语法检查**

Run: `bash -n scripts/deploy-admin.sh && echo OK`
Expected: `OK`。

- [ ] **Step 3: 提交**

```bash
git add scripts/deploy-admin.sh
git commit -m "chore(admin): ECS 部署脚本(Node + systemd ai-baby-admin:8400)"
```

---

## Task 9: 部署 + 上线 smoke

**Files:** 无(运行 + 验证)

- [ ] **Step 1: 跑全套单测**

Run: `cd admin && npm test`
Expected: 全绿。

- [ ] **Step 2: 部署到 ECS**

Run: `ECS_HOST=120.55.188.242 SSH_KEY=~/.ssh/ai_baby_aliyun bash scripts/deploy-admin.sh`
Expected: `Admin healthy: http://120.55.188.242:8400/`。

- [ ] **Step 3: 阿里云安全组放行 8400**(控制台操作,脚本会提醒)。

- [ ] **Step 4: 公网 smoke**

```bash
curl -fsS http://120.55.188.242:8400/admin-api/health   # {"status":"ok"}
# 登录 → 拿 token → 看 overview
TOKEN=$(curl -s -X POST http://120.55.188.242:8400/admin-api/login \
  -H 'Content-Type: application/json' -d '{"phone":"18915618653","password":"123456"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s http://120.55.188.242:8400/admin-api/overview -H "Authorization: Bearer $TOKEN"
```
Expected: overview 返回真实家庭数(应为 7、Pro 7)。浏览器打开 `http://120.55.188.242:8400/` 登录,确认四个 Tab 能查到真实数据。

- [ ] **Step 5: 合并 + 提示改密码**

```bash
git checkout main && git merge --ff-only feat/admin-backend && git push origin main
```
提醒用户:尽快把 ECS 上 `/etc/ai-baby-growth-companion/admin.env` 的 `ADMIN_PASSWORD` 改成强口令并 `systemctl restart ai-baby-admin`。

---

## 范围外(以后)

客户端崩溃/错误、Agent 运行轨迹、数据权利请求、邀请码管理、OTA 版本开关。各自一个独立计划。
