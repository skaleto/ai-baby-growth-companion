# 哄睡音乐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 App 加一套哄睡音频——内置离线白噪音/摇篮曲,息屏续播 + 锁屏控制 + 睡眠定时(末段淡出),暗色播放页,从记录页入口打开。

**Architecture:** 第三方原生插件 `@mediagrid/capacitor-native-audio`(原生引擎,不碰 WebView 音频)走后台 + 锁屏控制。端口层 `sleepAudio.ts` 把插件包在边界后面、Web 用 `<audio>` 回退(浏览器可开发可测);纯模块 `sleepAudioCatalog.ts` 是曲目注册表;纯控制器 `sleepPlaybackController.ts` 管定时 + 淡出;`useSleepAudio` 把控制器接到 React;暗色 `SleepMusicScreen` 全屏 portal 打开。后端零改动。

**Tech Stack:** Capacitor 8 + `@mediagrid/capacitor-native-audio` v3,React/TS,esbuild(纯模块 node 单测),Playwright(web 回退 DOM smoke)。

**设计稿:** `docs/architecture/sleep-music-design.md`

---

## ⚠️ 两个执行前必须知道的依赖

1. **原生 + 真机**:本功能装原生插件 + 改 iOS/安卓原生工程,**不能 OTA**,要发新原生包。后台续播/锁屏控制/音频焦点中断**无法 headless 测**,只能真机自查(Task 8 清单)。需要能跑 `npx cap sync` 且(发布时)有 Xcode / Android Studio。
2. **音频内容**:白噪音/子宫声/吹风机可**程序生成**(Task 2,真·免版税);**雨声/海浪/心跳/摇篮曲是录音**,代码造不出——v1 先上可生成的三条,其余在 catalog 留 `available:false` 占位,**作为内容任务**把免版税文件丢进 `frontend/public/sleep-audio/` 即自动点亮(文件名见 Task 3)。**绝不用受版权保护的现成录音。**

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `frontend/src/sleepAudioCatalog.ts` | 纯:曲目注册表 `{id,title,category,sourceKey,icon,available}` | 新建 |
| `frontend/src/sleepAudioSource.ts` | 纯:`resolveSleepAudioSource(key, native)` 解析平台音源路径 | 新建 |
| `frontend/src/sleepAudio.ts` | 端口层:包 mediagrid 插件 + Web `<audio>` 回退 | 新建 |
| `frontend/src/sleepPlaybackController.ts` | 纯控制器:播放态 + 睡眠定时 + 末段淡出(注入 port+clock,可测) | 新建 |
| `frontend/src/hooks/useSleepAudio.ts` | React 绑定:把控制器接到组件状态 | 新建 |
| `frontend/src/screens/SleepMusicScreen.tsx` | 暗色全屏播放页 | 新建 |
| `frontend/src/components/SleepMusicCard.tsx` | 记录页入口卡片 | 新建 |
| `frontend/src/styles/mobile-app.css` | 入口卡片 + 播放页样式(暗色) | 追加 |
| `frontend/public/sleep-audio/*.wav` | 内置音频(生成的噪音 + 占位录音) | 新建 |
| `frontend/src/App.tsx` | 挂入口卡片 + 全屏 portal + 开关状态 | 修改 |
| `scripts/gen-sleep-noise.mjs` | 生成可循环白/棕/粉噪音 WAV | 新建 |
| `scripts/test-sleep-audio-catalog.mjs` | catalog + source 纯单测 | 新建 |
| `scripts/test-sleep-controller.mjs` | 控制器定时/淡出单测(mock port + 假时钟) | 新建 |
| `scripts/test-sleep-music-smoke.mjs` | DOM smoke(web 回退) | 新建 |
| `android/app/src/main/AndroidManifest.xml` | AudioPlayerService + 前台服务权限 | 修改 |
| `ios/App/App/Info.plist` | `UIBackgroundModes: audio` | 修改 |
| `package.json` | 装插件 + 注册测试脚本 | 修改 |

---

## Task 1: 装插件 + 原生后台音频配置

**Files:** `package.json`, `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist`

- [ ] **Step 1: 安装插件**

Run: `npm install @mediagrid/capacitor-native-audio`
Expected: 加入 `dependencies`;无 peerDep 报错(Cap 8 兼容 v3+)。

- [ ] **Step 2: 确认插件 JS 导出名**

Run: `node -e "import('@mediagrid/capacitor-native-audio').then(m=>console.log(Object.keys(m)))"`
Expected: 打印导出键,应含 `AudioPlayer`(端口层将 `import { AudioPlayer } from "@mediagrid/capacitor-native-audio"`)。若导出名不同,记下真实名,Task 4 端口层据此改。

- [ ] **Step 3: 安卓清单——加前台媒体服务 + 权限**

