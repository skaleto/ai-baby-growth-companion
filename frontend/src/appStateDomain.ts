import type { SetStateAction } from "react";
import { makeId, todayISO } from "./data";
import {
  ALBUM_CATEGORY_VALUES,
  CARE_EVENT_TYPE_VALUES,
  EXPENSE_CATEGORY_IDS,
  MAX_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
} from "./appOptions";
import type {
  AgentBabyProfileContext,
  AlbumPrompt,
  AlbumItem,
  AlbumItemCategory,
  Attachment,
  BabyProfile,
  CareLog,
  CareLogEvent,
  CareLogEventType,
  ChatMessage,
  ConversationSummary,
  DailySummary,
  DailySummarySettings,
  ExpenseCategory,
  ExpenseItem,
  GrowthEvent,
  MemoryItem,
  PendingEffect,
  ProTrialStatus,
  RecordedBy,
  Reminder,
  ReminderAlertMode,
  ReminderKind,
  ReminderRepeatRule,
  ReminderScheduleMode,
  ReminderSoundId,
} from "./types";

export const LEGACY_STORAGE_KEYS = [
  "baby-companion-profile",
  "baby-companion-messages",
  "baby-companion-growth",
  "baby-companion-care",
  "baby-companion-reminders",
  "baby-companion-memories",
  "baby-companion-pending-effects",
  "baby-companion-album-items",
  "baby-companion-expenses",
  "baby-companion-conversation-summary",
];

export const LEGACY_IMPORT_MARKER_KEY = "baby-companion-legacy-imported";

export const readLocalJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const hasLocalArrayItems = (key: string) => {
  const value = readLocalJson(key);
  return Array.isArray(value) && value.length > 0;
};

export const hasLegacyLocalState = () => {
  try {
    if (window.localStorage.getItem(LEGACY_IMPORT_MARKER_KEY)) return false;
    const profile = readLocalJson("baby-companion-profile") as Partial<BabyProfile> | null;
    const hasProfile = Boolean(profile?.nickname?.trim() && (profile.birthDate?.trim() || profile.expectedDate?.trim()));
    return (
      hasProfile ||
      hasLocalArrayItems("baby-companion-messages") ||
      hasLocalArrayItems("baby-companion-growth") ||
      hasLocalArrayItems("baby-companion-care") ||
      hasLocalArrayItems("baby-companion-reminders") ||
      hasLocalArrayItems("baby-companion-memories") ||
      hasLocalArrayItems("baby-companion-pending-effects") ||
      hasLocalArrayItems("baby-companion-expenses")
    );
  } catch {
    return false;
  }
};

export const markLegacyImported = () => {
  try {
    window.localStorage.setItem(LEGACY_IMPORT_MARKER_KEY, "true");
  } catch {
    // Ignore storage failures; backend data remains authoritative after login.
  }
};

export const clearLocalAppState = () => {
  try {
    [...LEGACY_STORAGE_KEYS, "baby-companion-thinking-enabled", "baby-companion-model"].forEach((key) =>
      window.localStorage.removeItem(key),
    );
    markLegacyImported();
  } catch {
    // Ignore local storage failures.
  }
};

export const blankProfile: BabyProfile = {
  nickname: "",
  stage: "born",
  expectedDate: "",
  birthDate: "",
  region: "",
  feeding: "",
  allergies: [],
  caregivers: [],
};

export const hasCompleteProfile = (profile?: Partial<BabyProfile> | null) =>
  Boolean(profile?.nickname?.trim() && (profile.birthDate?.trim() || profile.expectedDate?.trim()));

export const suggestedFamilyName = (nickname: string) => `${nickname.trim() || "小宝"}家`;

export const textValue = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

export const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

export const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export const stringMember = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && values.includes(value as T);

