import { REMINDER_SOUND_OPTIONS } from "../appOptions";
import { localDateKey, localTimeKey, normalizeClockText, normalizeReminderSoundId, parseReminderDueAt } from "../appStateDomain";
import type { Reminder } from "../types";

export const formatIntervalText = (minutes: number) => {
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} 小时 ${rest} 分钟`;
};

export const reminderDate = (reminder: Reminder) => {
  const dueAt = parseReminderDueAt(reminder);
  if (dueAt) return localDateKey(dueAt);

  const isoMatch = reminder.dueText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const monthDay = reminder.dueText.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (monthDay) {
    const year = new Date(reminder.createdAt).getFullYear();
    return `${year}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}`;
  }

  return reminder.createdAt.slice(0, 10);
};

export const reminderTimeText = (reminder: Reminder) => {
  const dueAt = parseReminderDueAt(reminder);
  if (dueAt) return localTimeKey(dueAt);
  return normalizeClockText(reminder.dueText) ??
    (reminder.dueText
      .replace(/\d{4}-\d{1,2}-\d{1,2}/, "")
      .trim()
      .slice(0, 12) || undefined);
};

export const reminderCategoryLabel = (category: Reminder["category"]) => {
  if (category === "vaccine") return "疫苗";
  if (category === "routine") return "日常";
  if (category === "care") return "照护";
  return "自定义";
};

export const reminderStatusLabel = (status: Reminder["status"]) => {
  if (status === "done") return "已完成";
  if (status === "missed") return "已逾期";
  return "待完成";
};

export const reminderScheduleLabel = (reminder: Reminder) =>
  reminder.scheduleMode === "interval" ? "循环" : "一次";

export const reminderAlertLabel = (reminder: Reminder) =>
  reminder.alertMode === "ringing" ? "闹铃" : "通知";

export const reminderRepeatLabel = (reminder: Reminder) =>
  reminder.repeatRule ? `每 ${formatIntervalText(reminder.repeatRule.intervalMinutes)}` : undefined;

export const reminderSoundLabel = (reminder: Reminder) =>
  reminder.alertMode === "ringing"
    ? REMINDER_SOUND_OPTIONS.find((option) => option.value === normalizeReminderSoundId(reminder.soundId))?.label
    : undefined;

export const reminderNotificationLabel = (reminder: Reminder) => {
  if (reminder.status === "done") return undefined;
  if (reminder.notificationStatus === "scheduled") return "系统提醒已开启";
  if (reminder.notificationStatus === "scheduled_inexact") return "已降级为普通定时提醒";
  if (reminder.notificationStatus === "permission_denied") return "通知权限未开启";
  if (reminder.notificationStatus === "failed") return "系统提醒失败";
  if (reminder.notificationStatus === "in_app_only") return "仅 App 内提醒";
  return reminder.dueAt ? "待调度系统提醒" : "时间待确认";
};