在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 内(与现有 `.AlarmReceiver` 同级)加:
```xml
<service
    android:name="us.mediagrid.capacitorjs.plugins.nativeaudio.AudioPlayerService"
    android:foregroundServiceType="mediaPlayback"
    android:exported="true">
    <intent-filter>
        <action android:name="androidx.media3.session.MediaSessionService" />
    </intent-filter>
</service>
```
并在权限区(现有 `WAKE_LOCK` 旁)补两条(`WAKE_LOCK` 已存在,不重复):
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

- [ ] **Step 4: iOS——开后台音频模式**

在 `ios/App/App/Info.plist` 顶层 `<dict>` 内加(若已存在 `UIBackgroundModes` 则只并入 `audio`):
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

- [ ] **Step 5: 同步原生工程**

Run: `npm run build && npx cap sync`
Expected: `cap sync` 列出 `@mediagrid/capacitor-native-audio` 已加入 android & ios;无报错。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json android/app/src/main/AndroidManifest.xml ios/App/App/Info.plist
git commit -m "feat(sleep-music): 装 @mediagrid/capacitor-native-audio + iOS/安卓后台音频配置"
```

---

## Task 2: 生成可循环噪音音频(白/子宫声/吹风机)

**Files:** `scripts/gen-sleep-noise.mjs`, `frontend/public/sleep-audio/*.wav`, `package.json`

- [ ] **Step 1: 写生成脚本** `scripts/gen-sleep-noise.mjs`

```javascript
#!/usr/bin/env node
// 生成可无缝循环的噪音 WAV(免版税,代码造):white=白噪音,brown≈子宫声,pink≈吹风机。
// 16-bit PCM 单声道 22050Hz 15s。白噪音随机,循环天然无缝。
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(rootDir, "frontend/public/sleep-audio");
const SR = 22050, SECONDS = 15, N = SR * SECONDS;

function pcmToWav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, samples[i] | 0)), 44 + i * 2);
  return buf;
}
const white = () => { const s = new Float32Array(N); for (let i = 0; i < N; i++) s[i] = Math.random() * 2 - 1; return s; };
const brown = () => { const s = new Float32Array(N); let last = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; s[i] = last * 3.5; } return s; };
const pink = () => { const s = new Float32Array(N); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + 0.0299 * w; b1 = 0.985 * b1 + 0.0750 * w; b2 = 0.950 * b2 + 0.1538 * w; s[i] = (b0 + b1 + b2 + 0.18 * w) * 0.5; } return s; };
const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = f[i] * 9000; return o; };

await mkdir(outDir, { recursive: true });
for (const [key, gen] of [["white", white], ["womb", brown], ["fan", pink]]) {
  await writeFile(path.join(outDir, `${key}.wav`), pcmToWav(toI16(gen())));
  console.log("wrote", key + ".wav");
}
console.log("sleep noise generated");
```

- [ ] **Step 2: 生成 + 自检**

Run: `node scripts/gen-sleep-noise.mjs && ls -la frontend/public/sleep-audio/`
Expected: 三个文件 `white.wav` `womb.wav` `fan.wav`(各约 ~650KB),打印 `sleep noise generated`。

- [ ] **Step 3: 注册脚本(便于将来重生成)**

`package.json` `"scripts"` 加:
```json
"gen:sleep-noise": "node scripts/gen-sleep-noise.mjs",
```

- [ ] **Step 4: 内容任务占位说明**

新建 `frontend/public/sleep-audio/README.md`:
```markdown
# 内置哄睡音频

- `white.wav` / `womb.wav` / `fan.wav`:`npm run gen:sleep-noise` 程序生成(免版税)。
- 待补(内容任务,丢入同目录、用下列文件名即在 App 中自动点亮,见 sleepAudioCatalog.ts 的 available 开关):
  - `rain.wav` 雨声 · `waves.wav` 海浪 · `heartbeat.wav` 心跳 · `lullaby-1.wav` 摇篮曲
  - **只用免版税来源**(如 freesound.org CC0)。补齐后把 sleepAudioCatalog.ts 对应项 available 改 true。
```

- [ ] **Step 5: 提交**

```bash
git add scripts/gen-sleep-noise.mjs frontend/public/sleep-audio package.json
git commit -m "feat(sleep-music): 生成可循环噪音(白/子宫声/吹风机)+ 音频内容占位说明"
```

---

## Task 3: 曲目注册表 `sleepAudioCatalog.ts`(纯,TDD)

**Files:** Create `frontend/src/sleepAudioCatalog.ts`; Test `scripts/test-sleep-audio-catalog.mjs`; Modify `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-sleep-audio-catalog.mjs`

```javascript
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
  console.log("sleep audio catalog tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-sleep-audio-catalog.mjs`
Expected: FAIL(esbuild 找不到 `sleepAudioCatalog.ts`)。

- [ ] **Step 3: 写实现** `frontend/src/sleepAudioCatalog.ts`

```typescript
// 哄睡曲目注册表(纯模块:无 React / 无资源 import,守纯模块红线,可进 node 单测)。
// available=false 的是「内容任务」占位:把对应 <sourceKey>.wav 丢进 frontend/public/sleep-audio/ 后改 true。
export type SleepTrackCategory = "whitenoise" | "lullaby";

export type SleepTrack = {
  id: string;
  title: string;
  category: SleepTrackCategory;
  sourceKey: string; // 对应 public/sleep-audio/<sourceKey>.wav
  icon: string; // lucide 图标名,UI 侧映射
  available: boolean;
};

export const SLEEP_TRACKS: SleepTrack[] = [
  { id: "white", title: "白噪音", category: "whitenoise", sourceKey: "white", icon: "volume-2", available: true },
  { id: "womb", title: "子宫声", category: "whitenoise", sourceKey: "womb", icon: "heart", available: true },
  { id: "fan", title: "吹风机", category: "whitenoise", sourceKey: "fan", icon: "wind", available: true },
  { id: "rain", title: "雨声", category: "whitenoise", sourceKey: "rain", icon: "droplet", available: false },
  { id: "waves", title: "海浪", category: "whitenoise", sourceKey: "waves", icon: "ripple", available: false },
  { id: "heartbeat", title: "心跳", category: "whitenoise", sourceKey: "heartbeat", icon: "activity", available: false },
  { id: "lullaby-1", title: "摇篮曲", category: "lullaby", sourceKey: "lullaby-1", icon: "music", available: false },
];

export const availableSleepTracks = (): SleepTrack[] => SLEEP_TRACKS.filter((track) => track.available);
export const sleepTrackById = (id: string): SleepTrack | undefined => SLEEP_TRACKS.find((track) => track.id === id);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-sleep-audio-catalog.mjs`
Expected: PASS `sleep audio catalog tests passed`。

- [ ] **Step 5: 注册** `package.json`:`"test:sleep-catalog": "node scripts/test-sleep-audio-catalog.mjs",` 并挂进 `verify:frontend`(早段纯测里,接在 `test:feeding-alarm-view` 之后 ` && npm run test:sleep-catalog`)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/sleepAudioCatalog.ts scripts/test-sleep-audio-catalog.mjs package.json
git commit -m "feat(sleep-music): 曲目注册表 sleepAudioCatalog(纯,含单测)"
```

---

## Task 4: 音源解析 + 端口层 `sleepAudio.ts`

**Files:** Create `frontend/src/sleepAudioSource.ts`, `frontend/src/sleepAudio.ts`; Test 复用 `scripts/test-sleep-audio-catalog.mjs`(追加)

- [ ] **Step 1: 给 catalog 测试追加 source 断言**

在 `scripts/test-sleep-audio-catalog.mjs` 的 `console.log(...)` 之前插入(同一 bundle 入口改为同时导出;此处单独 bundle source 模块):
```javascript
  const sout = path.join(tempDir, "source.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/sleepAudioSource.ts")], bundle: true, platform: "node", format: "esm", outfile: sout, logLevel: "silent" });
  const s = await import(pathToFileURL(sout).href);
  assert.equal(s.resolveSleepAudioSource("white", false), "/sleep-audio/white.wav", "web 源");
  assert.equal(s.resolveSleepAudioSource("white", true), "public/sleep-audio/white.wav", "native 源");
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-sleep-audio-catalog.mjs`
Expected: FAIL(找不到 `sleepAudioSource.ts`)。

- [ ] **Step 3: 写音源解析** `frontend/src/sleepAudioSource.ts`(纯)

```typescript
// 解析平台音源:Web 走 dist 根下的 /sleep-audio/*.wav;原生走插件期望的 public/ 相对路径。
// 注:native 路径格式以 mediagrid 为准——Task 8 真机首验,若不符在此一处改。
export function resolveSleepAudioSource(sourceKey: string, native: boolean): string {
  return native ? `public/sleep-audio/${sourceKey}.wav` : `/sleep-audio/${sourceKey}.wav`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-sleep-audio-catalog.mjs`
Expected: PASS。

- [ ] **Step 5: 写端口层** `frontend/src/sleepAudio.ts`(包插件 + Web 回退,照 nativeAlarm.ts 套路)

```typescript
// 哄睡音频端口层:原生用 @mediagrid/capacitor-native-audio(后台 + 锁屏控制),
// Web 用 <audio> 回退(无后台,仅供开发/测 UI)。上层只认本接口,不直接碰插件。
import { AudioPlayer } from "@mediagrid/capacitor-native-audio";
import { isNativePlatform, isPluginAvailable } from "./platform";
import { resolveSleepAudioSource } from "./sleepAudioSource";

export type SleepPlaybackStatus = "playing" | "paused" | "stopped";

export interface SleepAudioPort {
  load(track: { id: string; title: string; sourceKey: string }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>; // 0..1
  onStatus(cb: (status: SleepPlaybackStatus) => void): () => void;
  onInterruptionPause(cb: () => void): () => void; // 失去音频焦点 → 暂停
}

export const isSleepAudioNative = () => isNativePlatform() && isPluginAvailable("AudioPlayer");

const AUDIO_ID = "sleep-music";

function createNativePort(): SleepAudioPort {
  let loadedId: string | null = null;
  return {
    async load(track) {
      if (loadedId) { try { await AudioPlayer.destroy({ audioId: AUDIO_ID }); } catch { /* 首次无实例 */ } }
      await AudioPlayer.create({
        audioId: AUDIO_ID,
        audioSource: resolveSleepAudioSource(track.sourceKey, true),
        friendlyTitle: track.title,
        useForNotification: true,
        isBackgroundMusic: true,
        loop: true,
        showSeekBackward: false,
        showSeekForward: false,
      });
      await AudioPlayer.initialize({ audioId: AUDIO_ID });
      loadedId = track.id;
    },
    play: () => AudioPlayer.play({ audioId: AUDIO_ID }),
    pause: () => AudioPlayer.pause({ audioId: AUDIO_ID }),
    async stop() { await AudioPlayer.stop({ audioId: AUDIO_ID }); },
    setVolume: (volume) => AudioPlayer.setVolume({ audioId: AUDIO_ID, volume }),
    onStatus(cb) {
      const p = AudioPlayer.onPlaybackStatusChange({ audioId: AUDIO_ID }, (r) => cb(r.status));
      return () => { void p.then((h) => h?.remove?.()); };
    },
    onInterruptionPause(cb) {
      const p = AudioPlayer.onAppLosesFocus({ audioId: AUDIO_ID }, () => cb());
      return () => { void p.then((h) => h?.remove?.()); };
    },
  };
}

