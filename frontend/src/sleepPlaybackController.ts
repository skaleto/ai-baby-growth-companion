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

  // 平铺排定:末段每步降一档音量,到点 stop 并复位音量(供下次起播)。
  const scheduleFadeAndStop = (totalMs: number) => {
    clearTimers();
    const fadeStart = Math.max(0, totalMs - fadeMs);
    for (let i = 1; i <= fadeSteps; i++) {
      const vol = Math.max(0, 1 - i / fadeSteps);
      pending.push(clock.setTimeout(() => { void port.setVolume(vol); }, fadeStart + (fadeMs / fadeSteps) * i));
    }
    pending.push(clock.setTimeout(() => { void (async () => { await port.stop(); await port.setVolume(1); })(); }, totalMs));
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
