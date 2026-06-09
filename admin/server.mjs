// admin/server.mjs
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./lib/config.mjs";
import { db as defaultDb } from "./lib/db.mjs";
import { makeRepo } from "./lib/repo.mjs";
import { login as doLogin, verifyToken } from "./lib/auth.mjs";
import applications from "./routes/applications.mjs";
import redeemCodes from "./routes/redeemCodes.mjs";
import entitlements from "./routes/entitlements.mjs";
import usage from "./routes/usage.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp({ db } = {}) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  const repo = makeRepo(db || defaultDb());

  app.get("/admin-api/health", (_req, res) => res.json({ status: "ok" }));

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

  app.use("/admin-api", requireAuth, usage(repo)); // /overview, /family
  app.use("/admin-api/applications", requireAuth, applications(repo));
  app.use("/admin-api/redeem-codes", requireAuth, redeemCodes(repo));
  app.use("/admin-api/entitlements", requireAuth, entitlements(repo));

  app.use(express.static(join(__dirname, "public")));
  return app;
}

// 仅在直接运行时监听(测试里只 import createApp)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(config.port, () => console.log(`admin on :${config.port}`));
}