function createWebPort(): SleepAudioPort {
  const el = typeof Audio !== "undefined" ? new Audio() : ({} as HTMLAudioElement);
  el.loop = true;
  const statusCbs = new Set<(s: SleepPlaybackStatus) => void>();
  const emit = (s: SleepPlaybackStatus) => statusCbs.forEach((cb) => cb(s));
  el.addEventListener?.("play", () => emit("playing"));
  el.addEventListener?.("pause", () => emit("paused"));
  return {
    async load(track) { el.src = resolveSleepAudioSource(track.sourceKey, false); el.load?.(); },
    async play() { await el.play?.(); },
    async pause() { el.pause?.(); },
    async stop() { el.pause?.(); el.currentTime = 0; emit("stopped"); },
    async setVolume(volume) { el.volume = Math.max(0, Math.min(1, volume)); },
    onStatus(cb) { statusCbs.add(cb); return () => statusCbs.delete(cb); },
    onInterruptionPause() { return () => undefined; }, // web 无音频焦点回调
  };
}

export const createSleepAudioPort = (): SleepAudioPort => (isSleepAudioNative() ? createNativePort() : createWebPort());
```

- [ ] **Step 6: 构建确认编译**

Run: `npm run build`
Expected: `✓ built`,无 `error TS`。若 `AudioPlayer` 导出名/方法签名与 Task 1 Step 2 实测不符,据实改本文件(端口层是唯一接触点)。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/sleepAudioSource.ts frontend/src/sleepAudio.ts scripts/test-sleep-audio-catalog.mjs
git commit -m "feat(sleep-music): 音源解析 + sleepAudio 端口层(mediagrid 原生 + Web 回退)"
```

