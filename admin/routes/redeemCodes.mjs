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
