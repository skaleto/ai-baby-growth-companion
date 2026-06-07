#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-media-capture-date-"));
const bundlePath = path.join(tempDir, "mediaCaptureDate.mjs");
const pad2 = (value) => `${value}`.padStart(2, "0");
const localIsoSeconds = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/mediaCaptureDate.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const mediaDate = await import(pathToFileURL(bundlePath).href);

  assert.equal(typeof mediaDate.parseExifDateTimeText, "function", "EXIF date text parser should be exported");
  assert.equal(typeof mediaDate.resolveMediaCaptureDate, "function", "media capture date resolver should be exported");

  assert.equal(
    mediaDate.parseExifDateTimeText("2026:06:01 09:08:07"),
    "2026-06-01T09:08:07",
    "EXIF DateTimeOriginal should become an ISO-like local timestamp",
  );
  assert.equal(mediaDate.parseExifDateTimeText("bad input"), undefined, "invalid EXIF date text should be ignored");

  const oldLastModified = Date.parse("2026-05-20T10:11:12.000Z");
  const fileWithLastModified = new File(["x"], "baby.jpg", {
    type: "image/jpeg",
    lastModified: oldLastModified,
  });
  assert.equal(
    await mediaDate.resolveMediaCaptureDate(fileWithLastModified, "2026-06-04T12:00:00+08:00"),
    localIsoSeconds(new Date(oldLastModified)),
    "file lastModified should be used before upload timestamp when EXIF is unavailable",
  );

  const fileWithoutUsefulDate = new File(["x"], "baby.png", {
    type: "image/png",
    lastModified: 0,
  });
  assert.equal(
    await mediaDate.resolveMediaCaptureDate(fileWithoutUsefulDate, "2026-06-04T12:00:00+08:00"),
    "2026-06-04T12:00:00+08:00",
    "upload timestamp should be the final fallback",
  );

  console.log("media capture date tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