---

## Task 5: 播放控制器 `sleepPlaybackController.ts`(定时 + 淡出,TDD)

**Files:** Create `frontend/src/sleepPlaybackController.ts`; Test `scripts/test-sleep-controller.mjs`; Modify `package.json`

- [ ] **Step 1: 写失败测试** `scripts/test-sleep-controller.mjs`(注入 mock port + 假时钟)

```javascript
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

  // 假时钟:手动推进
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
  assert.deepEqual(calls[0], ["load", "white"]);
  assert.ok(calls.some((c) => c[0] === "play"), "应 play");

  // 定时 30 分钟;到 29:30 起淡出,30:00 stop
  calls.length = 0;
  ctrl.setTimer(30);
  advance(29 * 60000 + 30000); // 到 29:30(淡出起点)
  const vols = calls.filter((c) => c[0] === "vol").map((c) => c[1]);
  assert.ok(vols.length >= 1 && vols[vols.length - 1] < 1, "淡出应开始递降");
  advance(30000); // 到 30:00
  assert.ok(calls.some((c) => c[0] === "vol" && c[1] === 0), "末尾音量应到 0");
  assert.ok(calls.some((c) => c[0] === "stop"), "到点应 stop");

  // 「不限时」= 不排定时
  const ctrl2 = createSleepController({ port, clock, fadeMs: 30000, fadeSteps: 6 });
  calls.length = 0;
  await ctrl2.playTrack({ id: "womb", title: "子宫声", sourceKey: "womb" });
  ctrl2.setTimer(null);
  advance(10 * 60 * 60000);
  assert.ok(!calls.some((c) => c[0] === "stop"), "不限时不得自动停");

  console.log("sleep controller tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-sleep-controller.mjs`