export const normalizeBabyProfile = (value: Partial<BabyProfile> | null | undefined): BabyProfile => ({
  nickname: textValue(value?.nickname),
  stage: value?.stage === "pregnancy" ? "pregnancy" : "born",
  expectedDate: textValue(value?.expectedDate),
  birthDate: textValue(value?.birthDate),
  region: textValue(value?.region),
  feeding: textValue(value?.feeding),
  allergies: stringList(value?.allergies),
  caregivers: stringList(value?.caregivers),
});

export const normalizeAttachment = (value: Partial<Attachment> | null | undefined, index: number): Attachment => ({
  id: textValue(value?.id, `attachment-${index}`),
  name: textValue(value?.name, "附件"),
  kind: value?.kind === "video" || value?.kind === "audio" ? value.kind : "image",
  url: textValue(value?.url) || undefined,
  dataUrl: textValue(value?.dataUrl) || undefined,
  mimeType: textValue(value?.mimeType) || undefined,
  filePath: textValue(value?.filePath) || undefined,
  publicUrl: textValue(value?.publicUrl) || undefined,
  thumbnailPath: textValue(value?.thumbnailPath) || undefined,
  thumbnailUrl: textValue(value?.thumbnailUrl) || undefined,
  width: numberValue(value?.width),
  height: numberValue(value?.height),
  createdAt: textValue(value?.createdAt) || undefined,
});

export const normalizeRecordedBy = (value: Partial<RecordedBy> | null | undefined): RecordedBy | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const label = textValue(value.label) || textValue(value.roleName);
  const userId = textValue(value.userId);
  if (!label && !userId) return undefined;
  return {
    userId: userId || undefined,
    roleName: textValue(value.roleName) || label || undefined,
    label: label || "家庭成员",
    caregiver: typeof value.caregiver === "boolean" ? value.caregiver : undefined,
  };
};

export const recordedByLabel = (recordedBy?: RecordedBy) => recordedBy?.label || recordedBy?.roleName || "家庭成员";

export const creatorMetaText = (recordedBy?: RecordedBy) => `记录人：${recordedByLabel(recordedBy)}`;

export const stripAttachmentUrlForStorage = (url?: string) => {
  if (!url || url.startsWith("data:")) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith("/api/uploads/")) return parsed.pathname;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0];
  }
};

export const normalizeAlbumCategory = (value: unknown): AlbumItemCategory =>
  stringMember(ALBUM_CATEGORY_VALUES, value) ? value : "daily";

export const normalizeAlbumItem = (value: Partial<AlbumItem> | null | undefined, index: number): AlbumItem => ({
  id: textValue(value?.id, `album-${index}`),
  kind: value?.kind === "media" ? "media" : "keyEvent",
  title: textValue(value?.title, "成长片段"),
  date: textValue(value?.date, todayISO()),
  occurredAt: textValue(value?.occurredAt) || undefined,
  category: normalizeAlbumCategory(value?.category),
  tags: stringList(value?.tags),
  attachmentId: textValue(value?.attachmentId) || undefined,
  attachment: value?.attachment ? normalizeAttachment(value.attachment, index) : undefined,
  linkedType:
    value?.linkedType === "chatMessage" ||
    value?.linkedType === "careLogEvent" ||
    value?.linkedType === "growthEvent" ||
    value?.linkedType === "reminder"
      ? value.linkedType
      : undefined,
  linkedId: textValue(value?.linkedId) || undefined,
  source: value?.source === "agent" || value?.source === "manual" ? value.source : "rule",
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});

export const normalizeExpenseCategory = (value: unknown): ExpenseCategory =>
  stringMember(EXPENSE_CATEGORY_IDS, value) ? value : "other";

