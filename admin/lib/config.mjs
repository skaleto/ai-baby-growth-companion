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
