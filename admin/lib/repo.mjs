// admin/lib/repo.mjs
import crypto from "node:crypto";

const nowIso = () => new Date().toISOString();
const plusDaysIso = (days) => new Date(Date.now() + days * 86400_000).toISOString();
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
    // 位置参数(? )以兼容 node:sqlite 与 better-sqlite3。
    db.prepare(`
      INSERT INTO pro_trial_entitlement (id, family_id, enabled, starts_at, expires_at, plan_code, note, created_at, updated_at)
      VALUES (?, ?, 'true', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(family_id) DO UPDATE SET
        enabled='true', expires_at=?, plan_code=?, note=?, updated_at=?
    `).run(
      `pro-entitlement-${familyId}`, familyId, existing?.starts_at || now, expires, planCode, "admin grant", now, now,
      expires, planCode, "admin grant", now,
    );
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
    rejectApplication, monthlyCalls, monthlyTokens, overview };
}