export const normalizeExpenseItem = (value: Partial<ExpenseItem> | null | undefined, index: number): ExpenseItem => {
  const now = new Date().toISOString();
  const amount = numberValue(value?.amount) ?? 0;
  return {
    id: textValue(value?.id, makeId("expense")),
    title: textValue(value?.title, "小宝支出"),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: textValue(value?.currency, "CNY"),
    category: normalizeExpenseCategory(value?.category),
    date: textValue(value?.date, todayISO()),
    quantity: numberValue(value?.quantity),
    unitPrice: numberValue(value?.unitPrice),
    merchant: textValue(value?.merchant) || undefined,
    note: textValue(value?.note) || undefined,
    brand: textValue(value?.brand) || undefined,
    spec: textValue(value?.spec) || undefined,
    attachmentIds: stringList(value?.attachmentIds),
    attachments: Array.isArray(value?.attachments)
      ? value.attachments.map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
      : undefined,
    source: value?.source === "agent" ? "agent" : "manual",
    createdAt: textValue(value?.createdAt, now),
    updatedAt: textValue(value?.updatedAt, now),
    recordedBy: normalizeRecordedBy(value?.recordedBy),
    createdByUserId: textValue(value?.createdByUserId) || undefined,
  };
};

export const normalizeAlbumPrompt = (value: Partial<AlbumPrompt> | null | undefined, index: number): AlbumPrompt => ({
  id: textValue(value?.id, `album-prompt-${index}`),
  attachmentId: textValue(value?.attachmentId),
  sourceMessageId: textValue(value?.sourceMessageId),
  title: textValue(value?.title, "值得收藏的素材"),
  category: normalizeAlbumCategory(value?.category),
  reason: textValue(value?.reason, "这段素材可能值得保存到相册。"),
  tags: stringList(value?.tags),
  status: value?.status === "saved" || value?.status === "ignored" ? value.status : "pending",
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
});

export const normalizeChatMessage = (value: Partial<ChatMessage> | null | undefined, index: number): ChatMessage => ({
  id: textValue(value?.id, `message-${index}`),
  role: value?.role === "parent" ? "parent" : "ai",
  text: textValue(value?.text),
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
  attachments: Array.isArray(value?.attachments)
    ? value.attachments.map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
    : undefined,
  tags: stringList(value?.tags),
  reasoning: textValue(value?.reasoning) || undefined,
  isStreaming: Boolean(value?.isStreaming),
  toolActivities: Array.isArray(value?.toolActivities) ? value.toolActivities : [],
  sources: Array.isArray(value?.sources) ? value.sources : [],
  safetyAlerts: Array.isArray(value?.safetyAlerts) ? value.safetyAlerts : [],
  effectDecisions: Array.isArray(value?.effectDecisions) ? value.effectDecisions : [],
  albumPrompts: Array.isArray(value?.albumPrompts) ? value.albumPrompts.map(normalizeAlbumPrompt) : [],
});

export const normalizeCareLogEventType = (value: unknown): CareLogEventType =>
  stringMember(CARE_EVENT_TYPE_VALUES, value) ? value : "note";

export const normalizeClockText = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const match = raw.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:点\s*(半|\d{1,2}|[一二两三四五六七八九十]{1,3})?|[:：]\s*(\d{1,2}))/);
  if (!match) return undefined;
  const period = match[1] ?? "";
  const parsedHour = parseLooseNumber(match[2]);
  if (parsedHour === undefined) return undefined;
  let hour = parsedHour;
  const minuteText = match[3] ?? match[4];
  const parsedMinute = minuteText === "半" ? 30 : parseLooseNumber(minuteText ?? "0");
  if (parsedMinute === undefined) return undefined;
  const minute = parsedMinute;
  if ((period === "下午" || period === "晚上") && hour < 12) hour += 12;
  if (period === "凌晨" && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return undefined;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const localTimeKey = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const reminderTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

export const chineseNumberMap: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

export const parseLooseNumber = (value: string | undefined) => {
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === "十") return 10;
  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const left = value.slice(0, tenIndex);
    const right = value.slice(tenIndex + 1);
    const tens = left ? chineseNumberMap[left] : 1;
    const ones = right ? chineseNumberMap[right] : 0;
    return tens !== undefined && ones !== undefined ? tens * 10 + ones : undefined;
  }
  return chineseNumberMap[value];
};

export const dateFromLocalParts = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

