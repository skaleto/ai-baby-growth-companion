// admin/test/repo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.mjs";
import { createSchema } from "../lib/schema.mjs";
import { makeRepo } from "../lib/repo.mjs";

export function memDb() {
  const db = openDb(":memory:");
  createSchema(db);
  return db;
}

function seedFamily(db, { fid = "fam-1", uid = "user-1", phone = "13800000000" } = {}) {
  db.prepare("INSERT INTO auth_user (id, phone) VALUES (?,?)").run(uid, phone);
  db.prepare("INSERT INTO auth_family (id) VALUES (?)").run(fid);
  db.prepare("INSERT INTO auth_family_member (id, family_id, user_id, role_name) VALUES (?,?,?,?)")
    .run("m-1", fid, uid, "妈妈");
  return { fid, uid, phone };
}

test("内存 DB 建表成功", () => {
  const db = memDb();
  const n = db.prepare(
    "SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='redeem_code'").get().c;
  assert.equal(n, 1);
});

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
