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
