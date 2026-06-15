#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-sleep-catalog-"));
try {
  const out = path.join(tempDir, "catalog.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/sleepAudioCatalog.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const m = await import(pathToFileURL(out).href);
  assert.ok(Array.isArray(m.SLEEP_TRACKS) && m.SLEEP_TRACKS.length >= 3, "应有曲目表");
  const ids = m.SLEEP_TRACKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "id 必须唯一");
  for (const t of m.SLEEP_TRACKS) {
    assert.ok(t.id && t.title && t.sourceKey && t.icon, `字段完备: ${t.id}`);
    assert.ok(t.category === "whitenoise" || t.category === "lullaby", `合法分类: ${t.id}`);
    assert.equal(typeof t.available, "boolean", `available 是布尔: ${t.id}`);
  }
  const avail = m.availableSleepTracks();
  assert.ok(avail.every((t) => t.available), "availableSleepTracks 只含已就位");
  assert.ok(avail.some((t) => t.id === "white"), "white 应可用");
  assert.equal(m.sleepTrackById("white")?.title, "白噪音");
  assert.equal(m.sleepTrackById("nope"), undefined);

  const sout = path.join(tempDir, "source.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/sleepAudioSource.ts")], bundle: true, platform: "node", format: "esm", outfile: sout, logLevel: "silent" });
  const s = await import(pathToFileURL(sout).href);
  assert.equal(s.resolveSleepAudioSource("white", false), "/sleep-audio/white.wav", "web 源");
  assert.equal(s.resolveSleepAudioSource("white", true), "public/sleep-audio/white.wav", "native 源");

  console.log("sleep audio catalog tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
