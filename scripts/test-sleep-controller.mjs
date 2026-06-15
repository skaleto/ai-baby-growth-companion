#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-sleep-ctrl-"));
try {
  const out = path.join(tempDir, "ctrl.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/sleepPlaybackController.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const { createSleepController } = await import(pathToFileURL(out).href);

  // 假时钟:手动推进。
  let nowMs = 0; const timers = [];
  const clock = {
    now: () => nowMs,
    setTimeout: (fn, ms) => { const id = timers.length; timers.push({ at: nowMs + ms, fn, id, live: true }); return id; },
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.live = false; },
  };
  const advance = (ms) => { nowMs += ms; timers.filter((t) => t.live && t.at <= nowMs).sort((a, b) => a.at - b.at).forEach((t) => { t.live = false; t.fn(); }); };

  const calls = [];
  const port = {
    load: async (t) => calls.push(["load", t.id]),
    play: async () => calls.push(["play"]),
    pause: async () => calls.push(["pause"]),
    stop: async () => calls.push(["stop"]),
    setVolume: async (v) => calls.push(["vol", Math.round(v * 100) / 100]),
    onStatus: () => () => {}, onInterruptionPause: () => () => {},
  };

  const ctrl = createSleepController({ port, clock, fadeMs: 30000, fadeSteps: 6 });
  await ctrl.playTrack({ id: "white", title: "白噪音", sourceKey: "white" });
  assert.deepEqual(calls[0], ["vol", 1], "起播应先复位音量到 1");
  assert.ok(calls.some((c) => c[0] === "load" && c[1] === "white"), "应 load 白噪音");
  assert.ok(calls.some((c) => c[0] === "play"), "应 play");

  // 定时 30 分钟:末 30s(从 29:30 起)淡出,30:00 stop。
  calls.length = 0;
  ctrl.setTimer(30);
  advance(29 * 60000 + 40000); // 推到 29:40,淡出已起(首两步触发)
  const vols = calls.filter((c) => c[0] === "vol").map((c) => c[1]);
  assert.ok(vols.length >= 1 && vols[vols.length - 1] < 1, "淡出应已开始递降");
  advance(20000); // 推到 30:00
  assert.ok(calls.some((c) => c[0] === "vol" && c[1] === 0), "末尾音量应到 0");
  assert.ok(calls.some((c) => c[0] === "stop"), "到点应 stop");

  // 「不限时」= 不排定时。
  const ctrl2 = createSleepController({ port, clock, fadeMs: 30000, fadeSteps: 6 });
  calls.length = 0;
  await ctrl2.playTrack({ id: "womb", title: "子宫声", sourceKey: "womb" });
  ctrl2.setTimer(null);
  advance(10 * 60 * 60000);
  assert.ok(!calls.some((c) => c[0] === "stop"), "不限时不得自动停");

  // 重设定时应清掉旧定时(切档不叠加)。
  const ctrl3 = createSleepController({ port, clock, fadeMs: 30000, fadeSteps: 6 });
  ctrl3.setTimer(15);
  ctrl3.setTimer(null); // 取消
  calls.length = 0;
  advance(60 * 60000);
  assert.ok(!calls.some((c) => c[0] === "stop"), "取消定时后不得再停");

  console.log("sleep controller tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
