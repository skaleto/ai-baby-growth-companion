// 提醒编辑草稿(UI 草稿域,自 App.tsx 拆出——架构债 D1/Records 轮)。
// 纯模块红线:可被 esbuild 逻辑测试打包,不得依赖 React/window/资产/import.meta.env。
import { todayISO } from "./data";
import type { Reminder, ReminderAlertMode, ReminderScheduleMode, ReminderSoundId } from "./types";
import {
  localDateKey,
  localTimeKey,
  normalizeReminderAlertMode,
  normalizeReminderScheduleMode,
  normalizeReminderSoundId,
  parseReminderDueAt,
} from "./appStateDomain";

export type ReminderDraft = {
  title: string;
  category: Reminder["category"];
  scheduleMode: ReminderScheduleMode;
  alertMode: ReminderAlertMode;
  dueDate: string;
  dueTime: string;
  intervalMinutes: string;
  soundId: ReminderSoundId;
};

export type ReminderPostponeDraft = {
  dueDate: string;
  dueTime: string;
};

export function createReminderDraft(base = new Date()): ReminderDraft {
  const dueAt = new Date(base);
  dueAt.setMinutes(dueAt.getMinutes() + 30);
  dueAt.setSeconds(0, 0);
  return {
    title: "",
    category: "care",
    scheduleMode: "once",
    alertMode: "notification",
    dueDate: localDateKey(dueAt),
    dueTime: localTimeKey(dueAt),
    intervalMinutes: "180",
    soundId: "soft_chime",
  };
}

export function reminderDraftFromReminder(reminder: Reminder): ReminderDraft {
  const dueAt = parseReminderDueAt(reminder) ?? new Date();
  return {
    title: reminder.title,
    category: reminder.category,
    scheduleMode: normalizeReminderScheduleMode(reminder.scheduleMode, reminder.reminderKind, reminder.repeatRule),
    alertMode: normalizeReminderAlertMode(reminder.alertMode, reminder.reminderKind),
    dueDate: localDateKey(dueAt),
    dueTime: localTimeKey(dueAt),
    intervalMinutes: reminder.repeatRule ? String(reminder.repeatRule.intervalMinutes) : "180",
    soundId: normalizeReminderSoundId(reminder.soundId),
  };
}

export function reminderPostponeDraftFromReminder(reminder?: Reminder): ReminderPostponeDraft {
  const fallback = new Date(Date.now() + 30 * 60 * 1000);
  fallback.setSeconds(0, 0);
  const parsed = reminder ? parseReminderDueAt(reminder) : undefined;
  const dueAt = parsed && parsed.getTime() > Date.now() ? new Date(parsed) : fallback;
  return {
    dueDate: localDateKey(dueAt),
    dueTime: localTimeKey(dueAt),
  };
}

export function dateFromReminderPostponeDraft(draft: ReminderPostponeDraft): Date | undefined {
  const dueAt = new Date(`${draft.dueDate || todayISO()}T${draft.dueTime || "09:00"}:00`);
  return Number.isNaN(dueAt.getTime()) ? undefined : dueAt;
}
