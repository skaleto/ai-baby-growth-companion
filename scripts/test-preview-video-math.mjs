#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-preview-video-math-"));
const bundlePath = path.join(tempDir, "previewVideoMath.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/components/previewVideoMath.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const m = await import(pathToFileURL(bundlePath).href);

  assert.equal(typeof m.clamp01, "function", "clamp01 should be exported");
  assert.equal(typeof m.progressFraction, "function", "progressFraction should be exported");
  assert.equal(typeof m.seekTimeFromFraction, "function", "seekTimeFromFraction should be exported");
  assert.equal(typeof m.fractionFromPointer, "function", "fractionFromPointer should be exported");

  // clamp01
  assert.equal(m.clamp01(-0.5), 0);
  assert.equal(m.clamp01(1.5), 1);
  assert.equal(m.clamp01(0.3), 0.3);

  // progressFraction: currentTime / duration, clamped; 0 when duration invalid
  assert.equal(m.progressFraction(5, 10), 0.5);
  assert.equal(m.progressFraction(20, 10), 1, "overrun clamps to 1");
  assert.equal(m.progressFraction(5, 0), 0, "zero duration → 0");
  assert.equal(m.progressFraction(5, Number.NaN), 0, "NaN duration → 0");
  assert.equal(m.progressFraction(5, Infinity), 0, "infinite duration → 0");

  // seekTimeFromFraction: fraction * duration, clamped; 0 when duration invalid
  assert.equal(m.seekTimeFromFraction(0.5, 10), 5);
  assert.equal(m.seekTimeFromFraction(2, 10), 10, "over-1 fraction clamps");
  assert.equal(m.seekTimeFromFraction(-1, 10), 0, "negative fraction clamps");
  assert.equal(m.seekTimeFromFraction(0.5, 0), 0, "zero duration → 0");

  // fractionFromPointer: (clientX - left) / width, clamped
  assert.equal(m.fractionFromPointer(50, 0, 100), 0.5);
  assert.equal(m.fractionFromPointer(-10, 0, 100), 0, "left of bar clamps to 0");
  assert.equal(m.fractionFromPointer(150, 0, 100), 1, "right of bar clamps to 1");
  assert.equal(m.fractionFromPointer(60, 10, 100), 0.5, "honors left offset");
  assert.equal(m.fractionFromPointer(50, 0, 0), 0, "zero width → 0");

  console.log("preview video math tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
