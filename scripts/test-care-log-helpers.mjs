#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-care-log-helpers-"));
const bundlePath = path.join(tempDir, "careLogHelpers.mjs");
const appStateDomainBundlePath = path.join(tempDir, "appStateDomain.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/utils/careLogHelpers.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/appStateDomain.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: appStateDomainBundlePath,
    logLevel: "silent",
  });

  const utils = await import(pathToFileURL(bundlePath).href);
  const appStateDomain = await import(pathToFileURL(appStateDomainBundlePath).href);
  assert.equal(typeof utils.mergeCareLog, "function", "mergeCareLog should be exported");
  assert.equal(typeof appStateDomain.normalizeClockText, "function", "normalizeClockText should be exported");

  const merged = utils.mergeCareLog([
    {
      id: "care-feed",
      date: "2026-06-05",
      milkMl: 100,
      milkTimes: 1,
      notes: ["今天喝了100ml母乳"],
      solids: [],
      events: [
        { id: "event-milk-1", type: "milk", date: "2026-06-05", time: "13:24", amountMl: 100 },
      ],
    },
  ], {
    date: "2026-06-05",
    milkMl: 100,
    milkTimes: 1,
    notes: ["今天9点多喝了100ml奶粉，喝完吐了"],
    events: [
      { id: "event-milk-2", type: "milk", date: "2026-06-05", time: "21:00", amountMl: 100 },
    ],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].milkMl, 200);
  assert.equal(merged[0].milkTimes, 2);
  assert.equal(merged[0].events.length, 2);
  assert.ok(merged[0].events.some((event) => event.time === "21:00" && event.amountMl === 100));
  assert.ok(merged[0].notes.includes("今天9点多喝了100ml奶粉，喝完吐了"));

  assert.equal(
    appStateDomain.normalizeClockText("十二点喝了100毫升奶粉", new Date("2026-06-06T00:21:00+08:00")),
    "00:00",
  );
  assert.equal(
    appStateDomain.normalizeClockText("中午十二点喝了100毫升奶粉", new Date("2026-06-06T00:21:00+08:00")),
    "12:00",
  );
  assert.equal(
    appStateDomain.normalizeClockText("6点半配方奶120ml", new Date("2026-06-06T20:00:00+08:00")),
    "18:30",
  );

  console.log("care log helper tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