export const setClockOnDate = (date: Date, clockText: string) => {
  const [hour, minute] = clockText.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

export const parseWeekdayIndex = (value: string) => {
  if (value === "一" || value === "1") return 1;
  if (value === "二" || value === "2") return 2;
  if (value === "三" || value === "3") return 3;
  if (value === "四" || value === "4") return 4;
  if (value === "五" || value === "5") return 5;
  if (value === "六" || value === "6") return 6;
  return 0;
};

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
  const anchorType = source.anchorType === "careEvent" ? "careEvent" : "now";
  if (anchorType === "careEvent" && source.careEventType !== "milk") return undefined;
  const intervalMinutes = typeof source.intervalMinutes === "number" && Number.isFinite(source.intervalMinutes)
    ? Math.round(source.intervalMinutes)
    : undefined;
  if (!intervalMinutes) return undefined;
  return {
    mode: "fixedInterval",
    intervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, intervalMinutes)),
    anchorType,
    careEventType: anchorType === "careEvent" ? "milk" : undefined,
  };
};

export const isIntervalReminder = (reminder: Pick<Reminder, "scheduleMode" | "repeatRule" | "status">) =>
  reminder.status !== "done" &&
  reminder.scheduleMode === "interval" &&
  reminder.repeatRule?.mode === "fixedInterval";

export const isIntervalMilkReminder = (reminder: Pick<Reminder, "scheduleMode" | "repeatRule" | "status">) =>
  isIntervalReminder(reminder) &&
  reminder.repeatRule?.anchorType === "careEvent" &&
  reminder.repeatRule?.careEventType === "milk";

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

export const normalizeEventClockText = (timeValue: unknown, noteValue: unknown) => {
  const directTime = normalizeClockText(timeValue);
  const noteTime = normalizeClockText(noteValue);
  if (directTime && noteTime && directTime.endsWith(":00") && typeof noteValue === "string" && /点\s*半/.test(noteValue)) {
    return noteTime;
  }
  return directTime ?? noteTime;
};

export const canonicalCareEventTitle = (type: CareLogEventType, fallback?: string) => {
  if (type === "milk") return "喝奶";
  if (type === "sleep") return "睡觉";
  if (type === "wake") return "醒来";
  if (type === "poop") return "便便";
  if (type === "solid") return "辅食";
  if (type === "temperature") return "体温";
  if (type === "soothing") return "哄睡";
  return fallback || "照护记录";
};

export const canonicalCareEventTags = (type: CareLogEventType, tags: string[]) => {
  if (type === "sleep" || type === "wake" || type === "soothing") return ["睡眠"];
  if (type === "note") return tags.length ? tags : ["照护记录"];
  return [canonicalCareEventTitle(type)];
};

export const normalizeCareLogEvent = (
  value: Partial<CareLogEvent> | null | undefined,
  index: number,
  fallbackDate: string,
): CareLogEvent => {
  const type = normalizeCareLogEventType(value?.type);
  const tags = canonicalCareEventTags(type, stringList(value?.tags));
  return {
    id: textValue(value?.id, `care-event-${index}`),
    type,
    date: textValue(value?.date, fallbackDate),
    time: normalizeEventClockText(value?.time, value?.note),
    title: canonicalCareEventTitle(type, textValue(value?.title) || undefined),
    amountMl: numberValue(value?.amountMl),
    durationHours: numberValue(value?.durationHours),
    temperature: numberValue(value?.temperature),
    note: textValue(value?.note) || undefined,
    tags,
    recordedBy: normalizeRecordedBy(value?.recordedBy),
    createdByUserId: textValue(value?.createdByUserId) || undefined,
  };
};

