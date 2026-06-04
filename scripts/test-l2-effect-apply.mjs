#!/usr/bin/env node
import assert from "node:assert/strict";

import { applyEffectDecisions } from "./l2-benchmark/effect-apply.mjs";

function jsonResponse(state = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { state };
    },
    async text() {
      return JSON.stringify({ state });
    },
  };
}

function makeFetchRecorder() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    return jsonResponse();
  };
  return { calls, fetchImpl };
}

async function careLogAutoWritesMergedDailySnapshot() {
  const { calls, fetchImpl } = makeFetchRecorder();

  const result = await applyEffectDecisions({
    baseUrl: "http://l2.test",
    token: "token-1",
    scenarioId: "feed-complete",
    now: "2026-06-04T12:00:00+08:00",
    beforeState: { careLogs: [] },
    finalResponse: {
      effectDecisions: [
        {
          type: "careLog",
          mode: "auto",
          payload: {
            date: "2026-06-04",
            events: [{ type: "milk", time: "18:30", amountMl: 120 }],
          },
        },
      ],
    },
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(
    calls[0].url,
    "http://l2.test/api/app/state/careLogs/l2-feed-complete-care-2026-06-04?mode=replace",
  );
  assert.equal(calls[0].body.date, "2026-06-04");
  assert.equal(calls[0].body.milkMl, 120);
  assert.equal(calls[0].body.milkTimes, 1);
  assert.equal(calls[0].body.events[0].type, "milk");
  assert.equal(calls[0].body.events[0].amountMl, 120);
  assert.ok(calls[0].body.events[0].id);
  assert.deepEqual(result.applied.map((item) => item.collection), ["careLogs"]);
}

async function pendingEffectsStayPendingInsteadOfWritingFinalCollections() {
  const { calls, fetchImpl } = makeFetchRecorder();

  const result = await applyEffectDecisions({
    baseUrl: "http://l2.test",
    token: "token-1",
    scenarioId: "expense-and-growth-pending",
    now: "2026-06-04T12:00:00+08:00",
    beforeState: {},
    finalResponse: {
      safetyAlerts: [{ level: "warning", category: "health", message: "请观察宝宝状态" }],
      tags: ["待确认"],
      effectDecisions: [
        {
          type: "expenseItem",
          mode: "pending",
          payload: { title: "奶粉", amount: 268, category: "formula", date: "2026-06-04" },
        },
        {
          type: "growthEvent",
          mode: "pending",
          payload: { title: "第一次翻身", date: "2026-06-04", summary: "今天第一次翻身了", tags: ["大运动"] },
        },
        {
          type: "growthMeasurement",
          mode: "pending",
          payload: { type: "height", value: 68.2, date: "2026-06-04", note: "今天身高68.2cm" },
        },
        {
          type: "growthMeasurement",
          mode: "pending",
          payload: { type: "weight", value: 7.4, date: "2026-06-04", note: "今天体重7.4kg" },
        },
        {
          type: "careLog",
          mode: "ask",
          payload: { question: "喝完后告诉我奶量就好" },
        },
      ],
    },
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(
    calls[0].url,
    "http://l2.test/api/app/state/pendingEffects/l2-expense-and-growth-pending-pending-20260604120000?mode=merge",
  );
  assert.equal(calls[0].body.status, "pending");
  assert.equal(calls[0].body.expenses.length, 1);
  assert.equal(calls[0].body.expenses[0].amount, 268);
  assert.equal(calls[0].body.growthEvent.title, "第一次翻身");
  assert.equal(calls[0].body.growthMeasurements.length, 2);
  assert.equal(calls[0].body.growthMeasurements[0].type, "height");
  assert.equal(calls[0].body.growthMeasurements[1].value, 7.4);
  assert.equal(calls[0].body.safetyAlerts.length, 1);
  assert.equal(calls[0].body.careLogPatch, undefined);
  assert.deepEqual(result.applied.map((item) => item.collection), ["pendingEffects"]);
}

async function autoReminderWritesReminderCollection() {
  const { calls, fetchImpl } = makeFetchRecorder();

  await applyEffectDecisions({
    baseUrl: "http://l2.test",
    token: "token-1",
    scenarioId: "reminder-once",
    now: "2026-06-04T12:00:00+08:00",
    beforeState: {},
    finalResponse: {
      effectDecisions: [
        {
          type: "reminder",
          mode: "auto",
          payload: {
            title: "提醒喂奶",
            scheduleMode: "once",
            alertMode: "notification",
            dueText: "今天 10:45",
          },
        },
      ],
    },
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].url, "http://l2.test/api/app/state/reminders/l2-reminder-once-reminder-0?mode=merge");
  assert.equal(calls[0].body.id, "l2-reminder-once-reminder-0");
  assert.equal(calls[0].body.scheduleMode, "once");
  assert.equal(calls[0].body.alertMode, "notification");
}

async function pendingReminderAndMemoryWritePendingEffectDraft() {
  const { calls, fetchImpl } = makeFetchRecorder();

  await applyEffectDecisions({
    baseUrl: "http://l2.test",
    token: "token-1",
    scenarioId: "health-reminder-and-memory",
    now: "2026-06-04T12:00:00+08:00",
    beforeState: {},
    finalResponse: {
      effectDecisions: [
        {
          type: "reminder",
          mode: "pending",
          payload: {
            title: "用药提醒",
            scheduleMode: "once",
            alertMode: "notification",
            category: "custom",
            dueText: "明天 09:00",
          },
        },
        {
          type: "memory",
          mode: "pending",
          payload: {
            text: "小宝吃鸡蛋会起疹子",
            category: "health",
            confidence: 0.84,
          },
        },
      ],
    },
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(
    calls[0].url,
    "http://l2.test/api/app/state/pendingEffects/l2-health-reminder-and-memory-pending-20260604120000?mode=merge",
  );
  assert.equal(calls[0].body.reminders.length, 1);
  assert.equal(calls[0].body.reminders[0].scheduleMode, "once");
  assert.equal(calls[0].body.memories.length, 1);
  assert.equal(calls[0].body.memories[0].category, "health");
}

await careLogAutoWritesMergedDailySnapshot();
await pendingEffectsStayPendingInsteadOfWritingFinalCollections();
await autoReminderWritesReminderCollection();
await pendingReminderAndMemoryWritePendingEffectDraft();

console.log("L2 effect apply tests passed");