Expected: FAIL(找不到 `sleepPlaybackController.ts`)。

- [ ] **Step 3: 写实现** `frontend/src/sleepPlaybackController.ts`(纯:注入 port + clock,无 React)

```typescript
// 哄睡播放控制器(纯:注入 SleepAudioPort + 时钟,可 node 单测)。
// 管:播放/暂停/停;睡眠定时(到点前 fadeMs 内把音量线性降到 0 再 stop);不限时=不排。
import type { SleepAudioPort } from "./sleepAudio";

export interface SleepClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface SleepController {
  playTrack(track: { id: string; title: string; sourceKey: string }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setTimer(minutes: number | null): void; // null = 不限时
  dispose(): void;
}

export function createSleepController(opts: {
  port: SleepAudioPort;
  clock: SleepClock;
  fadeMs?: number;
  fadeSteps?: number;
}): SleepController {
  const { port, clock } = opts;
  const fadeMs = opts.fadeMs ?? 30000;
  const fadeSteps = Math.max(2, opts.fadeSteps ?? 30);
  const pending: number[] = [];
  const clearTimers = () => { while (pending.length) clock.clearTimeout(pending.pop() as number); };

  const scheduleFadeAndStop = (totalMs: number) => {
    clearTimers();
    const fadeStart = Math.max(0, totalMs - fadeMs);
    pending.push(clock.setTimeout(() => {
      for (let i = 1; i <= fadeSteps; i++) {
        const at = (fadeMs / fadeSteps) * i;
        const vol = Math.max(0, 1 - i / fadeSteps);
        pending.push(clock.setTimeout(() => { void port.setVolume(vol); }, at));
      }
      pending.push(clock.setTimeout(() => { void (async () => { await port.stop(); await port.setVolume(1); })(); }, fadeMs));
    }, fadeStart));
  };

  return {
    async playTrack(track) {
      clearTimers();
      await port.setVolume(1);
      await port.load(track);
      await port.play();
    },
    pause: () => port.pause(),
    resume: () => port.play(),
    async stop() { clearTimers(); await port.stop(); await port.setVolume(1); },
    setTimer(minutes) {
      clearTimers();
      if (minutes == null) return;
      scheduleFadeAndStop(minutes * 60000);
    },
    dispose() { clearTimers(); },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/test-sleep-controller.mjs`
Expected: PASS `sleep controller tests passed`。

- [ ] **Step 5: 注册** `package.json`:`"test:sleep-controller": "node scripts/test-sleep-controller.mjs",` 挂进 `verify:frontend`(接在 `test:sleep-catalog` 之后)。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/sleepPlaybackController.ts scripts/test-sleep-controller.mjs package.json
git commit -m "feat(sleep-music): 播放控制器(睡眠定时 + 末段淡出,含单测)"
```

---

## Task 6: React 绑定 + 暗色播放页 + 入口 + App 接线

**Files:** Create `frontend/src/hooks/useSleepAudio.ts`, `frontend/src/screens/SleepMusicScreen.tsx`, `frontend/src/components/SleepMusicCard.tsx`; Modify `frontend/src/styles/mobile-app.css`, `frontend/src/App.tsx`

- [ ] **Step 1: 写 hook** `frontend/src/hooks/useSleepAudio.ts`

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { createSleepAudioPort, type SleepPlaybackStatus } from "../sleepAudio";
import { createSleepController } from "../sleepPlaybackController";

const realClock = { now: () => Date.now(), setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms), clearTimeout: (id: number) => window.clearTimeout(id) };

export function useSleepAudio() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<SleepPlaybackStatus>("stopped");
  const [timerMin, setTimerMin] = useState<number | null>(null);
  const portRef = useRef(createSleepAudioPort());
  const ctrlRef = useRef(createSleepController({ port: portRef.current, clock: realClock }));

  useEffect(() => {
    const offStatus = portRef.current.onStatus(setStatus);
    const offInt = portRef.current.onInterruptionPause(() => { void portRef.current.pause(); });
    const ctrl = ctrlRef.current;
    return () => { offStatus(); offInt(); ctrl.dispose(); };
  }, []);

  return useMemo(() => ({
    currentId, status, timerMin,
    async playTrack(track: { id: string; title: string; sourceKey: string }) {
      setCurrentId(track.id);
      await ctrlRef.current.playTrack(track);
    },
    async toggle() { if (status === "playing") await ctrlRef.current.pause(); else await ctrlRef.current.resume(); },
    async stop() { await ctrlRef.current.stop(); setCurrentId(null); setTimerMin(null); },
    setTimer(min: number | null) { setTimerMin(min); ctrlRef.current.setTimer(min); },
  }), [currentId, status, timerMin]);
}
```