export const normalizeCareLog = (value: Partial<CareLog> | null | undefined, index: number): CareLog => ({
  id: textValue(value?.id, `care-${index}`),
  date: textValue(value?.date, todayISO()),
  milkMl: numberValue(value?.milkMl),
  milkTimes: numberValue(value?.milkTimes),
  sleepHours: numberValue(value?.sleepHours),
  wakes: numberValue(value?.wakes),
  soothing: value?.soothing === "easy" || value?.soothing === "normal" || value?.soothing === "hard" ? value.soothing : undefined,
  solids: stringList(value?.solids),
  poop: textValue(value?.poop) || undefined,
  temperature: numberValue(value?.temperature),
  notes: stringList(value?.notes),
  events: Array.isArray(value?.events)
    ? value.events.map((item, eventIndex) => normalizeCareLogEvent(item, eventIndex, textValue(value?.date, todayISO())))
    : [],
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});

export const careEventTimelineKey = (event: CareLogEvent) =>
  [
    event.date,
    event.type,
    event.time ?? "",
    event.amountMl ?? "",
    event.durationHours ?? "",
    event.temperature ?? "",
  ].join("|");

export const dedupeCareEvents = (events: CareLogEvent[]) => {
  const byKey = new Map<string, CareLogEvent>();
  events.forEach((event) => {
    if (event.type === "note" && !event.time) return;
    const normalized: CareLogEvent = {
      ...event,
      title: canonicalCareEventTitle(event.type, event.title),
      tags: canonicalCareEventTags(event.type, event.tags ?? []),
    };
    const key = careEventTimelineKey(normalized);
    const existing = byKey.get(key);
    byKey.set(key, {
      ...normalized,
      id: existing?.id ?? normalized.id,
      amountMl: normalized.amountMl ?? existing?.amountMl,
      durationHours: normalized.durationHours ?? existing?.durationHours,
      temperature: normalized.temperature ?? existing?.temperature,
      note: normalized.note ?? existing?.note,
      tags: Array.from(new Set([...(existing?.tags ?? []), ...(normalized.tags ?? [])])),
      recordedBy: existing?.recordedBy ?? normalized.recordedBy,
      createdByUserId: existing?.createdByUserId ?? normalized.createdByUserId,
    });
  });
  return Array.from(byKey.values());
};

export const uniqueTexts = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

export const dedupeCareLogs = (logs: CareLog[]) => {
  const byDate = new Map<string, CareLog>();
  logs.forEach((log) => {
    const existing = byDate.get(log.date);
    if (!existing) {
      byDate.set(log.date, { ...log, notes: uniqueTexts(log.notes), events: dedupeCareEvents(log.events) });
      return;
    }
    byDate.set(log.date, {
      ...existing,
      id: existing.id,
      milkMl: log.milkMl ?? existing.milkMl,
      milkTimes: log.milkTimes ?? existing.milkTimes,
      sleepHours: log.sleepHours ?? existing.sleepHours,
      wakes: log.wakes ?? existing.wakes,
      soothing: log.soothing ?? existing.soothing,
      solids: uniqueTexts([...(existing.solids ?? []), ...(log.solids ?? [])]),
      poop: log.poop ?? existing.poop,
      temperature: log.temperature ?? existing.temperature,
      notes: uniqueTexts([...existing.notes, ...log.notes]).slice(-8),
      events: dedupeCareEvents([...existing.events, ...log.events]),
    });
  });
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
};

export const normalizeGrowthEvent = (value: Partial<GrowthEvent> | null | undefined, index: number): GrowthEvent => ({
  id: textValue(value?.id, `growth-${index}`),
  type: textValue(value?.type, "daily_growth"),
  title: textValue(value?.title, "成长记录"),
  date: textValue(value?.date, todayISO()),
  summary: textValue(value?.summary),
  firstTime: Boolean(value?.firstTime),
  mediaKind: value?.mediaKind,
  tags: stringList(value?.tags),
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});

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

export const normalizeMemoryItem = (value: Partial<MemoryItem> | null | undefined, index: number): MemoryItem => ({
  id: textValue(value?.id, `memory-${index}`),
  text: textValue(value?.text),
  category: normalizeMemoryCategory(value?.category),
  confidence: numberValue(value?.confidence) ?? 0.7,
  updatedAt: textValue(value?.updatedAt, new Date().toISOString()),
});

