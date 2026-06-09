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
