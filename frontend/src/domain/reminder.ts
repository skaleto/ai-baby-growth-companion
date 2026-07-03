// 领域拆分 P7:从 appStateDomain 抽出的「提醒」解析/归一化/排期——中文口语时间→dueAt、schedule/alarm 模式收敛、间隔规则降级。
// 纯模块红线:不 import 宿主 API;依赖 coerce/dateTime 与外部 appOptions,不反向依赖上层聚合模块(misc)。
import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "../appOptions";
import type {
  Reminder,
  ReminderAlertMode,
  ReminderKind,
  ReminderRepeatRule,
  ReminderScheduleMode,
  ReminderSoundId,
} from "../types";
import { numberValue, stringList, textValue } from "./coerce";
import {
  dateFromLocalParts,
  localDateKey,
  localTimeKey,
  normalizeClockText,
  parseLooseNumber,
  parseWeekdayIndex,
  reminderTimezone,
  setClockOnDate,
} from "./dateTime";

export const parseReminderDueAt = (value: Partial<Reminder> | string | null | undefined, now = new Date()): Date | undefined => {
  const reminder = typeof value === "string" ? { dueText: value } : value;
  if (!reminder) return undefined;
  const directDueAt = textValue(reminder.dueAt);
  if (directDueAt) {
    const parsed = new Date(directDueAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const text = [reminder.timeSourceText, reminder.dueText, reminder.title]
    .map((item) => textValue(item))
    .filter(Boolean)
    .join(" ");
  if (!text) return undefined;

  const numberPattern = "(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]{1,4})";
  const minuteRelative = text.match(new RegExp(`${numberPattern}\\s*(?:分钟|分)\\s*后`));
  if (minuteRelative) {
    const minutes = parseLooseNumber(minuteRelative[1]);
    if (minutes !== undefined) return new Date(now.getTime() + minutes * 60 * 1000);
  }
  if (/半\s*(?:个)?小时\s*后/.test(text)) return new Date(now.getTime() + 30 * 60 * 1000);
  if (/一刻钟后|15\s*分钟后/.test(text)) return new Date(now.getTime() + 15 * 60 * 1000);

  const hourRelative = text.match(new RegExp(`${numberPattern}\\s*(?:个)?小时\\s*后`));
  if (hourRelative) {
    const hours = parseLooseNumber(hourRelative[1]);
    if (hours !== undefined) return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  const dayRelative = text.match(new RegExp(`${numberPattern}\\s*天\\s*后`));
  if (dayRelative) {
    const days = parseLooseNumber(dayRelative[1]);
    if (days !== undefined) return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  let target = new Date(now);
  target.setSeconds(0, 0);
  let hasDate = false;
  const isoMatch = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
  const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  const weekMatch = text.match(/(下周|下星期|周|星期)([一二三四五六日天1-7])/);

  if (isoMatch) {
    target = dateFromLocalParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    hasDate = true;
  } else if (monthDay) {
    target = dateFromLocalParts(now.getFullYear(), Number(monthDay[1]), Number(monthDay[2]));
    if (target < now) target.setFullYear(target.getFullYear() + 1);
    hasDate = true;
  } else if (/大后天/.test(text)) {
    target.setDate(now.getDate() + 3);
    hasDate = true;
  } else if (/后天/.test(text)) {
    target.setDate(now.getDate() + 2);
    hasDate = true;
  } else if (/明天/.test(text)) {
    target.setDate(now.getDate() + 1);
    hasDate = true;
  } else if (/今天/.test(text)) {
    hasDate = true;
  } else if (weekMatch) {
    const targetDay = parseWeekdayIndex(weekMatch[2]);
    const currentDay = now.getDay();
    let offset = (targetDay - currentDay + 7) % 7;
    if (weekMatch[1].startsWith("下") || offset === 0) offset += 7;
    target.setDate(now.getDate() + offset);
    hasDate = true;
  }

  const clock = normalizeClockText(text);
  if (clock) {
    target = setClockOnDate(target, clock);
    if (!hasDate && target <= now) target.setDate(target.getDate() + 1);
    return target;
  }

  if (hasDate) {
    target.setHours(9, 0, 0, 0);
    return target;
  }

  return undefined;
};

export const formatReminderDueText = (dueAt: Date) => {
  const today = localDateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);
  const date = localDateKey(dueAt);
  const time = localTimeKey(dueAt);
  if (date === today) return `今天 ${time}`;
  if (date === tomorrow) return `明天 ${time}`;
  return `${date} ${time}`;
};

export const reminderNotificationId = (reminder: Pick<Reminder, "id">, offset = 0) => {
  let hash = 0;
  for (let index = 0; index < reminder.id.length; index += 1) {
    hash = (hash * 31 + reminder.id.charCodeAt(index)) & 0x7fffffff;
  }
  return Math.max(1, (hash + offset) % 2_000_000_000);
};

export const normalizeReminderKind = (kind: unknown): ReminderKind =>
  kind === "alarm" || kind === "schedule" ? kind : "schedule";

export const normalizeReminderScheduleMode = (mode: unknown, reminderKind?: unknown, repeatRule?: unknown): ReminderScheduleMode => {
  if (mode === "once" || mode === "interval") return mode;
  if (repeatRule && typeof repeatRule === "object") return "interval";
  return reminderKind === "alarm" ? "interval" : "once";
};

export const normalizeReminderAlertMode = (mode: unknown, reminderKind?: unknown): ReminderAlertMode => {
  if (mode === "notification" || mode === "ringing") return mode;
  return reminderKind === "alarm" ? "ringing" : "notification";
};

export const normalizeReminderSoundId = (soundId: unknown): ReminderSoundId =>
  soundId === "soft_bell" || soundId === "soft_chime" ? soundId : "soft_chime";

export const normalizeReminderRepeatRule = (value: unknown): ReminderRepeatRule | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Partial<ReminderRepeatRule>;
  if (source.mode !== "fixedInterval") return undefined;
  const intervalMinutes = typeof source.intervalMinutes === "number" && Number.isFinite(source.intervalMinutes)
    ? Math.round(source.intervalMinutes)
    : undefined;
  if (!intervalMinutes) return undefined;
  // 老数据里的 careEvent(milk 锚定)规则一律优雅降级为按当前时间循环。
  return {
    mode: "fixedInterval",
    intervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, intervalMinutes)),
    anchorType: "now",
    careEventType: undefined,
  };
};

