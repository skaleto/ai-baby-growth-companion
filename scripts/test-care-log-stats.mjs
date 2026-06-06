#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-care-log-stats-"));
const bundlePath = path.join(tempDir, "careLogStats.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/utils/careLogStats.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const stats = await import(pathToFileURL(bundlePath).href);
  assert.equal(typeof stats.careLogWithEventStats, "function", "careLogWithEventStats should be exported");
  assert.equal(typeof stats.careLogsWithEventStats, "function", "careLogsWithEventStats should be exported");

  const normalized = stats.careLogWithEventStats({
    id: "care-today",
    date: "2026-06-06",
    milkMl: 100,
    milkTimes: 1,
    sleepHours: 1,
    wakes: 0,
    soothing: undefined,
    solids: [],
    poop: undefined,
    temperature: undefined,
    notes: [],
    events: [
      { id: "milk-1", type: "milk", date: "2026-06-06", time: "00:20", amountMl: 120 },
      { id: "milk-2", type: "milk", date: "2026-06-06", time: "01:10", amountMl: 20 },
      { id: "milk-3", type: "milk", date: "2026-06-06", time: "09:10", amountMl: 100, note: "喝完吐了" },
      { id: "sleep-1", type: "sleep", date: "2026-06-06", time: "10:00", durationHours: 1.25 },
      { id: "sleep-2", type: "sleep", date: "2026-06-06", time: "13:00", durationHours: 1.5 },
      { id: "poop-1", type: "poop", date: "2026-06-06", time: "14:00", note: "黄色软便" },
      { id: "poop-2", type: "poop", date: "2026-06-06", time: "18:00", note: "少量" },
      { id: "temp-1", type: "temperature", date: "2026-06-06", time: "19:00", temperature: 36.8 },
    ],
  });

  assert.equal(normalized.milkMl, 240, "milk total should be derived from milk events");
  assert.equal(normalized.milkTimes, 3, "milk count should be derived from milk events");
  assert.equal(normalized.sleepHours, 2.8, "sleep total should be derived from sleep events and rounded to one decimal");
  assert.equal(normalized.poop, "少量", "poop text should use the latest poop event note");
  assert.equal(normalized.temperature, 36.8, "temperature should use the latest temperature event");
  assert.equal(normalized.events.length, 8, "event details should be preserved");

  const fallback = stats.careLogWithEventStats({
    id: "legacy-care",
    date: "2026-06-05",
    milkMl: 180,
    milkTimes: 2,
    sleepHours: 3,
    wakes: 1,
    soothing: "normal",
    solids: [],
    notes: [],
    events: [],
  });

  assert.equal(fallback.milkMl, 180, "legacy aggregate milk total should remain fallback when events are absent");
  assert.equal(fallback.milkTimes, 2, "legacy aggregate milk count should remain fallback when events are absent");
  assert.equal(fallback.sleepHours, 3, "legacy aggregate sleep total should remain fallback when events are absent");

  console.log("care log stats tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
