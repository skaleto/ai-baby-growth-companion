#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-daily-summary-"));
const bundlePath = path.join(tempDir, "dailySummary.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/utils/dailySummary.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const utils = await import(pathToFileURL(bundlePath).href);

  assert.equal(typeof utils.buildCareStats, "function", "buildCareStats should be exported");
  assert.equal(typeof utils.buildGrowthStats, "function", "buildGrowthStats should be exported");
  assert.equal(typeof utils.countTodayDataPoints, "function", "countTodayDataPoints should be exported");
  assert.equal(typeof utils.summarizeCareLogEffect, "function", "summarizeCareLogEffect should be exported");
  assert.equal(typeof utils.buildCaregiverCompanionLine, "function", "buildCaregiverCompanionLine should be exported");
  assert.equal(typeof utils.buildHandoffSummary, "function", "buildHandoffSummary should be exported");

  const careLog = {
    id: "care-1",
    date: "2026-06-02",
    milkMl: 620,
    milkTimes: 5,
    sleepHours: 11.25,
    wakes: 3,
    soothing: "normal",
    solids: ["米粉"],
    poop: "便便 1 次",
    temperature: 36.8,
    notes: ["外出晒太阳"],
    events: [
      { id: "milk-1", type: "milk", date: "2026-06-02", time: "03:00", amountMl: 120 },
      { id: "sleep-1", type: "sleep", date: "2026-06-02", time: "13:00", durationHours: 1.5 },
      { id: "poop-1", type: "poop", date: "2026-06-02", time: "17:00" },
    ],
  };

  const careStats = utils.buildCareStats(careLog);
  assert.deepEqual(
    careStats.map((stat) => [stat.key, stat.label, stat.value, stat.detail, stat.empty]),
    [
      ["feeding", "喂养", "620 ml", "5 次喂养", false],
      ["sleep", "睡眠", "11.3 小时", "夜醒 3 次", false],
      ["care", "护理", "便便已记录", "体温 36.8", false],
    ],
  );

  const emptyCareStats = utils.buildCareStats(null);
  assert.deepEqual(
    emptyCareStats.map((stat) => [stat.key, stat.value, stat.detail, stat.empty]),
    [
      ["feeding", "还没看到喂养记录", "可以先随手记一条", true],
      ["sleep", "还没看到睡眠记录", "有记录会更完整", true],
      ["care", "还没看到护理记录", "便便、体温或备注都可以", true],
    ],
  );

  const growthStats = utils.buildGrowthStats([
    { id: "h-old", type: "height", value: 67.1, date: "2026-05-20" },
    { id: "h-new", type: "height", value: 68.2, date: "2026-06-01" },
    { id: "w-new", type: "weight", value: 7.35, date: "2026-06-02" },
    { id: "head-future", type: "headCircumference", value: 43.2, date: "2026-06-03" },
  ], "2026-06-02");

  assert.equal(growthStats.key, "growth");
  assert.equal(growthStats.label, "成长");
  assert.equal(growthStats.value, "体重 7.35 kg");
  assert.equal(growthStats.detail, "身高 68.2 cm · 06-02");
  assert.equal(growthStats.empty, false);

  assert.equal(utils.countTodayDataPoints(careLog, [], "2026-06-02"), 12);
  assert.equal(
    utils.countTodayDataPoints(careLog, [{ id: "w-new", type: "weight", value: 7.35, date: "2026-06-02" }], "2026-06-02"),
    13,
  );

  assert.deepEqual(
    utils.summarizeCareLogEffect({
      milkMl: 120,
      sleepHours: 1.5,
      poop: "便便 1 次",
      temperature: 36.8,
      notes: ["换尿布"],
    }),
    ["喝奶 120 ml", "睡眠 1.5 小时", "便便已记录", "体温 36.8", "换尿布"],
  );

  const companionLine = utils.buildCaregiverCompanionLine(careLog, [
    { id: "w-new", type: "weight", value: 7.35, date: "2026-06-02" },
  ], "2026-06-02");
  assert.equal(companionLine, "昨晚记录到 3 次夜醒，你真的辛苦了。我先帮你把今天的交接整理好。");
  for (const word of ["产后抑郁", "焦虑症", "抑郁症", "异常", "应该", "治疗", "落后同龄"]) {
    assert.equal(companionLine.includes(word), false, `companion line should not contain ${word}`);
  }

  assert.equal(
    utils.buildCaregiverCompanionLine(null, [], "2026-06-02"),
    "今天记录还不多，没关系，我先帮你收着已有的。",
  );

  const handoff = utils.buildHandoffSummary({
    babyNickname: "小宝",
    careLog,
    growthMeasurements: [{ id: "w-new", type: "weight", value: 7.35, date: "2026-06-02" }],
    selectedDate: "2026-06-02",
    reminders: [
      { id: "r-done", title: "洗澡", status: "done", dueText: "今天 20:00", category: "care", createdAt: "2026-06-02T10:00:00+08:00", history: [] },
      { id: "r-open", title: "复查体温", status: "open", dueText: "今天 22:00", category: "care", createdAt: "2026-06-02T10:00:00+08:00", history: [] },
    ],
    pendingEffectCount: 2,
    observations: ["晚 8 点洗澡提醒还没标完成。"],
  });
  assert.deepEqual(handoff.sections.map((section) => section.title), ["宝宝今天", "已完成", "待接手", "留意一下"]);
  assert.equal(handoff.sections[0].items[0], "喂养：620 ml，5 次");
  assert.equal(handoff.sections[0].items[1], "睡眠：11.3 小时，夜醒 3 次");
  assert.equal(handoff.sections[0].items[2], "护理：便便已记录，体温 36.8");
  assert.equal(handoff.sections[0].items[3], "成长：体重 7.35 kg");
  assert.ok(handoff.copyText.includes("小宝今天："));
  assert.ok(handoff.copyText.includes("待确认记录 2 条"));
  assert.equal(handoff.copyText.includes("异常"), false);

  console.log("daily summary utils tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
