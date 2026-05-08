import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Reminder, ReminderSoundId } from "./types";

export type NativeAlarmEvent = {
  type: "alarm_closed_current" | "reminder_triggered";
  reminderId: string;
  notificationId?: number;
  handledAt: string;
  nextDueAt?: string;
  intervalMinutes?: number;
  exact?: boolean;
};

type NativeAlarmScheduleResult = {
  scheduled: boolean;
  exact: boolean;
};

type NativeAlarmPlugin = {
  scheduleAlarm(options: {
    reminderId: string;
    notificationId: number;
    title: string;
    body: string;
    dueAt: string;
    dueText: string;
    scheduleMode: "once" | "interval";
    alertMode: "notification" | "ringing";
    intervalMinutes?: number;
    soundId?: ReminderSoundId;
  }): Promise<NativeAlarmScheduleResult>;
  cancelAlarm(options: { reminderId: string; notificationId: number }): Promise<{ cancelled: boolean }>;
  consumeAlarmEvents(): Promise<{ events?: NativeAlarmEvent[] }>;
};

const AlarmReminder = registerPlugin<NativeAlarmPlugin>("AlarmReminder");

export const isNativeAlarmAvailable = () =>
  Capacitor.isNativePlatform() &&
  (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios") &&
  Capacitor.isPluginAvailable("AlarmReminder");

export const nativeAlarmPlatform = () => (isNativeAlarmAvailable() ? Capacitor.getPlatform() : undefined);

export const scheduleAlarmReminder = async (reminder: Reminder) => {
  if (!isNativeAlarmAvailable() || !reminder.notificationId || !reminder.dueAt) {
    throw new Error("Native reminder scheduler is not available for this reminder.");
  }
  const scheduleMode = reminder.scheduleMode === "interval" ? "interval" : "once";
  const alertMode = reminder.alertMode === "ringing" ? "ringing" : "notification";
  if (scheduleMode === "interval" && !reminder.repeatRule) {
    throw new Error("Interval reminders need a repeat rule.");
  }
  return AlarmReminder.scheduleAlarm({
    reminderId: reminder.id,
    notificationId: reminder.notificationId,
    title: reminder.title || (alertMode === "ringing" ? "到提醒时间啦" : "小宝记提醒"),
    body: alertMode === "ringing"
      ? `${reminder.dueText} · 到提醒时间啦。`
      : `${reminder.dueText} · ${reminder.title || "小宝记提醒"}`,
    dueAt: reminder.dueAt,
    dueText: reminder.dueText,
    scheduleMode,
    alertMode,
    intervalMinutes: reminder.repeatRule?.intervalMinutes,
    soundId: alertMode === "ringing"
      ? reminder.soundId === "soft_bell" ? "soft_bell" : "soft_chime"
      : undefined,
  });
};

export const cancelAlarmReminder = async (reminder: Reminder) => {
  if (!isNativeAlarmAvailable() || !reminder.notificationId) return;
  await AlarmReminder.cancelAlarm({
    reminderId: reminder.id,
    notificationId: reminder.notificationId,
  });
};

export const consumeAlarmEvents = async () => {
  if (!isNativeAlarmAvailable()) return [];
  const result = await AlarmReminder.consumeAlarmEvents();
  return Array.isArray(result.events) ? result.events : [];
};
