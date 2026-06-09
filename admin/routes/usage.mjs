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