export const normalizeConversationSummary = (
  value: Partial<ConversationSummary> | null | undefined,
): ConversationSummary | null => {
  const text = textValue(value?.text).trim();
  if (!text) return null;
  return {
    id: textValue(value?.id, "conversation-summary"),
    text,
    coveredThroughMessageId: textValue(value?.coveredThroughMessageId),
    coveredThroughCreatedAt: textValue(value?.coveredThroughCreatedAt),
    sourceMessageCount: numberValue(value?.sourceMessageCount) ?? 0,
    updatedAt: textValue(value?.updatedAt, new Date().toISOString()),
  };
};

export const normalizeProTrialStatus = (value: Partial<ProTrialStatus> | null | undefined): ProTrialStatus => ({
  enabled: Boolean(value?.enabled),
  entitlement: value?.entitlement
    ? {
        enabled: Boolean(value.entitlement.enabled),
        planCode: textValue(value.entitlement.planCode) || undefined,
        startsAt: textValue(value.entitlement.startsAt) || undefined,
        expiresAt: textValue(value.entitlement.expiresAt) || undefined,
      }
    : null,
  application: value?.application
    ? {
        id: textValue(value.application.id),
        status: textValue(value.application.status, "pending"),
        source: textValue(value.application.source) || undefined,
        createdAt: textValue(value.application.createdAt) || undefined,
        updatedAt: textValue(value.application.updatedAt) || undefined,
      }
    : null,
  message: textValue(value?.message) || undefined,
});

export const normalizeDailySummarySettings = (
  value: Partial<DailySummarySettings> | null | undefined,
): DailySummarySettings => ({
  enabled: value?.enabled !== false,
  reminderTime: textValue(value?.reminderTime, "21:30"),
  mutedMissingTypes: stringList(value?.mutedMissingTypes),
});

export const normalizeMissingPrompt = (value: Partial<DailySummary["missingItems"][number]> | null | undefined, index: number) => ({
  id: textValue(value?.id, `missing-${index}`),
  type: textValue(value?.type, "general"),
  scope: textValue(value?.scope, "family"),
  title: textValue(value?.title, "可能漏项"),
  message: textValue(value?.message, "这条信息可以稍后再补。"),
  action: textValue(value?.action) || undefined,
});

export const normalizeDailySummary = (value: Partial<DailySummary> | null | undefined): DailySummary | null => {
  if (!value || !textValue(value.text).trim()) return null;
  return {
    id: textValue(value.id, "daily-summary"),
    date: textValue(value.date, todayISO()),
    text: textValue(value.text),
    facts: stringList(value.facts),
    observations: stringList(value.observations),
    findings: Array.isArray(value.findings) ? value.findings : [],
    missingItems: Array.isArray(value.missingItems) ? value.missingItems.map(normalizeMissingPrompt) : [],
    accountMissingItems: Array.isArray(value.accountMissingItems) ? value.accountMissingItems.map(normalizeMissingPrompt) : [],
    generatedAt: textValue(value.generatedAt, new Date().toISOString()),
    generatedByUserId: textValue(value.generatedByUserId) || undefined,
    sourceFingerprint: textValue(value.sourceFingerprint) || undefined,
    stale: Boolean(value.stale),
  };
};

export const normalizePendingEffect = (value: Partial<PendingEffect> | null | undefined, index: number): PendingEffect => ({
  id: textValue(value?.id, `pending-${index}`),
  messageId: textValue(value?.messageId),
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
  status: "pending",
  tags: stringList(value?.tags),
  growthEvent: value?.growthEvent ? normalizeGrowthEvent(value.growthEvent, index) : undefined,
  careLogPatch: value?.careLogPatch ? normalizeCareLog(value.careLogPatch, index) : undefined,
  reminders: Array.isArray(value?.reminders) ? value.reminders.map(normalizeReminder) : [],
  memories: Array.isArray(value?.memories) ? value.memories.map(normalizeMemoryItem) : [],
  expenses: Array.isArray(value?.expenses) ? value.expenses.map(normalizeExpenseItem) : [],
  safetyAlerts: Array.isArray(value?.safetyAlerts) ? value.safetyAlerts : [],
});

