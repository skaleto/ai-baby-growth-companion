import softBellSoundUrl from "../assets/sounds/xiaobao_bell.wav";
import softChimeSoundUrl from "../assets/sounds/xiaobao_chime.wav";
import type { ReminderSoundId } from "../types";

export const REMINDER_QUICK_ACTIONS = [
  { label: "疫苗", prompt: "提醒我带小宝去社区医院打疫苗" },
  { label: "体检", prompt: "提醒我带小宝去做体检" },
  { label: "洗澡", prompt: "晚上 8 点提醒我给小宝洗澡" },
  { label: "喂奶闹钟", prompt: "每 3 小时提醒我喂奶" },
  { label: "喂药", prompt: "提醒我给小宝喂药，具体用药以医生医嘱为准" },
  { label: "复诊", prompt: "提醒我带小宝去复诊" },
  { label: "自定义", prompt: "帮我设置一个照护提醒：" },
];

export const REMINDER_CHANNELS = {
  schedule: "baby_schedule_v1",
  soft_chime: "baby_alarm_chime_v2",
  soft_bell: "baby_alarm_bell_v2",
} as const;

export const LEGACY_REMINDER_CHANNELS = ["baby_alarm_chime_v1", "baby_alarm_bell_v1"];

export const REMINDER_SOUND_FILES: Record<ReminderSoundId, string> = {
  soft_chime: "xiaobao_chime.wav",
  soft_bell: "xiaobao_bell.wav",
};

export const REMINDER_WEB_SOUND_URLS: Record<ReminderSoundId, string> = {
  soft_chime: softChimeSoundUrl,
  soft_bell: softBellSoundUrl,
};

export const DAILY_SUMMARY_NOTIFICATION_ID = 210930;
