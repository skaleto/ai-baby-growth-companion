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
