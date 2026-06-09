// admin/routes/applications.mjs
import { Router } from "express";
export default (repo) => {
  const r = Router();
  r.get("/", (_req, res) => res.json({ items: repo.listPendingApplications() }));
  r.post("/:familyId/approve", (req, res) => { repo.approveApplication(req.params.familyId); res.json({ ok: true }); });
  r.post("/:familyId/reject", (req, res) => { repo.rejectApplication(req.params.familyId); res.json({ ok: true }); });
  return r;
};