- [ ] **Step 2: 写播放页** `frontend/src/screens/SleepMusicScreen.tsx`(暗色;图标按 catalog 的 icon 名映射)

```tsx
import { memo } from "react";
import { Activity, Droplet, Heart, Music, Volume2, Wind, X, Pause, Play, Square } from "lucide-react";
import { availableSleepTracks } from "../sleepAudioCatalog";
import { useSleepAudio } from "../hooks/useSleepAudio";

const ICONS: Record<string, typeof Music> = { "volume-2": Volume2, heart: Heart, wind: Wind, droplet: Droplet, ripple: Activity, activity: Activity, music: Music };
const TIMERS: { label: string; min: number | null }[] = [
  { label: "15", min: 15 }, { label: "30", min: 30 }, { label: "45", min: 45 },
  { label: "60", min: 60 }, { label: "90", min: 90 }, { label: "不限", min: null },
];

export const SleepMusicScreen = memo(function SleepMusicScreen({ onClose }: { onClose: () => void }) {
  const sleep = useSleepAudio();
  const tracks = availableSleepTracks();
  const playing = sleep.status === "playing";
  return (
    <div className="sleep-screen" role="dialog" aria-modal="true" aria-label="哄睡音乐">
      <div className="sleep-top">
        <b>哄睡音乐</b>
        <button type="button" className="sleep-x" aria-label="关闭" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="sleep-grid">
        {tracks.map((t) => {
          const Icon = ICONS[t.icon] ?? Music;
          const on = sleep.currentId === t.id;
          return (
            <button type="button" key={t.id} className={`sleep-tile${on ? " on" : ""}`}
              onClick={() => void sleep.playTrack({ id: t.id, title: t.title, sourceKey: t.sourceKey })}>
              <Icon size={20} aria-hidden="true" /><span>{t.title}</span>
            </button>
          );
        })}
      </div>
      {sleep.currentId ? (
        <div className="sleep-now">
          <span>{tracks.find((t) => t.id === sleep.currentId)?.title} · {playing ? "循环中" : "已暂停"}</span>
          <button type="button" className="sleep-pp" aria-label={playing ? "暂停" : "播放"} onClick={() => void sleep.toggle()}>
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
        </div>
      ) : null}
      <div className="sleep-timerrow">
        <span className="sleep-tl">睡眠定时</span>
        <div className="sleep-chips">
          {TIMERS.map((t) => (
            <button type="button" key={t.label} className={`sleep-chip${sleep.timerMin === t.min ? " on" : ""}`}
              onClick={() => sleep.setTimer(t.min)}>{t.label}</button>
          ))}
        </div>
      </div>
      <button type="button" className="sleep-stop" onClick={() => void sleep.stop()}><Square size={16} /> 停止</button>
    </div>
  );
});
```

- [ ] **Step 3: 写入口卡片** `frontend/src/components/SleepMusicCard.tsx`

```tsx
import { memo } from "react";
import { Moon } from "lucide-react";

export const SleepMusicCard = memo(function SleepMusicCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="sleep-entry-card" onClick={onOpen} aria-label="打开哄睡音乐">
      <span className="sleep-entry-orb" aria-hidden="true"><Moon size={20} /></span>
      <span className="sleep-entry-body">
        <span className="sleep-entry-title">哄睡音乐</span>
        <span className="sleep-entry-sub">白噪音 · 摇篮曲 · 睡眠定时</span>
      </span>
    </button>
  );
});
```

- [ ] **Step 4: 样式** 追加到 `frontend/src/styles/mobile-app.css` 末尾

```css
/* 哄睡音乐入口卡片(记录页) */
.sleep-entry-card { display: flex; align-items: center; gap: 13px; width: 100%; margin: 0 0 12px; padding: 14px 16px; border: 1px solid rgba(120, 130, 170, 0.28); border-radius: 16px; background: #f4f5fb; text-align: left; }
.sleep-entry-orb { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(94, 110, 160, 0.16); color: #5e6ea0; }
.sleep-entry-body { display: grid; gap: 2px; }
.sleep-entry-title { font-size: 15px; font-weight: 600; color: var(--ink, #2d3137); }
.sleep-entry-sub { font-size: 12px; color: var(--muted, #7d8585); }
/* 暗色全屏播放页 */
.sleep-screen { position: fixed; inset: 0; z-index: 1300; display: flex; flex-direction: column; gap: 14px; padding: 16px 16px calc(env(safe-area-inset-bottom) + 16px); background: #171b26; color: #e9ecf2; overflow-y: auto; }
.sleep-top { display: flex; align-items: center; justify-content: space-between; }
.sleep-top b { font-size: 16px; font-weight: 600; }
.sleep-x { border: 0; background: transparent; color: #98a2b6; padding: 4px; }
.sleep-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sleep-tile { display: grid; justify-items: center; gap: 5px; padding: 13px 6px; border: 1px solid #2d3446; border-radius: 13px; background: #222a3a; color: #e9ecf2; }
.sleep-tile span { font-size: 12px; }
.sleep-tile.on { background: #233a30; border-color: #345f4b; color: #8fc6a8; }
.sleep-now { display: flex; align-items: center; justify-content: space-between; gap: 11px; padding: 11px 13px; border-radius: 15px; background: #2b3446; }
.sleep-now span { font-size: 13px; }
.sleep-pp { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 0; background: #8fc6a8; color: #13241b; }
.sleep-timerrow { display: grid; gap: 8px; }
.sleep-tl { font-size: 12px; color: #98a2b6; }
.sleep-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sleep-chip { border: 1px solid #2f3850; border-radius: 999px; padding: 7px 13px; font-size: 12px; color: #98a2b6; background: transparent; }
.sleep-chip.on { background: #8fc6a8; color: #13241b; border-color: #8fc6a8; }
.sleep-stop { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; padding: 12px; border: 1px solid #34405a; border-radius: 13px; background: transparent; color: #e9ecf2; font-size: 13px; }
```

