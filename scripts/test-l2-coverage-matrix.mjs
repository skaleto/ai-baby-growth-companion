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
  "reminder-once",
  "vague-reminder-ask",
  "medicine-reminder-pending",
  "vaccine-reminder-pending",
  "expense-record",
  "memory-health-pending",
  "memory-preference-pending",
  "memory-caregiver-pending",
  "qa-care-allergy-context",
  "caregiver-fatigue-context",
  "profile-update-boundary",
  "read-only-reminder-list-context",
  "read-only-growth-trend-context",
  "read-only-daily-summary-context",
  "read-only-weekly-summary-context",
  "private-reminder-share-boundary",
  "photo-album",
  "screenshot-ignore",
  "growth-milestone",
  "growth-measurement-complete",
  "growth-measurement-ambiguous-unit",
  "growth-measurement-out-of-range",
  "growth-measurement-update-boundary",
  "growth-measurement-delete-boundary",
  "growth-measurement-duplicate-boundary",
  "daily-observation-context",
  "qa-care-no-memory-pollution",
]) {
  assert.ok(byId.has(id), `missing scenario ${id}`);
}

assert.equal(byId.get("growth-milestone").expect.effect.type, "growthEvent");
assert.equal(byId.get("growth-milestone").expect.effect.mode, "pending");
assert.equal(byId.get("growth-milestone").stateExpect.collection, "pendingEffects");
assert.equal(byId.get("growth-measurement-complete").expect.effect.type, "growthMeasurement");
assert.equal(byId.get("growth-measurement-complete").expect.effect.mode, "pending");
assert.equal(byId.get("growth-measurement-complete").stateExpect.collection, "pendingEffects");
assert.equal(Boolean(byId.get("growth-measurement-complete").skip), false, "growth measurement should now be runnable");
assert.equal(Boolean(byId.get("growth-measurement-complete").knownGap), false, "growth measurement is no longer a known AI-agent coverage gap");
assert.equal(byId.get("growth-measurement-ambiguous-unit").expect.effect.type, "growthMeasurement");
assert.equal(byId.get("growth-measurement-ambiguous-unit").expect.effect.mode, "ask");
assert.deepEqual(byId.get("growth-measurement-ambiguous-unit").stateExpect.mustNotGrow, ["growthMeasurements", "pendingEffects"]);
assert.equal(byId.get("growth-measurement-out-of-range").expect.effect.type, "growthMeasurement");
assert.equal(byId.get("growth-measurement-out-of-range").expect.effect.mode, "ask");
assert.ok(
  byId.get("growth-measurement-out-of-range").expect.effect.payloadAssertions.some(
    (item) => item.path === "missingFields.0" && item.op === "eq" && item.value === "range",
  ),
);
assert.deepEqual(byId.get("growth-measurement-out-of-range").stateExpect.mustNotGrow, ["growthMeasurements", "pendingEffects"]);
assert.equal(byId.get("growth-measurement-update-boundary").expect.noEffectMutation, true);
assert.ok(byId.get("growth-measurement-update-boundary").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.ok(byId.get("growth-measurement-update-boundary").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("growth-measurement-delete-boundary").expect.noEffectMutation, true);
assert.ok(byId.get("growth-measurement-delete-boundary").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.ok(byId.get("growth-measurement-delete-boundary").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(Boolean(byId.get("growth-measurement-duplicate-boundary").skip), false, "duplicate growth measurement should now be runnable");
assert.equal(Boolean(byId.get("growth-measurement-duplicate-boundary").knownGap), false, "duplicate growth measurement should not remain a known gap");
assert.equal(byId.get("growth-measurement-duplicate-boundary").expect.effect.type, "growthMeasurement");
assert.equal(byId.get("growth-measurement-duplicate-boundary").expect.effect.mode, "ask");
assert.equal(byId.get("feed-mixed-missing-type").expect.effect.type, "careLog");
assert.equal(byId.get("feed-mixed-missing-type").expect.effect.mode, "ask");
assert.deepEqual(byId.get("feed-mixed-missing-type").stateExpect.mustNotGrow, ["careLogs"]);
assert.equal(byId.get("sleep-start-boundary").expect.effect.type, "careLog");
assert.equal(byId.get("sleep-start-boundary").expect.effect.mode, "ask");
assert.deepEqual(byId.get("sleep-start-boundary").stateExpect.mustNotGrow, ["careLogs"]);
assert.equal(byId.get("vague-reminder-ask").expect.effect.type, "reminder");
assert.equal(byId.get("vague-reminder-ask").expect.effect.mode, "ask");
assert.deepEqual(byId.get("vague-reminder-ask").stateExpect.mustNotGrow, ["reminders"]);
assert.equal(byId.get("medicine-reminder-pending").expect.effect.type, "reminder");
assert.equal(byId.get("medicine-reminder-pending").expect.effect.mode, "pending");
assert.equal(byId.get("medicine-reminder-pending").stateExpect.collection, "pendingEffects");
assert.ok(byId.get("medicine-reminder-pending").stateExpect.mustNotGrow.includes("reminders"));
assert.equal(byId.get("vaccine-reminder-pending").expect.effect.type, "reminder");
assert.equal(byId.get("vaccine-reminder-pending").expect.effect.mode, "pending");
assert.equal(byId.get("vaccine-reminder-pending").stateExpect.collection, "pendingEffects");
assert.ok(byId.get("vaccine-reminder-pending").stateExpect.mustNotGrow.includes("reminders"));
assert.equal(byId.get("multi-care-events").expect.effect.type, "careLog");
assert.equal(byId.get("multi-care-events").expect.effect.mode, "auto");
assert.equal(byId.get("multi-care-events").stateExpect.collection, "careLogs");
assert.equal(byId.get("multi-care-events").stateExpect.mustGrow, true);
assert.equal(byId.get("expense-record").expect.effect.type, "expenseItem");
assert.equal(byId.get("expense-record").expect.effect.mode, "pending");
assert.equal(byId.get("expense-record").stateExpect.collection, "pendingEffects");
assert.equal(byId.get("expense-record").stateExpect.mustGrow, true);
assert.ok(byId.get("expense-record").stateExpect.mustNotGrow.includes("expenses"));
assert.ok(
  byId.get("expense-record").stateExpect.newItemAssertions.some(
    (item) => item.path === "expenses.0.amount" && item.op === "approx" && item.value === 268,
  ),
);
assert.equal(byId.get("memory-health-pending").expect.effect.type, "memory");
assert.equal(byId.get("memory-health-pending").expect.effect.mode, "pending");
assert.equal(byId.get("memory-health-pending").stateExpect.collection, "pendingEffects");
assert.ok(byId.get("memory-health-pending").stateExpect.mustNotGrow.includes("memories"));
assert.ok(
  byId.get("memory-health-pending").stateExpect.newItemAssertions.some(
    (item) => item.path === "memories.0.category" && item.op === "eq" && item.value === "health",
  ),
);
assert.equal(byId.get("memory-preference-pending").expect.effect.type, "memory");
assert.equal(byId.get("memory-preference-pending").expect.effect.mode, "pending");
assert.equal(byId.get("memory-preference-pending").stateExpect.collection, "pendingEffects");
assert.ok(byId.get("memory-preference-pending").stateExpect.mustNotGrow.includes("memories"));
assert.ok(
  byId.get("memory-preference-pending").stateExpect.newItemAssertions.some(
    (item) => item.path === "memories.0.category" && item.op === "eq" && item.value === "preference",
  ),
);
assert.equal(byId.get("memory-caregiver-pending").expect.effect.type, "memory");
assert.equal(byId.get("memory-caregiver-pending").expect.effect.mode, "pending");
assert.equal(byId.get("memory-caregiver-pending").stateExpect.collection, "pendingEffects");
assert.ok(byId.get("memory-caregiver-pending").stateExpect.mustNotGrow.includes("memories"));
assert.ok(
  byId.get("memory-caregiver-pending").stateExpect.newItemAssertions.some(
    (item) => item.path === "memories.0.category" && item.op === "eq" && item.value === "caregiver",
  ),
);
assert.equal(byId.get("qa-care-allergy-context").expect.noEffectMutation, true);
assert.ok(byId.get("qa-care-allergy-context").stateExpect.mustNotGrow.includes("memories"));
assert.equal(byId.get("qa-care-no-memory-pollution").expect.noEffectMutation, true);
assert.ok(byId.get("qa-care-no-memory-pollution").stateExpect.mustNotGrow.includes("memories"));
assert.ok(byId.get("qa-care-no-memory-pollution").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("caregiver-fatigue-context").expect.noEffectMutation, true);
assert.ok(byId.get("caregiver-fatigue-context").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("profile-update-boundary").expect.noEffectMutation, true);
assert.ok(byId.get("profile-update-boundary").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("read-only-reminder-list-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-reminder-list-context").expect.aiTextAssertions.some(
  (item) => item.op === "notContains" && item.value === "这个提醒想定",
));
assert.ok(byId.get("read-only-reminder-list-context").stateExpect.mustNotGrow.includes("reminders"));
assert.ok(byId.get("read-only-reminder-list-context").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("read-only-growth-trend-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-growth-trend-context").expect.aiTextAssertions.some(
  (item) => item.op === "contains" && item.value === "7.4",
));
assert.ok(byId.get("read-only-growth-trend-context").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.ok(byId.get("read-only-growth-trend-context").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("read-only-daily-summary-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-daily-summary-context").expect.aiTextAssertions.some(
  (item) => item.op === "contains" && item.value === "240",
));
assert.ok(byId.get("read-only-daily-summary-context").expect.aiTextAssertions.some(
  (item) => item.op === "notContains" && item.value === "我再帮你记",
));
assert.ok(byId.get("read-only-daily-summary-context").stateExpect.mustNotGrow.includes("careLogs"));
assert.ok(byId.get("read-only-daily-summary-context").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("read-only-weekly-summary-context").expect.noEffectMutation, true);
assert.ok(byId.get("read-only-weekly-summary-context").expect.aiTextAssertions.some(
  (item) => item.op === "contains" && item.value === "7.4",
));
assert.ok(byId.get("read-only-weekly-summary-context").expect.aiTextAssertions.some(
  (item) => item.op === "notContains" && item.value === "我再帮你记",
));
assert.ok(byId.get("read-only-weekly-summary-context").stateExpect.mustNotGrow.includes("growthMeasurements"));
assert.ok(byId.get("read-only-weekly-summary-context").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(byId.get("private-reminder-share-boundary").expect.noEffectMutation, true);
assert.ok(byId.get("private-reminder-share-boundary").expect.aiTextAssertions.some(
  (item) => item.op === "notContains" && item.value === "已同步",
));
assert.ok(byId.get("private-reminder-share-boundary").stateExpect.mustNotGrow.includes("reminders"));
assert.ok(byId.get("private-reminder-share-boundary").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.equal(Boolean(byId.get("photo-album").skip), false, "photo album should now be runnable");
assert.equal(byId.get("photo-album").expect.effect.type, "albumItem");
assert.equal(byId.get("photo-album").expect.effect.mode, "auto");
assert.ok(byId.get("photo-album").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.ok(Array.isArray(byId.get("photo-album").attachments) && byId.get("photo-album").attachments.length > 0);
assert.ok(byId.get("photo-album").attachments[0].dataUrl.startsWith("data:image/"));
assert.equal(Boolean(byId.get("screenshot-ignore").skip), false, "screenshot ignore should now be runnable");
assert.equal(byId.get("screenshot-ignore").expect.noEffectMutation, true);
assert.equal(byId.get("screenshot-ignore").expect.noAlbumGrowth, true);
assert.ok(byId.get("screenshot-ignore").stateExpect.mustNotGrow.includes("albumItems"));
assert.ok(byId.get("screenshot-ignore").stateExpect.mustNotGrow.includes("pendingEffects"));
assert.ok(Array.isArray(byId.get("screenshot-ignore").attachments) && byId.get("screenshot-ignore").attachments.length > 0);
assert.ok(byId.get("screenshot-ignore").attachments[0].dataUrl.startsWith("data:image/"));

const capabilities = new Set(scenarios.map((scenario) => scenario.capability));
for (const capability of [
  "喂养记录",
  "睡眠记录",
  "提醒",
  "健康提醒边界",
  "记账",
  "记忆",
  "资料边界",
  "只读查询",
  "私密状态边界",
  "陪伴边界",
  "成长事件",
  "成长数据维护",
  "数据关联陪伴",
  "视觉/相册",
  "安全",
]) {
  assert.ok(capabilities.has(capability), `missing capability ${capability}`);
}

console.log("L2 coverage matrix tests passed");
