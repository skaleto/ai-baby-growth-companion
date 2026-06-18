#!/usr/bin/env node
import assert from "node:assert/strict";
import { SEEDS } from "./qa-sweep/seed-matrix.mjs";

const byLabel = Object.fromEntries(SEEDS.map((s) => [s.label, s]));
assert.equal(SEEDS.length, 4, "恰好 4 个种子(防重复 label 漏检)");
assert.deepEqual(
  SEEDS.map((s) => s.label).sort(),
  ["caregiver-empty", "caregiver-rich", "free-quota-exhausted", "viewer-readonly"],
  "应有 4 个种子",
);
for (const s of SEEDS) {
  assert.ok(s.appState && s.appState.profile, `${s.label}: 有 appState.profile`);
  assert.ok(s.authMe && s.authMe.member, `${s.label}: 有 authMe.member`);
  assert.ok(s.expect && typeof s.expect === "object", `${s.label}: 有 expect 期望`);
}
// 富:照护人 + 有数据
assert.equal(byLabel["caregiver-rich"].authMe.member.caregiver, true, "rich=照护人");
assert.ok(byLabel["caregiver-rich"].appState.careLogs.length > 0, "rich 有 careLogs");
// 空:照护人 + 数组全空
assert.equal(byLabel["caregiver-empty"].authMe.member.caregiver, true, "empty=照护人");
for (const col of ["careLogs", "albumItems", "expenses", "reminders", "growthEvents"]) {
  assert.equal(byLabel["caregiver-empty"].appState[col].length, 0, `empty ${col} 为空`);
}
// 只读:有数据但 caregiver:false
assert.equal(byLabel["viewer-readonly"].authMe.member.caregiver, false, "viewer=仅查看");
assert.ok(byLabel["viewer-readonly"].appState.careLogs.length > 0, "viewer 仍有数据");
// 配额用尽
assert.equal(byLabel["free-quota-exhausted"].appState.proTrial.freeCallsRemaining, 0, "配额=0");
assert.equal(byLabel["free-quota-exhausted"].appState.proTrial.enabled, false, "非 Pro");
console.log("qa seed matrix tests passed");