- [ ] **Step 5: App 接线** —— import + 开关状态 + 入口 + 全屏 portal

在 `frontend/src/App.tsx`:
(a) import 区加:
```typescript
import { SleepMusicScreen } from "./screens/SleepMusicScreen";
import { SleepMusicCard } from "./components/SleepMusicCard";
```
(b) 与 `feedingAlarmHandlers` 等状态同区,加开关 state(放任一现有 `useState` 旁):
```typescript
const [sleepMusicOpen, setSleepMusicOpen] = useState(false);
const [sleepMusicHandlers] = useState(() => ({ open: () => setSleepMusicOpen(true), close: () => setSleepMusicOpen(false) }));
```
(c) 记录页:在 `<FeedingAlarmCard ... />` 之后紧接着加入口卡片:
```tsx
          <SleepMusicCard onOpen={sleepMusicHandlers.open} />
```
(d) 全屏 portal:在 records 的 `recordsEntryDrawer` portal 块之后(同区)加:
```tsx
          {sleepMusicOpen
            ? createPortal(<SleepMusicScreen onClose={sleepMusicHandlers.close} />, document.body)
            : null}
```

- [ ] **Step 6: 构建**

Run: `npm run build`
Expected: `✓ built` 无 `error TS`。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/hooks/useSleepAudio.ts frontend/src/screens/SleepMusicScreen.tsx frontend/src/components/SleepMusicCard.tsx frontend/src/styles/mobile-app.css frontend/src/App.tsx
git commit -m "feat(sleep-music): 暗色播放页 + 记录页入口 + App 接线(hook/controller/port 串起来)"
```

---

## Task 7: DOM smoke(Web 回退路径)

**Files:** Create `scripts/test-sleep-music-smoke.mjs`; Modify `package.json`

- [ ] **Step 1: 写测试** `scripts/test-sleep-music-smoke.mjs`(照 test-feeding-alarm.mjs 套路;Web 环境用 `<audio>` 回退,断言 UI 流转)

```javascript
#!/usr/bin/env node
// 哄睡音乐 DOM smoke(Web 回退):入口打开播放页 → 选曲 → 暂停/播放切换 → 选定时 → 停止。
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.SLEEP_MUSIC_PORT || 4333);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [], reminders: [], memories: [], pendingEffects: [], expenses: [], albumItems: [],
  conversationSummary: null, thinkingEnabled: false, selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};
