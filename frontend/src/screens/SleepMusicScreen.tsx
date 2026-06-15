// 哄睡音乐播放页(暗色全屏 portal)。图标按 catalog 的 icon 名映射 lucide。
import { memo } from "react";
import { Activity, Droplet, Heart, Music, Pause, Play, Square, Volume2, Wind, X } from "lucide-react";
import { availableSleepTracks } from "../sleepAudioCatalog";
import { useSleepAudio } from "../hooks/useSleepAudio";

const ICONS: Record<string, typeof Music> = {
  "volume-2": Volume2, heart: Heart, wind: Wind, droplet: Droplet, ripple: Activity, activity: Activity, music: Music,
};
const TIMERS: { label: string; min: number | null }[] = [
  { label: "15", min: 15 }, { label: "30", min: 30 }, { label: "45", min: 45 },
  { label: "60", min: 60 }, { label: "90", min: 90 }, { label: "不限", min: null },
];

export const SleepMusicScreen = memo(function SleepMusicScreen({ onClose }: { onClose: () => void }) {
  const sleep = useSleepAudio();
  const tracks = availableSleepTracks();
  const playing = sleep.status === "playing";
  const current = tracks.find((t) => t.id === sleep.currentId);
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
          <span>{current?.title} · {playing ? "循环中" : "已暂停"}</span>
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
