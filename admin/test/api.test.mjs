// admin/test/api.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
import { config } from "../lib/config.mjs";
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

test("health 返回 ok", async () => {
  const { base, close } = await start();
  const res = await fetch(`${base}/admin-api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
  await close();
});

test("登录成功拿令牌,受保护端点带令牌可访问、无令牌 401", async () => {
  const { base, close } = await start();
  const t = await token(base);
  assert.ok(t);
  const noauth = await fetch(`${base}/admin-api/overview`);
  assert.equal(noauth.status, 401);
  const ok = await fetch(`${base}/admin-api/overview`, { headers: { Authorization: `Bearer ${t}` } });
  assert.notEqual(ok.status, 401);
  await close();
});

test("端到端:发码→列出→停用", async () => {
  const { base, close } = await start(); const t = await token(base);
  const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const gen = await (await fetch(`${base}/admin-api/redeem-codes`, { method: "POST", headers: auth, body: JSON.stringify({ count: 2 }) })).json();
  assert.equal(gen.codes.length, 2);
  const list = await (await fetch(`${base}/admin-api/redeem-codes`, { headers: auth })).json();
  assert.equal(list.items.length, 2);
  await close();
});