export const isIntervalReminder = (reminder: Pick<Reminder, "scheduleMode" | "repeatRule" | "status">) =>
  reminder.status !== "done" &&
  reminder.scheduleMode === "interval" &&
  reminder.repeatRule?.mode === "fixedInterval";

export const normalizeReminderSchedule = (reminder: Reminder, now = new Date()): Reminder => {
  const repeatRule = normalizeReminderRepeatRule(reminder.repeatRule);
  const scheduleMode = normalizeReminderScheduleMode(reminder.scheduleMode, reminder.reminderKind, repeatRule);
  const alertMode = normalizeReminderAlertMode(reminder.alertMode, reminder.reminderKind);
  const reminderKind: ReminderKind = alertMode === "ringing" ? "alarm" : "schedule";
  let dueAt = parseReminderDueAt(reminder, now);
  if (!dueAt && scheduleMode === "interval" && repeatRule) {
    dueAt = new Date(now.getTime() + repeatRule.intervalMinutes * 60 * 1000);
  }
  if (!dueAt) {
    return {
      ...reminder,
      reminderKind,
      scheduleMode,
      alertMode,
      repeatRule,
      soundId: alertMode === "ringing" ? normalizeReminderSoundId(reminder.soundId) : reminder.soundId,
      timeSourceText: reminder.timeSourceText || reminder.dueText,
      timezone: reminder.timezone || reminderTimezone(),
      notificationStatus: reminder.notificationStatus ?? "pending",
    };
  }
  return {
    ...reminder,
    reminderKind,
    scheduleMode,
    alertMode,
    dueAt: dueAt.toISOString(),
    dueText: formatReminderDueText(dueAt),
    timeSourceText: reminder.timeSourceText || reminder.dueText,
    timezone: reminder.timezone || reminderTimezone(),
    notificationId: reminder.notificationId ?? reminderNotificationId(reminder),
    notificationStatus: reminder.notificationStatus ?? "pending",
    repeatRule,
    soundId: alertMode === "ringing" ? normalizeReminderSoundId(reminder.soundId) : reminder.soundId,
  };
};

export const normalizeReminder = (value: Partial<Reminder> | null | undefined, index: number): Reminder => {
  const repeatRule = normalizeReminderRepeatRule(value?.repeatRule);
  const scheduleMode = normalizeReminderScheduleMode(value?.scheduleMode, value?.reminderKind, repeatRule);
  const alertMode = normalizeReminderAlertMode(value?.alertMode, value?.reminderKind);
  const reminder: Reminder = {
    id: textValue(value?.id, `reminder-${index}`),
    title: textValue(value?.title, "照护提醒"),
    reminderKind: alertMode === "ringing" ? "alarm" : "schedule",
    scheduleMode,
    alertMode,
    dueText: textValue(value?.dueText, "待确认时间"),
    dueAt: textValue(value?.dueAt) || undefined,
    timeSourceText: textValue(value?.timeSourceText) || undefined,
    timezone: textValue(value?.timezone) || undefined,
    notificationId: numberValue(value?.notificationId),
    notificationStatus:
      value?.notificationStatus === "scheduled" ||
      value?.notificationStatus === "scheduled_inexact" ||
      value?.notificationStatus === "permission_denied" ||
      value?.notificationStatus === "failed" ||
      value?.notificationStatus === "in_app_only" ||
      value?.notificationStatus === "cancelled"
        ? value.notificationStatus
        : value?.notificationStatus === "pending"
          ? "pending"
          : undefined,
    notificationError: textValue(value?.notificationError) || undefined,
    category: normalizeReminderCategory(value?.category),
    recurrence: textValue(value?.recurrence) || undefined,
    repeatRule,
    soundId: normalizeReminderSoundId(value?.soundId),
    lastAnchorEventId: textValue(value?.lastAnchorEventId) || undefined,
    lastAnchorAt: textValue(value?.lastAnchorAt) || undefined,
    status: normalizeReminderStatus(value?.status),
    createdAt: textValue(value?.createdAt, new Date().toISOString()),
    history: stringList(value?.history),
  };
  return normalizeReminderSchedule(reminder);
};

export function normalizeReminderCategory(category: string | undefined): Reminder["category"] {
  if (category === "vaccine" || category === "routine" || category === "care" || category === "custom") {
    return category;
  }
  return "custom";
}

export function normalizeReminderStatus(status: string | undefined): Reminder["status"] {
  if (status === "open" || status === "done" || status === "missed") return status;
  return "open";
}
