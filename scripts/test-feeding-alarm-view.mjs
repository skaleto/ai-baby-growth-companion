#!/usr/bin/env node
// 喂奶闹钟派生纯函数单测(esbuild 打包后在 node 跑,守纯模块红线)。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-feeding-alarm-"));
const bundlePath = path.join(tempDir, "feedingAlarmView.mjs");
try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/feedingAlarmView.ts")],
    bundle: true, platform: "node", format: "esm", outfile: bundlePath, logLevel: "silent",
  });
  const m = await import(pathToFileURL(bundlePath).href);
  assert.equal(typeof m.computeFeedingAlarmView, "function", "应导出 computeFeedingAlarmView");
  assert.equal(typeof m.formatDurationCompact, "function", "应导出 formatDurationCompact");

  const now = 1_000_000_000_000;
  const daily = m.computeFeedingAlarmView({ dueAtMs: now + 100 * 60000, intervalMinutes: 180, lastMilkAtMs: now - 80 * 60000, nowMs: now });
  assert.equal(daily.hasAlarm, true);
  assert.equal(daily.overdue, false);
  assert.equal(daily.untilNextMs, 100 * 60000);
  assert.equal(daily.sinceLastMs, 80 * 60000);

  const due = m.computeFeedingAlarmView({ dueAtMs: now - 15 * 60000, intervalMinutes: 180, lastMilkAtMs: now - 195 * 60000, nowMs: now });
  assert.equal(due.overdue, true, "dueAt 已过应 overdue");
  assert.ok(due.untilNextMs < 0, "过点 untilNextMs 应为负");

  const none = m.computeFeedingAlarmView({ dueAtMs: null, intervalMinutes: null, lastMilkAtMs: now - 60 * 60000, nowMs: now });
  assert.equal(none.hasAlarm, false, "无闹钟 hasAlarm=false");
  assert.equal(none.untilNextMs, null);

  const noMilk = m.computeFeedingAlarmView({ dueAtMs: now + 60 * 60000, intervalMinutes: 180, lastMilkAtMs: null, nowMs: now });
  assert.equal(noMilk.sinceLastMs, null, "无喝奶记录 sinceLastMs=null");

  assert.equal(m.formatDurationCompact(80 * 60000), "1小时20分");
  assert.equal(m.formatDurationCompact(45 * 60000), "45分");
  assert.equal(m.formatDurationCompact(120 * 60000), "2小时");
  assert.equal(m.formatDurationCompact(30 * 1000), "刚刚");

  console.log("feeding alarm view tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
