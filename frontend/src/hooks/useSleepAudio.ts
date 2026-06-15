import { useEffect, useMemo, useState } from "react";
import { createSleepAudioPort, type SleepPlaybackStatus } from "../sleepAudio";
import { createSleepController } from "../sleepPlaybackController";

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
  clearTimeout: (id: number) => window.clearTimeout(id),
};

export function useSleepAudio() {
  const [port] = useState(() => createSleepAudioPort());
  const [ctrl] = useState(() => createSleepController({ port, clock: realClock }));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<SleepPlaybackStatus>("stopped");
  const [timerMin, setTimerMin] = useState<number | null>(null);

  useEffect(() => {
    const offStatus = port.onStatus(setStatus);
    const offInt = port.onInterruptionPause(() => { void port.pause(); });
    return () => { offStatus(); offInt(); ctrl.dispose(); };
  }, [port, ctrl]);

  return useMemo(() => ({
    currentId,
    status,
    timerMin,
    async playTrack(track: { id: string; title: string; sourceKey: string }) {
      setCurrentId(track.id);
      await ctrl.playTrack(track);
    },
    async toggle() {
      if (status === "playing") await ctrl.pause();
      else await ctrl.resume();
    },
    async stop() {
      await ctrl.stop();
      setCurrentId(null);
      setTimerMin(null);
    },
    setTimer(min: number | null) {
      setTimerMin(min);
      ctrl.setTimer(min);
    },
  }), [currentId, status, timerMin, ctrl]);
}
