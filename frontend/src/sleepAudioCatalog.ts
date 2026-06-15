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
