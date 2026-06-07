#!/usr/bin/env node
import assert from "node:assert/strict";

import { scenarios } from "./l2-benchmark/scenarios.mjs";

const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

for (const id of [
  "feed-complete",
  "feed-mixed-missing-type",
  "sleep-complete",
  "sleep-start-boundary",
  "multi-care-events",
  "expense-record",
  "growth-milestone",
  "growth-measurement-complete",
  "growth-measurement-ambiguous-unit",
  "growth-measurement-out-of-range",
  "growth-measurement-update-boundary",
  "growth-measurement-delete-boundary",
  "growth-measurement-duplicate-boundary",
  "read-only-growth-trend-context",
  "read-only-daily-summary-context",
  "read-only-weekly-summary-context",
  "qa-policy",
  "qa-care-no-memory-pollution",
]) {
  assert.ok(byId.has(id), `missing scenario ${id}`);
}

assert.equal(byId.get("feed-complete").stateExpect.collection, "careLogs");
assert.equal(byId.get("feed-complete").stateExpect.mustGrow, true);
assert.ok(byId.get("feed-mixed-missing-type").stateExpect.mustNotGrow.includes("careLogs"));
assert.equal(byId.get("sleep-complete").stateExpect.collection, "careLogs");
assert.equal(byId.get("sleep-complete").stateExpect.mustGrow, true);
assert.ok(byId.get("sleep-start-boundary").stateExpect.mustNotGrow.includes("careLogs"));
assert.equal(byId.get("multi-care-events").stateExpect.collection, "careLogs");
assert.equal(byId.get("multi-care-events").stateExpect.mustGrow, true);

assert.equal(byId.get("expense-record").stateExpect.collection, "pendingEffects");
assert.equal(byId.get("expense-record").stateExpect.mustGrow, true);
assert.ok(byId.get("expense-record").stateExpect.mustNotGrow.includes("expenses"));

assert.equal(byId.get("growth-milestone").stateExpect.collection, "pendingEffects");
assert.equal(byId.get("growth-measurement-complete").stateExpect.collection, "pendingEffects");
assert.equal(byId.get("growth-measurement-complete").stateExpect.mustGrow, true);
assert.deepEqual(byId.get("growth-measurement-ambiguous-unit").stateExpect.mustNotGrow, ["growthMeasurements", "pendingEffects"]);
assert.deepEqual(byId.get("growth-measurement-out-of-range").stateExpect.mustNotGrow, ["growthMeasurements", "pendingEffects"]);
assert.ok(byId.get("growth-measurement-update-boundary").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.ok(byId.get("growth-measurement-delete-boundary").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.equal(Boolean(byId.get("growth-measurement-duplicate-boundary").skip), false);

assert.equal(byId.get("qa-care-no-memory-pollution").expect.noEffectMutation, true);
assert.ok(byId.get("qa-care-no-memory-pollution").stateExpect.mustNotGrow.includes("memories"));
assert.ok(byId.get("qa-care-no-memory-pollution").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("read-only-growth-trend-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-growth-trend-context").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.equal(byId.get("read-only-daily-summary-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-daily-summary-context").stateExpect.mustNotGrow.includes("careLogs"));
assert.equal(byId.get("read-only-weekly-summary-context").expect.noEffectMutation, true);

const capabilities = new Set(scenarios.map((scenario) => scenario.capability));
for (const capability of [
  "喂养记录",
  "睡眠记录",
  "记账",
  "成长事件",
  "成长数据维护",
  "只读查询",
  "安全",
]) {
  assert.ok(capabilities.has(capability), `missing capability ${capability}`);
}

console.log("L2 coverage matrix tests passed");
