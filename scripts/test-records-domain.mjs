#!/usr/bin/env node
// recordsDomain 纯逻辑单测(D1 大拆分轮抽出的 care-log 数值/分段聚合)。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-records-domain-"));
const bundlePath = path.join(tempDir, "recordsDomain.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/recordsDomain.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const m = await import(pathToFileURL(bundlePath).href);
  const { positiveNumber, sumValues, totalForLog, countForLog, segmentValuesForLog, careEventsByKind } = m;

  // positiveNumber:只放行有意义正数。
  assert.equal(positiveNumber(120), 120);
  assert.equal(positiveNumber(0), undefined);
  assert.equal(positiveNumber(-3), undefined);
  assert.equal(positiveNumber(undefined), undefined);
  assert.equal(sumValues([1, 2, 3]), 6);

  // 逐条事件优先:总量=累加,次数=事件数,按时间排序。
  const logWithEvents = {
    date: "2026-06-29",
    events: [
      { id: "e2", type: "milk", time: "12:00", amountMl: 90 },
      { id: "e1", type: "milk", time: "08:00", amountMl: 120 },
      { id: "s1", type: "sleep", time: "13:00", durationHours: 1.5 },
    ],
  };
  assert.equal(totalForLog(logWithEvents, "milk"), 210, "milk 总量=120+90");
  assert.equal(countForLog(logWithEvents, "milk"), 2, "milk 次数=事件数");
  // 逐条事件量正确聚合(排序行为属 parseTimeSort,已由 test-care-log-helpers 覆盖,此处不重复)。
  assert.deepEqual(
    careEventsByKind(logWithEvents, "milk").map((i) => i.value).sort((a, b) => a - b),
    [90, 120],
    "milk 逐条事件量",
  );

  // 直填字段优先于逐条;无事件时按次数均分成段。
  const logDirect = { date: "2026-06-28", events: [], milkMl: 600, milkTimes: 4, sleepHours: 12 };
  assert.equal(totalForLog(logDirect, "milk"), 600, "直填 milkMl 优先");
  assert.equal(countForLog(logDirect, "milk"), 4, "直填 milkTimes 优先");
  assert.deepEqual(segmentValuesForLog(logDirect, "milk"), [150, 150, 150, 150], "600 按 4 次均分");

  // 空日:无总量、无次数、无分段。
  const empty = { date: "2026-06-27", events: [] };
  assert.equal(totalForLog(empty, "milk"), undefined);
  assert.equal(countForLog(empty, "milk"), undefined);
  assert.deepEqual(segmentValuesForLog(empty, "milk"), []);

  console.log("records domain tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
