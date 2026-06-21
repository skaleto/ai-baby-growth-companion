#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-sleep-port-"));

try {
  const out = path.join(tempDir, "sleep-audio.mjs");
  let nativeCreateCalls = 0;
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/sleepAudio.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: out,
    logLevel: "silent",
    plugins: [{
      name: "sleep-audio-test-stubs",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: "capacitor-core", namespace: "stub" }));
        buildApi.onResolve({ filter: /^@mediagrid\/capacitor-native-audio$/ }, () => ({ path: "native-audio", namespace: "stub" }));
        buildApi.onLoad({ filter: /^capacitor-core$/, namespace: "stub" }, () => ({
          contents: `
            export const Capacitor = {
              isNativePlatform: () => true,
              getPlatform: () => "ios",
              isPluginAvailable: () => true
            };
          `,
          loader: "js",
        }));
        buildApi.onLoad({ filter: /^native-audio$/, namespace: "stub" }, () => ({
          contents: `
            export const AudioPlayer = {
              create: () => { globalThis.__sleepNativeCreateCalls = (globalThis.__sleepNativeCreateCalls || 0) + 1; return Promise.resolve(); },
              initialize: () => Promise.resolve(),
              play: () => Promise.resolve(),
              pause: () => Promise.resolve(),
              stop: () => Promise.resolve(),
              setVolume: () => Promise.resolve(),
              destroy: () => Promise.resolve(),
              onPlaybackStatusChange: () => Promise.resolve(),
              onAppLosesFocus: () => Promise.resolve()
            };
          `,
          loader: "js",
        }));
      },
    }],
  });

  const audioInstances = [];
  globalThis.__sleepNativeCreateCalls = 0;
  globalThis.Audio = class FakeAudio {
    constructor() {
      this.loop = false;
      this.src = "";
      this.volume = 1;
      this.currentTime = 0;
      this.listeners = new Map();
      audioInstances.push(this);
    }
    addEventListener(name, cb) { this.listeners.set(name, cb); }
    load() {}
    play() { this.listeners.get("play")?.(); return Promise.resolve(); }
    pause() { this.listeners.get("pause")?.(); }
  };

  const { createSleepAudioPort, isSleepAudioNative } = await import(pathToFileURL(out).href);
  assert.equal(isSleepAudioNative(), false, "本地哄睡音频在 native 壳内应走 WebView audio 回退");
  const port = createSleepAudioPort();
  await port.load({ id: "white", title: "白噪音", sourceKey: "white" });
  await port.play();

  nativeCreateCalls = globalThis.__sleepNativeCreateCalls;
  assert.equal(nativeCreateCalls, 0, "不应把 public/sleep-audio 相对路径交给原生播放器");
  assert.equal(audioInstances[0]?.src, "/sleep-audio/white.wav", "native 壳内也应使用可由 WebView 解析的哄睡音源");
  console.log("sleep audio port tests passed");
} finally {
  delete globalThis.Audio;
  delete globalThis.__sleepNativeCreateCalls;
  await rm(tempDir, { recursive: true, force: true });
}