export const resolveStateAction = <T,>(action: SetStateAction<T>, current: T): T =>
  typeof action === "function" ? (action as (current: T) => T)(current) : action;

export const safeDate = (value: string, dateOnly = false) => {
  if (!value) return null;
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatZhDate = (value: string, options: Intl.DateTimeFormatOptions, fallback: string, dateOnly = false) => {
  const date = safeDate(value, dateOnly);
  return date ? new Intl.DateTimeFormat("zh-CN", options).format(date) : fallback;
};

export const formatTime = (value: string) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date) : "--:--";
};

export const formatDate = (value: string) => formatZhDate(value, { month: "short", day: "numeric" }, "待设置");

export const formatFullDate = (value: string) =>
  formatZhDate(value, { year: "numeric", month: "long", day: "numeric", weekday: "short" }, "待设置", true);

export const formatExpenseDateLabel = (value: string) =>
  formatZhDate(value, { year: "numeric", month: "long", day: "numeric" }, "选择日期", true);

export const monthTitle = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${value}-01T00:00:00`));

export const ageLabel = (birthDate: string) => {
  const start = safeDate(birthDate, true);
  if (!start) return "待设置生日";
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const months = Math.floor(days / 30);
  return months > 0 ? `${months}个月${days % 30}天` : `${days}天`;
};

export const displayProfileValue = (value: string, fallback = "暂未设置") => value.trim() || fallback;

export const babyProfileForAgent = (profile: BabyProfile): AgentBabyProfileContext => {
  if (profile.stage === "pregnancy") {
    return {
      ...profile,
      ageLabel: profile.expectedDate ? `孕期，预产期 ${profile.expectedDate}` : "孕期，预产期待设置",
    };
  }

  const birthDate = safeDate(profile.birthDate, true);
  if (!birthDate) {
    return { ...profile, ageLabel: "已出生，生日待设置" };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ageDays = Math.max(0, Math.floor((today.getTime() - birthDate.getTime()) / 86400000));
  const ageWeeks = Math.floor(ageDays / 7);
  const ageMonths = Math.floor(ageDays / 30);
  const daysUntilFullMonth = Math.max(0, 30 - ageDays);
  const fullMonth = ageDays >= 30;
  const label = fullMonth
    ? `出生${ageDays}天，约${ageMonths}个月${ageDays % 30}天`
    : `出生${ageDays}天，未满月，还差${daysUntilFullMonth}天满30天`;

  return {
    ...profile,
    ageDays,
    ageWeeks,
    ageMonths,
    ageLabel: label,
    fullMonth,
    daysUntilFullMonth,
  };
};

export const stageLabel = (stage: BabyProfile["stage"]) => (stage === "pregnancy" ? "孕期" : "已出生");

export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDays = (date: string, offset: number) => {
  const source = safeDate(date, true) ?? new Date();
  return toISODate(new Date(source.getFullYear(), source.getMonth(), source.getDate() + offset));
};

export const addMonths = (month: string, offset: number) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return toISODate(new Date(year, monthIndex - 1 + offset, 1)).slice(0, 7);
};

export const calendarDatesForMonth = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1).getDay();
  const totalDays = new Date(year, monthIndex, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => ""),
    ...Array.from({ length: totalDays }, (_, index) => `${month}-${`${index + 1}`.padStart(2, "0")}`),
  ];
};

export const splitListText = (value: string) =>
  value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const currentClockText = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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

export function normalizeMemoryCategory(category: string | undefined): MemoryItem["category"] {
  if (
    category === "routine" ||
    category === "preference" ||
    category === "health" ||
    category === "caregiver" ||
    category === "concern"
  ) {
    return category;
  }
  return "routine";
}