function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  return { stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }) };
}
async function waitForServer(url, timeoutMs = 30000) { const s = Date.now(); while (Date.now() - s < timeoutMs) { try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {} await new Promise((r) => setTimeout(r, 400)); } throw new Error("server not ready"); }
async function installMocks(page) {
  await page.addInitScript(() => { window.localStorage.setItem("baby-companion-auth-token", "sleep-token"); window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true)); HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve(); }; HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); }; });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" }, family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true }, authenticated: true, onboardingRequired: false }) });
    if (url.pathname === "/api/app/state") return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: appState }) });
    if (url.pathname === "/api/pro/usage") return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, byFeature: [], byModel: [] }) });
    if (url.pathname === "/api/auth/family/members") return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [{ userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" }] }) });
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: appState }) });
  });
}
const server = startServer();
let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  await installMocks(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "打开哄睡音乐" }).click();
  const screen = page.locator(".sleep-screen");
  await screen.waitFor({ state: "visible", timeout: 6000 });
  assert.ok(await screen.getByText("哄睡音乐").first().isVisible(), "播放页应打开");
  console.log("[SM1] entry opens sleep player ✔");

  await screen.locator(".sleep-tile", { hasText: "白噪音" }).click();
  await page.locator(".sleep-now").waitFor({ state: "visible", timeout: 4000 });
  assert.ok(await page.locator(".sleep-now").getByText("循环中").isVisible(), "选曲后应显示循环中(playing)");
  await page.locator(".sleep-pp").click();
  assert.ok(await page.locator(".sleep-now").getByText("已暂停").isVisible(), "暂停后应显示已暂停");
  console.log("[SM2] pick track plays, toggle pauses ✔");

  await screen.locator(".sleep-chip", { hasText: "30" }).click();
  assert.ok(await page.locator(".sleep-chip.on", { hasText: "30" }).isVisible(), "定时 30 应选中");
  await screen.locator(".sleep-stop").click();
  assert.equal(await page.locator(".sleep-now").count(), 0, "停止后 now-playing 应消失");
  console.log("[SM3] timer select + stop ✔");

  console.log("sleep music DOM smoke tests passed");
} finally {
  if (browser) await browser.close();
  await server.stop();
}
```

- [ ] **Step 2: 构建后跑测试确认通过**

Run: `npm run build && node scripts/test-sleep-music-smoke.mjs`
Expected: 打印 `[SM1]`、`[SM2]`、`[SM3]` 与 `sleep music DOM smoke tests passed`。

- [ ] **Step 3: 注册** `package.json`:`"test:sleep-music": "node scripts/test-sleep-music-smoke.mjs",` 挂进 `verify:frontend` 末尾(`&& npm run test:sleep-music`)。

- [ ] **Step 4: 提交**

```bash
git add scripts/test-sleep-music-smoke.mjs package.json
git commit -m "test(sleep-music): DOM smoke——入口/选曲/暂停/定时/停止(web 回退)"
```

---

## Task 8: 全量验证 + 原生构建 + 真机自查

**Files:** 无(验证)

- [ ] **Step 1: 全量前端验证**

Run: `npm run verify:frontend`
Expected: 既有用例全绿 + `sleep audio catalog tests passed` + `sleep controller tests passed` + `sleep music DOM smoke tests passed`。贴真实输出。

- [ ] **Step 2: 同步原生**

Run: `npm run build && npx cap sync`
Expected: 无报错;`@mediagrid/capacitor-native-audio` 在两端;`frontend/public/sleep-audio/*.wav` 同步到 `ios/App/App/public/sleep-audio/` 与 `android/app/src/main/assets/public/sleep-audio/`。
Run(确认音频已落地): `ls ios/App/App/public/sleep-audio/ android/app/src/main/assets/public/sleep-audio/`

- [ ] **Step 3: 真机自查清单**(headless 测不了,必须真机各一轮 iOS + 华为)

- 选一条白噪音 → **息屏**仍在响;
- **锁屏 / 通知栏**出现 播放/暂停/停止,且可控、与 App 内状态同步;
- 播放中**来电**或放别的音乐 → 自动暂停(`onAppLosesFocus`),不抢占;
- 睡眠定时选 1 分钟(临时调小验证)→ 末 ~30s 音量缓降 → 到点停;
- **首验本地音源路径**:若选曲不出声,确认 `resolveSleepAudioSource` 的 native 路径与 mediagrid 实际期望一致(Task 4 一处改),并复跑。

- [ ] **Step 4: 内容补齐(发布前)**

按 `frontend/public/sleep-audio/README.md`,补 `rain/waves/heartbeat/lullaby-1` 的**免版税**文件并把 catalog 对应 `available` 改 true;或确认 v1 仅上三条噪音。

- [ ] **Step 5: 出原生包**(不走 OTA)

`VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`(及 iOS),按 `AGENTS.md` 确认内置包 base URL 不是 localhost。

---

## Self-Review

- **Spec 覆盖**:音源内置离线(Task 2/3)✓;后台+锁屏(Task 1 配置 + Task 4 端口 `useForNotification/isBackgroundMusic`)✓;音频焦点中断暂停(Task 4 `onAppLosesFocus` + Task 6 hook)✓;睡眠定时 15/30/45/60/90/不限 + 末段淡出(Task 5 控制器 + Task 6 UI)✓;暗色播放页(Task 6)✓;记录页入口(Task 6)✓;后端零改动 ✓;原生包不走 OTA(Task 8)✓。非目标(在线曲库/自传/睡眠检测)未做,符合 v1。
- **占位扫描**:无 TODO/TBD 当占位;`available:false` 是**显式产品状态**(内容任务),非代码占位。native 音源路径与 mediagrid 导出名两处标注「首验可改」,均给了确切默认值与改点。
- **类型一致**:`SleepAudioPort`(load/play/pause/stop/setVolume/onStatus/onInterruptionPause)在 Task 4 定义,Task 5 控制器与 Task 6 hook 同名调用一致;`createSleepController({port,clock,fadeMs,fadeSteps})` 签名 Task 5 定义、测试与 hook 一致;`SleepTrack.sourceKey` 贯穿 catalog→source→port 一致;`resolveSleepAudioSource(key,native)` Task 4 定义并被端口层调用。
