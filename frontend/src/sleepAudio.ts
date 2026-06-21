// 哄睡音频端口层:上层只认本接口,不直接碰插件。
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

// @mediagrid/capacitor-native-audio expects a concrete URL/URI. Our tracks are
// bundled Vite public assets, and passing "public/sleep-audio/*.wav" leaves
// AVPlayer/ExoPlayer with an unresolved relative URI. Keep native disabled for
// these local tracks until a file:// bridge is added.
const ENABLE_NATIVE_SLEEP_AUDIO = false;
export const isSleepAudioNative = () => ENABLE_NATIVE_SLEEP_AUDIO && isNativePlatform() && isPluginAvailable("AudioPlayer");

const AUDIO_ID = "sleep-music";

function createNativePort(): SleepAudioPort {
  let loaded = false;
  let statusCb: ((status: SleepPlaybackStatus) => void) | null = null;
  let interruptCb: (() => void) | null = null;
  return {
    async load(track) {
      if (loaded) { try { await AudioPlayer.destroy({ audioId: AUDIO_ID }); } catch { /* 首次无实例 */ } }
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
      loaded = true;
      // 监听必须在 create 之后注册(audioId 才存在);随 destroy() 一并释放,无需手动 remove。
      if (statusCb) void AudioPlayer.onPlaybackStatusChange({ audioId: AUDIO_ID }, (r) => statusCb?.(r.status));
      if (interruptCb) void AudioPlayer.onAppLosesFocus({ audioId: AUDIO_ID }, () => interruptCb?.());
    },
    play: () => AudioPlayer.play({ audioId: AUDIO_ID }),
    pause: () => AudioPlayer.pause({ audioId: AUDIO_ID }),
    stop: () => AudioPlayer.stop({ audioId: AUDIO_ID }),
    setVolume: (volume) => AudioPlayer.setVolume({ audioId: AUDIO_ID, volume }),
    onStatus(cb) { statusCb = cb; return () => { statusCb = null; }; },
    onInterruptionPause(cb) { interruptCb = cb; return () => { interruptCb = null; }; },
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
