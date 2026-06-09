import {
  Bell,
  BellOff,
  Brain,
  CalendarDays,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe2,
  Image as ImageIcon,
  Keyboard as KeyboardIcon,
  LineChart,
  Mic,
  Milk,
  Moon,
  MoreHorizontal,
  Music2,
  PartyPopper,
  PencilLine,
  ReceiptText,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Syringe,
  Trash2,
  UserRound,
  Users,
  Video,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import {
  ChangeEvent,
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { prefetchAlbumVideo } from "./components/albumVideoPlayback";
import { AgentApiError, compressConversationSummary, runAgentChatStream, type AgentStreamStatusType } from "./agentApi";
import {
  ALBUM_CATEGORIES,
  albumCategoryFromTags,
  albumCategoryLabel,
  albumMonthLabel,
  albumItemFromDecision,
  albumItemFromStandaloneAttachment,
  albumPromptFromDecision,
  albumPromptFromEffectDecision,
  attachmentAspectRatio,
  attachmentListSrc,
  buildDerivedAlbumItems,
  decideAlbumMedia,
  dedupeAlbumItems,
  distributeIntoColumns,
  isVisibleAlbumMedia,
  resolveAlbumEffectTarget,
  type AlbumMediaDecision,
} from "./albumDomain";
import { ensureMicrophonePermission } from "./audioPermission";
import {
  confirmPendingEffectOnServer,
  deleteAttachment,
  deleteAppRecord,
  discardPendingEffectOnServer,
  importAppState,
  readAppState,
  readAiUsageSummary,
  redeemProCode,
  submitProTrialApplication,
  type AppStateCollection,
  type AppStateResponse,
  upsertAppRecord,
  uploadFileAttachment,
} from "./appStateApi";
import { AsrStreamController, runAsrStream } from "./asrApi";
import {
  AUTH_EXPIRED_EVENT,
  AuthFamily,
  AuthMember,
  AuthUser,
  apiBaseUrl,
  clearAuthToken,
  getAuthToken,
  readInviteRoleOptions,
  loginWithInvite,
  logoutCurrentUser,
  readCurrentUser,
  readFamilyMembers,
  refreshAccessToken,
  removeFamilyMember,
  resetFamilyInviteCode,
  updateFamilyMemberCaregiver,
  updateFamilyName,
  type FamilyMember,
  type FamilyMembersResponse,
} from "./authApi";
import {
  initialProfile,
  makeId,
  todayISO,
} from "./data";
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess, hapticWarning } from "./haptics";
import {
  cancelAlarmReminder,
  consumeAlarmEvents,
  isNativeAlarmAvailable,
  nativeAlarmPlatform,
  scheduleAlarmReminder,
  type NativeAlarmEvent,
} from "./nativeAlarm";
import { resolveMediaCaptureDate } from "./mediaCaptureDate";
import { isNativeMediaPickerAvailable, isNativeMediaPickerCancel, pickNativeMediaFiles } from "./nativeMediaPicker";
import { MOBILE_UPDATE_NOTICE_EVENT, type MobileUpdateNoticeDetail, type MobileUpdateNoticeTone } from "./mobileUpdates";
import { useStoredState } from "./storage";
import { useStableViewport } from "./hooks/useStableViewport";
import {
  CARE_EVENT_TYPE_OPTIONS,
  DEFAULT_MODEL,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_OPTIONS,
  FEEDING_SELECT_OPTIONS,
  GROWTH_MEASUREMENT_META,
  GROWTH_MEASUREMENT_TYPES,
  LEDGER_VIEWS,
  MAX_INTERVAL_MINUTES,
  MOBILE_TABS,
  MIN_INTERVAL_MINUTES,
  RECORD_VIEWS,
  REGION_SELECT_OPTIONS,
  REMINDER_ALERT_MODE_OPTIONS,
  REMINDER_CATEGORY_OPTIONS,
  REMINDER_SCHEDULE_MODE_OPTIONS,
  REMINDER_SOUND_OPTIONS,
  GENDER_SELECT_OPTIONS,
  ROLE_OPTIONS,
  ROLE_SELECT_OPTIONS,
  STAGE_SELECT_OPTIONS,
  UNIQUE_ROLE_OPTIONS,
  type LedgerView as LedgerViewId,
  type MobileTab,
  type RecordView,
} from "./appOptions";
import {
  addDays,
  addMonths,
  ageLabel,
  babyProfileForAgent,
  blankProfile,
  calendarDatesForMonth,
  canonicalCareEventTitle,
  clearLocalAppState,
  creatorMetaText,
  currentClockText,
  dedupeCareLogs,
  displayProfileValue,
  formatDate,
  formatExpenseDateLabel,
  formatFullDate,
  formatReminderDueText,
  formatTime,
  hasCompleteProfile,
  hasLegacyLocalState,
  isIntervalMilkReminder,
  isIntervalReminder,
  localDateKey,
  localTimeKey,
  markLegacyImported,
  mergeAlbumItemsFromSnapshot,
  monthTitle,
  normalizeAlbumItem,
  normalizeBabyProfile,
  normalizeCareLog,
  normalizeCareLogEvent,
  normalizeChatMessage,
  normalizeClockText,
  normalizeConversationSummary,
  normalizeExpenseItem,
  normalizeGrowthEvent,
  normalizeGrowthMeasurement,
  normalizeMemoryCategory,
  normalizeMemoryItem,
  normalizePendingEffect,
  normalizeProTrialStatus,
  normalizeReminder,
  normalizeReminderAlertMode,
  normalizeReminderSchedule,
  normalizeReminderScheduleMode,
  normalizeReminderSoundId,
  parseReminderDueAt,
  reminderNotificationId,
  reminderTimezone,
  resolveStateAction,
  splitListText,
  stageLabel,
  stripAttachmentUrlForStorage,
  suggestedFamilyName,
} from "./appStateDomain";
import { AlbumVideoThumbnail } from "./components/AlbumVideoThumbnail";
import { PreviewVideoPlayer } from "./components/PreviewVideoPlayer";
import { StorySelect, selectOptionsWithCurrent } from "./components/StorySelect";
import { AuthScene } from "./components/AuthScene";
import { StorybookScene } from "./components/StorybookScene";
import { AuthBrand } from "./components/AuthBrand";
import { ConsentGate } from "./components/ConsentGate";
import { AiDataNotice } from "./components/AiDataNotice";
import { LegalDocModal } from "./components/LegalDocModal";
import type { LegalDocId } from "./legalContent";
import {
  AgentChatResponse,
  AgentModelId,
  AiUsageSummary,
  AlbumPrompt,
  AlbumItem,
  AlbumItemCategory,
  AppStateSnapshot,
  AgentSource,
  Attachment,
  AttachmentKind,
  BabyProfile,
  CareLog,
  CareLogEvent,
  CareLogEventType,
  ChatMessage,
  ConversationSummary,
  EffectDecision,
  ExpenseCategory,
  ExpenseItem,
  GrowthEvent,
  GrowthMeasurement,
  GrowthMeasurementType,
  MemoryItem,
  PendingEffect,
  ProTrialStatus,
  RecordedBy,
  Reminder,
  ReminderKind,
  ReminderAlertMode,
  ReminderRepeatRule,
  ReminderScheduleMode,
  ReminderSoundId,
  SafetyAlert,
  ToolActivity,
} from "./types";
import companionAvatarIcon from "./assets/storybook-icons/companion-avatar.png";
import companionIcon from "./assets/storybook-icons/companion.png";
import growthIcon from "./assets/storybook-icons/growth.png";
import milkIcon from "./assets/storybook-icons/milk.png";
import poopIcon from "./assets/storybook-icons/poop.png";
import profileIcon from "./assets/storybook-icons/profile.png";
import recordsIcon from "./assets/storybook-icons/records.png";
import reminderIcon from "./assets/storybook-icons/reminder.png";
import sleepIcon from "./assets/storybook-icons/sleep.png";
import solidIcon from "./assets/storybook-icons/solid.png";
import temperatureIcon from "./assets/storybook-icons/temperature.png";
import alarmSceneImage from "./assets/alarm/alarm-scene.webp";
import emptyRemindersImg from "./assets/illustrations/empty-reminders.png";
import {
  aiUsageFeatureLabel,
  aiUsageModelLabel,
  aiUsageProviderLabel,
  formatTokenCount,
} from "./utils/aiUsage";
import {
  AGENT_IMAGE_MAX_EDGE_BATCH,
  AGENT_IMAGE_MAX_EDGE_SINGLE,
  AGENT_IMAGE_TARGET_CHARS_LARGE_BATCH,
  AGENT_IMAGE_TARGET_CHARS_SINGLE,
  AGENT_IMAGE_TARGET_CHARS_SMALL_BATCH,
  MAX_AGENT_ATTACHMENT_DATA_URL_CHARS,
  MAX_ALBUM_PICKER_ATTACHMENTS,
  MAX_CHAT_ATTACHMENTS,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_THUMBNAIL_TIMEOUT_MS,
  formatFileSize,
  maxMediaUploadBytes,
} from "./utils/uploadLimits";
import {
  LEGACY_REMINDER_CHANNELS,
  REMINDER_CHANNELS,
  REMINDER_QUICK_ACTIONS,
  REMINDER_SOUND_FILES,
  REMINDER_WEB_SOUND_URLS,
} from "./utils/reminderAssets";
import {
  expenseCategoryLabel,
  expenseMonthKey,
  expenseSourceLabel,
  expenseYearKey,
  formatMoney,
  formatMoneyCompact,
  groupExpensesByMonth,
  sumExpenses,
  type ExpenseMonthGroup,
} from "./utils/expense";
import { LedgerView, type LedgerStats } from "./views/LedgerView";
import { MilestonesView } from "./views/MilestonesView";
import { GrowthEntryView } from "./views/GrowthEntryView";
import { type GrowthMilestone, milestoneTag } from "./data/growthMilestones";
import {
  careAlbumCategory,
  careAlbumTitle,
  careEventBody,
  careEventTitleMap,
  careEventsForLog,
  inferCareEventType,
  parseTimeSort,
  recordTimeLabel,
  soothingText,
} from "./utils/careLogHelpers";
import { careLogWithEventStats, careLogsWithEventStats } from "./utils/careLogStats";
import {
  formatIntervalText,
  reminderAlertLabel,
  reminderCategoryLabel,
  reminderDate,
  reminderNotificationLabel,
  reminderRepeatLabel,
  reminderScheduleLabel,
  reminderSoundLabel,
  reminderStatusLabel,
  reminderTimeText,
} from "./utils/reminderLabels";

const BUILD_OTA_VERSION = (import.meta.env.VITE_MOBILE_UPDATE_VERSION as string | undefined)?.trim() ?? "";

type ComposerMode = "keyboard" | "voice";

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "unsupported" | "error";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";
type AiUsageStatus = "idle" | "loading" | "ready" | "error";

type CompressionStatus = "idle" | "checking" | "compressing" | "done" | "failed";

type MediaUploadStatus = "preparing" | "uploading" | "processing" | "done" | "failed";
type MediaUploadTarget = "chat" | "album";

type MediaUploadItem = {
  id: string;
  name: string;
  kind: AttachmentKind;
  target: MediaUploadTarget;
  status: MediaUploadStatus;
  progress: number;
  message?: string;
};

type QueuedMediaFile = {
  id: string;
  file: File;
  kind: AttachmentKind;
};

type PreviewMotion = "opening" | "idle" | "closing";

// Rect of the tapped thumbnail, so the preview can morph (FLIP) out of / back
// into that exact thumbnail instead of a generic center zoom.
type PreviewOriginRect = { top: number; left: number; width: number; height: number };
const previewOriginFromRect = (rect: DOMRect): PreviewOriginRect => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height,
});

// View Transitions API (Chromium WebView 111+, iOS 18+ WKWebView) gives a native
// container-transform morph between the tapped thumbnail and the fullscreen media.
// Older WebViews fall back to the FLIP animation.
const supportsViewTransition = (): boolean =>
  typeof document !== "undefined" &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function";

const PREVIEW_VT = supportsViewTransition();

const startViewTransition = (callback: () => void): { finished: Promise<unknown> } =>
  (
    document as unknown as {
      startViewTransition: (cb: () => void) => { finished: Promise<unknown> };
    }
  ).startViewTransition(callback);

type RuntimeVersionInfo = {
  otaVersion: string;
  nativeVersion: string;
  bundleId: string;
  platform: string;
  status: string;
};

type SystemWeakNotice = {
  id: number;
  message: string;
  tone: MobileUpdateNoticeTone;
  progress?: number | null;
  progressMode?: MobileUpdateNoticeDetail["progressMode"];
};

type RecordEventType = "care" | "growth" | "reminder";

type RecordEvent = {
  id: string;
  date: string;
  timeLabel: string;
  sortValue: number;
  type: RecordEventType;
  kind: CareLogEventType | "growth" | "reminder";
  title: string;
  body: string;
  tags: string[];
  careLogId?: string;
  careEventId?: string;
  recordedBy?: RecordedBy;
};

type CareEventDraft = {
  type: CareLogEventType;
  time: string;
  amountMl: string;
  durationHours: string;
  temperature: string;
  note: string;
};

type RecordsEntryDrawer = "ai" | "manual" | null;

type ManualRecordKind = Extract<CareLogEventType, "milk" | "sleep" | "poop" | "temperature" | "solid">;
type ManualNumericDraftKey = "amountMl" | "durationHours" | "temperature";

type ManualRecordTypeOption = {
  type: ManualRecordKind;
  label: string;
  hint: string;
};

type ReminderDraft = {
  title: string;
  category: Reminder["category"];
  scheduleMode: ReminderScheduleMode;
  alertMode: ReminderAlertMode;
  dueDate: string;
  dueTime: string;
  intervalMinutes: string;
  soundId: ReminderSoundId;
};

type ReminderPostponeDraft = {
  dueDate: string;
  dueTime: string;
};

type ExpenseDraft = {
  title: string;
  amount: string;
  category: ExpenseCategory;
  date: string;
  quantity: string;
  unitPrice: string;
  merchant: string;
  note: string;
  brand: string;
  spec: string;
  source: ExpenseItem["source"];
};

type PendingReminderDraft = {
  id: string;
  draft: ReminderDraft;
};

type PendingMemoryDraft = {
  id: string;
  text: string;
};

type PendingGrowthDraft = {
  title: string;
  date: string;
  summary: string;
};

type PendingGrowthMeasurementDraft = {
  id: string;
  type: GrowthMeasurementType;
  value: string;
  date: string;
  note: string;
};

type PendingCareDraft = {
  date: string;
  milkMl: string;
  milkTimes: string;
  sleepHours: string;
  wakes: string;
  poop: string;
  temperature: string;
  notes: string;
};

type PendingEffectDraft = {
  growthEvent?: PendingGrowthDraft;
  growthMeasurements: PendingGrowthMeasurementDraft[];
  careLogPatch?: PendingCareDraft;
  reminders: PendingReminderDraft[];
  memories: PendingMemoryDraft[];
  expenses: ExpenseDraft[];
};

type CareTrendPoint = {
  date: string;
  label: string;
  value: number | undefined;
  height: number;
  selected: boolean;
};

type CareTrendMetric = {
  key: string;
  label: string;
  currentLabel: string;
  deltaLabel: string;
  averageLabel: string;
  trendClass: "up" | "down" | "flat" | "muted";
  points: CareTrendPoint[];
};

type CareTrendDefinition = {
  key: string;
  label: string;
  unit: string;
  decimals?: number;
  getValue: (log?: CareLog) => number | undefined;
};

type GrowthTrendMetric = {
  key: GrowthMeasurementType;
  label: string;
  valueLabel: string;
  deltaLabel: string;
  dateLabel: string;
  hasData: boolean;
};

type GrowthCurvePoint = {
  id: string;
  date: string;
  label: string;
  valueLabel: string;
  x: number;
  y: number;
};

type GrowthCurveData = {
  points: GrowthCurvePoint[];
  polyline: string;
  minLabel: string;
  maxLabel: string;
  latestLabel: string;
};

type DailyCareSegment = {
  id: string;
  time?: string;
  label: string;
  value: number;
  grow: number;
};

type DailyCareMarker = {
  id: string;
  time: string;
  label: string;
};

type DailyCareBreakdown = {
  key: "milk" | "sleep";
  label: string;
  totalLabel: string;
  countLabel: string;
  emptyLabel: string;
  segments: DailyCareSegment[];
  markers: DailyCareMarker[];
};

type WeeklyCareDay = {
  date: string;
  label: string;
  selected: boolean;
  milkValue?: number;
  milkCount?: number;
  milkHeight: number;
  milkSegments: number[];
  sleepValue?: number;
  sleepCount?: number;
  sleepHeight: number;
  sleepSegments: number[];
};

type WeeklyCareComparison = {
  days: WeeklyCareDay[];
  hasData: boolean;
  milkAverageLabel: string;
  sleepAverageLabel: string;
};

const extractCareEventsFromText = (text: string, date: string) =>
  text
    .split(/[。；;\n]/)
    .flatMap((sentence) => sentence.split(/(?=(?:凌晨|早上|上午|中午|下午|晚上)?\s*\d{1,2}\s*(?:点|:|：))/))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): CareLogEvent | null => {
      const type = inferCareEventType(part);
      const explicitTime = normalizeClockText(part);
      const time = explicitTime ?? (/刚刚|刚才|现在/.test(part) ? currentClockText() : undefined);
      if (!time || type === "note") return null;
      const amountText = part.match(/(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i)?.[1];
      const durationText = part.match(/(\d+(?:\.\d+)?)\s*(?:小时|h)/i)?.[1];
      const temperatureText = part.match(/体温\s*(\d+(?:\.\d+)?)/)?.[1];
      return {
        id: makeId("care-event"),
        type,
        date,
        time,
        title: careEventTitleMap[type],
        amountMl: amountText ? Number(amountText) : undefined,
        durationHours: durationText ? Number(durationText) : undefined,
        temperature: temperatureText ? Number(temperatureText) : undefined,
        note: part,
        tags: [careEventTitleMap[type]],
      };
    })
    .filter((event): event is CareLogEvent => Boolean(event))
    .slice(0, 12);

const hasExplicitCareRecordSignal = (text: string) => {
  const events = extractCareEventsFromText(text, todayISO());
  if (
    events.some((event) => {
      if (event.type === "milk") return positiveNumber(event.amountMl) !== undefined;
      if (event.type === "sleep") return positiveNumber(event.durationHours) !== undefined;
      if (event.type === "temperature") return positiveNumber(event.temperature) !== undefined;
      return event.type === "poop" || event.type === "solid" || event.type === "wake" || event.type === "soothing";
    })
  ) {
    return true;
  }
  return /喝奶\s*\d+\s*次|奶量\s*\d+|睡眠\s*\d+(?:\.\d+)?\s*(?:小时|h)|夜醒\s*\d+\s*次|体温\s*\d+(?:\.\d+)?/.test(text);
};

const hasExplicitStructuredActionSignal = (text: string) =>
  hasExplicitCareRecordSignal(text) ||
  /(提醒|记得|待办|复诊|保存到相册|存到相册|加入相册|留念|纪念|第一次|里程碑|满月|百天|生日|疫苗本|接种证|体检报告|医生通知|病历)/.test(text);

const emptyStructuredResponse = (response: AgentChatResponse): AgentChatResponse => ({
  ...response,
  growthEvent: null,
  careLogPatch: null,
  reminders: [],
  memories: [],
  effectDecisions: [],
});

const suppressImageOnlyCareEffects = (
  response: AgentChatResponse,
  parentText: string,
  attachments: Attachment[],
  albumDecisions: AlbumMediaDecision[] = [],
): AgentChatResponse => {
  if (!attachments.some((item) => item.kind === "image" || item.kind === "video")) return response;
  const screenshotDescriptionOnly =
    albumDecisions.some((decision) => decision.mode === "ignore" && decision.tags.includes("截图")) &&
    !hasExplicitStructuredActionSignal(parentText);
  if (screenshotDescriptionOnly) return emptyStructuredResponse(response);
  if (hasExplicitCareRecordSignal(parentText)) return response;
  return {
    ...response,
    careLogPatch: null,
    effectDecisions: (response.effectDecisions ?? []).filter((decision) => decision.type !== "careLog"),
  };
};

// careLog + reminder helpers moved to ./utils/careLogHelpers and ./utils/reminderLabels

const buildRecordEvents = (
  careLogs: CareLog[],
  growthEvents: GrowthEvent[],
  reminders: Reminder[],
): RecordEvent[] => {
  const careEvents: RecordEvent[] = careLogs.flatMap((log) =>
    careEventsForLog(log).map((event, index) => ({
      id: `record-${log.id}-${event.id || index}`,
      date: event.date || log.date,
      timeLabel: recordTimeLabel(event.date || log.date, event.time),
      sortValue: parseTimeSort(event.time, 8 * 60 + index),
      type: "care",
      kind: event.type,
      title: event.title || careEventTitleMap[event.type],
      body: careEventBody(event),
      tags: event.tags?.length ? event.tags : [careEventTitleMap[event.type]],
      careLogId: log.id,
      careEventId: event.id,
      recordedBy: event.recordedBy ?? log.recordedBy,
    })),
  );

  const growthRecords: RecordEvent[] = growthEvents.map((event) => ({
    id: `record-${event.id}`,
    date: event.date,
    timeLabel: recordTimeLabel(event.date),
    sortValue: 12 * 60,
    type: "growth",
    kind: "growth",
    title: event.title,
    body: event.summary,
    tags: event.tags,
    recordedBy: event.recordedBy,
  }));

  const reminderEvents: RecordEvent[] = reminders
    .filter((reminder) => reminder.status === "done")
    .map((reminder) => ({
      id: `record-${reminder.id}`,
      date: reminderDate(reminder),
      timeLabel: recordTimeLabel(reminderDate(reminder), reminderTimeText(reminder)),
      sortValue: parseTimeSort(reminder.dueText, 20 * 60),
      type: "reminder",
      kind: "reminder",
      title: reminder.title,
      body: "已完成",
      tags: [reminder.category === "vaccine" ? "疫苗" : "提醒"],
    }));

  return [...careEvents, ...growthRecords, ...reminderEvents].sort(
    (left, right) => left.date.localeCompare(right.date) || left.sortValue - right.sortValue,
  );
};

const recordEventIconSrc = (event: RecordEvent) => {
  if (event.kind === "milk") return milkIcon;
  if (event.kind === "sleep" || event.kind === "wake" || event.kind === "soothing") return sleepIcon;
  if (event.kind === "poop") return poopIcon;
  if (event.kind === "solid") return solidIcon;
  if (event.kind === "temperature") return temperatureIcon;
  if (event.kind === "growth") return growthIcon;
  if (event.kind === "reminder") return reminderIcon;
  return recordsIcon;
};

// reminder labels moved to ./utils/reminderLabels

const albumCategoryIconSrc = (category: AlbumItemCategory) => {
  if (category === "growth") return growthIcon;
  if (category === "feeding") return milkIcon;
  if (category === "sleep") return sleepIcon;
  if (category === "health") return temperatureIcon;
  if (category === "reminder") return reminderIcon;
  return recordsIcon;
};

// careAlbumCategory + careAlbumTitle moved to ./utils/careLogHelpers

const formatTrendValue = (value: number | undefined, unit: string, decimals = 0) => {
  if (value === undefined || !Number.isFinite(value)) return "未记录";
  const text = decimals > 0 ? value.toFixed(decimals).replace(/\.0$/, "") : `${Math.round(value)}`;
  return unit ? `${text} ${unit}` : text;
};

const careTrendDefinitions: CareTrendDefinition[] = [
  {
    key: "milkMl",
    label: "奶量",
    unit: "ml",
    getValue: (log?: CareLog) => (log?.milkMl && log.milkMl > 0 ? log.milkMl : undefined),
  },
  {
    key: "milkTimes",
    label: "喝奶次数",
    unit: "次",
    getValue: (log?: CareLog) => (log?.milkTimes !== undefined ? log.milkTimes : undefined),
  },
  {
    key: "sleepHours",
    label: "睡眠",
    unit: "h",
    decimals: 1,
    getValue: (log?: CareLog) => (log?.sleepHours && log.sleepHours > 0 ? log.sleepHours : undefined),
  },
  {
    key: "wakes",
    label: "夜醒",
    unit: "次",
    getValue: (log?: CareLog) => (log?.wakes !== undefined ? log.wakes : undefined),
  },
  {
    key: "temperature",
    label: "体温",
    unit: "°C",
    decimals: 1,
    getValue: (log?: CareLog) => (log?.temperature && log.temperature > 0 ? log.temperature : undefined),
  },
  {
    key: "poop",
    label: "便便",
    unit: "次",
    getValue: (log?: CareLog) => {
      if (!log) return undefined;
      const eventCount = log.events.filter((event) => event.type === "poop").length;
      if (eventCount > 0) return eventCount;
      return log.poop ? 1 : undefined;
    },
  },
];

const buildCareTrendMetrics = (careLogs: CareLog[], selectedDate: string): CareTrendMetric[] => {
  const logByDate = new Map(careLogs.map((log) => [log.date, log]));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 6));

  return careTrendDefinitions
    .map((definition) => {
      const values = dates.map((date) => definition.getValue(logByDate.get(date)));
      const recordedValues = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
      if (!recordedValues.length) return null;

      const maxValue = Math.max(...recordedValues, 1);
      const current = values[values.length - 1];
      const previous = values[values.length - 2];
      const average = recordedValues.reduce((total, value) => total + value, 0) / recordedValues.length;
      const decimals = definition.decimals ?? 0;
      const delta = current !== undefined && previous !== undefined ? current - previous : undefined;
      const trendClass: CareTrendMetric["trendClass"] =
        delta === undefined ? "muted" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      const deltaLabel =
        delta === undefined
          ? current === undefined
            ? "当天待记录"
            : "前日待记录"
          : delta === 0
            ? "较前日持平"
            : `较前日 ${delta > 0 ? "+" : ""}${formatTrendValue(delta, definition.unit, decimals)}`;

      return {
        key: definition.key,
        label: definition.label,
        currentLabel: formatTrendValue(current, definition.unit, decimals),
        deltaLabel,
        averageLabel: `近7天均值 ${formatTrendValue(average, definition.unit, decimals)}`,
        trendClass,
        points: dates.map((date, index) => {
          const value = values[index];
          return {
            date,
            label: date === todayISO() ? "今" : `${Number(date.slice(-2))}`,
            value,
            height: value === undefined ? 0 : Math.max(10, Math.round((value / maxValue) * 100)),
            selected: date === selectedDate,
          };
        }),
      };
    })
    .filter((metric): metric is CareTrendMetric => Boolean(metric));
};

const positiveNumber = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;

const sumValues = (values: number[]) => values.reduce((total, value) => total + value, 0);

const compactValue = (value: number | undefined, unit: string, decimals = 0) => {
  if (value === undefined) return "未记录";
  const text = decimals > 0 ? value.toFixed(decimals).replace(/\.0$/, "") : `${Math.round(value)}`;
  return `${text}${unit}`;
};

const formatGrowthMeasurementValue = (value: number, type: GrowthMeasurementType) => {
  const meta = GROWTH_MEASUREMENT_META[type];
  const decimals = meta.step === "0.01" ? 2 : 1;
  return `${value.toFixed(decimals).replace(/\.?0+$/, "")}${meta.unit}`;
};

const MANUAL_RECORD_TYPES: ManualRecordTypeOption[] = [
  { type: "milk", label: "喂奶", hint: "奶量、亲喂或配方奶" },
  { type: "sleep", label: "睡眠", hint: "睡了多久、醒来情况" },
  { type: "poop", label: "便便尿布", hint: "便便、尿布状态" },
  { type: "temperature", label: "体温", hint: "测量温度" },
  { type: "solid", label: "辅食", hint: "辅食品类和接受度" },
];

const MANUAL_TIME_PRESETS = [
  { label: "现在", offsetMinutes: 0 },
  { label: "15 分钟前", offsetMinutes: 15 },
  { label: "30 分钟前", offsetMinutes: 30 },
  { label: "1 小时前", offsetMinutes: 60 },
];

const MANUAL_MILK_AMOUNTS = [60, 90, 120, 150, 180];
const MANUAL_MILK_NOTES = ["母乳", "配方奶", "亲喂", "混合喂养"];
const MANUAL_SLEEP_DURATIONS = [
  { label: "20 分钟", value: "0.33" },
  { label: "30 分钟", value: "0.5" },
  { label: "45 分钟", value: "0.75" },
  { label: "1 小时", value: "1" },
  { label: "1.5 小时", value: "1.5" },
  { label: "2 小时", value: "2" },
];
const MANUAL_TEMPERATURE_OPTIONS = [36.5, 36.8, 37.0, 37.3, 37.5, 38.0];
const MANUAL_POOP_NOTES = ["尿布偏湿", "尿布很满", "黄色软便", "绿色便便", "干硬便便"];
const MANUAL_SOLID_NOTES = ["米粉少量", "南瓜泥", "苹果泥", "胡萝卜泥", "接受度不错", "少量尝试"];

const createCareEventDraft = (type: CareLogEventType = "milk"): CareEventDraft => ({
  type,
  time: currentClockText(),
  amountMl: "",
  durationHours: "",
  temperature: "",
  note: type === "poop" ? MANUAL_POOP_NOTES[0] : type === "solid" ? MANUAL_SOLID_NOTES[0] : "",
});

const timePresetValue = (offsetMinutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - offsetMinutes);
  date.setSeconds(0, 0);
  return localTimeKey(date);
};

const numericDraftText = (value: number, decimals = 0) =>
  decimals > 0 ? value.toFixed(decimals).replace(/\.0$/, "") : String(Math.round(value));

const sleepDurationText = (value: string) => {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return "未选择";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hourPart = Math.floor(totalMinutes / 60);
  const minutePart = totalMinutes % 60;
  return minutePart ? `${hourPart} 小时 ${minutePart} 分钟` : `${hourPart} 小时`;
};

const buildGrowthTrendMetrics = (measurements: GrowthMeasurement[]): GrowthTrendMetric[] =>
  GROWTH_MEASUREMENT_TYPES.map((type) => {
    const meta = GROWTH_MEASUREMENT_META[type];
    const items = measurements
      .filter((measurement) => measurement.type === type)
      .sort((left, right) => left.date.localeCompare(right.date));
    const latest = items[items.length - 1];
    const previous = items[items.length - 2];
    if (!latest) {
      return {
        key: type,
        label: meta.label,
        valueLabel: "未记录",
        deltaLabel: "记录后可回看变化",
        dateLabel: "暂无",
        hasData: false,
      };
    }
    const delta = previous ? latest.value - previous.value : undefined;
    const deltaLabel =
      delta === undefined
        ? "第一笔记录"
        : delta === 0
          ? "较上次持平"
          : `较上次 ${delta > 0 ? "+" : ""}${formatGrowthMeasurementValue(delta, type)}`;

    return {
      key: type,
      label: meta.label,
      valueLabel: formatGrowthMeasurementValue(latest.value, type),
      deltaLabel,
      dateLabel: latest.date === todayISO() ? "今天" : formatDate(latest.date),
      hasData: true,
    };
  });

const buildGrowthCurveData = (measurements: GrowthMeasurement[], type: GrowthMeasurementType): GrowthCurveData => {
  const meta = GROWTH_MEASUREMENT_META[type];
  const items = measurements
    .filter((measurement) => measurement.type === type && Number.isFinite(measurement.value))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-8);

  if (!items.length) {
    return {
      points: [],
      polyline: "",
      minLabel: `暂无${meta.label}`,
      maxLabel: "记录后生成曲线",
      latestLabel: "暂无记录",
    };
  }

  const values = items.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const left = 20;
  const right = 284;
  const top = 24;
  const bottom = 118;
  const width = right - left;
  const height = bottom - top;
  const points = items.map((item, index) => {
    const x = items.length === 1 ? (left + right) / 2 : left + (width * index) / (items.length - 1);
    const y = bottom - ((item.value - minValue) / range) * height;
    return {
      id: item.id,
      date: item.date,
      label: item.date === todayISO() ? "今天" : `${Number(item.date.slice(-2))}日`,
      valueLabel: formatGrowthMeasurementValue(item.value, type),
      x,
      y,
    };
  });
  const latest = items[items.length - 1];

  return {
    points,
    polyline: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    minLabel: formatGrowthMeasurementValue(minValue, type),
    maxLabel: formatGrowthMeasurementValue(maxValue, type),
    latestLabel: `${latest.date === todayISO() ? "今天" : formatDate(latest.date)} ${formatGrowthMeasurementValue(latest.value, type)}`,
  };
};

const careEventValue = (event: CareLogEvent, kind: "milk" | "sleep") =>
  kind === "milk" ? positiveNumber(event.amountMl) : positiveNumber(event.durationHours);

const careEventsByKind = (log: CareLog | undefined, kind: "milk" | "sleep") =>
  (log?.events ?? [])
    .filter((event) => event.type === kind)
    .map((event) => ({ event, value: careEventValue(event, kind) }))
    .filter((item): item is { event: CareLogEvent; value: number } => item.value !== undefined)
    .sort((left, right) => parseTimeSort(left.event.time, 0) - parseTimeSort(right.event.time, 0));

const splitEvenSegments = (total: number | undefined, count: number | undefined) => {
  if (!total || total <= 0) return [];
  const segmentCount = Math.min(12, Math.max(1, Math.round(count ?? 1)));
  return Array.from({ length: segmentCount }, () => total / segmentCount);
};

const segmentValuesForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  const eventValues = careEventsByKind(log, kind).map((item) => item.value);
  if (eventValues.length) return eventValues;
  if (kind === "milk") return splitEvenSegments(positiveNumber(log?.milkMl), log?.milkTimes);
  return splitEvenSegments(positiveNumber(log?.sleepHours), undefined);
};

const totalForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  const direct = kind === "milk" ? positiveNumber(log?.milkMl) : positiveNumber(log?.sleepHours);
  return direct ?? positiveNumber(sumValues(careEventsByKind(log, kind).map((item) => item.value)));
};

const countForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  if (kind === "milk") {
    return log?.milkTimes ?? (careEventsByKind(log, "milk").length || undefined);
  }
  const sleepEventCount = careEventsByKind(log, "sleep").length;
  return sleepEventCount || undefined;
};

const buildDailyCareBreakdowns = (log: CareLog | undefined): DailyCareBreakdown[] => {
  const milkEvents = careEventsByKind(log, "milk");
  const sleepEvents = careEventsByKind(log, "sleep");
  const milkTotal = totalForLog(log, "milk");
  const sleepTotal = totalForLog(log, "sleep");

  const milkSegments = milkEvents.length
    ? milkEvents.map((item, index) => ({
        id: item.event.id || `milk-${index}`,
        time: item.event.time,
        label: compactValue(item.value, "ml"),
        value: item.value,
        grow: item.value,
      }))
    : splitEvenSegments(milkTotal, log?.milkTimes).map((value, index) => ({
        id: `milk-summary-${index}`,
        time: undefined,
        label: compactValue(value, "ml"),
        value,
        grow: value,
      }));

  const sleepSegments = sleepEvents.length
    ? sleepEvents.map((item, index) => ({
        id: item.event.id || `sleep-${index}`,
        time: item.event.time,
        label: compactValue(item.value, "h", 1),
        value: item.value,
        grow: item.value,
      }))
    : splitEvenSegments(sleepTotal, undefined).map((value, index) => ({
        id: `sleep-summary-${index}`,
        time: undefined,
        label: compactValue(value, "h", 1),
        value,
        grow: value,
      }));

  return [
    {
      key: "milk",
      label: "奶量",
      totalLabel: compactValue(milkTotal, "ml"),
      countLabel: log?.milkTimes ? `${log.milkTimes} 次` : milkEvents.length ? `${milkEvents.length} 次` : "次数待记录",
      emptyLabel: "今天还没有奶量记录",
      segments: milkSegments,
      markers: milkSegments
        .filter((segment) => Boolean(segment.time))
        .map((segment) => ({ id: segment.id, time: segment.time!, label: segment.label }))
        .slice(0, 4),
    },
    {
      key: "sleep",
      label: "睡眠",
      totalLabel: compactValue(sleepTotal, "h", 1),
      countLabel: log?.wakes ? `夜醒 ${log.wakes} 次` : sleepEvents.length ? `${sleepEvents.length} 段` : "夜醒待记录",
      emptyLabel: "今天还没有睡眠记录",
      segments: sleepSegments,
      markers: sleepSegments
        .filter((segment) => Boolean(segment.time))
        .map((segment) => ({ id: segment.id, time: segment.time!, label: segment.label }))
        .slice(0, 4),
    },
  ];
};

const averageLabel = (values: Array<number | undefined>, unit: string, decimals = 0) => {
  const recorded = values.filter((value): value is number => value !== undefined);
  if (!recorded.length) return `均值 ${compactValue(undefined, unit, decimals)}`;
  return `均值 ${compactValue(sumValues(recorded) / recorded.length, unit, decimals)}`;
};

const buildWeeklyCareComparison = (careLogs: CareLog[], selectedDate: string): WeeklyCareComparison => {
  const logByDate = new Map(careLogs.map((log) => [log.date, log]));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 6));
  const milkValues = dates.map((date) => totalForLog(logByDate.get(date), "milk"));
  const sleepValues = dates.map((date) => totalForLog(logByDate.get(date), "sleep"));
  const maxMilk = Math.max(...milkValues.filter((value): value is number => value !== undefined), 1);
  const maxSleep = Math.max(...sleepValues.filter((value): value is number => value !== undefined), 1);

  return {
    hasData: milkValues.some((value) => value !== undefined) || sleepValues.some((value) => value !== undefined),
    milkAverageLabel: averageLabel(milkValues, "ml"),
    sleepAverageLabel: averageLabel(sleepValues, "h", 1),
    days: dates.map((date, index) => {
      const log = logByDate.get(date);
      const milkValue = milkValues[index];
      const sleepValue = sleepValues[index];
      return {
        date,
        label: date === todayISO() ? "今" : `${Number(date.slice(-2))}`,
        selected: date === selectedDate,
        milkValue,
        milkCount: countForLog(log, "milk"),
        milkHeight: milkValue === undefined ? 0 : Math.max(12, Math.round((milkValue / maxMilk) * 100)),
        milkSegments: segmentValuesForLog(log, "milk"),
        sleepValue,
        sleepCount: countForLog(log, "sleep"),
        sleepHeight: sleepValue === undefined ? 0 : Math.max(12, Math.round((sleepValue / maxSleep) * 100)),
        sleepSegments: segmentValuesForLog(log, "sleep"),
      };
    }),
  };
};

const platformLabel = () => {
  if (!Capacitor.isNativePlatform()) return "浏览器预览";
  return Capacitor.getPlatform() === "ios" ? "iOS App" : "Android App";
};

type CareEventAnchor = {
  id: string;
  occurredAt: Date;
  label: string;
};

let reminderChannelsReady = false;

const careEventAnchorDate = (log: CareLog, event: CareLogEvent) => {
  if (!event.time) return null;
  const date = event.date || log.date;
  const parsed = new Date(`${date}T${event.time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const latestCareEventAnchor = (careLogs: CareLog[], type: CareLogEventType): CareEventAnchor | null => {
  let latest: CareEventAnchor | null = null;
  careLogs.forEach((log) => {
    log.events.forEach((event, eventIndex) => {
      if (event.type !== type) return;
      const occurredAt = careEventAnchorDate(log, event);
      if (!occurredAt) return;
      if (latest && latest.occurredAt >= occurredAt) return;
      latest = {
        id: event.id || `${log.id}-${type}-${eventIndex}`,
        occurredAt,
        label: `${formatReminderDueText(occurredAt)}${event.amountMl ? ` ${event.amountMl}ml` : ""}`,
      };
    });
  });
  return latest;
};

const addReminderHistory = (reminder: Reminder, entry: string) => ({
  ...reminder,
  history: [entry, ...reminder.history.filter((item) => item !== entry)].slice(0, 8),
});

// formatIntervalText moved to ./utils/reminderLabels

const nextIntervalDueAt = (anchorAt: Date, intervalMinutes: number, now = new Date()) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  let dueAt = new Date(anchorAt.getTime() + intervalMs);
  while (dueAt.getTime() <= now.getTime()) {
    dueAt = new Date(dueAt.getTime() + intervalMs);
  }
  return dueAt;
};

const prepareIntervalReminder = (reminder: Reminder, careLogs: CareLog[], now = new Date()) => {
  if (!isIntervalReminder(reminder) || !reminder.repeatRule) return normalizeReminderSchedule(reminder, now);
  const anchor = isIntervalMilkReminder(reminder) ? latestCareEventAnchor(careLogs, "milk") : null;
  const anchorAt = anchor?.occurredAt ?? now;
  const dueAt = nextIntervalDueAt(anchorAt, reminder.repeatRule.intervalMinutes, now);
  const entry = anchor
    ? `按最近一次喝奶 ${anchor.label} 计算下一次提醒`
    : "按当前时间开始循环提醒";
  return normalizeReminderSchedule(
    addReminderHistory(
      {
        ...reminder,
        dueAt: dueAt.toISOString(),
        dueText: formatReminderDueText(dueAt),
        recurrence: `每 ${formatIntervalText(reminder.repeatRule.intervalMinutes)} ${reminder.title || "提醒"}`,
        lastAnchorEventId: anchor?.id,
        lastAnchorAt: anchorAt.toISOString(),
        notificationStatus: "pending",
        notificationError: undefined,
      },
      entry,
    ),
    now,
  );
};

const reminderChannelId = (reminder: Reminder) =>
  reminder.alertMode === "ringing"
    ? reminder.soundId === "soft_bell"
      ? REMINDER_CHANNELS.soft_bell
      : REMINDER_CHANNELS.soft_chime
    : REMINDER_CHANNELS.schedule;

const reminderSoundFile = (reminder: Reminder) =>
  reminder.alertMode === "ringing" ? REMINDER_SOUND_FILES[normalizeReminderSoundId(reminder.soundId)] : undefined;

const shouldUseNativeReminderScheduler = (reminder: Reminder) => {
  const platform = nativeAlarmPlatform();
  if (platform === "ios") return true;
  return platform === "android" && (isIntervalReminder(reminder) || reminder.alertMode === "ringing");
};

const ensureReminderChannels = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || reminderChannelsReady) return;
  try {
    await Promise.all(
      LEGACY_REMINDER_CHANNELS.map((id) =>
        LocalNotifications.deleteChannel({ id }).catch(() => undefined),
      ),
    );
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNELS.schedule,
      name: "小宝日程提醒",
      description: "疫苗、体检、复诊和普通照护待办",
      importance: 3,
      visibility: 1,
      vibration: false,
    });
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNELS.soft_chime,
      name: "小宝喂奶闹钟 · 柔和叮咚",
      description: "短促柔和的喂奶循环提醒",
      sound: REMINDER_SOUND_FILES.soft_chime,
      importance: 4,
      visibility: 1,
      vibration: false,
    });
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNELS.soft_bell,
      name: "小宝喂奶闹钟 · 轻铃声",
      description: "清脆但短促的喂奶循环提醒",
      sound: REMINDER_SOUND_FILES.soft_bell,
      importance: 4,
      visibility: 1,
      vibration: false,
    });
    reminderChannelsReady = true;
  } catch {
    // If channel creation fails, scheduling will surface the actionable error below.
  }
};

const canScheduleExactAlarm = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return true;
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return status.exact_alarm === "granted";
  } catch {
    return true;
  }
};

const scheduleNativeReminders = async (
  newReminders: Reminder[],
  options: { careLogs?: CareLog[]; anchorInterval?: boolean } = {},
): Promise<Reminder[]> => {
  if (newReminders.length === 0) return [];
  const prepared = newReminders.map((reminder) =>
    options.anchorInterval === false
      ? normalizeReminderSchedule(normalizeReminder(reminder, 0), new Date())
      : prepareIntervalReminder(normalizeReminder(reminder, 0), options.careLogs ?? [], new Date()),
  );

  if (!Capacitor.isNativePlatform()) {
    return prepared.map((reminder) => ({
      ...reminder,
      notificationStatus: reminder.dueAt ? "in_app_only" : "failed",
      notificationError: reminder.dueAt ? undefined : "提醒时间不明确，无法调度系统通知。",
    }));
  }

  const now = Date.now();
  const scheduleable = prepared.filter((reminder) => reminder.dueAt && new Date(reminder.dueAt).getTime() > now);
  const failed = prepared.filter((reminder) => !scheduleable.some((item) => item.id === reminder.id));
  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      return prepared.map((reminder) => ({
        ...reminder,
        notificationStatus: "permission_denied",
        notificationError: "系统通知权限未开启，提醒会保留在 App 内。",
      }));
    }

    await ensureReminderChannels();
    const exactAlarmGranted = await canScheduleExactAlarm();
    const nativeAlarmExactById = new Map<string, boolean>();
    const nativeAlarmReminders = scheduleable.filter(shouldUseNativeReminderScheduler);
    const localNotificationReminders = scheduleable.filter((reminder) => !shouldUseNativeReminderScheduler(reminder));

    for (const reminder of nativeAlarmReminders) {
      const result = await scheduleAlarmReminder(reminder);
      nativeAlarmExactById.set(reminder.id, result.exact);
    }

    if (localNotificationReminders.length) {
      await LocalNotifications.schedule({
        notifications: localNotificationReminders.map((reminder) => ({
          id: reminder.notificationId ?? reminderNotificationId(reminder),
          title: reminder.title,
          body: reminder.alertMode === "ringing"
            ? `${reminder.dueText} · 到提醒时间啦`
            : `${reminder.dueText} · 打开小宝记确认是否完成`,
          sound: reminderSoundFile(reminder),
          channelId: reminderChannelId(reminder),
          schedule: {
            at: new Date(reminder.dueAt!),
            allowWhileIdle: (reminder.alertMode === "ringing" || reminder.scheduleMode === "interval") && exactAlarmGranted,
          },
          extra: {
            reminderId: reminder.id,
            reminderKind: reminder.reminderKind,
            scheduleMode: reminder.scheduleMode,
            alertMode: reminder.alertMode,
            repeatRule: reminder.repeatRule,
          },
        })),
      });
    }

    return [
      ...scheduleable.map((reminder) => {
        const exactForReminder = nativeAlarmExactById.has(reminder.id)
          ? nativeAlarmExactById.get(reminder.id)
          : reminder.alertMode === "ringing" || reminder.scheduleMode === "interval"
            ? exactAlarmGranted
            : true;
        return {
          ...reminder,
          notificationStatus: (reminder.alertMode === "ringing" || reminder.scheduleMode === "interval") && !exactForReminder ? "scheduled_inexact" as const : "scheduled" as const,
          notificationError: (reminder.alertMode === "ringing" || reminder.scheduleMode === "interval") && !exactForReminder
            ? "系统精确定时权限未开启，已安排提醒，但可能不够准时。"
            : undefined,
        };
      }),
      ...failed.map((reminder) => ({
        ...reminder,
        notificationStatus: "failed" as const,
        notificationError: reminder.dueAt ? "提醒时间已经过去，未调度系统通知。" : "提醒时间不明确，无法调度系统通知。",
      })),
    ];
  } catch (error) {
    const message = error instanceof Error ? error.message : "系统通知调度失败";
    return prepared.map((reminder) => ({
      ...reminder,
      notificationStatus: "failed",
      notificationError: message,
    }));
  }
};

const cancelNativeReminder = async (reminder: Reminder) => {
  if (!Capacitor.isNativePlatform() || !reminder.notificationId) return;
  if (shouldUseNativeReminderScheduler(reminder)) {
    try {
      await cancelAlarmReminder(reminder);
    } catch {
      // Continue with the LocalNotifications cleanup below in case an older schedule exists.
    }
  }
  try {
    await LocalNotifications.cancel({ notifications: [{ id: reminder.notificationId }] });
  } catch {
    // The reminder record can still be completed or deleted even if the OS notification was already gone.
  }
};

function createReminderDraft(base = new Date()): ReminderDraft {
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

function reminderDraftFromReminder(reminder: Reminder): ReminderDraft {
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

function reminderPostponeDraftFromReminder(reminder?: Reminder): ReminderPostponeDraft {
  const fallback = new Date(Date.now() + 30 * 60 * 1000);
  fallback.setSeconds(0, 0);
  const parsed = reminder ? parseReminderDueAt(reminder) : undefined;
  const dueAt = parsed && parsed.getTime() > Date.now() ? new Date(parsed) : fallback;
  return {
    dueDate: localDateKey(dueAt),
    dueTime: localTimeKey(dueAt),
  };
}

function dateFromReminderPostponeDraft(draft: ReminderPostponeDraft) {
  const dueAt = new Date(`${draft.dueDate || todayISO()}T${draft.dueTime || "09:00"}:00`);
  return Number.isNaN(dueAt.getTime()) ? undefined : dueAt;
}

function reminderFromDraft(draft: ReminderDraft, existing?: Reminder): Reminder {
  const scheduleMode = normalizeReminderScheduleMode(draft.scheduleMode);
  const alertMode = normalizeReminderAlertMode(draft.alertMode);
  const title = draft.title.trim() || (scheduleMode === "interval" ? "循环提醒" : "照护提醒");
  const reminderKind: ReminderKind = alertMode === "ringing" ? "alarm" : "schedule";
  const intervalValue = Number(draft.intervalMinutes);
  const intervalMinutes = Math.round(Number.isFinite(intervalValue) ? intervalValue : 180);
  const repeatRule: ReminderRepeatRule | undefined = scheduleMode === "interval"
    ? {
        mode: "fixedInterval",
        intervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, intervalMinutes)),
        anchorType: /奶|喂奶|喝奶|吃奶/.test(title) ? "careEvent" : "now",
        careEventType: /奶|喂奶|喝奶|吃奶/.test(title) ? "milk" : undefined,
      }
    : undefined;
  const dueAt = new Date(`${draft.dueDate || todayISO()}T${draft.dueTime || "09:00"}:00`);
  const scheduleDueAt = Number.isNaN(dueAt.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : dueAt;
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const base: Reminder = {
    id: existing?.id ?? makeId("reminder"),
    title,
    reminderKind,
    scheduleMode,
    alertMode,
    dueText: repeatRule ? `每 ${formatIntervalText(repeatRule.intervalMinutes)} ${title}` : formatReminderDueText(scheduleDueAt),
    dueAt: repeatRule ? existing?.dueAt : scheduleDueAt.toISOString(),
    timeSourceText: repeatRule ? `每 ${formatIntervalText(repeatRule.intervalMinutes)}` : formatReminderDueText(scheduleDueAt),
    timezone: reminderTimezone(),
    notificationId: existing?.notificationId,
    notificationStatus: "pending",
    notificationError: undefined,
    category: draft.category,
    recurrence: repeatRule ? `每 ${formatIntervalText(repeatRule.intervalMinutes)} ${title}` : undefined,
    repeatRule,
    soundId: alertMode === "ringing" ? normalizeReminderSoundId(draft.soundId) : undefined,
    lastAnchorEventId: existing?.lastAnchorEventId,
    lastAnchorAt: existing?.lastAnchorAt,
    status: "open",
    createdAt,
    history: existing?.history ?? [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 手动创建`],
  };
  return normalizeReminderSchedule(base);
}

function createExpenseDraft(baseDate = todayISO()): ExpenseDraft {
  return {
    title: "",
    amount: "",
    category: "other",
    date: baseDate,
    quantity: "",
    unitPrice: "",
    merchant: "",
    note: "",
    brand: "",
    spec: "",
    source: "manual",
  };
}

function expenseDraftFromExpense(expense: ExpenseItem): ExpenseDraft {
  return {
    title: expense.title,
    amount: expense.amount ? String(expense.amount) : "",
    category: expense.category,
    date: expense.date,
    quantity: expense.quantity ? String(expense.quantity) : "",
    unitPrice: expense.unitPrice ? String(expense.unitPrice) : "",
    merchant: expense.merchant ?? "",
    note: expense.note ?? "",
    brand: expense.brand ?? "",
    spec: expense.spec ?? "",
    source: expense.source,
  };
}

function expenseFromDraft(draft: ExpenseDraft, existing?: ExpenseItem): ExpenseItem {
  const now = new Date().toISOString();
  const amount = Number(draft.amount);
  const quantity = draft.quantity ? Number(draft.quantity) : undefined;
  const unitPrice = draft.unitPrice ? Number(draft.unitPrice) : undefined;
  return normalizeExpenseItem(
    {
      id: existing?.id ?? makeId("expense"),
      title: draft.title.trim() || "小宝支出",
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
      currency: "CNY",
      category: draft.category,
      date: draft.date || todayISO(),
      quantity: quantity && Number.isFinite(quantity) ? quantity : undefined,
      unitPrice: unitPrice && Number.isFinite(unitPrice) ? Math.round(unitPrice * 100) / 100 : undefined,
      merchant: draft.merchant.trim() || undefined,
      note: draft.note.trim() || undefined,
      brand: draft.brand.trim() || undefined,
      spec: draft.spec.trim() || undefined,
      attachmentIds: existing?.attachmentIds ?? [],
      attachments: existing?.attachments,
      source: draft.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      recordedBy: existing?.recordedBy,
      createdByUserId: existing?.createdByUserId,
    },
    0,
  );
}

const pendingExpenseDraftFromExpense = (expense: ExpenseItem): ExpenseDraft => expenseDraftFromExpense(expense);

const pendingDraftFromEffect = (effect: PendingEffect): PendingEffectDraft => ({
  growthEvent: effect.growthEvent
    ? {
        title: effect.growthEvent.title ?? "",
        date: effect.growthEvent.date ?? todayISO(),
        summary: effect.growthEvent.summary ?? "",
      }
    : undefined,
  growthMeasurements: (effect.growthMeasurements ?? []).map((measurement) => ({
    id: measurement.id,
    type: measurement.type,
    value: measurement.value ? String(measurement.value) : "",
    date: measurement.date || selectedDateFallback(effect),
    note: measurement.note ?? "",
  })),
  careLogPatch: effect.careLogPatch
    ? {
        date: effect.careLogPatch.date ?? selectedDateFallback(effect),
        milkMl: effect.careLogPatch.milkMl ? String(effect.careLogPatch.milkMl) : "",
        milkTimes: effect.careLogPatch.milkTimes ? String(effect.careLogPatch.milkTimes) : "",
        sleepHours: effect.careLogPatch.sleepHours ? String(effect.careLogPatch.sleepHours) : "",
        wakes: effect.careLogPatch.wakes ? String(effect.careLogPatch.wakes) : "",
        poop: effect.careLogPatch.poop ?? "",
        temperature: effect.careLogPatch.temperature ? String(effect.careLogPatch.temperature) : "",
        notes: effect.careLogPatch.notes?.join("、") ?? "",
      }
    : undefined,
  reminders: (effect.reminders ?? []).map((reminder) => ({
    id: reminder.id,
    draft: reminderDraftFromReminder(reminder),
  })),
  memories: (effect.memories ?? []).map((memory) => ({
    id: memory.id,
    text: memory.text,
  })),
  expenses: (effect.expenses ?? []).map(pendingExpenseDraftFromExpense),
});

const selectedDateFallback = (effect: PendingEffect) =>
  effect.createdAt ? effect.createdAt.slice(0, 10) : todayISO();

const growthEventFromPendingDraft = (effect: PendingEffect, draft: PendingGrowthDraft | undefined) =>
  effect.growthEvent && draft
    ? normalizeGrowthEvent({
        ...effect.growthEvent,
        title: draft.title.trim() || effect.growthEvent.title,
        date: draft.date || effect.growthEvent.date,
        summary: draft.summary.trim() || effect.growthEvent.summary,
      }, 0)
    : undefined;

const growthMeasurementsFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
  (effect.growthMeasurements ?? []).map((measurement, index) => {
    const nextDraft = draft.growthMeasurements.find((item) => item.id === measurement.id);
    if (!nextDraft) return measurement;
    const numericValue = Number(nextDraft.value);
    return normalizeGrowthMeasurement({
      ...measurement,
      type: nextDraft.type,
      value: Number.isFinite(numericValue) ? numericValue : measurement.value,
      date: nextDraft.date || measurement.date,
      note: nextDraft.note.trim() || undefined,
    }, index);
  });

const careLogPatchFromPendingDraft = (effect: PendingEffect, draft: PendingCareDraft | undefined): Partial<CareLog> | undefined =>
  effect.careLogPatch && draft
    ? {
        ...effect.careLogPatch,
        date: draft.date || effect.careLogPatch.date,
        milkMl: draft.milkMl ? Number(draft.milkMl) : undefined,
        milkTimes: draft.milkTimes ? Number(draft.milkTimes) : undefined,
        sleepHours: draft.sleepHours ? Number(draft.sleepHours) : undefined,
        wakes: draft.wakes ? Number(draft.wakes) : undefined,
        poop: draft.poop.trim() || undefined,
        temperature: draft.temperature ? Number(draft.temperature) : undefined,
        notes: splitListText(draft.notes),
      }
    : undefined;

const remindersFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
  (effect.reminders ?? []).map((reminder) => {
    const nextDraft = draft.reminders.find((item) => item.id === reminder.id)?.draft;
    return nextDraft ? reminderFromDraft(nextDraft, reminder) : reminder;
  });

const memoriesFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
  (effect.memories ?? []).map((memory) => {
    const nextDraft = draft.memories.find((item) => item.id === memory.id);
    return nextDraft ? { ...memory, text: nextDraft.text.trim() || memory.text } : memory;
  });

const expensesFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
  (effect.expenses ?? []).map((expense, index) => {
    const nextDraft = draft.expenses[index];
    return nextDraft ? expenseFromDraft(nextDraft, expense) : expense;
  });

const normalizeSoothing = (value: CareLog["soothing"] | undefined): CareLog["soothing"] | undefined => {
  if (value === "easy" || value === "normal" || value === "hard") return value;
  return undefined;
};

const hasCareLogContent = (patch: Partial<CareLog>) =>
  Boolean(
    patch.milkMl ||
      patch.milkTimes ||
      patch.sleepHours ||
      patch.wakes ||
      patch.soothing ||
      patch.solids?.length ||
      patch.poop ||
      patch.temperature ||
      patch.events?.length ||
      patch.notes?.length,
  );

const mergeCareEventsWithInferred = (modelEvents: CareLogEvent[], inferredEvents: CareLogEvent[]) => {
  if (!modelEvents.length) return inferredEvents;

  const usedInferredIndexes = new Set<number>();
  const merged = modelEvents.map((event, index) => {
    const inferredIndex = inferredEvents.findIndex(
      (candidate, candidateIndex) =>
        !usedInferredIndexes.has(candidateIndex) &&
        (candidate.type === event.type || !event.time || candidate.note === event.note || candidate.title === event.title),
    );
    const inferred = inferredEvents[inferredIndex >= 0 ? inferredIndex : index];
    if (inferredIndex >= 0) usedInferredIndexes.add(inferredIndex);

    return {
      ...event,
      id: event.id || inferred?.id || makeId("care-event"),
      time: event.time ?? inferred?.time,
      amountMl: event.amountMl ?? inferred?.amountMl,
      durationHours: event.durationHours ?? inferred?.durationHours,
      temperature: event.temperature ?? inferred?.temperature,
      note: event.note ?? inferred?.note,
      tags: event.tags?.length ? event.tags : inferred?.tags,
    };
  });

  const extras = inferredEvents.filter(
    (candidate, index) =>
      !usedInferredIndexes.has(index) &&
      !merged.some((event) => event.type === candidate.type && event.time === candidate.time && event.note === candidate.note),
  );
  return [...merged, ...extras].slice(0, 12);
};

const hasConcreteCareEventTime = (patch: Partial<CareLog> | undefined) =>
  Boolean(patch?.events?.some((event) => event.time && event.type !== "note"));

const hasConcreteCareSummary = (patch: Partial<CareLog> | undefined) =>
  Boolean(
    patch?.milkMl ||
      patch?.milkTimes ||
      patch?.sleepHours ||
      patch?.wakes ||
      patch?.soothing ||
      patch?.solids?.length ||
      patch?.poop ||
      patch?.temperature,
  );

const isAutoRecordableCareLog = (patch: Partial<CareLog> | undefined, alerts: SafetyAlert[]) =>
  Boolean(
    patch &&
      hasCareLogContent(patch) &&
      (hasConcreteCareEventTime(patch) || hasConcreteCareSummary(patch)) &&
      !alerts.some((alert) => alert.level === "urgent"),
  );

const normalizeAgentResponse = (result: AgentChatResponse, parentText: string) => {
  const now = new Date().toISOString();
  const growthEvent: GrowthEvent | undefined =
    result.growthEvent && (result.growthEvent.title || result.growthEvent.summary)
      ? {
          id: result.growthEvent.id ?? makeId("growth"),
          type: result.growthEvent.type ?? "daily_growth",
          title: result.growthEvent.title ?? "新的成长瞬间",
          date: result.growthEvent.date ?? todayISO(),
          summary: result.growthEvent.summary ?? `${parentText}。`,
          firstTime: Boolean(result.growthEvent.firstTime),
          mediaKind: result.growthEvent.mediaKind,
          tags: result.growthEvent.tags ?? ["成长"],
        }
      : undefined;

  const careLogPatch =
    result.careLogPatch && hasCareLogContent(result.careLogPatch)
      ? (() => {
          const date = result.careLogPatch?.date ?? todayISO();
          const modelEvents = (result.careLogPatch?.events ?? []).map((item, index) => ({
            ...normalizeCareLogEvent(item, index, date),
            id: item.id || makeId("care-event"),
          }));
          const inferredEvents = extractCareEventsFromText(parentText, date);
          const events = mergeCareEventsWithInferred(modelEvents, inferredEvents);
          return {
            ...result.careLogPatch,
            date,
            soothing: normalizeSoothing(result.careLogPatch.soothing),
            solids: result.careLogPatch.solids ?? [],
            events,
            notes: result.careLogPatch.notes?.length ? result.careLogPatch.notes : [parentText],
          };
        })()
      : undefined;

  const reminders: Reminder[] = (result.reminders ?? [])
    .filter((item) => item.title || item.dueText)
    .map((item, index) =>
      normalizeReminder(
        {
          id: item.id ?? makeId("reminder"),
          title: item.title ?? "新的照护提醒",
          reminderKind: item.reminderKind,
          dueText: item.dueText ?? "待确认时间",
          dueAt: item.dueAt,
          timeSourceText: item.timeSourceText,
          timezone: item.timezone,
          notificationId: item.notificationId,
          notificationStatus: item.notificationStatus,
          notificationError: item.notificationError,
          category: item.category,
          recurrence: item.recurrence,
          scheduleMode: item.scheduleMode,
          alertMode: item.alertMode,
          repeatRule: item.repeatRule,
          soundId: item.soundId,
          lastAnchorEventId: item.lastAnchorEventId,
          lastAnchorAt: item.lastAnchorAt,
          status: item.status,
          createdAt: item.createdAt ?? now,
          history: item.history ?? [],
        },
        index,
      ),
    );

  const memories: MemoryItem[] = (result.memories ?? [])
    .filter((item) => item.text?.trim())
    .map((item) => ({
      id: item.id ?? makeId("memory"),
      text: item.text!.trim(),
      category: normalizeMemoryCategory(item.category),
      confidence: item.confidence ?? 0.72,
      updatedAt: item.updatedAt ?? now,
    }));

  const expenses: ExpenseItem[] = (result.expenses ?? [])
    .filter((item) => item.title?.trim() || item.amount)
    .map((item, index) =>
      normalizeExpenseItem(
        {
          ...item,
          id: item.id ?? makeId("expense"),
          date: item.date || todayISO(),
          source: "agent",
          createdAt: item.createdAt ?? now,
          updatedAt: item.updatedAt ?? now,
        },
        index,
      ),
    );

  return {
    aiText: result.aiText,
    tags: result.tags ?? [],
    growthEvent,
    careLogPatch,
    reminders,
    memories,
    expenses,
    sources: normalizeSources(result.sources ?? []),
    safetyAlerts: normalizeSafetyAlerts(result.safetyAlerts),
    effectDecisions: result.effectDecisions ?? [],
  };
};

const normalizeSources = (sources: AgentSource[]) =>
  sources
    .filter((source) => source.title?.trim() && source.url?.trim())
    .map((source) => ({
      title: source.title.trim(),
      url: source.url.trim(),
      snippet: source.snippet?.trim() ?? "",
    }))
    .slice(0, 5);

const normalizeSafetyAlerts = (alerts: SafetyAlert[] | null | undefined): SafetyAlert[] =>
  (alerts ?? [])
    .filter((alert) => alert.message?.trim())
    .map((alert) => {
      const level: SafetyAlert["level"] = alert.level === "urgent" ? "urgent" : "notice";
      const category: SafetyAlert["category"] = alert.category ?? "general";

      return {
        level,
        category,
        message: alert.message,
        recommendedAction: alert.recommendedAction ?? "请结合宝宝状态，必要时咨询医生。",
      };
    })
    .slice(0, 3);

const pendingEffectSummary = (effect: PendingEffect) => [
  effect.growthEvent ? `成长：${effect.growthEvent.title}` : "",
  effect.growthMeasurements?.length ? `成长数据 ${effect.growthMeasurements.length} 条` : "",
  effect.careLogPatch && hasCareLogContent(effect.careLogPatch) ? "照护日志" : "",
  effect.reminders?.length ? `提醒 ${effect.reminders.length} 条` : "",
  effect.memories?.length ? `记忆 ${effect.memories.length} 条` : "",
  effect.expenses?.length ? `支出 ${effect.expenses.length} 笔` : "",
].filter(Boolean);

const MISSING_FIELD_LABELS: Record<string, string> = {
  milkMl: "喝了多少 ml",
  amountMl: "喝了多少 ml",
  milkTimes: "喝奶次数",
  feedingType: "是母乳还是配方奶",
  durationHours: "睡了多久",
  sleepHours: "睡了多久",
  dueAt: "具体提醒时间",
  intervalMinutes: "提醒间隔",
  time: "具体时间",
  date: "日期",
  title: "买了什么",
  amount: "实际花了多少钱",
  expenseTitle: "买了什么",
  expenseAmount: "实际花了多少钱",
  temperatureC: "体温",
  poop: "便便情况",
  solids: "辅食内容",
  notes: "补充说明",
};

const userFacingMissingFields = (fields: string[]) =>
  fields
    .map((field) => MISSING_FIELD_LABELS[field] ?? (/[\u4e00-\u9fff]/.test(field) ? field : undefined))
    .filter((label, index, labels): label is string => Boolean(label) && labels.indexOf(label) === index);

const askDecisions = (decisions: EffectDecision[] | undefined) =>
  (decisions ?? [])
    .filter((decision) => decision.mode === "ask")
    .map((decision) => {
      const payload = decision.payload && typeof decision.payload === "object"
        ? decision.payload as { question?: unknown; missingFields?: unknown; topic?: unknown }
        : {};
      const question = typeof payload.question === "string" && payload.question.trim()
        ? payload.question.trim()
        : decision.reason || "这条记录还缺一点信息，补充后我再帮你整理。";
      const missingFields = Array.isArray(payload.missingFields)
        ? payload.missingFields.filter((item): item is string => typeof item === "string")
        : [];
      return {
        id: decision.id,
        question,
        missingFields: userFacingMissingFields(missingFields),
      };
    });

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// expense helpers moved to ./utils/expense

const upsertToolActivity = (items: ToolActivity[] | undefined, activity: ToolActivity) => {
  const current = items ?? [];
  if (current.some((item) => item.id === activity.id)) {
    return current.map((item) => (item.id === activity.id ? activity : item));
  }
  return [...current, activity];
};

const isAgentProgressActivity = (activity: ToolActivity) => activity.toolId === "agent-progress";

const VOICE_CANCEL_DISTANCE_PX = 76;

const visibleToolActivitiesForMessage = (message: ChatMessage) => {
  const activities = message.toolActivities ?? [];
  if (message.isStreaming) return activities;
  return activities.filter((activity) => activity.status !== "completed");
};

const failedRunningActivities = (items: ToolActivity[]) =>
  items.map((item) => (item.status === "running" ? { ...item, status: "failed" as const } : item));

const fetchAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取附件内容（${response.status}）`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read attachment"));
    reader.readAsDataURL(blob);
  });
};

const dataUrlWithinAgentLimit = (dataUrl?: string) =>
  dataUrl && dataUrl.length <= MAX_AGENT_ATTACHMENT_DATA_URL_CHARS ? dataUrl : undefined;

const agentImageTargetChars = (visualCount: number) => {
  if (visualCount >= 6) return AGENT_IMAGE_TARGET_CHARS_LARGE_BATCH;
  if (visualCount >= 3) return AGENT_IMAGE_TARGET_CHARS_SMALL_BATCH;
  return AGENT_IMAGE_TARGET_CHARS_SINGLE;
};

const agentImageMaxEdge = (visualCount: number) =>
  visualCount >= 3 ? AGENT_IMAGE_MAX_EDGE_BATCH : AGENT_IMAGE_MAX_EDGE_SINGLE;

const resizeImageDataUrlForAgent = async (dataUrl?: string, visualCount = 1) => {
  if (!dataUrl?.startsWith("data:image/")) return dataUrlWithinAgentLimit(dataUrl);
  if (typeof window === "undefined" || typeof document === "undefined") return dataUrlWithinAgentLimit(dataUrl);

  const targetChars = agentImageTargetChars(visualCount);
  const baseMaxEdge = agentImageMaxEdge(visualCount);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("无法读取图片内容"));
    nextImage.src = dataUrl;
  });
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return dataUrlWithinAgentLimit(dataUrl);
  if (Math.max(sourceWidth, sourceHeight) <= baseMaxEdge && dataUrl.length <= targetChars) {
    return dataUrlWithinAgentLimit(dataUrl);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return dataUrlWithinAgentLimit(dataUrl);

  const attempts = [
    { edge: baseMaxEdge, quality: 0.82 },
    { edge: Math.round(baseMaxEdge * 0.88), quality: 0.78 },
    { edge: Math.round(baseMaxEdge * 0.76), quality: 0.74 },
    { edge: Math.round(baseMaxEdge * 0.64), quality: 0.72 },
  ];
  let smallest = dataUrl;

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.edge / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", attempt.quality);
    if (compressed.length < smallest.length) smallest = compressed;
    if (compressed.length <= targetChars) return dataUrlWithinAgentLimit(compressed);
  }

  return dataUrlWithinAgentLimit(smallest);
};

const agentStatusTag = (type: AgentStreamStatusType) => {
  if (type === "planning") return "理解中";
  if (type === "retrieving_context") return "查找中";
  if (type === "analyzing_media") return "分析中";
  return "生成中";
};

const formatAgentFailureMessage = (error: unknown, attachments: Attachment[]) => {
  const message = error instanceof Error ? error.message.trim() : "";
  if (error instanceof AgentApiError && error.code === "PRO_QUOTA_EXCEEDED") {
    return message || "本月免费 AI 体验次数已用完，申请 Pro 内测后即可不限次使用。";
  }
  const hasVisualAttachments = attachments.some((attachment) => attachment.kind === "image" || attachment.kind === "video");
  if (/图片分析超时|AI 响应超时/.test(message)) return message;
  if (/timeout|timed out|超时/i.test(message)) {
    return hasVisualAttachments
      ? "图片分析超时了：我已尝试分批处理，但模型没有及时返回。请稍后重试；如果仍失败，可以先减少图片数量或分开发送。"
      : "AI 响应超时了：模型没有及时返回，请稍后重试。";
  }
  if (message) return `AI 服务暂时不可用：${message}`;
  return "AI 服务暂时不可用，请稍后再试。";
};

const isVisualAttachment = (attachment: Attachment) => attachment.kind === "image" || attachment.kind === "video";

const VISUAL_AGENT_MODEL: AgentModelId = "doubao-seed-2.0-pro";

const simpleCareRecordPattern =
  /(喝|奶|母乳|配方奶|睡|醒|拉|尿|便便|辅食|体温|发烧|身高|体重|头围|ml|毫升|cm|kg|记一下|记录|提醒|花了|买了|记账)/i;

const thinkingIntentPattern =
  /(为什么|怎么|怎么办|原因|分析|评估|对比|规划|计划|方案|建议|趋势|复盘|总结|是否|要不要|可不可以|需不需要|如何)/;

const resolveAgentModelForMessage = (text: string, messageAttachments: Attachment[]): AgentModelId => {
  if (messageAttachments.some(isVisualAttachment)) return VISUAL_AGENT_MODEL;
  return DEFAULT_MODEL;
};

const resolveThinkingForMessage = (text: string, messageAttachments: Attachment[]) => {
  if (messageAttachments.some(isVisualAttachment)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (simpleCareRecordPattern.test(trimmed) && trimmed.length < 80) return false;
  return trimmed.length >= 120 || thinkingIntentPattern.test(trimmed);
};

const resolveLowLatencyForMessage = (model: AgentModelId, messageAttachments: Attachment[]) =>
  model.startsWith("doubao-") && messageAttachments.some(isVisualAttachment);

const mergeVoiceText = (baseText: string, transcript: string) => {
  const base = baseText.trim();
  const text = transcript.trim();
  if (!base) return text;
  if (!text) return base;
  return `${base}${/[，。！？,.!?]$/.test(base) ? "" : " "}${text}`;
};

const downsampleAudio = (input: Float32Array, inputRate: number, outputRate: number) => {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += input[cursor];
    }
    output[index] = sum / Math.max(1, end - start);
  }

  return output;
};

const pcm16FromFloat32 = (input: Float32Array) => {
  const output = new Uint8Array(input.length * 2);
  const view = new DataView(output.buffer);
  input.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });
  return output;
};

const rmsLevel = (input: Float32Array) => {
  if (!input.length) return 0;
  const sum = input.reduce((total, sample) => total + sample * sample, 0);
  return Math.min(1, Math.sqrt(sum / input.length) * 6);
};

const extractAiTextPreview = (jsonContent: string) => {
  const keyIndex = jsonContent.indexOf('"aiText"');
  if (keyIndex < 0) return "";

  const colonIndex = jsonContent.indexOf(":", keyIndex);
  if (colonIndex < 0) return "";

  const quoteIndex = jsonContent.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) return "";

  let value = "";
  let escaping = false;
  for (let index = quoteIndex + 1; index < jsonContent.length; index += 1) {
    const char = jsonContent[index];
    if (escaping) {
      value += char === "n" ? "\n" : char === "t" ? "\t" : char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') return value;
    value += char;
  }

  return value;
};

function App() {
  useStableViewport();
  const legacyLocalStateRef = useRef(hasLegacyLocalState());
  const [storedProfile, setStoredProfile] = useStoredState("baby-companion-profile", blankProfile);
  const [storedMessages, setStoredMessages] = useStoredState<ChatMessage[]>("baby-companion-messages", []);
  const [storedGrowthEvents, setStoredGrowthEvents] = useStoredState<GrowthEvent[]>("baby-companion-growth", []);
  const [storedGrowthMeasurements, setStoredGrowthMeasurements] = useStoredState<GrowthMeasurement[]>("baby-companion-growth-measurements", []);
  const [storedCareLogs, setStoredCareLogs] = useStoredState<CareLog[]>("baby-companion-care", []);
  const [storedReminders, setStoredReminders] = useStoredState<Reminder[]>("baby-companion-reminders", []);
  const [storedMemories, setStoredMemories] = useStoredState<MemoryItem[]>("baby-companion-memories", []);
  const [storedPendingEffects, setStoredPendingEffects] = useStoredState<PendingEffect[]>("baby-companion-pending-effects", []);
  const [storedAlbumItems, setStoredAlbumItems] = useStoredState<AlbumItem[]>("baby-companion-album-items", []);
  const [storedExpenses, setStoredExpenses] = useStoredState<ExpenseItem[]>("baby-companion-expenses", []);
  const [storedConversationSummary, setStoredConversationSummary] = useStoredState<ConversationSummary | null>(
    "baby-companion-conversation-summary",
    null,
  );
  // 首登知情同意：勾选一次后记住，不再弹。
  const [consentGiven, setConsentGiven] = useStoredState("baby-companion-consent-v1", false);
  // 设置页里点开的隐私/协议/儿童信息静态页。
  const [settingsLegalDoc, setSettingsLegalDoc] = useState<LegalDocId | null>(null);
  const profile = useMemo(() => normalizeBabyProfile(storedProfile), [storedProfile]);
  const messages = useMemo(() => storedMessages.map(normalizeChatMessage), [storedMessages]);
  const growthEvents = useMemo(() => storedGrowthEvents.map(normalizeGrowthEvent), [storedGrowthEvents]);
  const growthMeasurements = useMemo(() => storedGrowthMeasurements.map(normalizeGrowthMeasurement), [storedGrowthMeasurements]);
  const careLogs = useMemo(() => careLogsWithEventStats(dedupeCareLogs(storedCareLogs.map(normalizeCareLog))), [storedCareLogs]);
  const reminders = useMemo(() => storedReminders.map(normalizeReminder), [storedReminders]);
  const memories = useMemo(() => storedMemories.map(normalizeMemoryItem), [storedMemories]);
  const pendingEffects = useMemo(() => storedPendingEffects.map(normalizePendingEffect), [storedPendingEffects]);
  const storedAlbumItemsNormalized = useMemo(() => storedAlbumItems.map(normalizeAlbumItem), [storedAlbumItems]);
  const expenses = useMemo(() => storedExpenses.map(normalizeExpenseItem), [storedExpenses]);
  const conversationSummary = useMemo(
    () => normalizeConversationSummary(storedConversationSummary),
    [storedConversationSummary],
  );
  const setProfile = (action: SetStateAction<BabyProfile>) =>
    setStoredProfile((current) => normalizeBabyProfile(resolveStateAction(action, normalizeBabyProfile(current))));
  const setMessages = (action: SetStateAction<ChatMessage[]>) =>
    setStoredMessages((current) => resolveStateAction(action, current.map(normalizeChatMessage)).map(normalizeChatMessage));
  const setGrowthEvents = (action: SetStateAction<GrowthEvent[]>) =>
    setStoredGrowthEvents((current) => resolveStateAction(action, current.map(normalizeGrowthEvent)).map(normalizeGrowthEvent));
  const setGrowthMeasurements = (action: SetStateAction<GrowthMeasurement[]>) =>
    setStoredGrowthMeasurements((current) => resolveStateAction(action, current.map(normalizeGrowthMeasurement)).map(normalizeGrowthMeasurement));
  const setCareLogs = (action: SetStateAction<CareLog[]>) =>
    setStoredCareLogs((current) => resolveStateAction(action, current.map(normalizeCareLog)).map(normalizeCareLog));
  const setReminders = (action: SetStateAction<Reminder[]>) =>
    setStoredReminders((current) => resolveStateAction(action, current.map(normalizeReminder)).map(normalizeReminder));
  const setMemories = (action: SetStateAction<MemoryItem[]>) =>
    setStoredMemories((current) => resolveStateAction(action, current.map(normalizeMemoryItem)).map(normalizeMemoryItem));
  const setPendingEffects = (action: SetStateAction<PendingEffect[]>) =>
    setStoredPendingEffects((current) =>
      resolveStateAction(action, current.map(normalizePendingEffect)).map(normalizePendingEffect),
    );
  const setAlbumItems = (action: SetStateAction<AlbumItem[]>) =>
    setStoredAlbumItems((current) => resolveStateAction(action, current.map(normalizeAlbumItem)).map(normalizeAlbumItem));
  const setExpenses = (action: SetStateAction<ExpenseItem[]>) =>
    setStoredExpenses((current) => resolveStateAction(action, current.map(normalizeExpenseItem)).map(normalizeExpenseItem));
  const setConversationSummary = (action: SetStateAction<ConversationSummary | null>) =>
    setStoredConversationSummary((current) =>
      normalizeConversationSummary(resolveStateAction(action, normalizeConversationSummary(current))),
    );
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => (getAuthToken() ? "checking" : "unauthenticated"));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authFamily, setAuthFamily] = useState<AuthFamily | null>(null);
  const [authMember, setAuthMember] = useState<AuthMember | null>(null);
  const [proTrial, setProTrial] = useState<ProTrialStatus>(() => normalizeProTrialStatus(null));
  const [aiUsageSummary, setAiUsageSummary] = useState<AiUsageSummary | null>(null);
  const [aiUsageStatus, setAiUsageStatus] = useState<AiUsageStatus>("idle");
  const [familyMembers, setFamilyMembers] = useState<FamilyMembersResponse | null>(null);
  const [familyMembersStatus, setFamilyMembersStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [familyMemberBusyUserId, setFamilyMemberBusyUserId] = useState<string | null>(null);
  const [resetInviteCodeValue, setResetInviteCodeValue] = useState<string | null>(null);
  const [isApplyingProTrial, setIsApplyingProTrial] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [isRedeemingProCode, setIsRedeemingProCode] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginInviteCode, setLoginInviteCode] = useState("");
  const [loginRoleName, setLoginRoleName] = useState<"" | (typeof ROLE_OPTIONS)[number]>("");
  const [loginCaregiver, setLoginCaregiver] = useState<boolean | null>(null);
  const [loginExistingMember, setLoginExistingMember] = useState<AuthMember | null>(null);
  const [loginError, setLoginError] = useState("");
  const [occupiedInviteRoles, setOccupiedInviteRoles] = useState<string[]>([]);
  const [inviteRoleHint, setInviteRoleHint] = useState("");
  const [inviteFamilyName, setInviteFamilyName] = useState("");
  const [isCheckingInviteRoles, setIsCheckingInviteRoles] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDraft, setOnboardingDraft] = useState<BabyProfile>({
    ...blankProfile,
    allergies: ["暂未发现"],
    caregivers: initialProfile.caregivers,
  });
  const [onboardingFamilyName, setOnboardingFamilyName] = useState(suggestedFamilyName(initialProfile.nickname));
  const onboardingFamilyNameTouchedRef = useRef(false);
  const [onboardingAllergiesText, setOnboardingAllergiesText] = useState("暂未发现");
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("records");
  const [recordView, setRecordView] = useState<RecordView>("today");
  const [recordsEntryDrawer, setRecordsEntryDrawer] = useState<RecordsEntryDrawer>(null);
  const [recordsEntryDrawerClosing, setRecordsEntryDrawerClosing] = useState(false);
  const [recordsAssistantOpen, setRecordsAssistantOpen] = useState(false);
  const [ledgerView, setLedgerView] = useState<LedgerViewId>("month");
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => createExpenseDraft());
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseItem | null>(null);
  const [expenseBulkMode, setExpenseBulkMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(() => new Set());
  const [collapsedExpenseMonths, setCollapsedExpenseMonths] = useState<Set<string>>(() => new Set());
  const [bulkDeleteExpensesOpen, setBulkDeleteExpensesOpen] = useState(false);
  const [milestonesViewOpen, setMilestonesViewOpen] = useState(false);
  const [growthEntryOpen, setGrowthEntryOpen] = useState(false);
  const [reminderManagementOpen, setReminderManagementOpen] = useState(false);
  const [albumCategory, setAlbumCategory] = useState<AlbumItemCategory | "all">("all");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(todayISO().slice(0, 7));
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<BabyProfile>(profile);
  const [allergiesText, setAllergiesText] = useState(profile.allergies.join("、"));
  const [composerMode, setComposerMode] = useState<ComposerMode>("keyboard");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAttachmentTrayExpanded, setIsAttachmentTrayExpanded] = useState(false);
  const [mediaUploadItems, setMediaUploadItems] = useState<MediaUploadItem[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewAlbumItem, setPreviewAlbumItem] = useState<AlbumItem | null>(null);
  const [previewMotion, setPreviewMotion] = useState<PreviewMotion>("idle");
  const [previewOriginRect, setPreviewOriginRect] = useState<PreviewOriginRect | null>(null);
  const [previewActionsOpen, setPreviewActionsOpen] = useState(false);
  const [albumAnimationSeed, setAlbumAnimationSeed] = useState(0);
  const [previewTransform, setPreviewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [runtimeVersion, setRuntimeVersion] = useState<RuntimeVersionInfo>(() => ({
    otaVersion: BUILD_OTA_VERSION || "内置包",
    nativeVersion: "检测中",
    bundleId: "检测中",
    platform: Capacitor.getPlatform(),
    status: Capacitor.isNativePlatform() ? "读取中" : "Web 预览",
  }));
  const [systemWeakNotice, setSystemWeakNotice] = useState<SystemWeakNotice | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "offline">("loading");
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>("idle");
  const [editingPendingId, setEditingPendingId] = useState("");
  const [pendingDraft, setPendingDraft] = useState<PendingEffectDraft | null>(null);
  const [confirmingPendingEffectIds, setConfirmingPendingEffectIds] = useState<string[]>([]);
  const [manualRecordKind, setManualRecordKind] = useState<ManualRecordKind>("milk");
  const [editingCareEventId, setEditingCareEventId] = useState("");
  const [swipedTimelineEventId, setSwipedTimelineEventId] = useState("");
  const [deleteCareEventTarget, setDeleteCareEventTarget] = useState<RecordEvent | null>(null);
  const [careEventDraft, setCareEventDraft] = useState<CareEventDraft>(() => createCareEventDraft("milk"));
  const [growthCurveType, setGrowthCurveType] = useState<GrowthMeasurementType>("height");
  const [growthMeasurementDraft, setGrowthMeasurementDraft] = useState<{
    type: GrowthMeasurementType;
    value: string;
    date: string;
    note: string;
  }>({
    type: "height",
    value: "",
    date: todayISO(),
    note: "",
  });
  const [editingGrowthMeasurementId, setEditingGrowthMeasurementId] = useState("");
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState("");
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(() => createReminderDraft());
  const [completeReminderTarget, setCompleteReminderTarget] = useState<Reminder | null>(null);
  const [postponeReminderTarget, setPostponeReminderTarget] = useState<Reminder | null>(null);
  const [postponeReminderDraft, setPostponeReminderDraft] = useState<ReminderPostponeDraft>(() => reminderPostponeDraftFromReminder());
  const [deleteReminderTarget, setDeleteReminderTarget] = useState<Reminder | null>(null);
  const [ringingReminder, setRingingReminder] = useState<Reminder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumFileInputRef = useRef<HTMLInputElement>(null);
  const expenseEditorBodyRef = useRef<HTMLDivElement>(null);
  const expenseOptionalPanelRef = useRef<HTMLDetailsElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const asrControllerRef = useRef<AsrStreamController | null>(null);
  const voiceStandbyStreamRef = useRef<MediaStream | null>(null);
  const voiceStandbyPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const voicePreparingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const voiceBaseTextRef = useRef("");
  const voiceSampleBufferRef = useRef<number[]>([]);
  const voiceSessionRef = useRef(0);
  const voiceShouldStopRef = useRef(false);
  const voiceEndedRef = useRef(false);
  const voiceAsrReadyRef = useRef(false);
  const voiceAutoSubmitRef = useRef(false);
  const voicePressingRef = useRef(false);
  const voicePointerRef = useRef<{ pointerId: number; startY: number; canceling: boolean } | null>(null);
  const voicePointerCleanupRef = useRef<(() => void) | null>(null);
  const voiceAutoSubmitTimerRef = useRef<number | null>(null);
  const inputValueRef = useRef(input);
  const recordsEntryDrawerCloseTimerRef = useRef<number | null>(null);
  const timelineSwipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const submitComposerMessageRef = useRef<((textOverride?: string, options?: { skipVoiceStop?: boolean }) => Promise<void>) | null>(null);
  const hasPositionedMessageListRef = useRef(false);
  const messageScrollSignatureRef = useRef("");
  const backendReadyRef = useRef(false);
  // Album items whose optimistic persistRecord has not yet succeeded. While an id
  // is here, applyAppSnapshot must not let a backend snapshot that omits it drop
  // the item (production data-loss guard). Removed on persist success.
  const pendingPersistAlbumIdsRef = useRef<Set<string>>(new Set());
  const compressionInFlightRef = useRef(false);
  const compressionResetTimerRef = useRef<number | null>(null);
  const intervalReminderRescheduleRef = useRef("");
  const remindersRef = useRef<Reminder[]>([]);
  const handledNativeNotificationKeysRef = useRef<Set<string>>(new Set());
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);
  const systemWeakNoticeTimerRef = useRef<number | null>(null);
  const previewPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const previewLastPointRef = useRef({ x: 0, y: 0 });
  const previewPinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const previewSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
  } | null>(null);
  const previewDragOffsetRef = useRef(0);
  const previewTapGuardRef = useRef(false);
  const previewCarouselTrackRef = useRef<HTMLDivElement | null>(null);
  const previewSwipeSettleTimerRef = useRef<number | null>(null);
  const previewSwipeSettleCleanupRef = useRef<(() => void) | null>(null);
  const previewAlbumItemsRef = useRef<AlbumItem[]>([]);
  const previewAlbumItemRef = useRef<AlbumItem | null>(null);
  const previewOpenTimerRef = useRef<number | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const previewVideoCleanupRef = useRef<(() => void) | null>(null);
  const appPlatform = platformLabel();
  const babyNickname = profile.nickname.trim() || "小宝";
  const familySpeakerName = `${babyNickname}家`;
  const withBabyNickname = useCallback(
    (text: string) => text.split("小宝").join(babyNickname),
    [babyNickname],
  );
  const settleExpenseOptionalPanel = useCallback(() => {
    const body = expenseEditorBodyRef.current;
    const panel = expenseOptionalPanelRef.current;
    if (!body || !panel || !panel.open) return;
    const target = panel.querySelector("textarea") ?? panel;
    const alignTarget = () => {
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const safeBottom = bodyRect.bottom - 22;
      const safeTop = bodyRect.top + 12;
      if (targetRect.bottom > safeBottom) {
        body.scrollTop += targetRect.bottom - safeBottom;
      } else if (targetRect.top < safeTop) {
        body.scrollTop -= safeTop - targetRect.top;
      }
    };
    window.requestAnimationFrame(alignTarget);
    window.setTimeout(alignTarget, 90);
    window.setTimeout(alignTarget, 240);
  }, []);
  const canCaregive = authMember?.caregiver ?? true;
  const visibleTabs = MOBILE_TABS;
  const freeAiCallsRemaining = proTrial.freeCallsRemaining;
  // 统一边界：Pro 不限次；Free 在每月免费额度内也可用 AI（含图片/视频整理）。剩余未知时不前置拦截，由服务端兜底。
  const hasAiQuota = proTrial.enabled || freeAiCallsRemaining == null || freeAiCallsRemaining > 0;
  const canAttachVisuals = canCaregive && hasAiQuota;
  const activeUploadStatuses: MediaUploadStatus[] = ["preparing", "uploading", "processing"];
  const chatUploadItems = mediaUploadItems.filter((item) => item.target === "chat");
  const albumUploadItems = mediaUploadItems.filter((item) => item.target === "album");
  const activeChatUploadItems = chatUploadItems.filter((item) => activeUploadStatuses.includes(item.status));
  const isUploadingChatMedia = activeChatUploadItems.length > 0;
  const isUploadingAlbumMedia = albumUploadItems.some((item) => activeUploadStatuses.includes(item.status));
  const visibleChatAttachmentCount = Math.min(MAX_CHAT_ATTACHMENTS, attachments.length + activeChatUploadItems.length);
  const isChatAttachmentLimitReached = visibleChatAttachmentCount >= MAX_CHAT_ATTACHMENTS;
  const chatAttachmentCountLabel = `已添加 ${visibleChatAttachmentCount}/${MAX_CHAT_ATTACHMENTS} 个素材`;
  const chatAttachmentLimitLabel = isChatAttachmentLimitReached
    ? `${chatAttachmentCountLabel}，已达上限`
    : chatAttachmentCountLabel;
  const pendingImageCount = attachments.filter((item) => item.kind === "image").length + activeChatUploadItems.filter((item) => item.kind === "image").length;
  const pendingVideoCount = attachments.filter((item) => item.kind === "video").length + activeChatUploadItems.filter((item) => item.kind === "video").length;
  const pendingUploadCount = activeChatUploadItems.length;
  const attachmentTrayMetaLabel = [
    pendingUploadCount ? `${pendingUploadCount} 个上传中` : "",
    pendingImageCount ? `${pendingImageCount} 张照片` : "",
    pendingVideoCount ? `${pendingVideoCount} 个视频` : "",
  ].filter(Boolean).join(" · ");
  const canCollapseAttachmentTray = visibleChatAttachmentCount > 2 && pendingUploadCount === 0;
  const isAttachmentTrayOpen = !canCollapseAttachmentTray || isAttachmentTrayExpanded;
  const attachmentTrayPreviewItems = attachments.slice(0, 3);
  const attachmentTrayOverflowCount = Math.max(0, attachments.length - attachmentTrayPreviewItems.length);
  const visualToolTitle = isUploadingChatMedia
    ? "素材正在上传"
    : hasAiQuota ? "照片或视频" : "本月免费 AI 已用完，申请 Pro 内测后不限次";
  const visualToolGated = !hasAiQuota;
  const visualToolDisabled = !canCaregive || isSubmitting || isUploadingChatMedia;
  const visualToolClassName = visualToolGated ? "visual-tool-gated" : "";
  const canUseComposerInput = !isSubmitting || recordsEntryDrawer === "ai";
  const proApplicationPending = proTrial.application?.status === "pending";
  const proStatusText = proTrial.enabled ? "Pro 内测已开通" : proApplicationPending ? "Pro 内测申请中" : "可申请 Pro 内测";
  const aiUsageTopFeatures = Array.isArray(aiUsageSummary?.byFeature) ? aiUsageSummary.byFeature.slice(0, 3) : [];
  const aiUsageTopModel = Array.isArray(aiUsageSummary?.byModel) ? aiUsageSummary.byModel[0] : undefined;
  const ledgerModalOpen = expenseEditorOpen || Boolean(deleteExpenseTarget) || bulkDeleteExpensesOpen;
  const reminderModalOpen = reminderEditorOpen || Boolean(completeReminderTarget) || Boolean(postponeReminderTarget) || Boolean(deleteReminderTarget);
  const appModalOpen = Boolean(recordsEntryDrawer) || Boolean(deleteCareEventTarget) || Boolean(deleteExpenseTarget) || bulkDeleteExpensesOpen;
  const loginRoleOptions = useMemo(
    () =>
      ROLE_SELECT_OPTIONS.map((option) => {
        const occupied = option.value && occupiedInviteRoles.includes(option.value);
        return occupied
          ? { ...option, disabled: true, hint: "已被家庭成员使用" }
          : option;
      }),
    [occupiedInviteRoles],
  );
  const loginSelectedRoleOccupied = Boolean(loginRoleName && occupiedInviteRoles.includes(loginRoleName));
  const loginCredentialsReady = loginPhone.trim().replace(/\s+/g, "").length === 11 && loginInviteCode.trim().replace(/\s+/g, "").length >= 6;
  const loginReady = loginExistingMember
    ? loginCredentialsReady
    : Boolean(loginCredentialsReady && loginRoleName && loginCaregiver !== null && !loginSelectedRoleOccupied);
  const switchMobileTab = (tab: MobileTab) => {
    if (tab === "album" && activeMobileTab !== "album") {
      setAlbumAnimationSeed((seed) => seed + 1);
    }
    setRecordsAssistantOpen(false);
    if (tab !== "profile") {
      setReminderManagementOpen(false);
    }
    setActiveMobileTab(tab);
  };

  const showSystemWeakNotice = useCallback((message: string, tone: SystemWeakNotice["tone"] = "info", durationMs = 2600) => {
    if (systemWeakNoticeTimerRef.current !== null) {
      window.clearTimeout(systemWeakNoticeTimerRef.current);
    }
    const notice = {
      id: Date.now(),
      message,
      tone,
    } satisfies SystemWeakNotice;
    setSystemWeakNotice(notice);
    systemWeakNoticeTimerRef.current = window.setTimeout(() => {
      setSystemWeakNotice((current) => (current?.id === notice.id ? null : current));
      systemWeakNoticeTimerRef.current = null;
    }, durationMs);
  }, []);

  const refreshAiUsageSummary = useCallback(async (options: { quiet?: boolean } = {}) => {
    setAiUsageStatus("loading");
    try {
      const summary = await readAiUsageSummary(30);
      setAiUsageSummary(summary);
      setAiUsageStatus("ready");
      if (!options.quiet) showSystemWeakNotice("AI 用量已刷新。", "success");
    } catch (error) {
      setAiUsageStatus("error");
      if (!options.quiet) {
        showSystemWeakNotice(error instanceof Error ? error.message : "AI 用量读取失败。", "warning");
      }
    }
  }, [showSystemWeakNotice]);

  const refreshFamilyMembers = useCallback(async (options: { quiet?: boolean } = {}) => {
    setFamilyMembersStatus("loading");
    try {
      const data = await readFamilyMembers();
      setFamilyMembers(data);
      setFamilyMembersStatus("ready");
    } catch (error) {
      setFamilyMembersStatus("error");
      if (!options.quiet) {
        showSystemWeakNotice(error instanceof Error ? error.message : "家庭成员读取失败。", "warning");
      }
    }
  }, [showSystemWeakNotice]);

  const handleToggleMemberCaregiver = async (member: FamilyMember) => {
    if (member.self) return;
    const next = !member.caregiver;
    setFamilyMemberBusyUserId(member.userId);
    try {
      await updateFamilyMemberCaregiver(member.userId, next);
      showSystemWeakNotice(next ? "已设为照护人。" : "已设为仅查看，对方需重新登录。", "success");
      await refreshFamilyMembers({ quiet: true });
    } catch (error) {
      showSystemWeakNotice(error instanceof Error ? error.message : "权限调整失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const handleRemoveFamilyMember = async (member: FamilyMember) => {
    if (member.self) return;
    if (!window.confirm(`确定移除「${member.roleName}」吗？对方会被退出登录，需重新用邀请码加入。`)) return;
    setFamilyMemberBusyUserId(member.userId);
    try {
      await removeFamilyMember(member.userId);
      showSystemWeakNotice("已移除该成员。", "success");
      await refreshFamilyMembers({ quiet: true });
    } catch (error) {
      showSystemWeakNotice(error instanceof Error ? error.message : "移除失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const handleResetFamilyInviteCode = async () => {
    if (!window.confirm("重置后旧邀请码立即失效（已加入的成员不受影响）。确定重置？")) return;
    setFamilyMemberBusyUserId("__reset__");
    try {
      const result = await resetFamilyInviteCode();
      setResetInviteCodeValue(result.inviteCode);
      showSystemWeakNotice("邀请码已重置，请把新码发给家人。", "success");
    } catch (error) {
      showSystemWeakNotice(error instanceof Error ? error.message : "重置邀请码失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const clearPreviewTimers = useCallback(() => {
    if (previewOpenTimerRef.current !== null) {
      window.clearTimeout(previewOpenTimerRef.current);
      previewOpenTimerRef.current = null;
    }
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    if (previewSwipeSettleTimerRef.current !== null) {
      window.clearTimeout(previewSwipeSettleTimerRef.current);
      previewSwipeSettleTimerRef.current = null;
    }
    previewSwipeSettleCleanupRef.current?.();
    previewSwipeSettleCleanupRef.current = null;
  }, []);

  const setPreviewCarouselTransform = useCallback((offsetPx = 0, animated = false, durationMs = 220) => {
    const track = previewCarouselTrackRef.current;
    if (!track) return;
    const stableOffset = Math.abs(offsetPx) < 0.4 ? 0 : offsetPx;
    const offsetText = Math.abs(stableOffset).toFixed(2);
    const offsetExpression = stableOffset >= 0 ? `+ ${offsetText}px` : `- ${offsetText}px`;
    track.style.transition = animated ? `transform ${durationMs}ms cubic-bezier(0.2, 0.88, 0.2, 1)` : "none";
    track.style.transform = `translate3d(calc(-100vw ${offsetExpression}), 0, 0)`;
  }, []);

  const resetPreviewCarouselTransform = useCallback(() => {
    previewDragOffsetRef.current = 0;
    setPreviewCarouselTransform(0, false);
  }, [setPreviewCarouselTransform]);

  const preloadPreviewAttachment = useCallback(async (attachment: Attachment) => {
    if (attachment.kind !== "image" || !attachment.url) return;
    await new Promise<void>((resolve) => {
      const image = new window.Image();
      const finish = () => {
        if (typeof image.decode === "function") {
          image.decode().then(() => resolve()).catch(() => resolve());
          return;
        }
        resolve();
      };
      image.onload = finish;
      image.onerror = () => resolve();
      image.src = attachment.url ?? "";
      if (image.complete) finish();
    });
  }, []);

  const openPreviewAttachment = useCallback((attachment: Attachment, albumItem?: AlbumItem | null, motion: PreviewMotion = "opening", origin: PreviewOriginRect | null = null) => {
    clearPreviewTimers();
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    previewSwipeRef.current = null;
    previewTapGuardRef.current = false;
    resetPreviewCarouselTransform();
    previewAlbumItemRef.current = albumItem ?? null;
    setPreviewTransform({ scale: 1, x: 0, y: 0 });
    setPreviewAlbumItem(albumItem ?? null);
    setPreviewAttachment(attachment);
    setPreviewOriginRect(origin);
    setPreviewMotion(motion);
    if (motion !== "opening") return;
    previewOpenTimerRef.current = window.setTimeout(() => {
      setPreviewMotion("idle");
      previewOpenTimerRef.current = null;
    }, 260);
  }, [clearPreviewTimers, resetPreviewCarouselTransform]);

  // Album tile tap: use a View Transition (container-transform morph from the
  // tapped thumbnail) when supported, else the FLIP path inside openPreviewAttachment.
  const openAlbumPreview = useCallback(
    (event: { currentTarget: HTMLButtonElement }, attachment: Attachment, item: AlbumItem) => {
      if (!attachment.url) return;
      const tileEl = event.currentTarget;
      const origin = previewOriginFromRect(tileEl.getBoundingClientRect());
      if (!PREVIEW_VT) {
        openPreviewAttachment(attachment, item, "opening", origin);
        return;
      }
      // Name the tapped thumbnail so the browser morphs it into the fullscreen media.
      tileEl.style.viewTransitionName = "preview-media";
      const vt = startViewTransition(() => {
        flushSync(() => openPreviewAttachment(attachment, item, "idle", origin));
        // Drop the name in the new snapshot so only the fullscreen figure carries it.
        tileEl.style.viewTransitionName = "";
      });
      vt.finished.finally(() => {
        tileEl.style.viewTransitionName = "";
      });
    },
    [openPreviewAttachment],
  );

  const closePreviewAttachment = useCallback(() => {
    clearPreviewTimers();
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    previewSwipeRef.current = null;
    previewTapGuardRef.current = false;
    resetPreviewCarouselTransform();
    setPreviewTransform({ scale: 1, x: 0, y: 0 });

    const finalize = () => {
      setPreviewAttachment(null);
      setPreviewAlbumItem(null);
      previewAlbumItemRef.current = null;
      setPreviewMotion("idle");
    };

    if (PREVIEW_VT) {
      // Morph the fullscreen media back into its thumbnail (if it's on screen).
      const itemId = previewAlbumItemRef.current?.id;
      const tileEl =
        itemId && typeof document !== "undefined"
          ? (document.querySelector(`[data-vt-item="${itemId}"]`) as HTMLElement | null)
          : null;
      const onScreen =
        !!tileEl &&
        (() => {
          const r = tileEl.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
        })();
      if (tileEl && onScreen) tileEl.style.viewTransitionName = "preview-media";
      const vt = startViewTransition(() => {
        flushSync(finalize);
      });
      vt.finished.finally(() => {
        if (tileEl) tileEl.style.viewTransitionName = "";
      });
      return;
    }

    setPreviewMotion("closing");
    previewCloseTimerRef.current = window.setTimeout(() => {
      finalize();
      previewCloseTimerRef.current = null;
    }, 240);
  }, [clearPreviewTimers, resetPreviewCarouselTransform]);

  const handlePreviewClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("figcaption, video, button")) return;
    if (previewTapGuardRef.current) {
      previewTapGuardRef.current = false;
      return;
    }
    closePreviewAttachment();
  }, [closePreviewAttachment]);

  useEffect(() => {
    setPreviewActionsOpen(false);
  }, [previewAlbumItem?.id, previewAttachment?.id]);

  useEffect(() => {
    if (!previewActionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".media-preview-menu")) return;
      setPreviewActionsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [previewActionsOpen]);

  const findAdjacentPreviewAlbumItem = useCallback((direction: -1 | 1) => {
    const items = previewAlbumItemsRef.current;
    const current = previewAlbumItemRef.current;
    if (!current || !items.length) return null;
    const currentIndex = items.findIndex((item) => item.id === current.id);
    if (currentIndex < 0) return null;
    const nextItem = items[currentIndex + direction];
    return nextItem?.attachment?.url ? nextItem : null;
  }, []);

  const showAdjacentPreviewAlbumItem = useCallback((direction: -1 | 1) => {
    const nextItem = findAdjacentPreviewAlbumItem(direction);
    if (!nextItem?.attachment?.url) return false;
    void preloadPreviewAttachment(nextItem.attachment).then(() => {
      previewPointersRef.current.clear();
      previewPinchRef.current = null;
      previewSwipeRef.current = null;
      previewAlbumItemRef.current = nextItem;
      setPreviewTransform({ scale: 1, x: 0, y: 0 });
      setPreviewAlbumItem(nextItem);
      setPreviewAttachment(nextItem.attachment as Attachment);
      setPreviewMotion("idle");
    });
    return true;
  }, [findAdjacentPreviewAlbumItem, preloadPreviewAttachment]);

  const bindPreviewVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      previewVideoCleanupRef.current?.();
      previewVideoCleanupRef.current = null;
      if (!node) return;
      const closeAfterNativeFullscreen = () => closePreviewAttachment();
      const closeAfterStandardFullscreen = () => {
        if (!document.fullscreenElement) closePreviewAttachment();
      };
      node.addEventListener("webkitendfullscreen", closeAfterNativeFullscreen);
      document.addEventListener("fullscreenchange", closeAfterStandardFullscreen);
      node.muted = false;
      previewVideoCleanupRef.current = () => {
        node.pause();
        node.removeEventListener("webkitendfullscreen", closeAfterNativeFullscreen);
        document.removeEventListener("fullscreenchange", closeAfterStandardFullscreen);
      };
    },
    [closePreviewAttachment],
  );

  const previewDistance = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const dampPreviewSwipeOffset = (deltaX: number, hasAdjacent: boolean) => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const sign = Math.sign(deltaX) || 1;
    const distance = Math.abs(deltaX);
    if (!hasAdjacent) {
      const resisted = viewportWidth * 0.22 * (1 - Math.exp(-distance / (viewportWidth * 0.26)));
      return sign * resisted;
    }
    const progress = Math.min(distance / viewportWidth, 1);
    const friction = 0.74 - progress * 0.16;
    return sign * Math.min(viewportWidth * 0.82, distance * friction);
  };

  const beginPreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    if (!previewAlbumItemRef.current || previewTransform.scale > 1.05) return;
    previewSwipeSettleTimerRef.current && window.clearTimeout(previewSwipeSettleTimerRef.current);
    previewSwipeSettleTimerRef.current = null;
    previewDragOffsetRef.current = 0;
    setPreviewCarouselTransform(0, false);
    previewSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp || window.performance.now(),
      velocityX: 0,
    };
  };

  const updatePreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const swipe = previewSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const eventTime = event.timeStamp || window.performance.now();
    const frameDeltaX = event.clientX - swipe.lastX;
    const elapsedMs = Math.max(1, eventTime - swipe.lastTime);
    swipe.velocityX = swipe.velocityX * 0.58 + (frameDeltaX / elapsedMs) * 0.42;
    swipe.lastX = event.clientX;
    swipe.lastY = event.clientY;
    swipe.lastTime = eventTime;
    const rawDeltaX = swipe.lastX - swipe.startX;
    const rawDeltaY = swipe.lastY - swipe.startY;
    if (Math.abs(rawDeltaX) < 3 || Math.abs(rawDeltaX) < Math.abs(rawDeltaY) * 0.8) return;
    if (Math.abs(rawDeltaX) > 8 || Math.abs(rawDeltaY) > 8) previewTapGuardRef.current = true;
    if (event.cancelable) event.preventDefault();
    const direction = rawDeltaX < 0 ? 1 : -1;
    const hasAdjacent = Boolean(findAdjacentPreviewAlbumItem(direction));
    const offset = dampPreviewSwipeOffset(rawDeltaX, hasAdjacent);
    previewDragOffsetRef.current = offset;
    setPreviewCarouselTransform(offset, false);
  };

  const finishPreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const swipe = previewSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    previewSwipeRef.current = null;
    const deltaX = swipe.lastX - swipe.startX;
    const deltaY = swipe.lastY - swipe.startY;
    const leadingX = Math.abs(deltaX) > 18 ? deltaX : swipe.velocityX;
    const direction = leadingX < 0 ? 1 : -1;
    const nextItem = findAdjacentPreviewAlbumItem(direction);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const isFlick = Math.abs(swipe.velocityX) > 0.46 && Math.abs(deltaX) > 24 && Math.sign(swipe.velocityX) === Math.sign(leadingX || deltaX);
    const hasHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.18 || isFlick;
    const hasEnoughTravel = Math.abs(deltaX) > Math.max(64, viewportWidth * 0.18) || isFlick;
    const speedBoost = Math.min(90, Math.abs(swipe.velocityX) * 72);
    const durationMs = Math.max(210, Math.min(380, 350 - Math.abs(deltaX) * 0.08 - speedBoost));
    if (!nextItem?.attachment?.url || !hasHorizontalIntent || !hasEnoughTravel) {
      setPreviewCarouselTransform(0, true, 320);
      return;
    }
    const nextAttachment = nextItem.attachment;
    previewTapGuardRef.current = true;
    setPreviewCarouselTransform(direction > 0 ? -viewportWidth : viewportWidth, true, durationMs);
    void preloadPreviewAttachment(nextAttachment);
    let settled = false;
    const track = previewCarouselTrackRef.current;
    const settle = () => {
      if (settled) return;
      settled = true;
      previewSwipeSettleCleanupRef.current?.();
      previewSwipeSettleCleanupRef.current = null;
      previewPointersRef.current.clear();
      previewPinchRef.current = null;
      previewSwipeRef.current = null;
      previewAlbumItemRef.current = nextItem;
      setPreviewTransform({ scale: 1, x: 0, y: 0 });
      setPreviewAlbumItem(nextItem);
      setPreviewAttachment(nextAttachment);
      setPreviewMotion("idle");
      previewSwipeSettleTimerRef.current = null;
    };
    if (track) {
      const handleTransitionEnd = (transitionEvent: TransitionEvent) => {
        if (transitionEvent.target === track && transitionEvent.propertyName === "transform") settle();
      };
      track.addEventListener("transitionend", handleTransitionEnd);
      previewSwipeSettleCleanupRef.current = () => {
        track.removeEventListener("transitionend", handleTransitionEnd);
        if (previewSwipeSettleTimerRef.current !== null) {
          window.clearTimeout(previewSwipeSettleTimerRef.current);
          previewSwipeSettleTimerRef.current = null;
        }
      };
    }
    previewSwipeSettleTimerRef.current = window.setTimeout(settle, durationMs + 120);
  };

  const onPreviewStagePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("figcaption, button")) return;
    beginPreviewSwipe(event);
  };

  const onPreviewStagePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    updatePreviewSwipe(event);
  };

  const onPreviewStagePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    finishPreviewSwipe(event);
  };

  const onPreviewImagePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginPreviewSwipe(event);
    const point = { x: event.clientX, y: event.clientY };
    previewPointersRef.current.set(event.pointerId, point);
    previewLastPointRef.current = point;
    const points = Array.from(previewPointersRef.current.values());
    if (points.length >= 2) {
      previewPinchRef.current = {
        distance: previewDistance(points),
        scale: previewTransform.scale,
      };
    }
  };

  const onPreviewImagePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!previewPointersRef.current.has(event.pointerId)) return;
    event.stopPropagation();
    updatePreviewSwipe(event);
    const point = { x: event.clientX, y: event.clientY };
    previewPointersRef.current.set(event.pointerId, point);
    const points = Array.from(previewPointersRef.current.values());
    if (points.length >= 2 && previewPinchRef.current) {
      const distance = previewDistance(points);
      if (!distance || !previewPinchRef.current.distance) return;
      const nextScale = Math.min(4, Math.max(1, previewPinchRef.current.scale * (distance / previewPinchRef.current.distance)));
      setPreviewTransform((current) => ({
        ...current,
        scale: nextScale,
        x: nextScale === 1 ? 0 : current.x,
        y: nextScale === 1 ? 0 : current.y,
      }));
      return;
    }
    if (points.length === 1 && previewTransform.scale > 1) {
      const last = previewLastPointRef.current;
      const deltaX = point.x - last.x;
      const deltaY = point.y - last.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) previewTapGuardRef.current = true;
      previewLastPointRef.current = point;
      setPreviewTransform((current) => ({
        ...current,
        x: current.x + deltaX,
        y: current.y + deltaY,
      }));
    }
  };

  const onPreviewImagePointerEnd = (event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    finishPreviewSwipe(event);
    previewPointersRef.current.delete(event.pointerId);
    previewPinchRef.current = null;
    const [remaining] = Array.from(previewPointersRef.current.values());
    if (remaining) previewLastPointRef.current = remaining;
  };

  useLayoutEffect(() => {
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    setPreviewTransform({ scale: 1, x: 0, y: 0 });
    resetPreviewCarouselTransform();
    return () => {
      previewVideoCleanupRef.current?.();
      previewVideoCleanupRef.current = null;
    };
  }, [previewAttachment?.id, previewAlbumItem?.id, resetPreviewCarouselTransform]);

  const todayDate = todayISO();
  const todayLog = careLogs.find((item) => item.date === todayDate) ?? careLogs[careLogs.length - 1];
  const openReminders = reminders.filter((item) => item.status !== "done");
  const reminderBuckets = useMemo(() => {
    const sorted = [...reminders].sort((left, right) => {
      const dateCompare = reminderDate(left).localeCompare(reminderDate(right));
      if (dateCompare) return dateCompare;
      return parseTimeSort(reminderTimeText(left), 24 * 60) - parseTimeSort(reminderTimeText(right), 24 * 60);
    });
    const active = sorted.filter((item) => item.status !== "done");
    return {
      today: active.filter((item) => reminderDate(item) === todayDate),
      overdue: active.filter((item) => reminderDate(item) < todayDate || item.status === "missed"),
      upcoming: active.filter((item) => reminderDate(item) > todayDate && item.status !== "missed"),
      done: sorted.filter((item) => item.status === "done").reverse(),
    };
  }, [reminders, todayDate]);
  const actionableReminderCount =
    reminderBuckets.today.length + reminderBuckets.overdue.length + reminderBuckets.upcoming.length;
  const latestMilkAnchor = useMemo(() => latestCareEventAnchor(careLogs, "milk"), [careLogs]);
  const recordEvents = useMemo(
    () => buildRecordEvents(careLogs, growthEvents, reminders),
    [careLogs, growthEvents, reminders],
  );
  const eventDates = useMemo(
    () => new Set([...recordEvents.map((event) => event.date), ...careLogs.map((log) => log.date)]),
    [careLogs, recordEvents],
  );
  const calendarDates = useMemo(() => calendarDatesForMonth(calendarMonth), [calendarMonth]);
  const selectedEvents = useMemo(
    () => recordEvents.filter((event) => event.date === selectedDate),
    [recordEvents, selectedDate],
  );
  const derivedAlbumItems = useMemo(() => buildDerivedAlbumItems(messages), [messages]);
  const albumItems = useMemo(
    () => dedupeAlbumItems([...storedAlbumItemsNormalized, ...derivedAlbumItems]).filter(isVisibleAlbumMedia),
    [storedAlbumItemsNormalized, derivedAlbumItems],
  );
  const filteredAlbumItems = useMemo(
    () => albumItems.filter((item) => albumCategory === "all" || item.category === albumCategory),
    [albumItems, albumCategory],
  );
  const albumGroups = useMemo(() => {
    const groups = new Map<string, AlbumItem[]>();
    filteredAlbumItems.forEach((item) => {
      const key = (item.occurredAt ?? item.date).slice(0, 7) || "unknown";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: albumMonthLabel(key),
      items,
    }));
  }, [filteredAlbumItems]);
  const albumPreviewItems = useMemo(
    () => filteredAlbumItems.filter((item) => item.attachment?.url),
    [filteredAlbumItems],
  );
  const [albumRatioOverrides, setAlbumRatioOverrides] = useState<Record<string, number>>({});
  const recordAlbumRatio = useCallback((attachmentId: string, ratio: number) => {
    if (!attachmentId || !Number.isFinite(ratio) || ratio <= 0) return;
    setAlbumRatioOverrides((current) =>
      current[attachmentId] ? current : { ...current, [attachmentId]: ratio },
    );
  }, []);
  const albumTileAspect = useCallback(
    (item: AlbumItem) => {
      if (!item.attachment) return 1; // category-icon placeholder → square
      const measured = albumRatioOverrides[item.attachment.id];
      return attachmentAspectRatio(item.attachment, measured);
    },
    [albumRatioOverrides],
  );
  const previewAlbumIndex = previewAlbumItem
    ? albumPreviewItems.findIndex((item) => item.id === previewAlbumItem.id)
    : -1;
  const previewCarouselItems = previewAlbumIndex >= 0
    ? [
        albumPreviewItems[previewAlbumIndex - 1] ?? null,
        previewAlbumItem,
        albumPreviewItems[previewAlbumIndex + 1] ?? null,
      ]
    : [];
  const albumStats = useMemo(
    () => ({
      media: albumItems.length,
      videos: albumItems.filter((item) => item.attachment?.kind === "video").length,
      categories: new Set(albumItems.map((item) => item.category)).size,
    }),
    [albumItems],
  );
  const ledgerMonthKey = todayDate.slice(0, 7);
  const ledgerYearKey = todayDate.slice(0, 4);
  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => `${right.date}-${right.updatedAt}`.localeCompare(`${left.date}-${left.updatedAt}`)),
    [expenses],
  );
  const expenseMonthGroups = useMemo(() => groupExpensesByMonth(sortedExpenses), [sortedExpenses]);
  const monthExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expenseMonthKey(expense.date) === ledgerMonthKey),
    [sortedExpenses, ledgerMonthKey],
  );
  const yearExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expenseYearKey(expense.date) === ledgerYearKey),
    [sortedExpenses, ledgerYearKey],
  );
  const ledgerStats = useMemo(() => {
    const categoryTotals = EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: sumExpenses(monthExpenses.filter((expense) => expense.category === category.id)),
    })).filter((item) => item.total > 0);
    const maxCategoryTotal = Math.max(1, ...categoryTotals.map((item) => item.total));
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
      const month = `${ledgerYearKey}-${String(index + 1).padStart(2, "0")}`;
      return {
        month,
        label: `${index + 1}月`,
        total: sumExpenses(yearExpenses.filter((expense) => expenseMonthKey(expense.date) === month)),
      };
    });
    const maxMonthlyTotal = Math.max(1, ...monthlyTotals.map((item) => item.total));
    return {
      monthTotal: sumExpenses(monthExpenses),
      yearTotal: sumExpenses(yearExpenses),
      categoryTotals,
      maxCategoryTotal,
      monthlyTotals,
      maxMonthlyTotal,
      largest: monthExpenses.slice().sort((left, right) => right.amount - left.amount).slice(0, 3),
    };
  }, [ledgerYearKey, monthExpenses, yearExpenses]);
  useEffect(() => {
    if (visibleChatAttachmentCount === 0 && isAttachmentTrayExpanded) {
      setIsAttachmentTrayExpanded(false);
    }
  }, [isAttachmentTrayExpanded, visibleChatAttachmentCount]);

  useEffect(() => {
    previewAlbumItemsRef.current = albumPreviewItems;
  }, [albumPreviewItems]);

  useEffect(() => {
    document.body.classList.toggle("app-modal-open", appModalOpen);
    document.body.classList.toggle("ledger-modal-open", ledgerModalOpen);
    document.body.classList.toggle("reminder-modal-open", reminderModalOpen);
    document.body.classList.toggle("records-drawer-open", Boolean(recordsEntryDrawer));
    return () => {
      document.body.classList.remove("app-modal-open");
      document.body.classList.remove("ledger-modal-open");
      document.body.classList.remove("reminder-modal-open");
      document.body.classList.remove("records-drawer-open");
    };
  }, [appModalOpen, ledgerModalOpen, recordsEntryDrawer, reminderModalOpen]);

  useEffect(
    () => () => {
      if (recordsEntryDrawerCloseTimerRef.current !== null) {
        window.clearTimeout(recordsEntryDrawerCloseTimerRef.current);
        recordsEntryDrawerCloseTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    previewAlbumItemRef.current = previewAlbumItem;
  }, [previewAlbumItem]);

  useEffect(
    () => () => {
      clearPreviewTimers();
    },
    [clearPreviewTimers],
  );

  useEffect(() => {
    let alive = true;
    const fallbackVersion = BUILD_OTA_VERSION || "内置包";
    const platform = Capacitor.getPlatform();
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("CapacitorUpdater")) {
      setRuntimeVersion({
        otaVersion: fallbackVersion,
        nativeVersion: "Web",
        bundleId: "web",
        platform,
        status: "Web 预览",
      });
      return () => {
        alive = false;
      };
    }

    void CapacitorUpdater.current()
      .then((current) => {
        if (!alive) return;
        const bundle = current.bundle;
        const isBuiltin = !bundle?.id || bundle.id === "builtin";
        setRuntimeVersion({
          otaVersion: isBuiltin ? fallbackVersion : bundle.version || fallbackVersion,
          nativeVersion: current.native || "未知",
          bundleId: bundle?.id || "builtin",
          platform,
          status: isBuiltin ? "内置包" : "OTA 生效",
        });
      })
      .catch(() => {
        if (!alive) return;
        setRuntimeVersion({
          otaVersion: fallbackVersion,
          nativeVersion: "未知",
          bundleId: "读取失败",
          platform,
          status: "读取失败",
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handleMobileUpdateNotice = (event: Event) => {
      const detail = (event as CustomEvent<MobileUpdateNoticeDetail>).detail;
      if (!detail?.message) return;
      if (systemWeakNoticeTimerRef.current !== null) {
        window.clearTimeout(systemWeakNoticeTimerRef.current);
      }
      const notice = {
        id: Date.now(),
        message: detail.message,
        tone: detail.tone ?? "info",
        progress: typeof detail.progress === "number" ? Math.max(0, Math.min(100, detail.progress)) : null,
        progressMode: detail.progressMode ?? (typeof detail.progress === "number" ? "determinate" : null),
      } satisfies SystemWeakNotice;
      setSystemWeakNotice(notice);
      if (detail.durationMs !== 0) {
        systemWeakNoticeTimerRef.current = window.setTimeout(() => {
          setSystemWeakNotice((current) => (current?.id === notice.id ? null : current));
          systemWeakNoticeTimerRef.current = null;
        }, detail.durationMs ?? 2400);
      } else {
        systemWeakNoticeTimerRef.current = null;
      }
    };

    window.addEventListener(MOBILE_UPDATE_NOTICE_EVENT, handleMobileUpdateNotice);
    return () => {
      window.removeEventListener(MOBILE_UPDATE_NOTICE_EVENT, handleMobileUpdateNotice);
      if (systemWeakNoticeTimerRef.current !== null) {
        window.clearTimeout(systemWeakNoticeTimerRef.current);
        systemWeakNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!previewAttachment) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewAttachment();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (showAdjacentPreviewAlbumItem(-1)) event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight") {
        if (showAdjacentPreviewAlbumItem(1)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreviewAttachment, previewAttachment, showAdjacentPreviewAlbumItem]);

  useEffect(() => {
    if (previewAlbumIndex < 0) return;
    [albumPreviewItems[previewAlbumIndex - 1], albumPreviewItems[previewAlbumIndex + 1]].forEach((item) => {
      const attachment = item?.attachment;
      if (!attachment?.url || attachment.kind !== "image") return;
      const image = new window.Image();
      image.src = attachment.url;
      if (attachment.thumbnailUrl) {
        const thumbnail = new window.Image();
        thumbnail.src = attachment.thumbnailUrl;
      }
    });
  }, [albumPreviewItems, previewAlbumIndex]);
  const selectedCareLog = careLogs.find((item) => item.date === selectedDate);
  const selectedKeyPointCount = selectedEvents.length;
  const selectedGrowthCount = selectedEvents.filter((event) => event.type === "growth").length;
  const selectedDateIsToday = selectedDate === todayDate;
  const recordHeading = (() => {
    if (recordView === "trend") return "近 7 天对比";
    if (recordView === "growth") return "成长记录";
    if (recordView === "calendar") {
      const month = (selectedDate || todayDate).slice(0, 7);
      const [year, m] = month.split("-");
      return `${year} 年 ${Number(m)} 月日历`;
    }
    // today
    if (selectedDateIsToday) {
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const d = new Date(`${todayDate}T00:00:00`);
      return `今天 · ${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`;
    }
    return formatFullDate(selectedDate);
  })();
  const milkTrend = useMemo(() => {
    const recent = careLogs.slice(-3).map((item) => item.milkMl ?? 0).filter(Boolean);
    if (recent.length < 2) return "继续收集中";
    const delta = recent[recent.length - 1] - recent[0];
    return delta >= 0 ? `近3次 +${delta} ml` : `近3次 ${delta} ml`;
  }, [careLogs]);
  const weeklyCareComparison = useMemo(() => buildWeeklyCareComparison(careLogs, selectedDate), [careLogs, selectedDate]);
  const dailyCareBreakdowns = useMemo(() => buildDailyCareBreakdowns(selectedCareLog), [selectedCareLog]);
  const growthTrendMetrics = useMemo(() => buildGrowthTrendMetrics(growthMeasurements), [growthMeasurements]);
  const growthCurveData = useMemo(
    () => buildGrowthCurveData(growthMeasurements, growthCurveType),
    [growthMeasurements, growthCurveType],
  );
  const buildAgentPageContext = () => ({
    activeTab: activeMobileTab,
    selectedDate,
    selectedCareLog,
    selectedEvents: selectedEvents.slice(0, 12).map((event) => ({
      id: event.id,
      date: event.date,
      timeLabel: event.timeLabel,
      type: event.type,
      kind: event.kind,
      title: event.title,
      body: event.body,
      tags: event.tags,
    })),
    todayCareLog: careLogs.find((item) => item.date === todayISO()),
    recentCareLogs: careLogs.slice(-7),
    openReminders: openReminders.slice(0, 8),
    recentExpenses: sortedExpenses.slice(0, 8),
    pendingEffectSummaries: pendingEffects.slice(0, 6).map((effect) => ({
      id: effect.id,
      createdAt: effect.createdAt,
      tags: effect.tags ?? [],
      summary: pendingEffectSummary(effect),
    })),
  });

  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    ringingAudioRef.current?.pause();
    ringingAudioRef.current = null;
    if (!ringingReminder) return undefined;

    const soundUrl = REMINDER_WEB_SOUND_URLS[normalizeReminderSoundId(ringingReminder.soundId)];
    const audio = new Audio(soundUrl);
    audio.loop = true;
    ringingAudioRef.current = audio;
    void audio.play().catch(() => undefined);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (ringingAudioRef.current === audio) ringingAudioRef.current = null;
    };
  }, [ringingReminder?.id, ringingReminder?.soundId]);

  useEffect(
    () => () => {
      if (compressionResetTimerRef.current !== null) window.clearTimeout(compressionResetTimerRef.current);
      ringingAudioRef.current?.pause();
    },
    [],
  );

  useEffect(() => {
    const normalizedCode = loginInviteCode.trim();
    const compactCode = normalizedCode.replace(/\s+/g, "");
    const compactPhone = loginPhone.trim().replace(/\s+/g, "");
    if (compactCode.length < 6) {
      setOccupiedInviteRoles([]);
      setInviteRoleHint("");
      setInviteFamilyName("");
      setLoginExistingMember(null);
      setIsCheckingInviteRoles(false);
      return undefined;
    }

    let cancelled = false;
    setIsCheckingInviteRoles(true);
    const timer = window.setTimeout(() => {
      readInviteRoleOptions(normalizedCode, compactPhone.length === 11 ? compactPhone : undefined)
        .then((result) => {
          if (cancelled) return;
          const occupied = result.occupiedRoles.filter((role) =>
            (UNIQUE_ROLE_OPTIONS as readonly string[]).includes(role),
          );
          const familyName = result.familyName || "小宝家";
          setOccupiedInviteRoles(occupied);
          setInviteFamilyName(familyName);
          setLoginExistingMember(result.existingMember ? result.member ?? null : null);
          if (result.existingMember && result.member) {
            setInviteRoleHint(`已是 ${familyName} 的成员：${result.member.roleName} · ${result.member.caregiver ? "照护人" : "仅查看"}`);
          } else {
            setInviteRoleHint(
              occupied.length
                ? `${familyName} 已有：${occupied.join("、")}`
                : `${familyName} 可选择家庭身份`,
            );
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setOccupiedInviteRoles([]);
          setInviteFamilyName("");
          setLoginExistingMember(null);
          setInviteRoleHint(error instanceof Error ? error.message : "邀请码暂时无法确认");
        })
        .finally(() => {
          if (!cancelled) setIsCheckingInviteRoles(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loginInviteCode, loginPhone]);

  useEffect(() => {
    if (loginRoleName && occupiedInviteRoles.includes(loginRoleName)) {
      setLoginRoleName("");
    }
  }, [loginRoleName, occupiedInviteRoles]);

  useEffect(() => {
    if (!onboardingRequired || onboardingFamilyNameTouchedRef.current) return;
    const existingFamilyName = authFamily?.name?.trim() ?? "";
    const nextFamilyName =
      existingFamilyName && existingFamilyName !== "小宝家"
        ? existingFamilyName
        : suggestedFamilyName(onboardingDraft.nickname || initialProfile.nickname);
    setOnboardingFamilyName(nextFamilyName);
  }, [authFamily?.name, onboardingDraft.nickname, onboardingRequired]);

  const buildAppSnapshot = (): AppStateSnapshot => ({
    profile,
    messages,
    growthEvents,
    growthMeasurements,
    careLogs,
    reminders,
    memories,
    pendingEffects,
    albumItems: storedAlbumItemsNormalized.map((item) => ({
      ...item,
      attachment: item.attachment ? {
        ...item.attachment,
        url: stripAttachmentUrlForStorage(item.attachment.url),
        publicUrl: stripAttachmentUrlForStorage(item.attachment.publicUrl),
      } : undefined,
    })),
    expenses,
    conversationSummary,
    proTrial,
  });

  const applyAppSnapshot = (state: Partial<AppStateSnapshot>) => {
    if ("profile" in state) setProfile((state.profile ?? blankProfile) as BabyProfile);
    if (state.messages) setMessages(state.messages);
    if (state.growthEvents) setGrowthEvents(state.growthEvents);
    if (state.growthMeasurements) setGrowthMeasurements(state.growthMeasurements);
    if (state.careLogs) setCareLogs(state.careLogs);
    if (state.reminders) setReminders(state.reminders.map(normalizeReminder));
    if (state.memories) setMemories(state.memories);
    if (state.pendingEffects) setPendingEffects(state.pendingEffects);
    if (state.albumItems) {
      const snapshotAlbumItems = state.albumItems;
      // Merge instead of overwrite so optimistic album items still awaiting
      // confirmed persistence survive a snapshot that omits them (data-loss guard).
      setAlbumItems((current) =>
        mergeAlbumItemsFromSnapshot(current, snapshotAlbumItems, pendingPersistAlbumIdsRef.current),
      );
      // Any pending id the backend now reports is confirmed persisted; stop
      // tracking it so the guard set stays bounded and later deletes propagate.
      if (pendingPersistAlbumIdsRef.current.size) {
        snapshotAlbumItems.forEach((item) => pendingPersistAlbumIdsRef.current.delete(item.id));
      }
    }
    if (state.expenses) setExpenses(state.expenses);
    if ("conversationSummary" in state) {
      setConversationSummary((state.conversationSummary ?? null) as ConversationSummary | null);
    }
    if ("proTrial" in state) setProTrial(normalizeProTrialStatus(state.proTrial ?? null));
  };

  const applyEmptyAppSnapshot = () => {
    applyAppSnapshot({
      profile: blankProfile,
      messages: [],
      growthEvents: [],
      growthMeasurements: [],
      careLogs: [],
      reminders: [],
      memories: [],
      pendingEffects: [],
      conversationSummary: null,
      albumItems: [],
      expenses: [],
      proTrial: normalizeProTrialStatus(null),
    });
  };

  const loadStateFromBackend = async (
    options: { importLegacy: boolean; onboardingRequired?: boolean } = { importLegacy: false },
  ) => {
    setStorageStatus("loading");
    const response = await readAppState();
    if (response.empty) {
      if (options.importLegacy) {
        const imported = await importAppState(buildAppSnapshot());
        applyAppSnapshot(imported.state);
        setOnboardingRequired(options.onboardingRequired ?? !hasCompleteProfile(imported.state.profile as BabyProfile | undefined));
        markLegacyImported();
      } else {
        applyEmptyAppSnapshot();
        setOnboardingRequired(options.onboardingRequired ?? true);
      }
    } else {
      applyAppSnapshot(response.state);
      setOnboardingRequired(options.onboardingRequired ?? !hasCompleteProfile(response.state.profile as BabyProfile | undefined));
    }
    backendReadyRef.current = true;
    setStorageStatus("ready");
  };

  const applyStateResponse = (response: { state: Partial<AppStateSnapshot> }) => {
    applyAppSnapshot(response.state);
    backendReadyRef.current = true;
    setStorageStatus("ready");
  };

  const persistRecord = async <T,>(
    collection: AppStateCollection,
    id: string,
    item: T,
    options: { applyResponse?: boolean; mode?: "merge" | "replace" } = {},
  ) => {
    try {
      const response = await upsertAppRecord(collection, id, item, { mode: options.mode });
      if (options.applyResponse) applyStateResponse(response);
      else {
        backendReadyRef.current = true;
        setStorageStatus("ready");
      }
      return response;
    } catch (error) {
      backendReadyRef.current = false;
      setStorageStatus("offline");
      throw error;
    }
  };

  // Persist an optimistic album item while protecting it from snapshot overwrites.
  // The id is marked pending up front; on success it is cleared (backend now owns
  // it) so future snapshots may delete it normally; on failure it stays pending so
  // mergeAlbumItemsFromSnapshot keeps the item alive until it is eventually saved.
  const persistAlbumItemOptimistic = (item: AlbumItem) => {
    pendingPersistAlbumIdsRef.current.add(item.id);
    // On failure the id stays pending on purpose: mergeAlbumItemsFromSnapshot then
    // protects the item from being dropped by a snapshot that omits it. persistRecord
    // already flips storage status to "offline", so we only need to rethrow here.
    return persistRecord("albumItems", item.id, albumItemForStorage(item)).then((response) => {
      pendingPersistAlbumIdsRef.current.delete(item.id);
      return response;
    });
  };

  const applyForProTrial = async (source: string) => {
    setIsApplyingProTrial(true);
    try {
      const status = await submitProTrialApplication(source);
      setProTrial(normalizeProTrialStatus(status));
      showSystemWeakNotice("已收到 Pro 内测申请，开通后会在 App 内提示你。", "success");
    } catch (error) {
      showSystemWeakNotice(error instanceof Error ? error.message : "申请失败，请稍后再试。", "warning");
    } finally {
      setIsApplyingProTrial(false);
    }
  };

  const redeemProTrialCode = async () => {
    const code = redeemCodeInput.trim();
    if (!code || isRedeemingProCode) return;
    setIsRedeemingProCode(true);
    try {
      const status = await redeemProCode(code);
      setProTrial(normalizeProTrialStatus(status));
      setRedeemCodeInput("");
      showSystemWeakNotice("内测码兑换成功，Pro 已开通。", "success");
    } catch (error) {
      showSystemWeakNotice(error instanceof Error ? error.message : "兑换失败，请稍后再试。", "warning");
    } finally {
      setIsRedeemingProCode(false);
    }
  };

  const applyNativeAlarmEvents = async (events: NativeAlarmEvent[]) => {
    const updates = events.flatMap((event) => {
      const target = remindersRef.current.find(
        (reminder) => reminder.id === event.reminderId || reminder.notificationId === event.notificationId,
      );
      if (!target) return [];
      const nextDueAt = event.nextDueAt ? new Date(event.nextDueAt) : new Date(Number.NaN);
      const handledAt = new Date(event.handledAt);
      if (Number.isNaN(nextDueAt.getTime())) {
        const completed: Reminder = {
          ...target,
          status: "done",
          notificationStatus: "cancelled",
          history: [`${formatReminderDueText(Number.isNaN(handledAt.getTime()) ? new Date() : handledAt)} 已关闭本次提醒`, ...target.history],
        };
        return [completed];
      }

      const handledLabel = Number.isNaN(handledAt.getTime())
        ? formatReminderDueText(new Date())
        : formatReminderDueText(handledAt);
      const nextReminder = addReminderHistory(
        {
          ...target,
          status: "open",
          dueAt: nextDueAt.toISOString(),
          dueText: formatReminderDueText(nextDueAt),
          lastAnchorAt: Number.isNaN(handledAt.getTime()) ? target.lastAnchorAt : handledAt.toISOString(),
          notificationStatus: event.exact === false ? "scheduled_inexact" : "scheduled",
          notificationError: event.exact === false
            ? "系统精确定时权限未开启，已安排提醒，但可能不够准时。"
            : undefined,
        },
        event.type === "alarm_closed_current"
          ? `${handledLabel} 已关闭本次闹铃，下一次 ${formatReminderDueText(nextDueAt)}`
          : `${handledLabel} 已触发本次通知，下一次 ${formatReminderDueText(nextDueAt)}`,
      );
      return [nextReminder];
    });

    if (!updates.length) return;
    setReminders((current) => {
      const byId = new Map(current.map((reminder) => [reminder.id, reminder]));
      updates.forEach((reminder) => byId.set(reminder.id, reminder));
      const next = Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
      remindersRef.current = next;
      return next;
    });
    for (const reminder of updates) {
      await persistRecord("reminders", reminder.id, reminder);
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated" || !isNativeAlarmAvailable()) return undefined;

    let cancelled = false;
    const syncNativeAlarmEvents = async () => {
      try {
        const events = await consumeAlarmEvents();
        if (cancelled || !events.length) return;
        await applyNativeAlarmEvents(events);
      } catch {
        // Native alarm events are best-effort sync; the native side already scheduled the next alarm.
      }
    };

    void syncNativeAlarmEvents();
    const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void syncNativeAlarmEvents();
    });
    return () => {
      cancelled = true;
      void listener.then((handle) => handle.remove());
    };
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return undefined;
    }

    const handleIosNativeAlarmNotification = (notification: LocalNotificationSchema, source: "received" | "action") => {
      const extra = notification.extra as Record<string, unknown> | undefined;
      if (!extra?.nativeAlarm) return;
      const reminderId = typeof extra.reminderId === "string" ? extra.reminderId : "";
      if (!reminderId) return;
      const target = remindersRef.current.find((reminder) => reminder.id === reminderId);
      if (!target) return;

      const key = typeof extra.requestIdentifier === "string"
        ? extra.requestIdentifier
        : `${reminderId}-${notification.id}-${source}`;
      if (handledNativeNotificationKeysRef.current.has(key)) return;
      handledNativeNotificationKeysRef.current.add(key);

      if (target.alertMode === "ringing") {
        setRingingReminder(target);
        return;
      }

      if (isIntervalReminder(target) && target.repeatRule) {
        const handledAt = new Date();
        const nextDueAt = new Date(handledAt.getTime() + target.repeatRule.intervalMinutes * 60 * 1000);
        void applyNativeAlarmEvents([
          {
            type: "reminder_triggered",
            reminderId: target.id,
            notificationId: target.notificationId,
            handledAt: handledAt.toISOString(),
            nextDueAt: nextDueAt.toISOString(),
            intervalMinutes: target.repeatRule.intervalMinutes,
            exact: true,
          },
        ]).catch(() => undefined);
      }
    };

    const receivedListener = LocalNotifications.addListener("localNotificationReceived", (notification) => {
      handleIosNativeAlarmNotification(notification, "received");
    });
    const actionListener = LocalNotifications.addListener("localNotificationActionPerformed", (action: ActionPerformed) => {
      handleIosNativeAlarmNotification(action.notification, "action");
    });

    return () => {
      void receivedListener.then((handle) => handle.remove());
      void actionListener.then((handle) => handle.remove());
    };
  }, [authStatus]);

  const scheduleCompressionStatusReset = (status: CompressionStatus, delayMs: number) => {
    if (compressionResetTimerRef.current !== null) window.clearTimeout(compressionResetTimerRef.current);
    compressionResetTimerRef.current = window.setTimeout(() => {
      setCompressionStatus((current) => (current === status ? "idle" : current));
      compressionResetTimerRef.current = null;
    }, delayMs);
  };

  const runConversationCompression = async () => {
    if (!backendReadyRef.current || compressionInFlightRef.current || !canCaregive) return;
    compressionInFlightRef.current = true;
    if (compressionResetTimerRef.current !== null) {
      window.clearTimeout(compressionResetTimerRef.current);
      compressionResetTimerRef.current = null;
    }
    setCompressionStatus("checking");
    const compressingTimer = window.setTimeout(() => {
      setCompressionStatus((current) => (current === "checking" ? "compressing" : current));
    }, 250);

    try {
      const response = await compressConversationSummary();
      window.clearTimeout(compressingTimer);
      if (response.conversationSummary !== undefined) {
        setConversationSummary(response.conversationSummary ?? null);
      }
      if (response.status === "compressed") {
        setCompressionStatus("done");
        scheduleCompressionStatusReset("done", 2400);
      } else {
        setCompressionStatus("idle");
      }
    } catch {
      window.clearTimeout(compressingTimer);
      setCompressionStatus("failed");
      scheduleCompressionStatusReset("failed", 3600);
    } finally {
      compressionInFlightRef.current = false;
    }
  };

  const attachmentForStorage = (attachment: Attachment): Attachment => {
    const storedPublicUrl = stripAttachmentUrlForStorage(attachment.publicUrl);
    const storedUrl = storedPublicUrl || stripAttachmentUrlForStorage(attachment.url);
    const storedThumbnailUrl = stripAttachmentUrlForStorage(attachment.thumbnailUrl);
    return {
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      url: storedUrl,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      publicUrl: storedPublicUrl,
      thumbnailPath: attachment.thumbnailPath,
      thumbnailUrl: storedThumbnailUrl,
      width: attachment.width,
      height: attachment.height,
      createdAt: attachment.createdAt,
      capturedAt: attachment.capturedAt,
    };
  };

  const messageForStorage = (message: ChatMessage): ChatMessage => ({
    ...message,
    attachments: message.attachments?.map(attachmentForStorage),
  });

  const albumItemForStorage = (item: AlbumItem): AlbumItem => ({
    ...(({ recordedBy: _recordedBy, createdByUserId: _createdByUserId, ...rest }) => rest)(item),
    attachment: item.attachment ? attachmentForStorage(item.attachment) : undefined,
  });

  const expenseForStorage = (expense: ExpenseItem): ExpenseItem => ({
    ...(({ attachments: _attachments, recordedBy: _recordedBy, createdByUserId: _createdByUserId, ...rest }) => rest)(expense),
  });

  useEffect(() => {
    let cancelled = false;
    const bootstrapAuth = async () => {
      if (!getAuthToken()) {
        setAuthStatus("unauthenticated");
        return;
      }
      try {
        const me = await readCurrentUser();
        if (cancelled) return;
        setAuthUser(me.user);
        setAuthFamily(me.family);
        setAuthMember(me.member);
        await loadStateFromBackend({ importLegacy: false, onboardingRequired: me.onboardingRequired });
        setAuthStatus("authenticated");
      } catch {
        clearAuthToken();
        backendReadyRef.current = false;
        setAuthStatus("unauthenticated");
        setStorageStatus("loading");
      }
    };
    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleExpired = () => {
      backendReadyRef.current = false;
      setAuthUser(null);
      setAuthFamily(null);
      setAuthMember(null);
      setAuthStatus("unauthenticated");
      setStorageStatus("loading");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const refreshIntervalMs = 6 * 60 * 60 * 1000;
    const interval = window.setInterval(() => {
      void refreshAccessToken().catch(() => undefined);
    }, refreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setAiUsageSummary(null);
      setAiUsageStatus("idle");
      return;
    }
    void refreshAiUsageSummary({ quiet: true });
    void refreshFamilyMembers({ quiet: true });
  }, [authStatus, refreshAiUsageSummary, refreshFamilyMembers]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list || activeMobileTab !== "records" || !recordsAssistantOpen) return;

    const lastMessage = messages[messages.length - 1];
    const signature = [
      messages.length,
      lastMessage?.id ?? "",
      lastMessage?.text.length ?? 0,
      lastMessage?.reasoning?.length ?? 0,
      lastMessage?.isStreaming ? "streaming" : "done",
      isSubmitting ? "submitting" : "idle",
    ].join(":");
    const isFirstPosition = !hasPositionedMessageListRef.current;
    const didMessageChange = messageScrollSignatureRef.current !== signature;
    messageScrollSignatureRef.current = signature;

    if (!isFirstPosition && !didMessageChange) return;
    if (isFirstPosition || isSubmitting || lastMessage?.isStreaming) {
      list.scrollTop = list.scrollHeight;
    } else {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
    hasPositionedMessageListRef.current = true;
  }, [messages, isSubmitting, activeMobileTab, recordsAssistantOpen]);

  useEffect(() => {
    if (canAttachVisuals) return;
    setAttachments([]);
    setMediaUploadItems([]);
  }, [canAttachVisuals]);

  useEffect(() => {
    if (!canCaregive || !latestMilkAnchor) return;
    const candidates = reminders.filter(
      (reminder) =>
        isIntervalMilkReminder(reminder) &&
        (reminder.lastAnchorEventId !== latestMilkAnchor.id ||
          reminder.lastAnchorAt !== latestMilkAnchor.occurredAt.toISOString()),
    );
    if (!candidates.length) return;

    const signature = `${latestMilkAnchor.id}:${latestMilkAnchor.occurredAt.toISOString()}:${candidates
      .map((item) => item.id)
      .join(",")}`;
    if (intervalReminderRescheduleRef.current === signature) return;
    intervalReminderRescheduleRef.current = signature;

    void (async () => {
      try {
        await Promise.all(candidates.map(cancelNativeReminder));
        const scheduled = await scheduleNativeReminders(candidates, { careLogs });
        if (!scheduled.length) return;
        setReminders((current) => {
          const byId = new Map(current.map((reminder) => [reminder.id, reminder]));
          scheduled.forEach((reminder) => byId.set(reminder.id, reminder));
          return Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
        });
        for (const reminder of scheduled) {
          await persistRecord("reminders", reminder.id, reminder);
        }
      } catch {
        setStorageStatus("offline");
      } finally {
        intervalReminderRescheduleRef.current = "";
      }
    })();
  }, [canCaregive, latestMilkAnchor?.id, latestMilkAnchor?.occurredAt, reminders, careLogs]);

  useEffect(() => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
  }, [profile]);

  const readImageDimensionsFromFile = (file: File): Promise<Pick<Attachment, "width" | "height">> =>
    new Promise((resolve) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      image.onload = () => {
        cleanup();
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        cleanup();
        resolve({});
      };
      image.src = objectUrl;
    });

  const createVideoThumbnailDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);
      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute("src");
        video.load();
      };
      const finish = (value: string | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        cleanup();
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(undefined), VIDEO_THUMBNAIL_TIMEOUT_MS);
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const seekTime = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.4, video.duration / 8) : 0;
        try {
          video.currentTime = seekTime;
        } catch {
          finish(undefined);
        }
      };
      video.onseeked = () => {
        try {
          const width = video.videoWidth || 480;
          const height = video.videoHeight || 480;
          const scale = Math.min(1, 480 / Math.max(width, height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            finish(undefined);
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          finish(dataUrl);
        } catch {
          finish(undefined);
        }
      };
      video.onerror = () => {
        finish(undefined);
      };
      video.src = objectUrl;
    });

  const readAgentAttachmentDataUrl = async (attachment: Attachment, visualCount: number) => {
    if (!canAttachVisuals) return undefined;
    try {
      if (attachment.kind === "image") {
        const imageUrl = attachment.url ?? attachment.publicUrl;
        const dataUrl = attachment.dataUrl ?? (imageUrl ? await fetchAsDataUrl(imageUrl) : undefined);
        return resizeImageDataUrlForAgent(dataUrl, visualCount);
      }
      if (attachment.kind === "video") {
        const thumbnailUrl = attachment.thumbnailUrl;
        if (!thumbnailUrl) return undefined;
        const dataUrl = thumbnailUrl.startsWith("data:image/")
          ? thumbnailUrl
          : await fetchAsDataUrl(thumbnailUrl);
        return resizeImageDataUrlForAgent(dataUrl, visualCount);
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const updateMediaUploadItem = (id: string, patch: Partial<MediaUploadItem>) => {
    setMediaUploadItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeMediaUploadItem = (id: string) => {
    setMediaUploadItems((current) => current.filter((item) => item.id !== id));
  };

  const removeMediaUploadItemLater = (id: string, delay = 1800) => {
    window.setTimeout(() => {
      removeMediaUploadItem(id);
    }, delay);
  };

  const uploadMediaFile = async (
    id: string,
    file: File,
    kind: AttachmentKind,
    dimensions?: Pick<Attachment, "width" | "height">,
    thumbnailDataUrl?: string,
  ): Promise<Attachment> => {
    if (!canCaregive) throw new Error("当前身份仅可查看，不能上传附件。");
    updateMediaUploadItem(id, { status: "uploading", progress: 1, message: "上传中" });
    const uploaded = await uploadFileAttachment({
      id,
      name: file.name,
      kind,
      file,
      thumbnailDataUrl,
      onProgress: (progress) => updateMediaUploadItem(id, { status: "uploading", progress: Math.max(1, Math.min(99, progress)), message: `上传 ${progress}%` }),
    });
    updateMediaUploadItem(id, { status: "processing", progress: 100, message: "整理中" });
    const capturedAt = await resolveMediaCaptureDate(file, uploaded.createdAt);
    const attachment: Attachment = {
      id: uploaded.id,
      name: uploaded.name,
      kind: uploaded.kind,
      url: uploaded.url,
      publicUrl: uploaded.publicUrl,
      thumbnailUrl: uploaded.thumbnailUrl,
      thumbnailPath: uploaded.thumbnailPath,
      filePath: uploaded.filePath,
      mimeType: uploaded.mimeType,
      width: dimensions?.width,
      height: dimensions?.height,
      createdAt: uploaded.createdAt,
      capturedAt,
    };
    return attachment;
  };

  const queueMediaFiles = (files: File[], limit: number): QueuedMediaFile[] =>
    files
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, limit)
      .map((file) => ({
        id: makeId("attachment"),
        file,
        kind: file.type.startsWith("video/") ? "video" as AttachmentKind : "image" as AttachmentKind,
      }));

  const processSelectedMediaFiles = async (files: File[], target: MediaUploadTarget) => {
    const availableSlots = target === "chat" ? Math.max(0, MAX_CHAT_ATTACHMENTS - attachments.length) : MAX_ALBUM_PICKER_ATTACHMENTS;
    const queue = queueMediaFiles(files, availableSlots);
    const mediaFileCount = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")).length;
    const skippedByLimit = target === "chat" ? Math.max(0, mediaFileCount - availableSlots) : 0;
    if (queue.length) {
      setMediaUploadItems((current) => [
        ...current,
        ...queue.map(({ id, file, kind }) => ({
          id,
          name: file.name,
          kind,
          target,
          status: "preparing" as MediaUploadStatus,
          progress: 0,
          message: "准备中",
        })),
      ]);
    }

    const failures: string[] = [];
    for (const item of queue) {
      const maxUploadBytes = maxMediaUploadBytes(item.kind);
      if (item.file.size > maxUploadBytes) {
        const message = `超过 ${formatFileSize(maxUploadBytes)} 限制`;
        failures.push(`${item.file.name} ${message}`);
        updateMediaUploadItem(item.id, { status: "failed", progress: 0, message });
        removeMediaUploadItemLater(item.id, 6000);
        continue;
      }
      try {
        updateMediaUploadItem(item.id, { status: "preparing", progress: 0, message: item.kind === "video" ? "生成预览" : "读取信息" });
        const dimensions = item.kind === "image" ? await readImageDimensionsFromFile(item.file) : {};
        const thumbnailDataUrl = item.kind === "video" ? await createVideoThumbnailDataUrl(item.file) : undefined;
        const attachment = await uploadMediaFile(item.id, item.file, item.kind, dimensions, thumbnailDataUrl);
        if (target === "chat") {
          removeMediaUploadItem(item.id);
          setAttachments((current) => [...current, attachment].slice(0, MAX_CHAT_ATTACHMENTS));
        } else {
          const albumItem = albumItemFromStandaloneAttachment(attachment);
          setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
          updateMediaUploadItem(item.id, { status: "done", progress: 100, message: "已加入相册" });
          removeMediaUploadItemLater(item.id, 1600);
          void persistAlbumItemOptimistic(albumItem).catch(() => undefined);
          hapticSuccess();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        failures.push(`${item.file.name} ${message}`);
        updateMediaUploadItem(item.id, { status: "failed", progress: 0, message });
        removeMediaUploadItemLater(item.id, 6000);
      }
    }
    if (failures.length || (target === "chat" && (availableSlots === 0 || skippedByLimit > 0))) {
      const limitMessage = availableSlots === 0
        ? `最多同时添加 ${MAX_CHAT_ATTACHMENTS} 个素材，先处理当前内容后再继续添加。`
        : `最多同时添加 ${MAX_CHAT_ATTACHMENTS} 个素材，已先添加前 ${queue.length} 个。`;
      const message = failures.length
        ? `${target === "album" ? "相册" : "素材"}上传失败：${failures.slice(0, 2).join("；")}${failures.length > 2 ? " 等" : ""}${target === "chat" && skippedByLimit > 0 ? `；${limitMessage}` : ""}`
        : limitMessage;
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: message,
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
    if (target === "chat" && queue.length > 0 && queue.length >= availableSlots) {
      showSystemWeakNotice(
        `这条消息最多识别 ${MAX_CHAT_ATTACHMENTS} 个素材，本次已添加 ${queue.length} 个；更多请发送后再继续。`,
        skippedByLimit > 0 ? "warning" : "info",
        3600,
      );
    }
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCaregive || !canAttachVisuals || isUploadingChatMedia) {
      event.target.value = "";
      return;
    }
    await processSelectedMediaFiles(Array.from(event.target.files ?? []), "chat");
    event.target.value = "";
  };

  const handleAlbumFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCaregive || isUploadingAlbumMedia) {
      event.target.value = "";
      return;
    }
    await processSelectedMediaFiles(Array.from(event.target.files ?? []), "album");
    event.target.value = "";
  };

  const openMediaPicker = async () => {
    if (!canCaregive || isUploadingChatMedia) return;
    if (!hasAiQuota) {
      showSystemWeakNotice("本月免费 AI 体验次数已用完，申请 Pro 内测后即可不限次使用图片/视频整理。", "info");
      void applyForProTrial("visual-quota-exhausted");
      return;
    }

    const availableSlots = Math.max(0, MAX_CHAT_ATTACHMENTS - attachments.length);
    if (availableSlots <= 0) {
      await processSelectedMediaFiles([], "chat");
      return;
    }

    if (isNativeMediaPickerAvailable()) {
      try {
        const files = await pickNativeMediaFiles({ limit: availableSlots });
        if (files.length) await processSelectedMediaFiles(files, "chat");
        return;
      } catch (error) {
        if (isNativeMediaPickerCancel(error)) return;
        console.warn("[native-media-picker] failed", error);
        const message = error instanceof Error ? error.message : "无法读取已选择的素材";
        showSystemWeakNotice(`素材选择失败：${message}`, "warning", 3600);
        return;
      }
    }

    fileInputRef.current?.click();
  };

  const openAlbumMediaPicker = async () => {
    if (!canCaregive || isUploadingAlbumMedia) return;
    if (isNativeMediaPickerAvailable()) {
      try {
        const files = await pickNativeMediaFiles({ limit: MAX_ALBUM_PICKER_ATTACHMENTS });
        if (files.length) await processSelectedMediaFiles(files, "album");
        return;
      } catch (error) {
        if (isNativeMediaPickerCancel(error)) return;
        console.warn("[native-media-picker] failed", error);
        const message = error instanceof Error ? error.message : "无法读取已选择的素材";
        showSystemWeakNotice(`相册选择失败：${message}`, "warning", 3600);
        return;
      }
    }
    albumFileInputRef.current?.click();
  };

  const clearVoiceAutoSubmitTimer = () => {
    if (voiceAutoSubmitTimerRef.current !== null) {
      window.clearTimeout(voiceAutoSubmitTimerRef.current);
      voiceAutoSubmitTimerRef.current = null;
    }
  };

  const runVoiceAutoSubmit = () => {
    if (!voiceAutoSubmitRef.current || isSubmittingRef.current) return;

    const text = inputValueRef.current.trim();
    if (!text) return;

    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    voiceSessionRef.current += 1;
    voiceShouldStopRef.current = true;
    asrControllerRef.current?.close();
    asrControllerRef.current = null;
    void submitComposerMessageRef.current?.(text, { skipVoiceStop: true });
  };

  const scheduleVoiceAutoSubmit = (delayMs = 0) => {
    if (!voiceAutoSubmitRef.current) return;
    clearVoiceAutoSubmitTimer();
    voiceAutoSubmitTimerRef.current = window.setTimeout(runVoiceAutoSubmit, delayMs);
  };

  const voiceMediaConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  const stopVoiceStandbyStream = () => {
    const stream = voiceStandbyStreamRef.current;
    voiceStandbyStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  };

  const requestVoiceInputStream = async () => {
    const microphoneAllowed = await ensureMicrophonePermission();
    if (!microphoneAllowed) {
      throw new Error("麦克风权限未开启，请在系统设置中允许录音");
    }
    return navigator.mediaDevices.getUserMedia(voiceMediaConstraints);
  };

  const ensureVoiceInputStream = async () => {
    const standby = voiceStandbyStreamRef.current;
    if (standby && standby.getTracks().some((track) => track.readyState === "live")) {
      voiceStandbyStreamRef.current = null;
      standby.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      return standby;
    }

    if (voiceStandbyPromiseRef.current) {
      const stream = await voiceStandbyPromiseRef.current;
      voiceStandbyPromiseRef.current = null;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      return stream;
    }

    stopVoiceStandbyStream();
    return requestVoiceInputStream();
  };

  const prepareVoiceStandby = async () => {
    if (!canCaregive || voicePreparingRef.current || voiceStandbyStreamRef.current || mediaStreamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext && !window.webkitAudioContext) return;

    voicePreparingRef.current = true;
    try {
      const promise = requestVoiceInputStream();
      voiceStandbyPromiseRef.current = promise;
      const stream = await promise;
      if (voiceStandbyPromiseRef.current === promise) {
        voiceStandbyPromiseRef.current = null;
      }
      if (voicePressingRef.current) return;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      voiceStandbyStreamRef.current = stream;
      if (!voicePressingRef.current) {
        setVoiceStatus((current) => (current === "connecting" ? "idle" : current));
        setVoiceTranscript((current) => current || "语音已就绪，按住说话");
      }
    } catch (error) {
      voiceStandbyPromiseRef.current = null;
      const message = error instanceof Error ? error.message : "麦克风暂时不可用";
      setVoiceStatus("error");
      setVoiceError(message);
    } finally {
      voicePreparingRef.current = false;
    }
  };

  const sendBufferedVoiceSamples = (flush = false) => {
    const samplesPerChunk = 1600;
    const controller = asrControllerRef.current;
    const buffer = voiceSampleBufferRef.current;
    if (!controller) {
      buffer.length = 0;
      return;
    }

    while (buffer.length >= samplesPerChunk || (flush && buffer.length > 0)) {
      const chunkLength = buffer.length >= samplesPerChunk ? samplesPerChunk : buffer.length;
      const chunk = new Float32Array(buffer.splice(0, chunkLength));
      controller.sendAudio(pcm16FromFloat32(chunk));
    }
  };

  const cleanupLocalVoiceCapture = (keepStandby = false) => {
    const processor = scriptProcessorRef.current;
    scriptProcessorRef.current = null;
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }

    const source = audioSourceRef.current;
    audioSourceRef.current = null;
    source?.disconnect();

    const gain = silentGainRef.current;
    silentGainRef.current = null;
    gain?.disconnect();

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      if (keepStandby) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        voiceStandbyStreamRef.current = stream;
      } else {
        stream.getTracks().forEach((track) => track.stop());
      }
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }

    setIsListening(false);
    setVoiceLevel(0);
  };

  const finishVoiceStream = () => {
    sendBufferedVoiceSamples(true);
    const controller = asrControllerRef.current;
    if (!controller || voiceEndedRef.current) return;
    voiceEndedRef.current = true;
    controller.end();
    setVoiceStatus("processing");
  };

  const clearVoicePointerTracking = () => {
    voicePointerCleanupRef.current?.();
    voicePointerCleanupRef.current = null;
    voicePointerRef.current = null;
    setVoiceCancelArmed(false);
  };

  const stopVoiceCapture = (autoSubmit = false, keepStandby = true) => {
    clearVoicePointerTracking();
    voicePressingRef.current = false;
    if (autoSubmit) {
      hapticSelection();
      voiceAutoSubmitRef.current = true;
      scheduleVoiceAutoSubmit(1200);
    }
    voiceShouldStopRef.current = true;
    cleanupLocalVoiceCapture(keepStandby);
    finishVoiceStream();
  };

  const cancelVoiceCapture = () => {
    clearVoicePointerTracking();
    voicePressingRef.current = false;
    voiceSessionRef.current += 1;
    voiceShouldStopRef.current = true;
    voiceEndedRef.current = true;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    const baseText = voiceBaseTextRef.current;
    inputValueRef.current = baseText;
    setInput(baseText);
    setVoiceTranscript("");
    setVoiceError("");
    cleanupLocalVoiceCapture(true);
    asrControllerRef.current?.close();
    asrControllerRef.current = null;
    setVoiceStatus("idle");
  };

  const startVoiceCapture = async () => {
    if (!canCaregive || isSubmitting || isListening) return;
    hapticMedium();

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境无法访问麦克风");
      hapticWarning();
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境不支持实时音频采集");
      hapticWarning();
      return;
    }

    setVoiceTranscript("");
    setVoiceError("");
    setVoiceLevel(0);
    setVoiceStatus("connecting");

    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    voiceShouldStopRef.current = false;
    voiceEndedRef.current = false;
    voiceAsrReadyRef.current = false;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    voiceBaseTextRef.current = inputValueRef.current.trim();
    voiceSampleBufferRef.current = [];

    const controller = runAsrStream({
      onReady: () => {
        if (voiceSessionRef.current !== sessionId) return;
        voiceAsrReadyRef.current = true;
        if (mediaStreamRef.current) {
          setVoiceStatus("listening");
        }
      },
      onPartial: (text) => {
        if (voiceSessionRef.current !== sessionId) return;
        const merged = mergeVoiceText(voiceBaseTextRef.current, text);
        setVoiceTranscript(text);
        inputValueRef.current = merged;
        setInput(merged);
      },
      onFinal: (text) => {
        if (voiceSessionRef.current !== sessionId) return;
        const merged = mergeVoiceText(voiceBaseTextRef.current, text);
        setVoiceTranscript(text);
        inputValueRef.current = merged;
        setInput(merged);
        if (voiceEndedRef.current) {
          setVoiceStatus("idle");
          asrControllerRef.current?.close();
          asrControllerRef.current = null;
          scheduleVoiceAutoSubmit(0);
        }
      },
      onError: (message) => {
        if (voiceSessionRef.current !== sessionId) return;
        voiceShouldStopRef.current = true;
        voiceAutoSubmitRef.current = false;
        clearVoiceAutoSubmitTimer();
        setVoiceError(message);
        setVoiceStatus("error");
        cleanupLocalVoiceCapture();
        asrControllerRef.current?.close();
        asrControllerRef.current = null;
        hapticWarning();
      },
      onClose: () => {
        if (voiceSessionRef.current !== sessionId) return;
        cleanupLocalVoiceCapture();
        asrControllerRef.current = null;
        setVoiceStatus((current) => (current === "error" || current === "unsupported" ? current : "idle"));
        scheduleVoiceAutoSubmit(0);
      },
    });
    asrControllerRef.current = controller;

    let capturedStream: MediaStream | null = null;
    try {
      capturedStream = await ensureVoiceInputStream();

      if (voiceSessionRef.current !== sessionId || voiceShouldStopRef.current) {
        capturedStream.getTracks().forEach((track) => track.stop());
        finishVoiceStream();
        return;
      }

      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      if (voiceSessionRef.current !== sessionId || voiceShouldStopRef.current) {
        capturedStream.getTracks().forEach((track) => track.stop());
        void audioContext.close().catch(() => undefined);
        finishVoiceStream();
        return;
      }

      const source = audioContext.createMediaStreamSource(capturedStream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      const gain = audioContext.createGain();
      gain.gain.value = 0;

      mediaStreamRef.current = capturedStream;
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      scriptProcessorRef.current = processor;
      silentGainRef.current = gain;

      processor.onaudioprocess = (event) => {
        if (voiceShouldStopRef.current || voiceSessionRef.current !== sessionId) return;
        const samples = event.inputBuffer.getChannelData(0);
        setVoiceLevel((current) => current * 0.55 + rmsLevel(samples) * 0.45);

        const downsampled = downsampleAudio(samples, audioContext.sampleRate, 16000);
        voiceSampleBufferRef.current.push(...downsampled);
        sendBufferedVoiceSamples(false);
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);
      setIsListening(true);
      setVoiceStatus(voiceAsrReadyRef.current ? "listening" : "connecting");
    } catch (error) {
      capturedStream?.getTracks().forEach((track) => track.stop());
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请在系统设置中允许录音"
          : error instanceof Error
            ? error.message
          : "无法启动麦克风，请稍后再试";
      setVoiceError(message);
      setVoiceStatus("error");
      cleanupLocalVoiceCapture();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
      hapticWarning();
    }
  };

  const finishVoicePress = () => {
    const pointer = voicePointerRef.current;
    if (!pointer) return;
    if (pointer.canceling) {
      cancelVoiceCapture();
      return;
    }
    stopVoiceCapture(true);
  };

  const cancelVoicePress = () => {
    if (!voicePointerRef.current && !voicePressingRef.current) return;
    cancelVoiceCapture();
  };

  const startVoicePress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canUseComposerInput || voicePointerRef.current) return;
    event.preventDefault();
    const button = event.currentTarget;
    const pointerId = event.pointerId;
    voiceBaseTextRef.current = inputValueRef.current.trim();
    voicePointerRef.current = { pointerId, startY: event.clientY, canceling: false };
    setVoiceCancelArmed(false);

    const finishFromWindow = (pointerEvent: PointerEvent) => {
      if (voicePointerRef.current?.pointerId !== pointerEvent.pointerId) return;
      pointerEvent.preventDefault();
      finishVoicePress();
    };
    const updateCancelFromWindow = (pointerEvent: PointerEvent) => {
      const pointer = voicePointerRef.current;
      if (!pointer || pointer.pointerId !== pointerEvent.pointerId) return;
      const canceling = pointerEvent.clientY <= pointer.startY - VOICE_CANCEL_DISTANCE_PX;
      if (pointer.canceling === canceling) return;
      voicePointerRef.current = { ...pointer, canceling };
      setVoiceCancelArmed(canceling);
      if (canceling) hapticSelection();
    };
    const cancelFromWindow = (pointerEvent: PointerEvent) => {
      if (voicePointerRef.current?.pointerId !== pointerEvent.pointerId) return;
      cancelVoicePress();
    };
    const cancelOnBlur = () => cancelVoicePress();

    window.addEventListener("pointerup", finishFromWindow, true);
    window.addEventListener("pointermove", updateCancelFromWindow, true);
    window.addEventListener("pointercancel", cancelFromWindow, true);
    window.addEventListener("blur", cancelOnBlur);
    voicePointerCleanupRef.current = () => {
      window.removeEventListener("pointerup", finishFromWindow, true);
      window.removeEventListener("pointermove", updateCancelFromWindow, true);
      window.removeEventListener("pointercancel", cancelFromWindow, true);
      window.removeEventListener("blur", cancelOnBlur);
    };

    try {
      button.setPointerCapture(pointerId);
    } catch {
      // Some WebViews reject pointer capture during long-press gestures; the window listeners keep the press stable.
    }
    voicePressingRef.current = true;
    void startVoiceCapture();
  };

  const releaseVoicePress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (voicePointerRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released when the native view cancels a gesture.
    }
    finishVoicePress();
  };

  const cancelVoicePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (voicePointerRef.current?.pointerId !== event.pointerId) return;
    cancelVoicePress();
  };

  useEffect(
    () => () => {
      voiceSessionRef.current += 1;
      voiceShouldStopRef.current = true;
      voiceAutoSubmitRef.current = false;
      voicePressingRef.current = false;
      clearVoicePointerTracking();
      clearVoiceAutoSubmitTimer();
      cleanupLocalVoiceCapture();
      stopVoiceStandbyStream();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
    },
    [],
  );

  const toggleComposerMode = () => {
    if (!canCaregive || !canUseComposerInput) return;
    if (composerMode === "voice") {
      stopVoiceCapture(false, false);
      stopVoiceStandbyStream();
      setComposerMode("keyboard");
      return;
    }

    setComposerMode("voice");
    setVoiceStatus("idle");
    setVoiceTranscript("");
    setVoiceError("");
    void prepareVoiceStandby();
  };

  const submitComposerMessage = async (
    textOverride?: string,
    options: { skipVoiceStop?: boolean } = {},
  ) => {
    const text = (textOverride ?? inputValueRef.current).trim();
    if (!canCaregive) return;
    if ((!text && attachments.length === 0) || isSubmittingRef.current || isUploadingChatMedia) return;
    hapticLight();

    const submittedAttachments = attachments;
    const agentModel = resolveAgentModelForMessage(text, submittedAttachments);
    const agentThinkingEnabled = resolveThinkingForMessage(text, submittedAttachments);
    const agentLowLatencyEnabled = resolveLowLatencyForMessage(agentModel, submittedAttachments);
    const parentMessage: ChatMessage = {
      id: makeId("msg"),
      role: "parent",
      text: text || "上传了新的成长素材",
      createdAt: new Date().toISOString(),
      attachments: submittedAttachments,
    };
    const albumDecisions = submittedAttachments.map((attachment) => decideAlbumMedia(parentMessage, attachment));
    // 自动收藏：用户发到聊天的生活照/视频，发送瞬间就乐观进相册（不等 AI、不需手动点）。
    const autoSavedAttachmentIds = new Set<string>();
    albumDecisions
      .filter((decision) => decision.mode === "auto_save")
      .forEach((decision) => {
        const attachment = submittedAttachments.find((item) => item.id === decision.attachmentId);
        if (!attachment) return;
        const albumItem = albumItemFromDecision(decision, parentMessage, attachment);
        autoSavedAttachmentIds.add(decision.attachmentId);
        setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
        void persistAlbumItemOptimistic(albumItem).catch(() => undefined);
      });
    // 只有"还不确定"的素材才保留确认卡片
    let albumPrompts = albumDecisions
      .filter((decision) => decision.mode === "ask")
      .map(albumPromptFromDecision);
    const ignoredScreenshotDecision = albumDecisions.find(
      (decision) => decision.mode === "ignore" && decision.tags.includes("截图"),
    );
    const pendingAiMessage: ChatMessage = {
      id: makeId("msg"),
      role: "ai",
      text: "思考中",
      createdAt: new Date().toISOString(),
      tags: [agentThinkingEnabled ? "深度思考" : "处理中"],
      reasoning: "",
      isStreaming: true,
      toolActivities: [],
    };

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    if (!options.skipVoiceStop) stopVoiceCapture();
    inputValueRef.current = "";
    setInput("");
    setVoiceTranscript("");
    setAttachments([]);
    setMessages((current) => [...current, parentMessage, pendingAiMessage]);

    let toolActivities: ToolActivity[] = [];
    try {
      const agentSourceAttachments = submittedAttachments;
      const visualAttachmentCount = agentSourceAttachments.filter(isVisualAttachment).length;
      const agentAttachments = await Promise.all(
        agentSourceAttachments.map(async (item) => ({
          id: item.id,
          name: item.kind === "video" ? `${item.name}（视频缩略图）` : item.name,
          kind: item.kind,
          dataUrl: await readAgentAttachmentDataUrl(item, visualAttachmentCount),
        })),
      );
      let reasoningText = "";
      let contentText = "";
      const agentResponse = await runAgentChatStream(
        {
          message: parentMessage.text,
          model: agentModel,
          babyProfile: babyProfileForAgent(profile),
          recentMessages: messages.slice(-12).map((message) => ({
            ...message,
            attachments: message.attachments?.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              kind: attachment.kind,
            })),
          })),
          careLogs: careLogs.slice(-10),
          memories: memories.slice(0, 10),
          pageContext: buildAgentPageContext(),
          thinkingEnabled: agentThinkingEnabled,
          lowLatencyEnabled: agentLowLatencyEnabled,
          attachments: agentAttachments,
        },
        {
          onReasoning: (delta) => {
            reasoningText += delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? { ...message, reasoning: reasoningText, text: "思考中" }
                  : message,
              ),
            );
          },
          onContent: (delta) => {
            contentText += delta;
            const preview = extractAiTextPreview(contentText);
            if (!preview) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? { ...message, text: preview, tags: ["生成中"], reasoning: reasoningText }
                  : message,
              ),
            );
          },
          onTool: (activity) => {
            toolActivities = upsertToolActivity(toolActivities, activity);
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? {
                      ...message,
                      toolActivities,
                      text: contentText ? message.text : activity.message,
                      tags: activity.status === "running" ? [isAgentProgressActivity(activity) ? "处理中" : "查询中"] : message.tags,
                    }
                  : message,
              ),
            );
          },
          onStatus: (status) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id && !contentText
                  ? { ...message, text: status.message, tags: [agentStatusTag(status.type)] }
                  : message,
              ),
            );
          },
        },
      );
      const result = normalizeAgentResponse(
        suppressImageOnlyCareEffects(agentResponse, parentMessage.text, submittedAttachments, albumDecisions),
        parentMessage.text,
      );
      let aiText =
        ignoredScreenshotDecision && !/不会保存到.*相册|不.*保存.*相册/.test(result.aiText)
          ? `${result.aiText}\n\n这看起来是 App、网页或聊天截图，不会保存到成长相册。`
          : result.aiText;
      const serverAlbumDecisions = result.effectDecisions.filter((decision) => decision.type === "albumItem");
      const hasServerDecisions = serverAlbumDecisions.length > 0;
      let albumEffectMissingTarget = false;

      if (hasServerDecisions) {
        const albumEffectCandidates = [...messages, parentMessage];
        serverAlbumDecisions.forEach((decision) => {
          if (decision.mode === "ignore") return;
          const target = resolveAlbumEffectTarget(decision, albumEffectCandidates);
          if (!target) {
            albumEffectMissingTarget = true;
            return;
          }
          if (autoSavedAttachmentIds.has(target.attachment.id)) return; // 已自动进相册，不再弹确认卡
          const prompt = albumPromptFromEffectDecision(decision, target.message, target.attachment);
          if (!albumPrompts.some((item) => item.sourceMessageId === prompt.sourceMessageId && item.attachmentId === prompt.attachmentId)) {
            albumPrompts = [...albumPrompts, prompt];
          }
        });
      }

      if (albumEffectMissingTarget) {
        aiText = `${aiText}\n\n我没有找到要保存的照片或视频，可以重新发一下素材再告诉我保存到相册。`;
      } else if (albumPrompts.some((prompt) => prompt.status === "pending") && !/点.*保存到相册|确认.*保存到相册|保存到相册.*确认/.test(aiText)) {
        aiText = `${aiText}\n\n我会等你点「保存到相册」后再收藏这段素材。`;
      }
      if (autoSavedAttachmentIds.size > 0 && !/相册/.test(aiText)) {
        aiText = `${aiText}\n\n照片已经放进成长相册啦，不想留的可以在相册里删掉。`;
      }

      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: aiText,
        createdAt: new Date().toISOString(),
        tags: result.tags,
        reasoning: reasoningText,
        isStreaming: false,
        toolActivities,
        sources: result.sources,
        safetyAlerts: result.safetyAlerts,
        effectDecisions: result.effectDecisions,
        albumPrompts,
      };

      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      const persistenceTasks: Array<() => Promise<unknown>> = [
        () => persistRecord("messages", parentMessage.id, messageForStorage(parentMessage)),
        () => persistRecord("messages", aiMessage.id, messageForStorage(aiMessage)),
      ];
      try {
        for (const task of persistenceTasks) {
          await task();
        }
        const refreshedState = await readAppState();
        applyStateResponse(refreshedState);
        void runConversationCompression();
      } catch {
        // Local state stays usable; the status chip tells the parent that the backend sync needs attention.
      }
    } catch (error) {
      if (error instanceof AgentApiError && error.code === "PRO_QUOTA_EXCEEDED") {
        showSystemWeakNotice(error.message, "info", 3600);
        void applyForProTrial("ai-quota-exhausted");
      }
      const failedActivities = failedRunningActivities(toolActivities);
      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: formatAgentFailureMessage(error, submittedAttachments),
        createdAt: new Date().toISOString(),
        tags: ["系统"],
        isStreaming: false,
        toolActivities: failedActivities,
      };
      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      hapticWarning();
      try {
        await persistRecord("messages", parentMessage.id, messageForStorage(parentMessage));
        await persistRecord("messages", aiMessage.id, messageForStorage(aiMessage));
      } catch {
        // Keep the visible error message even if the backend is unreachable.
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };
  submitComposerMessageRef.current = submitComposerMessage;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitComposerMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const openNewReminderEditor = () => {
    if (!canCaregive) return;
    setEditingReminderId("");
    setReminderDraft(createReminderDraft());
    setReminderEditorOpen(true);
  };

  const openReminderQuickDraft = (action: (typeof REMINDER_QUICK_ACTIONS)[number]) => {
    if (!canCaregive) return;
    const draft = createReminderDraft();
    const nextDraft: ReminderDraft = {
      ...draft,
      title: withBabyNickname(action.prompt)
        .replace(/提醒我|帮我设置一个|：/g, "")
        .trim()
        .slice(0, 24) || action.label,
    };
    if (action.label === "疫苗") {
      nextDraft.title = `带${babyNickname}去社区医院打疫苗`;
      nextDraft.category = "vaccine";
    } else if (action.label === "体检") {
      nextDraft.title = `带${babyNickname}去做体检`;
      nextDraft.category = "routine";
    } else if (action.label === "洗澡") {
      nextDraft.title = `给${babyNickname}洗澡`;
      nextDraft.category = "care";
      nextDraft.dueTime = "20:00";
    } else if (action.label === "喂奶闹钟") {
      nextDraft.title = "喂奶提醒";
      nextDraft.category = "care";
      nextDraft.scheduleMode = "interval";
      nextDraft.alertMode = "ringing";
      nextDraft.intervalMinutes = "180";
    } else if (action.label === "喂药") {
      nextDraft.title = `给${babyNickname}喂药`;
      nextDraft.category = "care";
    } else if (action.label === "复诊") {
      nextDraft.title = `带${babyNickname}去复诊`;
      nextDraft.category = "routine";
    } else if (action.label === "自定义") {
      nextDraft.title = "";
      nextDraft.category = "custom";
    }
    setEditingReminderId("");
    setReminderDraft(nextDraft);
    setReminderEditorOpen(true);
  };

  const openEditReminderEditor = (reminder: Reminder) => {
    if (!canCaregive) return;
    setEditingReminderId(reminder.id);
    setReminderDraft(reminderDraftFromReminder(reminder));
    setReminderEditorOpen(true);
  };

  const closeReminderEditor = () => {
    setReminderEditorOpen(false);
    setEditingReminderId("");
    setReminderDraft(createReminderDraft());
  };

  const saveReminderDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    if (reminderDraft.scheduleMode === "once" && (!reminderDraft.dueDate || !reminderDraft.dueTime)) {
      window.alert("请选择提醒日期和时间。");
      return;
    }
    if (reminderDraft.scheduleMode === "interval") {
      const intervalMinutes = Number(reminderDraft.intervalMinutes);
      if (!Number.isFinite(intervalMinutes) || intervalMinutes < MIN_INTERVAL_MINUTES || intervalMinutes > MAX_INTERVAL_MINUTES) {
        window.alert(`循环间隔需要在 ${formatIntervalText(MIN_INTERVAL_MINUTES)} 到 ${formatIntervalText(MAX_INTERVAL_MINUTES)} 之间。`);
        return;
      }
    }

    const existing = editingReminderId ? reminders.find((item) => item.id === editingReminderId) : undefined;
    if (existing) await cancelNativeReminder(existing);
    const baseReminder = reminderFromDraft(reminderDraft, existing);
    const [scheduledReminder] = await scheduleNativeReminders([baseReminder], { careLogs });
    const nextReminder = scheduledReminder ?? baseReminder;
    setReminders((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      byId.set(nextReminder.id, nextReminder);
      return Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
    });
    try {
      await persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true });
      closeReminderEditor();
    } catch {
      setStorageStatus("offline");
      closeReminderEditor();
    }
  };

  const completeReminder = async (target: Reminder) => {
    if (!canCaregive) return;
    await cancelNativeReminder(target);
    if (isIntervalReminder(target) && target.repeatRule) {
      const completedAt = new Date();
      const nextDueAt = new Date(completedAt.getTime() + target.repeatRule.intervalMinutes * 60 * 1000);
      const baseReminder: Reminder = addReminderHistory(
        {
          ...target,
          status: "open",
          dueAt: nextDueAt.toISOString(),
          dueText: formatReminderDueText(nextDueAt),
          lastAnchorEventId: target.lastAnchorEventId ?? (isIntervalMilkReminder(target) ? latestMilkAnchor?.id : undefined),
          lastAnchorAt: target.lastAnchorAt ?? (isIntervalMilkReminder(target) ? latestMilkAnchor?.occurredAt.toISOString() : undefined) ?? completedAt.toISOString(),
          notificationStatus: "pending",
          notificationError: undefined,
        },
        `${new Intl.DateTimeFormat("zh-CN").format(completedAt)} 已完成本次，按完成时间顺延下一次`,
      );
      const [scheduledReminder] = await scheduleNativeReminders([baseReminder], { careLogs: [], anchorInterval: false });
      const nextReminder = scheduledReminder ?? baseReminder;
      setReminders((current) => current.map((item) => (item.id === target.id ? nextReminder : item)));
      void persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
      return;
    }
    const nextReminder: Reminder = {
      ...target,
      status: "done",
      notificationStatus: target.notificationStatus === "scheduled" ? "cancelled" : target.notificationStatus,
      history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 已完成`, ...target.history],
    };
    setReminders((current) =>
      current.map((item) => (item.id === target.id ? nextReminder : item)),
    );
    void persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
  };

  const requestCompleteReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setCompleteReminderTarget(target);
  };

  const closeCompleteReminderConfirm = () => {
    setCompleteReminderTarget(null);
  };

  const confirmCompleteReminder = async () => {
    if (!canCaregive || !completeReminderTarget) return;
    const target = completeReminderTarget;
    setCompleteReminderTarget(null);
    await completeReminder(target);
  };

  const closeRingingReminder = async () => {
    if (!ringingReminder) return;
    const target = ringingReminder;
    setRingingReminder(null);
    await completeReminder(target);
  };

  const requestPostponeReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setPostponeReminderDraft(reminderPostponeDraftFromReminder(target));
    setPostponeReminderTarget(target);
  };

  const closePostponeReminderConfirm = () => {
    setPostponeReminderTarget(null);
  };

  const postponeReminder = async (target: Reminder, postponedAt: Date) => {
    if (!canCaregive) return;
    await cancelNativeReminder(target);
    const baseReminder: Reminder = {
      ...target,
      status: "open",
      dueAt: postponedAt.toISOString(),
      dueText: formatReminderDueText(postponedAt),
      notificationStatus: "pending",
      notificationError: undefined,
      history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 延后到 ${formatReminderDueText(postponedAt)}`, ...target.history],
    };
    const [scheduledReminder] = await scheduleNativeReminders([baseReminder], {
      careLogs: target.scheduleMode === "interval" ? [] : careLogs,
      anchorInterval: target.scheduleMode !== "interval",
    });
    const nextReminder = scheduledReminder ?? baseReminder;
    setReminders((current) => current.map((item) => (item.id === target.id ? nextReminder : item)));
    void persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
  };

  const confirmPostponeReminder = async () => {
    if (!canCaregive || !postponeReminderTarget) return;
    const postponedAt = dateFromReminderPostponeDraft(postponeReminderDraft);
    if (!postponedAt || postponedAt.getTime() <= Date.now()) {
      window.alert("请选择晚于现在的提醒时间。");
      return;
    }
    const target = postponeReminderTarget;
    setPostponeReminderTarget(null);
    await postponeReminder(target, postponedAt);
  };

  const requestDeleteReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setDeleteReminderTarget(target);
  };

  const closeDeleteReminderConfirm = () => {
    setDeleteReminderTarget(null);
  };

  const confirmDeleteReminder = async () => {
    if (!canCaregive || !deleteReminderTarget) return;
    const target = deleteReminderTarget;
    setDeleteReminderTarget(null);
    await cancelNativeReminder(target);
    setReminders((current) => current.filter((item) => item.id !== target.id));
    void deleteAppRecord("reminders", target.id).catch(() => setStorageStatus("offline"));
  };

  const openNewExpenseEditor = () => {
    if (!canCaregive) return;
    setEditingExpenseId("");
    setExpenseDraft(createExpenseDraft(todayDate));
    setExpenseEditorOpen(true);
  };

  const openEditExpenseEditor = (expense: ExpenseItem) => {
    if (!canCaregive) return;
    setEditingExpenseId(expense.id);
    setExpenseDraft(expenseDraftFromExpense(expense));
    setExpenseEditorOpen(true);
  };

  const closeExpenseEditor = () => {
    setExpenseEditorOpen(false);
    setEditingExpenseId("");
    setExpenseDraft(createExpenseDraft(todayDate));
  };

  const saveExpenseDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const amount = Number(expenseDraft.amount);
    if (!expenseDraft.title.trim()) {
      window.alert("请填写商品名或用途。");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("请填写实际支付金额。");
      return;
    }
    const existing = editingExpenseId ? expenses.find((item) => item.id === editingExpenseId) : undefined;
    if (existing) {
      const delta = Math.abs(amount - existing.amount);
      const needsConfirm = amount >= 1000 || (existing.amount > 0 && delta / existing.amount >= 0.5 && delta >= 100);
      if (needsConfirm && !window.confirm(`确认把「${existing.title}」的金额改为 ${formatMoney(amount)} 吗？`)) return;
    }
    const nextExpense = expenseFromDraft(expenseDraft, existing);
    setExpenses((current) => {
      const withoutCurrent = current.filter((item) => item.id !== nextExpense.id);
      return [nextExpense, ...withoutCurrent].sort((left, right) =>
        `${right.date}-${right.updatedAt}`.localeCompare(`${left.date}-${left.updatedAt}`),
      );
    });
    try {
      await persistRecord("expenses", nextExpense.id, expenseForStorage(nextExpense), { applyResponse: true, mode: "replace" });
      closeExpenseEditor();
    } catch {
      setStorageStatus("offline");
      closeExpenseEditor();
    }
  };

  const requestDeleteExpense = (expense: ExpenseItem) => {
    if (!canCaregive) return;
    setDeleteExpenseTarget(expense);
  };

  const closeDeleteExpenseConfirm = () => {
    setDeleteExpenseTarget(null);
  };

  const confirmDeleteExpense = async () => {
    if (!canCaregive || !deleteExpenseTarget) return;
    const target = deleteExpenseTarget;
    setDeleteExpenseTarget(null);
    setExpenses((current) => current.filter((item) => item.id !== target.id));
    try {
      await deleteAppRecord("expenses", target.id);
    } catch {
      setStorageStatus("offline");
    }
  };

  const exitExpenseBulkMode = useCallback(() => {
    setExpenseBulkMode(false);
    setSelectedExpenseIds(new Set());
  }, []);

  const toggleExpenseBulkMode = useCallback(() => {
    setExpenseBulkMode((current) => {
      if (current) setSelectedExpenseIds(new Set());
      return !current;
    });
  }, []);

  const toggleExpenseSelection = useCallback((id: string) => {
    setSelectedExpenseIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpenseMonthCollapse = useCallback((monthKey: string) => {
    setCollapsedExpenseMonths((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const requestBulkDeleteExpenses = useCallback(() => {
    if (!canCaregive || selectedExpenseIds.size === 0) return;
    setBulkDeleteExpensesOpen(true);
  }, [canCaregive, selectedExpenseIds]);

  const closeBulkDeleteExpenses = useCallback(() => {
    setBulkDeleteExpensesOpen(false);
  }, []);

  const confirmBulkDeleteExpenses = useCallback(async () => {
    if (!canCaregive || selectedExpenseIds.size === 0) return;
    const targets = Array.from(selectedExpenseIds);
    setBulkDeleteExpensesOpen(false);
    setExpenses((current) => current.filter((item) => !selectedExpenseIds.has(item.id)));
    setSelectedExpenseIds(new Set());
    setExpenseBulkMode(false);
    for (const id of targets) {
      try {
        await deleteAppRecord("expenses", id);
      } catch {
        setStorageStatus("offline");
      }
    }
  }, [canCaregive, selectedExpenseIds]);

  const openMilestones = useCallback(() => {
    setActiveMobileTab("records");
    setRecordsAssistantOpen(false);
    setMilestonesViewOpen(true);
  }, []);
  const closeMilestones = useCallback(() => setMilestonesViewOpen(false), []);
  const openGrowthEntry = useCallback(() => {
    setRecordsEntryDrawer(null);
    setRecordsAssistantOpen(false);
    setGrowthEntryOpen(true);
  }, []);
  const openReminderManagement = useCallback(() => {
    setActiveMobileTab("profile");
    setReminderManagementOpen(true);
  }, []);
  const closeReminderManagement = useCallback(() => setReminderManagementOpen(false), []);
  const resetGrowthMeasurementDraft = useCallback(() => {
    setEditingGrowthMeasurementId("");
    setGrowthMeasurementDraft({
      type: "height",
      value: "",
      date: todayISO(),
      note: "",
    });
  }, []);
  const closeGrowthEntry = useCallback(() => {
    setGrowthEntryOpen(false);
    resetGrowthMeasurementDraft();
  }, [resetGrowthMeasurementDraft]);

  const achieveMilestone = useCallback((milestone: GrowthMilestone) => {
    if (!canCaregive) return;
    const growth = normalizeGrowthEvent({
      id: makeId("growth"),
      type: "milestone",
      title: milestone.title,
      date: todayISO(),
      summary: milestone.hint,
      firstTime: true,
      tags: [milestoneTag(milestone.id)],
    }, 0);
    setGrowthEvents((current) => [...current, growth]);
    void persistRecord("growthEvents", growth.id, growth).catch(() => setStorageStatus("offline"));
    hapticSuccess();
  }, [canCaregive]);

  const handleAddGrowthMeasurement = (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const meta = GROWTH_MEASUREMENT_META[growthMeasurementDraft.type];
    const numericValue = Number(growthMeasurementDraft.value);
    if (!Number.isFinite(numericValue) || numericValue < meta.min || numericValue > meta.max) {
      showSystemWeakNotice(`请输入 ${meta.min}-${meta.max}${meta.unit} 之间的${meta.label}。`, "warning");
      return;
    }
    const existingMeasurement = editingGrowthMeasurementId
      ? growthMeasurements.find((item) => item.id === editingGrowthMeasurementId)
      : undefined;
    const measurement = normalizeGrowthMeasurement(
      {
        ...existingMeasurement,
        id: editingGrowthMeasurementId || makeId("growth-measurement"),
        type: growthMeasurementDraft.type,
        value: numericValue,
        date: growthMeasurementDraft.date || todayISO(),
        note: growthMeasurementDraft.note.trim() || undefined,
      },
      0,
    );
    setGrowthMeasurements((current) => {
      if (!editingGrowthMeasurementId) return [...current, measurement];
      let updated = false;
      const next = current.map((item) => {
        if (item.id !== editingGrowthMeasurementId) return item;
        updated = true;
        return measurement;
      });
      return updated ? next : [...next, measurement];
    });
    void persistRecord("growthMeasurements", measurement.id, measurement).catch(() => setStorageStatus("offline"));
    if (editingGrowthMeasurementId) {
      resetGrowthMeasurementDraft();
    } else {
      setGrowthMeasurementDraft((current) => ({ ...current, value: "", note: "" }));
    }
    hapticSuccess();
  };

  const handleEditGrowthMeasurement = (measurement: GrowthMeasurement) => {
    if (!canCaregive) return;
    setEditingGrowthMeasurementId(measurement.id);
    setGrowthMeasurementDraft({
      type: measurement.type,
      value: String(measurement.value),
      date: measurement.date || todayISO(),
      note: measurement.note ?? "",
    });
  };

  const handleDeleteGrowthMeasurement = (id: string) => {
    if (!canCaregive) return;
    if (editingGrowthMeasurementId === id) resetGrowthMeasurementDraft();
    setGrowthMeasurements((current) => current.filter((item) => item.id !== id));
    void deleteAppRecord("growthMeasurements", id).catch(() => setStorageStatus("offline"));
  };

  const editAlbumItem = (item: AlbumItem) => {
    if (!canCaregive) return;
    const title = window.prompt("给这段回忆起个名字", item.title);
    if (title === null) return;
    const tags = window.prompt("标签，用顿号或逗号分隔", item.tags.join("、"));
    if (tags === null) return;
    const nextItem = normalizeAlbumItem(
      {
        ...item,
        title: title.trim() || item.title,
        tags: splitListText(tags),
        source: "manual",
      },
      0,
    );
    setAlbumItems((current) => dedupeAlbumItems([nextItem, ...current.filter((entry) => entry.id !== nextItem.id)]));
    setPreviewAlbumItem((current) => (current?.id === nextItem.id ? nextItem : current));
    void persistAlbumItemOptimistic(nextItem).catch(() => undefined);
  };

  const removeAlbumItem = async (item: AlbumItem) => {
    if (!canCaregive) return;
    const confirmed = window.confirm(`删除「${item.title}」？\n\n会同时删除云端/本地存储里的原始素材和缩略图。`);
    if (!confirmed) return;
    const attachmentId = item.attachmentId || item.attachment?.id || "";
    setAlbumItems((current) =>
      current.filter((entry) => entry.id !== item.id && (!attachmentId || entry.attachmentId !== attachmentId)),
    );
    setPreviewAlbumItem((current) => (current?.id === item.id ? null : current));
    if (attachmentId) {
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      setPreviewAttachment((current) => (current?.id === attachmentId ? null : current));
      setPreviewAlbumItem((current) => (current?.id === item.id || current?.attachmentId === attachmentId ? null : current));
    }
    try {
      if (attachmentId) {
        const response = await deleteAttachment(attachmentId);
        applyStateResponse(response);
      } else {
        const response = await deleteAppRecord("albumItems", item.id);
        applyStateResponse(response);
      }
    } catch (error) {
      setStorageStatus("offline");
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: error instanceof Error ? `素材删除失败：${error.message}` : "素材删除失败，请稍后再试。",
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
  };

  const updateAlbumPromptStatus = (messageId: string, promptId: string, status: AlbumPrompt["status"]) => {
    const nextMessages = messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            albumPrompts: (message.albumPrompts ?? []).map((prompt) =>
              prompt.id === promptId ? { ...prompt, status } : prompt,
            ),
          }
        : message,
    );
    const updatedMessage = nextMessages.find((message) => message.id === messageId);
    setMessages(nextMessages);
    if (updatedMessage) {
      void persistRecord("messages", updatedMessage.id, messageForStorage(updatedMessage)).catch(() => setStorageStatus("offline"));
    }
  };

  const saveAlbumPrompt = async (messageId: string, prompt: AlbumPrompt) => {
    if (!canCaregive) return;
    const sourceMessage = messages.find((message) => message.id === prompt.sourceMessageId);
    const attachment = sourceMessage?.attachments?.find((item) => item.id === prompt.attachmentId);
    if (!sourceMessage || !attachment) {
      updateAlbumPromptStatus(messageId, prompt.id, "ignored");
      return;
    }
    const albumItem = albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment);
    setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
    try {
      await persistAlbumItemOptimistic(albumItem);
      updateAlbumPromptStatus(messageId, prompt.id, "saved");
      hapticSuccess();
    } catch (error) {
      // This manual save intentionally rolls back on failure (with a visible
      // notice), so drop the pending guard for the item we are removing.
      pendingPersistAlbumIdsRef.current.delete(albumItem.id);
      setAlbumItems((current) => current.filter((item) => item.id !== albumItem.id));
      setStorageStatus("offline");
      showSystemWeakNotice(
        error instanceof Error ? `保存到相册失败：${error.message}` : "保存到相册失败，请稍后再试",
        "warning",
        3600,
      );
    }
  };

  const ignoreAlbumPrompt = (messageId: string, prompt: AlbumPrompt) => {
    updateAlbumPromptStatus(messageId, prompt.id, "ignored");
  };

  const confirmPendingEffect = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    if (confirmingPendingEffectIds.includes(effect.id)) return;
    setConfirmingPendingEffectIds((current) => (current.includes(effect.id) ? current : [...current, effect.id]));
    try {
      const response = await confirmPendingEffectOnServer(effect.id);
      applyAppSnapshot(response.state);
      const reminders = effect.reminders ?? [];
      if (reminders.length) {
        const scheduledReminders = await scheduleNativeReminders(reminders, { careLogs });
        for (const reminder of scheduledReminders) {
          await persistRecord("reminders", reminder.id, reminder, { applyResponse: true });
        }
      }
      setEditingPendingId("");
      setPendingDraft(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "确认记录失败，请稍后再试。");
    } finally {
      setConfirmingPendingEffectIds((current) => current.filter((id) => id !== effect.id));
    }
  };

  const discardPendingEffect = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    try {
      const response = await discardPendingEffectOnServer(effect.id);
      applyAppSnapshot(response.state);
      setEditingPendingId("");
      setPendingDraft(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "丢弃记录失败，请稍后再试。");
    }
  };

  const beginEditPendingEffect = (effect: PendingEffect) => {
    if (!canCaregive) return;
    setEditingPendingId(effect.id);
    setPendingDraft(pendingDraftFromEffect(effect));
  };

  const savePendingEffectDraft = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    if (!pendingDraft) {
      setEditingPendingId("");
      return;
    }
    const nextEffect: PendingEffect = {
      ...effect,
      growthEvent: growthEventFromPendingDraft(effect, pendingDraft.growthEvent),
      growthMeasurements: growthMeasurementsFromPendingDraft(effect, pendingDraft),
      careLogPatch: careLogPatchFromPendingDraft(effect, pendingDraft.careLogPatch),
      reminders: remindersFromPendingDraft(effect, pendingDraft),
      memories: memoriesFromPendingDraft(effect, pendingDraft),
      expenses: expensesFromPendingDraft(effect, pendingDraft),
    };
    setPendingEffects((current) =>
      current.map((item) => (item.id === effect.id ? nextEffect : item)),
    );
    try {
      await persistRecord("pendingEffects", nextEffect.id, nextEffect);
      setEditingPendingId("");
      setPendingDraft(null);
    } catch {
      window.alert("保存待确认内容失败，请稍后再试。");
    }
  };

  const updatePendingGrowthDraft = (patch: Partial<PendingGrowthDraft>) => {
    setPendingDraft((current) =>
      current?.growthEvent ? { ...current, growthEvent: { ...current.growthEvent, ...patch } } : current,
    );
  };

  const updatePendingGrowthMeasurementDraft = (id: string, patch: Partial<PendingGrowthMeasurementDraft>) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            growthMeasurements: current.growthMeasurements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          }
        : current,
    );
  };

  const updatePendingCareDraft = (patch: Partial<PendingCareDraft>) => {
    setPendingDraft((current) =>
      current?.careLogPatch ? { ...current, careLogPatch: { ...current.careLogPatch, ...patch } } : current,
    );
  };

  const updatePendingReminderDraft = (id: string, updater: (draft: ReminderDraft) => ReminderDraft) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            reminders: current.reminders.map((item) =>
              item.id === id ? { ...item, draft: updater(item.draft) } : item,
            ),
          }
        : current,
    );
  };

  const updatePendingMemoryDraft = (id: string, text: string) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            memories: current.memories.map((item) => (item.id === id ? { ...item, text } : item)),
          }
        : current,
    );
  };

  const updatePendingExpenseDraft = (index: number, patch: Partial<ExpenseDraft>) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            expenses: current.expenses.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
          }
        : current,
    );
  };

  const selectManualRecordKind = (type: ManualRecordKind) => {
    setManualRecordKind(type);
    setCareEventDraft(createCareEventDraft(type));
  };

  const clearRecordsEntryDrawerCloseTimer = () => {
    if (recordsEntryDrawerCloseTimerRef.current === null) return;
    window.clearTimeout(recordsEntryDrawerCloseTimerRef.current);
    recordsEntryDrawerCloseTimerRef.current = null;
  };

  const closeRecordsEntryDrawer = () => {
    if (!recordsEntryDrawer) return;
    if (recordsEntryDrawerClosing) return;
    if (voiceRecordingActive) cancelVoiceCapture();
    setRecordsEntryDrawerClosing(true);
    clearRecordsEntryDrawerCloseTimer();
    recordsEntryDrawerCloseTimerRef.current = window.setTimeout(() => {
      setRecordsEntryDrawer(null);
      setRecordsEntryDrawerClosing(false);
      setRecordsAssistantOpen(false);
      recordsEntryDrawerCloseTimerRef.current = null;
    }, 220);
  };

  const openManualRecordDrawer = () => {
    if (!canCaregive) return;
    clearRecordsEntryDrawerCloseTimer();
    setRecordsEntryDrawerClosing(false);
    setRecordsAssistantOpen(false);
    setRecordsEntryDrawer("manual");
    setActiveMobileTab("records");
    setCareEventDraft(createCareEventDraft(manualRecordKind));
  };

  const updateManualCareDraft = (patch: Partial<CareEventDraft>) => {
    setCareEventDraft((current) => ({ ...current, ...patch }));
  };

  const adjustManualNumericDraft = (
    field: ManualNumericDraftKey,
    delta: number,
    fallback: number,
    min: number,
    max: number,
    decimals = 0,
  ) => {
    const currentValue = Number(careEventDraft[field]);
    const baseValue = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : fallback;
    const nextValue = Math.min(max, Math.max(min, baseValue + delta));
    updateManualCareDraft({ [field]: numericDraftText(nextValue, decimals) });
  };

  const saveManualCareEvent = (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const note = careEventDraft.note.trim();
    const amountMl = manualRecordKind === "milk" && careEventDraft.amountMl ? Number(careEventDraft.amountMl) : undefined;
    const durationHours = manualRecordKind === "sleep" && careEventDraft.durationHours ? Number(careEventDraft.durationHours) : undefined;
    const temperature = manualRecordKind === "temperature" && careEventDraft.temperature ? Number(careEventDraft.temperature) : undefined;

    if (manualRecordKind === "milk" && (typeof amountMl !== "number" || !Number.isFinite(amountMl) || amountMl <= 0)) {
      showSystemWeakNotice("请输入这次喂奶的奶量。", "warning");
      return;
    }
    if (manualRecordKind === "sleep" && (typeof durationHours !== "number" || !Number.isFinite(durationHours) || durationHours <= 0)) {
      showSystemWeakNotice("请输入这段睡眠的时长。", "warning");
      return;
    }
    if (
      manualRecordKind === "temperature" &&
      (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 34 || temperature > 42)
    ) {
      showSystemWeakNotice("请输入 34-42°C 之间的体温。", "warning");
      return;
    }
    if ((manualRecordKind === "poop" || manualRecordKind === "solid") && !note) {
      showSystemWeakNotice("请选择这次记录的状态。", "warning");
      return;
    }

    const baseLog = selectedCareLog ?? normalizeCareLog({ id: makeId("care"), date: selectedDate, solids: [], notes: [], events: [] }, 0);
    const nextCareEvent = normalizeCareLogEvent(
      {
        id: makeId("care-event"),
        type: manualRecordKind,
        date: selectedDate,
        time: careEventDraft.time || currentClockText(),
        title: canonicalCareEventTitle(manualRecordKind),
        amountMl,
        durationHours,
        temperature,
        note: note || undefined,
      },
      (baseLog.events ?? []).length,
      selectedDate,
    );
    const nextLog = careLogWithEventStats({
      ...baseLog,
      events: [...(baseLog.events ?? []), nextCareEvent],
    });

    setCareLogs((current) => {
      const hasExistingLog = current.some((item) => item.id === nextLog.id);
      return hasExistingLog ? current.map((item) => (item.id === nextLog.id ? nextLog : item)) : [...current, nextLog];
    });
    void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() => {
      setStorageStatus("offline");
    });
    setCareEventDraft(createCareEventDraft(manualRecordKind));
    closeRecordsEntryDrawer();
    hapticSuccess();
  };

  const careEventForRecord = (record: RecordEvent) => {
    const log = careLogs.find((item) => item.id === record.careLogId);
    if (!log) return undefined;
    return (
      log.events.find((item) => item.id === record.careEventId) ??
      careEventsForLog(log).find((item) => item.id === record.careEventId)
    );
  };

  const beginEditCareTimelineEvent = (record: RecordEvent) => {
    if (!canCaregive || record.type !== "care" || !record.careLogId) return;
    const event = careEventForRecord(record);
    setSwipedTimelineEventId("");
    setEditingCareEventId(record.id);
    setCareEventDraft({
      type: event?.type ?? (record.kind === "growth" || record.kind === "reminder" ? "note" : record.kind),
      time: event?.time ?? "",
      amountMl: event?.amountMl ? String(event.amountMl) : "",
      durationHours: event?.durationHours ? String(event.durationHours) : "",
      temperature: event?.temperature ? String(event.temperature) : "",
      note: event?.note ?? record.body,
    });
  };

  const saveCareTimelineEvent = (event: FormEvent, record: RecordEvent) => {
    event.preventDefault();
    if (!canCaregive || record.type !== "care" || !record.careLogId) return;
    const currentLog = careLogs.find((item) => item.id === record.careLogId);
    if (!currentLog) return;

    const nextCareEvent = normalizeCareLogEvent(
      {
        id: record.careEventId || makeId("care-event"),
        type: careEventDraft.type,
        date: currentLog.date,
        time: careEventDraft.time,
        amountMl: careEventDraft.amountMl ? Number(careEventDraft.amountMl) : undefined,
        durationHours: careEventDraft.durationHours ? Number(careEventDraft.durationHours) : undefined,
        temperature: careEventDraft.temperature ? Number(careEventDraft.temperature) : undefined,
        note: careEventDraft.note.trim() || undefined,
      },
      0,
      currentLog.date,
    );
    const hasExistingEvent = currentLog.events.some((item) => item.id === nextCareEvent.id);
    const nextLog = careLogWithEventStats({
      ...currentLog,
      events: hasExistingEvent
        ? currentLog.events.map((item) => (item.id === nextCareEvent.id ? nextCareEvent : item))
        : [...currentLog.events, nextCareEvent],
    });

    setCareLogs((current) => current.map((item) => (item.id === nextLog.id ? nextLog : item)));
    void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() => {
      setStorageStatus("offline");
    });
    setEditingCareEventId("");
    setSwipedTimelineEventId("");
  };

  const canEditTimelineEvent = (record: RecordEvent) =>
    canCaregive && record.type === "care" && Boolean(record.careLogId && record.careEventId);

  const beginTimelineEventSwipe = (event: React.PointerEvent<HTMLElement>, record: RecordEvent) => {
    if (!canEditTimelineEvent(record)) return;
    timelineSwipeStartRef.current = { id: record.id, x: event.clientX, y: event.clientY };
  };

  const finishTimelineEventSwipe = (event: React.PointerEvent<HTMLElement>, record: RecordEvent) => {
    const start = timelineSwipeStartRef.current;
    timelineSwipeStartRef.current = null;
    if (!start || start.id !== record.id || !canEditTimelineEvent(record)) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 28 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    setSwipedTimelineEventId(deltaX < 0 ? record.id : "");
  };

  const cancelTimelineEventSwipe = () => {
    timelineSwipeStartRef.current = null;
  };

  const requestDeleteCareTimelineEvent = (record: RecordEvent) => {
    if (!canEditTimelineEvent(record)) return;
    setDeleteCareEventTarget(record);
    setSwipedTimelineEventId("");
    hapticWarning();
  };

  const closeDeleteCareEventConfirm = () => {
    setDeleteCareEventTarget(null);
  };

  const confirmDeleteCareTimelineEvent = () => {
    const record = deleteCareEventTarget;
    if (!canCaregive || !record?.careLogId || !record.careEventId) {
      setDeleteCareEventTarget(null);
      return;
    }
    const currentLog = careLogs.find((item) => item.id === record.careLogId);
    if (!currentLog) {
      setDeleteCareEventTarget(null);
      return;
    }

    let didChange = false;
    const nextEvents = currentLog.events.filter((item) => {
      const keep = item.id !== record.careEventId;
      if (!keep) didChange = true;
      return keep;
    });
    const noteMatch = record.careEventId.match(new RegExp(`^${currentLog.id}-note-(\\d+)$`));
    const noteIndex = noteMatch ? Number(noteMatch[1]) : -1;
    const nextNotes = noteIndex >= 0
      ? currentLog.notes.filter((_, index) => {
          const keep = index !== noteIndex;
          if (!keep) didChange = true;
          return keep;
        })
      : currentLog.notes;

    if (!didChange) {
      setDeleteCareEventTarget(null);
      return;
    }

    const nextLog = careLogWithEventStats({
      ...currentLog,
      events: nextEvents,
      notes: nextNotes,
    });

    setCareLogs((current) => current.map((item) => (item.id === nextLog.id ? nextLog : item)));
    void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() => {
      setStorageStatus("offline");
    });
    if (editingCareEventId === record.id) setEditingCareEventId("");
    setDeleteCareEventTarget(null);
    hapticSuccess();
  };

  const selectRecordDate = (date: string) => {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
    setEditingCareEventId("");
    setSwipedTimelineEventId("");
    setDeleteCareEventTarget(null);
  };

  const handleProfileSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const allergies = splitListText(allergiesText);

    const nextProfile: BabyProfile = {
      ...profileDraft,
      nickname: profileDraft.nickname.trim() || initialProfile.nickname,
      birthDate: profileDraft.birthDate || initialProfile.birthDate,
      expectedDate: profileDraft.expectedDate || initialProfile.expectedDate,
      region: profileDraft.region.trim(),
      feeding: profileDraft.feeding.trim(),
      allergies: allergies.length ? allergies : ["暂未发现"],
      caregivers: profile.caregivers.length ? profile.caregivers : initialProfile.caregivers,
    };
    setProfile(nextProfile);
    void persistRecord("profile", "default", nextProfile, { applyResponse: true }).catch(() => undefined);
    setIsProfileEditing(false);
    setActiveMobileTab("profile");
  };

  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoggingIn) return;
    setLoginError("");
    if (!loginExistingMember && (!loginRoleName || loginCaregiver === null)) {
      setLoginError("请先选择家庭身份和是否照护人。");
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await loginWithInvite(
        loginPhone,
        loginInviteCode,
        loginExistingMember ? undefined : loginRoleName,
        loginExistingMember ? undefined : loginCaregiver,
      );
      setAuthUser(response.user);
      setAuthFamily(response.family);
      setAuthMember(response.member);
      await loadStateFromBackend({
        importLegacy: response.member.caregiver && response.legacyImportAllowed && legacyLocalStateRef.current,
        onboardingRequired: response.onboardingRequired,
      });
      setAuthStatus("authenticated");
      setActiveMobileTab("records");
      legacyLocalStateRef.current = false;
    } catch (error) {
      clearAuthToken();
      setLoginError(error instanceof Error ? error.message : "登录失败，请稍后再试。");
      setAuthStatus("unauthenticated");
      setStorageStatus("loading");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutCurrentUser();
    backendReadyRef.current = false;
    setAuthUser(null);
    setAuthFamily(null);
    setAuthMember(null);
    setAuthStatus("unauthenticated");
    setOnboardingRequired(false);
    setStorageStatus("loading");
    setIsProfileEditing(false);
    setRecordsEntryDrawer(null);
    setRecordsAssistantOpen(false);
    setActiveMobileTab("records");
    setInviteFamilyName("");
    setLoginExistingMember(null);
    setOnboardingFamilyName(suggestedFamilyName(initialProfile.nickname));
    onboardingFamilyNameTouchedRef.current = false;
    clearLocalAppState();
    legacyLocalStateRef.current = false;
    applyEmptyAppSnapshot();
  };

  const saveOnboardingProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const allergies = splitListText(onboardingAllergiesText);
    const completedProfile: BabyProfile = {
      ...onboardingDraft,
      nickname: onboardingDraft.nickname.trim() || "小宝",
      birthDate: onboardingDraft.birthDate,
      expectedDate: onboardingDraft.expectedDate,
      region: onboardingDraft.region.trim(),
      feeding: onboardingDraft.feeding.trim(),
      allergies: allergies.length ? allergies : ["暂未发现"],
      caregivers: profile.caregivers.length ? profile.caregivers : initialProfile.caregivers,
    };

    if (!hasCompleteProfile(completedProfile)) {
      setOnboardingStep(0);
      return;
    }

    try {
      const nextFamilyName = (onboardingFamilyName.trim() || suggestedFamilyName(completedProfile.nickname)).slice(0, 30);
      const updatedFamily = await updateFamilyName(nextFamilyName);
      await persistRecord("profile", "default", completedProfile, { applyResponse: true });
      setAuthFamily(updatedFamily);
      setOnboardingRequired(false);
      setActiveMobileTab("records");
      backendReadyRef.current = true;
      setStorageStatus("ready");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "保存小宝资料失败，请稍后再试。");
    }
  };

  const resetProfileDraft = () => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
  };

  const startProfileEditing = () => {
    if (!canCaregive) return;
    resetProfileDraft();
    setIsProfileEditing(true);
  };

  const cancelProfileEditing = () => {
    resetProfileDraft();
    setIsProfileEditing(false);
  };

  const openRecordsAssistant = (
    text?: string,
    options: { mode?: ComposerMode; attachMedia?: boolean } = {},
  ) => {
    if (!canCaregive) return;
    clearRecordsEntryDrawerCloseTimer();
    setRecordsEntryDrawerClosing(false);
    setRecordsEntryDrawer("ai");
    setRecordsAssistantOpen(true);
    setActiveMobileTab("records");
    if (typeof text === "string") {
      inputValueRef.current = text;
      setInput(text);
    }
    if (options.mode === "voice" && composerMode !== "voice") {
      toggleComposerMode();
    } else if (options.mode === "keyboard" && composerMode === "voice") {
      toggleComposerMode();
    }
    if (options.attachMedia) {
      window.setTimeout(() => {
        void openMediaPicker();
      }, 80);
    }
  };

  const openLedgerAssistant = (mode: "text" | "voice" | "photo") => {
    const prompt = `帮我记一笔${babyNickname}支出：`;
    openRecordsAssistant(prompt, {
      mode: mode === "voice" ? "voice" : "keyboard",
      attachMedia: mode === "photo",
    });
  };

  const quickFill = (text: string) => {
    openRecordsAssistant(text, { mode: "keyboard" });
  };
  const quickActions = useMemo<Array<{ label: string; prompt: string; Icon: LucideIcon }>>(
    () => [
      { label: "喂奶", prompt: "刚才喝了 120ml 奶", Icon: Milk },
      { label: "睡眠", prompt: `${babyNickname}刚睡了 1 小时`, Icon: Moon },
      { label: "成长", prompt: `今天${babyNickname}第一次自己扶着沙发站起来了`, Icon: PartyPopper },
      { label: "记账", prompt: `帮我记一笔${babyNickname}支出：`, Icon: ReceiptText },
      { label: "问 AI", prompt: `为什么这两天${babyNickname}更难哄睡？`, Icon: CircleHelp },
    ],
    [babyNickname],
  );

  const voiceHoldLabel =
    voiceCancelArmed
      ? "松开取消"
      : voiceStatus === "error"
      ? voiceError || "语音识别暂时不可用"
      : voiceStatus === "unsupported"
        ? voiceError || "当前环境不支持语音输入"
        : isListening
          ? voiceTranscript || (voiceStatus === "connecting" ? "正在连接语音识别..." : "正在听，松开结束")
          : voiceStatus === "processing"
            ? voiceTranscript || "正在整理文字..."
            : voiceTranscript || input.trim() || "按住说话";
  const voiceButtonStyle = { "--voice-level": voiceLevel.toFixed(3) } as CSSProperties;
  const voiceRecordingActive =
    composerMode === "voice" &&
    (isListening || voiceStatus === "connecting" || voiceStatus === "processing" || voiceCancelArmed);
  const voicePanelLabel = voiceCancelArmed ? "松手取消" : "松手发送，上移取消";
  const compressionMessage =
    compressionStatus === "checking"
      ? "正在检查是否需要整理较早聊天记录..."
      : compressionStatus === "compressing"
        ? "正在整理较早聊天记录，后续回答会更连贯。"
        : compressionStatus === "done"
          ? "较早聊天记录已整理进长期摘要。"
          : compressionStatus === "failed"
          ? "本次聊天记录整理未完成，不影响继续使用。"
          : "";
  const systemWeakNoticeView = systemWeakNotice ? (
    <div
      className={`system-weak-toast ${systemWeakNotice.tone} ${systemWeakNotice.progressMode ? "with-progress" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="system-weak-toast-row">
        <span className="system-weak-message">{systemWeakNotice.message}</span>
        {systemWeakNotice.progressMode ? (
          <span className="system-weak-percent">
            {systemWeakNotice.progressMode === "determinate" && typeof systemWeakNotice.progress === "number"
              ? `${Math.round(systemWeakNotice.progress)}%`
              : "下载中"}
          </span>
        ) : null}
      </div>
      {systemWeakNotice.progressMode ? (
        <div
          className={`system-weak-progress ${systemWeakNotice.progressMode}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(typeof systemWeakNotice.progress === "number" ? { "aria-valuenow": Math.round(systemWeakNotice.progress) } : {})}
        >
          <i style={typeof systemWeakNotice.progress === "number" ? { width: `${systemWeakNotice.progress}%` } : undefined} />
        </div>
      ) : null}
    </div>
  ) : null;
  const expenseEditorDialog = expenseEditorOpen ? (
    <div className="story-modal-backdrop ledger-form-backdrop" role="presentation" onMouseDown={closeExpenseEditor}>
      <form className="story-modal ledger-form-sheet expense-editor" onSubmit={saveExpenseDraft} onMouseDown={(event) => event.stopPropagation()}>
        <div className="story-modal-head">
          <div>
            <p className="eyebrow">账本</p>
            <h3>{editingExpenseId ? "编辑支出" : "记一笔支出"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={closeExpenseEditor} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="expense-editor-body" ref={expenseEditorBodyRef}>
          <section className="expense-core-card" aria-label="支出核心信息">
            <label className="expense-title-field">
              商品名或用途
              <input
                value={expenseDraft.title}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="比如 奶粉、尿裤、体检"
              />
            </label>
            <label className="expense-money-field">
              金额
              <span className="expense-money-input">
                <span aria-hidden="true">¥</span>
                <input
                  inputMode="decimal"
                  value={expenseDraft.amount}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </span>
            </label>
            <div className="expense-editor-grid expense-required-grid">
              <label>
                分类
                <StorySelect
                  value={expenseDraft.category}
                  options={EXPENSE_CATEGORY_OPTIONS}
                  ariaLabel="支出分类"
                  onChange={(category) => setExpenseDraft((current) => ({ ...current, category }))}
                />
              </label>
              <label>
                日期
                <span className="expense-date-field">
                  <span>{formatExpenseDateLabel(expenseDraft.date)}</span>
                  <input
                    className="expense-date-input"
                    type="date"
                    value={expenseDraft.date}
                    aria-label="支出日期"
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, date: event.target.value }))}
                  />
                </span>
              </label>
            </div>
          </section>
          <details
            className="expense-optional-panel"
            ref={expenseOptionalPanelRef}
            onToggle={(event) => {
              if (event.currentTarget.open) settleExpenseOptionalPanel();
            }}
          >
            <summary>
              <span>
                <strong>补充说明</strong>
                <small>商家、备注</small>
              </span>
              <ChevronDown size={17} />
            </summary>
            <div className="expense-optional-fields">
              <label>
                商家
                <input
                  value={expenseDraft.merchant}
                  onFocus={settleExpenseOptionalPanel}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, merchant: event.target.value }))}
                  placeholder="比如 医院、母婴店、朋友代买"
                />
              </label>
              <label>
                备注
                <textarea
                  value={expenseDraft.note}
                  onFocus={settleExpenseOptionalPanel}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="比如 活动价、医生建议购买"
                />
              </label>
            </div>
          </details>
        </div>
        <div className="story-modal-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeExpenseEditor}>
            取消
          </button>
          <button type="submit" className="screen-action-button">
            <Save size={16} />
            保存
          </button>
        </div>
      </form>
    </div>
  ) : null;
  const deleteExpenseDialog = deleteExpenseTarget ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeDeleteExpenseConfirm}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-expense-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <ReceiptText size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">删除支出</p>
          <h3 id="delete-expense-title">确定删除这笔支出吗？</h3>
          <p>“{deleteExpenseTarget.title} · {formatMoney(deleteExpenseTarget.amount)}”会从家庭账本里移除。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeDeleteExpenseConfirm}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={() => void confirmDeleteExpense()}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteCareEventDialog = deleteCareEventTarget ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeDeleteCareEventConfirm}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-care-event-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <Trash2 size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">删除记录</p>
          <h3 id="delete-care-event-title">确定删除这条时间线记录吗？</h3>
          <p>“{deleteCareEventTarget.title} · {deleteCareEventTarget.body}”会从当天记录和统计里移除。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeDeleteCareEventConfirm}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={confirmDeleteCareTimelineEvent}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const bulkDeleteExpensesDialog = bulkDeleteExpensesOpen && selectedExpenseIds.size > 0 ? (
    <div className="story-modal-backdrop" role="presentation" onMouseDown={closeBulkDeleteExpenses}>
      <div
        className="story-modal delete-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-expense-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-badge" aria-hidden="true">
          <ReceiptText size={22} />
        </div>
        <div className="delete-confirm-copy">
          <p className="eyebrow">批量删除</p>
          <h3 id="bulk-delete-expense-title">确定删除选中的 {selectedExpenseIds.size} 笔支出？</h3>
          <p>选中的支出会从家庭账本里一并移除，无法撤销。</p>
        </div>
        <div className="story-modal-actions delete-confirm-actions">
          <button type="button" className="screen-action-button quiet" onClick={closeBulkDeleteExpenses}>
            先保留
          </button>
          <button type="button" className="screen-action-button danger" onClick={() => void confirmBulkDeleteExpenses()}>
            <Trash2 size={16} />
            删除 {selectedExpenseIds.size} 笔
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // 首登知情同意：未同意前挡住一切（登录/引导/主界面都看不到）。
  if (!consentGiven) {
    return <ConsentGate onAccept={() => setConsentGiven(true)} />;
  }

  if (authStatus === "checking") {
    return (
      <main className="app-shell auth-shell auth-splash">
        <AuthScene />
        {systemWeakNoticeView}
        <div className="auth-splash-content">
          <AuthBrand />
          <p className="auth-splash-status">正在确认登录状态...</p>
          <span className="loading-stars auth-loading" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <main className="app-shell auth-shell">
        {systemWeakNoticeView}
        <section className="auth-panel">
          <StorybookScene />
          <div>
            <p className="eyebrow">本地家庭私有部署</p>
            <h1>欢迎回来</h1>
            <p>用手机号和家庭邀请码登录，宝宝记录只保存在你连接的本地后端。</p>
          </div>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label>
              <span>手机号</span>
              <input
                inputMode="tel"
                autoComplete="tel"
                placeholder="请输入 11 位手机号"
                value={loginPhone}
                onChange={(event) => setLoginPhone(event.target.value)}
              />
            </label>
            <label>
              <span>邀请码</span>
              <input
                autoCapitalize="characters"
                autoComplete="one-time-code"
                placeholder="输入家庭邀请码"
                value={loginInviteCode}
                onChange={(event) => setLoginInviteCode(event.target.value)}
              />
            </label>
            {loginExistingMember ? (
              <div className="auth-join-options compact" aria-label="已注册家庭身份">
                <div>
                  <strong>已识别家庭身份</strong>
                  <small>
                    {inviteRoleHint || `你已经是${inviteFamilyName || "这个家庭"}的成员，本次登录会沿用原身份。`}
                  </small>
                </div>
              </div>
            ) : (
              <div className="auth-join-options" aria-label="加入家庭身份设置">
                <div>
                  <strong>加入家庭前先确认身份</strong>
                  <small>新手机号第一次使用家庭邀请码时，会按这里的选择加入{inviteFamilyName || "对应家庭"}。</small>
                </div>
                <label>
                  <span>家庭身份</span>
                  <StorySelect
                    ariaLabel="家庭身份"
                    value={loginRoleName}
                    options={loginRoleOptions}
                    onChange={setLoginRoleName}
                  />
                  {isCheckingInviteRoles || inviteRoleHint ? (
                    <small className="auth-role-hint">
                      {isCheckingInviteRoles ? "正在确认家庭身份..." : inviteRoleHint}
                    </small>
                  ) : null}
                </label>
                <div className="auth-permission-choice">
                  <span>权限</span>
                  <div className="auth-choice-row" role="radiogroup" aria-label="是否照护人">
                    <button
                      type="button"
                      className={loginCaregiver === true ? "selected" : ""}
                      aria-pressed={loginCaregiver === true}
                      onClick={() => setLoginCaregiver(true)}
                    >
                      <strong>照护人</strong>
                      <small>可聊天记录、上传和完成提醒</small>
                    </button>
                    <button
                      type="button"
                      className={loginCaregiver === false ? "selected" : ""}
                      aria-pressed={loginCaregiver === false}
                      onClick={() => setLoginCaregiver(false)}
                    >
                      <strong>仅查看</strong>
                      <small>只能查看家庭记录和提醒</small>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {loginError ? <p className="auth-error">{loginError}</p> : null}
            <button type="submit" disabled={isLoggingIn || !loginReady}>
              {isLoggingIn ? "登录中..." : "登录"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (onboardingRequired) {
    if (!canCaregive) {
      return (
        <main className="app-shell auth-shell">
          {systemWeakNoticeView}
          <section className="auth-panel onboarding-panel">
            <StorybookScene />
              <div className="onboarding-head">
              <div className="brand-mark">
                <img className="storybook-brand-icon" src={companionIcon} alt="" />
              </div>
              <div>
                <p className="eyebrow">{authFamily?.name ?? "小宝家"}</p>
                <h1>等待照护人完成设置</h1>
              </div>
            </div>
            <p className="viewer-empty-copy">
              你当前是{authMember?.roleName ?? "家庭成员"}，仅可查看家庭记录。等照护人设置好小宝资料后，你刷新就能查看记录、提醒和趋势。
            </p>
            <button className="profile-logout-button" type="button" onClick={() => void handleLogout()}>
              退出登录{(authUser?.maskedPhone ?? authUser?.phone) ? `（${authUser?.maskedPhone ?? authUser?.phone}）` : ""}
            </button>
          </section>
        </main>
      );
    }
    const progress = onboardingStep + 1;
    return (
      <main className="app-shell auth-shell">
        {systemWeakNoticeView}
        <section className="auth-panel onboarding-panel">
          <StorybookScene />
          <div className="onboarding-head">
            <div className="brand-mark">
              <img className="storybook-brand-icon" src={companionIcon} alt="" />
            </div>
            <div>
              <p className="eyebrow">首次设置</p>
              <h1>先认识一下小宝</h1>
            </div>
            <span>{progress}/3</span>
          </div>
          <form className="auth-form onboarding-form" onSubmit={saveOnboardingProfile}>
            {onboardingStep === 0 ? (
              <>
                <label>
                  <span>小宝昵称</span>
                  <input
                    placeholder="比如：小宝"
                    value={onboardingDraft.nickname}
                    onChange={(event) => setOnboardingDraft((current) => ({ ...current, nickname: event.target.value }))}
                  />
                </label>
                <label>
                  <span>家庭名称</span>
                  <input
                    placeholder="比如：芊芊家"
                    value={onboardingFamilyName}
                    onChange={(event) => {
                      onboardingFamilyNameTouchedRef.current = true;
                      setOnboardingFamilyName(event.target.value);
                    }}
                    onBlur={() => {
                      if (!onboardingFamilyName.trim()) {
                        onboardingFamilyNameTouchedRef.current = false;
                        setOnboardingFamilyName(suggestedFamilyName(onboardingDraft.nickname || initialProfile.nickname));
                      }
                    }}
                  />
                </label>
                <label>
                  <span>阶段</span>
                  <StorySelect
                    ariaLabel="小宝阶段"
                    value={onboardingDraft.stage}
                    options={STAGE_SELECT_OPTIONS}
                    onChange={(stage) =>
                      setOnboardingDraft((current) => ({
                        ...current,
                        stage,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>性别</span>
                  <StorySelect
                    ariaLabel="小宝性别"
                    value={onboardingDraft.gender}
                    options={GENDER_SELECT_OPTIONS}
                    onChange={(gender) => setOnboardingDraft((current) => ({ ...current, gender }))}
                  />
                </label>
                <label>
                  <span>{onboardingDraft.stage === "born" ? "出生日期" : "预产期"}</span>
                  <input
                    type="date"
                    value={onboardingDraft.stage === "born" ? onboardingDraft.birthDate : onboardingDraft.expectedDate}
                    onChange={(event) =>
                      setOnboardingDraft((current) =>
                        current.stage === "born"
                          ? { ...current, birthDate: event.target.value }
                          : { ...current, expectedDate: event.target.value },
                      )
                    }
                  />
                </label>
              </>
            ) : null}
            {onboardingStep === 1 ? (
              <>
                <label>
                  <span>所在地区</span>
                  <StorySelect
                    ariaLabel="所在地区"
                    value={onboardingDraft.region}
                    options={selectOptionsWithCurrent(REGION_SELECT_OPTIONS, onboardingDraft.region)}
                    onChange={(region) => setOnboardingDraft((current) => ({ ...current, region }))}
                  />
                </label>
                <label>
                  <span>喂养方式</span>
                  <StorySelect
                    ariaLabel="喂养方式"
                    value={onboardingDraft.feeding}
                    options={selectOptionsWithCurrent(FEEDING_SELECT_OPTIONS, onboardingDraft.feeding)}
                    onChange={(feeding) => setOnboardingDraft((current) => ({ ...current, feeding }))}
                  />
                </label>
              </>
            ) : null}
            {onboardingStep === 2 ? (
              <>
                <label>
                  <span>过敏信息</span>
                  <input value={onboardingAllergiesText} onChange={(event) => setOnboardingAllergiesText(event.target.value)} />
                </label>
                <div className="profile-form-note">
                  <strong>家庭照护人</strong>
                  <span>{profile.caregivers.join("、") || "会按加入家庭的成员自动生成"}</span>
                  <small>照护人来自家庭邀请码成员，不需要在这里手动填写。</small>
                </div>
                <p className="onboarding-note">这些资料会帮 AI 更稳地整理记录，你之后也能在“我的”里修改。</p>
              </>
            ) : null}
            {loginError ? <p className="auth-error">{loginError}</p> : null}
            <div className="onboarding-actions">
              {onboardingStep > 0 ? (
                <button type="button" className="quiet" onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))}>
                  上一步
                </button>
              ) : null}
              {onboardingStep < 2 ? (
                <button type="button" onClick={() => setOnboardingStep((step) => Math.min(2, step + 1))}>
                  下一步
                </button>
              ) : (
                <button type="submit">完成设置</button>
              )}
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell mobile-tab-${activeMobileTab}${activeMobileTab === "profile" && reminderManagementOpen ? " profile-reminders-open" : ""}${recordsAssistantOpen ? " records-assistant-expanded" : ""}${voiceRecordingActive ? " voice-recording-active" : ""}`}>
      {systemWeakNoticeView}
      <section className="topbar" aria-label="今日概览">
        <div className="brand-block">
          <div className="brand-mark">
            <img className="storybook-brand-icon" src={companionIcon} alt="" />
          </div>
          <div>
            <p className="eyebrow">AI宝宝成长伙伴</p>
            <h1>{profile.nickname}</h1>
          </div>
        </div>
        <div className="topbar-metrics">
          <div className="metric">
            <CalendarDays size={18} />
            <span>{ageLabel(profile.birthDate)}</span>
          </div>
          <div className="metric">
            <Users size={18} />
            <span>{profile.caregivers.join(" / ")}</span>
          </div>
          <div className="metric status">
            <Sparkles size={18} />
            <span>今日记录 {messages.filter((item) => item.role === "parent").length} 条</span>
          </div>
          <div className="metric">
            <Smartphone size={18} />
            <span>{storageStatus === "offline" ? "本地缓存" : storageStatus === "loading" ? "同步中" : appPlatform}</span>
          </div>
          <div className={`metric member ${canCaregive ? "caregiver" : "viewer"}`}>
            <UserRound size={18} />
            <span>{authFamily?.name ?? "小宝家"} · {authMember?.roleName ?? "家庭成员"} · {canCaregive ? "可记录" : "仅查看"}</span>
          </div>
        </div>
      </section>

      <div className="workspace">
        <aside className="left-rail">
          <section className="profile-panel">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <img className="storybook-photo-icon" src={companionAvatarIcon} alt="" />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{displayProfileValue(profile.region)} · {displayProfileValue(profile.feeding)}</p>
            </div>
            <div className="profile-grid">
              <div>
                <span>出生</span>
                <strong>{formatDate(profile.birthDate)}</strong>
              </div>
              <div>
                <span>预产</span>
                <strong>{formatDate(profile.expectedDate)}</strong>
              </div>
              <div>
                <span>过敏</span>
                <strong>{profile.allergies.join("、")}</strong>
              </div>
              <div>
                <span>提醒</span>
                <strong>{openReminders.length} 个</strong>
              </div>
            </div>
          </section>

          <section className="memory-panel">
            <div className="section-title">
              <Brain size={18} />
              <h2>AI记忆</h2>
            </div>
            <div className="memory-list">
              {memories.slice(0, 4).map((memory) => (
                <article className="memory-item" key={memory.id}>
                  <p>{memory.text}</p>
                  <span>{Math.round(memory.confidence * 100)}%</span>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <section className="chat-panel tab-content-enter" aria-label="每日聊天记录">
          <div className="chat-head">
            <div className="chat-companion-head">
              <div className="companion-badge" aria-hidden="true">
                <span className="companion-cloud" />
                <img className="companion-icon-img" src={companionAvatarIcon} alt="" />
              </div>
              <div>
                <p className="eyebrow">陪你记录{babyNickname}</p>
                <h2>今天想记点什么？</h2>
              </div>
            </div>
            <div className="head-actions">
              <AiDataNotice />
              <button
                type="button"
                className={`icon-button ${visualToolClassName}`.trim()}
                title={visualToolTitle}
                aria-disabled={visualToolGated}
                disabled={visualToolDisabled}
                onClick={openMediaPicker}
              >
                <CameraIcon size={18} />
              </button>
              <button
                type="button"
                className={`icon-button voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                title={composerMode === "voice" ? "键盘" : "语音"}
                onClick={toggleComposerMode}
              >
                {composerMode === "voice" ? <KeyboardIcon size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <button
              type="button"
              className="icon-button records-assistant-close"
              title="收起记录助手"
              aria-label="收起记录助手"
              onClick={() => setRecordsAssistantOpen(false)}
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="chat-prelude">
            {compressionMessage ? (
              <div className={`compression-notice ${compressionStatus}`} role="status">
                <Brain size={15} />
                <span>{compressionMessage}</span>
              </div>
            ) : null}

            <div className="quick-row">
              {quickActions.map(({ label, prompt, Icon }) => (
                <button type="button" className="quick-action" key={label} onClick={() => quickFill(prompt)}>
                  <span className="quick-action__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="quick-action__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="message-list" ref={messageListRef}>
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                {message.role === "ai" ? (
                  <span className="message-companion" aria-hidden="true">
                    <img src={companionAvatarIcon} alt="" />
                  </span>
                ) : null}
                <div className={`message-meta ${message.role === "ai" ? "message-meta-ai" : ""}`}>
                  {message.role === "parent" ? <span>{familySpeakerName}</span> : null}
                  <time>{formatTime(message.createdAt)}</time>
                </div>
                {message.role === "ai" && message.reasoning ? (
                  <details className="reasoning-box" open={message.isStreaming}>
                    <summary>{message.isStreaming ? "思考中" : "思考过程"}</summary>
                    <p>{message.reasoning}</p>
                  </details>
                ) : null}
                {message.role === "ai" && visibleToolActivitiesForMessage(message).length ? (
                  <div className="tool-activity-list">
                    {visibleToolActivitiesForMessage(message).map((activity) => (
                      <div className={`tool-activity ${activity.status}`} key={activity.id}>
                        {isAgentProgressActivity(activity) ? (
                          activity.status === "completed" ? (
                            <CheckCircle2 size={14} />
                          ) : activity.status === "failed" ? (
                            <X size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )
                        ) : (
                          <Globe2 size={14} />
                        )}
                        <span>{activity.message}</span>
                        {activity.query ? <small>{activity.query}</small> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.safetyAlerts?.length ? (
                  <div className="safety-alert-list">
                    {message.safetyAlerts.map((alert) => (
                      <div className={`safety-alert ${alert.level}`} key={`${alert.category}-${alert.message}`}>
                        <ShieldAlert size={15} />
                        <div>
                          <strong>{alert.message}</strong>
                          <span>{alert.recommendedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className={`message-text ${message.isStreaming ? "streaming" : ""}`}>
                  {message.isStreaming ? (
                    <span className="loading-stars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                  <p>{message.text}</p>
                </div>
                {message.sources?.length ? (
                  <div className="source-list" aria-label="联网查询来源">
                    {message.sources.map((source) => (
                      <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                        {hostLabel(source.url) ? <small>{hostLabel(source.url)}</small> : null}
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.attachments?.length ? (
                  <div className="attachment-strip">
                    {message.attachments.map((item) => (
                      <button
                        type="button"
                        className="attachment-thumb"
                        key={item.id}
                        onClick={() => {
                          if (!item.url) return;
                          openPreviewAttachment(item, null);
                        }}
                        disabled={!item.url}
                        title={item.url ? "查看大图" : item.name}
                      >
                        {item.kind === "image" && attachmentListSrc(item) ? (
                          <img src={attachmentListSrc(item)} alt={item.name} loading="lazy" decoding="async" />
                        ) : null}
                        {item.kind === "video" && item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.name} loading="lazy" decoding="async" />
                        ) : null}
                        {item.kind === "video" && !item.thumbnailUrl ? <Video size={20} /> : null}
                        {!item.url && item.kind !== "video" ? <ImageIcon size={18} /> : null}
                        <span>{item.kind === "video" ? "视频" : item.kind === "audio" ? "语音" : "照片"}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.tags?.length ? (
                  <div className="tag-row">
                    {message.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
                {message.role === "ai" && askDecisions(message.effectDecisions).length ? (
                  <div className="ask-effect-list">
                    {askDecisions(message.effectDecisions).map((decision) => (
                      <section className="ask-effect-card" key={decision.id}>
                        <CircleHelp size={16} />
                        <div>
                          <strong>需要补充一点信息</strong>
                          <span>{decision.question}</span>
                          {decision.missingFields.length ? (
                            <small>还需要：{decision.missingFields.join("、")}</small>
                          ) : null}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}
                {message.role === "ai" && message.albumPrompts?.length ? (
                  <div className="album-prompt-list">
                    {message.albumPrompts.map((prompt) => (
                      <section className={`album-prompt-card status-${prompt.status}`} key={prompt.id}>
                        <ImageIcon size={16} />
                        <div>
                          <strong>{prompt.status === "saved" ? "已保存到相册" : prompt.status === "ignored" ? "已忽略这段素材" : "这段素材可能值得保存到相册"}</strong>
                          <span>{prompt.status === "pending" ? "要保存吗？" : prompt.title}</span>
                          <small>{prompt.reason}</small>
                        </div>
                        {prompt.status === "pending" ? (
                          <div className="album-prompt-actions">
                            <button type="button" onClick={() => saveAlbumPrompt(message.id, prompt)}>
                              保存到相册
                            </button>
                            <button type="button" className="quiet" onClick={() => ignoreAlbumPrompt(message.id, prompt)}>
                              忽略
                            </button>
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : null}
                {message.role === "ai" &&
                pendingEffects.some((effect) => effect.messageId === message.id) ? (
                  <div className="pending-effect-list">
                    {pendingEffects
                      .filter((effect) => effect.messageId === message.id)
                      .map((effect) => {
                        const isConfirmingEffect = confirmingPendingEffectIds.includes(effect.id);
                        return (
                        <section className="pending-effect-card" key={effect.id}>
                          <div className="pending-effect-head">
                            <div>
                              <span>待确认记录</span>
                              <strong>{pendingEffectSummary(effect).join(" / ")}</strong>
                            </div>
                            <Clock3 size={16} />
                          </div>
                          {editingPendingId === effect.id ? (
                            pendingDraft ? (
                              <div className="pending-effect-form">
                                {pendingDraft.growthEvent ? (
                                  <fieldset>
                                    <legend>成长事件</legend>
                                    <label>
                                      标题
                                      <input
                                        value={pendingDraft.growthEvent.title}
                                        onChange={(event) => updatePendingGrowthDraft({ title: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      日期
                                      <input
                                        type="date"
                                        value={pendingDraft.growthEvent.date}
                                        onChange={(event) => updatePendingGrowthDraft({ date: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      摘要
                                      <textarea
                                        value={pendingDraft.growthEvent.summary}
                                        onChange={(event) => updatePendingGrowthDraft({ summary: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ) : null}
                                {pendingDraft.growthMeasurements.map((measurement) => {
                                  const meta = GROWTH_MEASUREMENT_META[measurement.type];
                                  return (
                                    <fieldset key={measurement.id}>
                                      <legend>成长数据</legend>
                                      <div className="pending-effect-grid">
                                        <label>
                                          类型
                                          <StorySelect
                                            value={measurement.type}
                                            options={GROWTH_MEASUREMENT_TYPES.map((type) => ({
                                              value: type,
                                              label: GROWTH_MEASUREMENT_META[type].label,
                                            }))}
                                            ariaLabel="待确认成长数据类型"
                                            onChange={(type) =>
                                              updatePendingGrowthMeasurementDraft(measurement.id, { type: type as GrowthMeasurementType })
                                            }
                                          />
                                        </label>
                                        <label>
                                          数值（{meta.unit}）
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            step={meta.step}
                                            min={meta.min}
                                            max={meta.max}
                                            value={measurement.value}
                                            onChange={(event) =>
                                              updatePendingGrowthMeasurementDraft(measurement.id, { value: event.target.value })
                                            }
                                          />
                                        </label>
                                      </div>
                                      <label>
                                        日期
                                        <input
                                          type="date"
                                          value={measurement.date}
                                          onChange={(event) =>
                                            updatePendingGrowthMeasurementDraft(measurement.id, { date: event.target.value })
                                          }
                                        />
                                      </label>
                                      <label>
                                        备注
                                        <textarea
                                          value={measurement.note}
                                          onChange={(event) =>
                                            updatePendingGrowthMeasurementDraft(measurement.id, { note: event.target.value })
                                          }
                                        />
                                      </label>
                                    </fieldset>
                                  );
                                })}
                                {pendingDraft.careLogPatch ? (
                                  <fieldset>
                                    <legend>照护记录</legend>
                                    <label>
                                      日期
                                      <input
                                        type="date"
                                        value={pendingDraft.careLogPatch.date}
                                        onChange={(event) => updatePendingCareDraft({ date: event.target.value })}
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        奶量 ml
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.milkMl}
                                          onChange={(event) => updatePendingCareDraft({ milkMl: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        喝奶次数
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.milkTimes}
                                          onChange={(event) => updatePendingCareDraft({ milkTimes: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        睡眠小时
                                        <input
                                          inputMode="decimal"
                                          value={pendingDraft.careLogPatch.sleepHours}
                                          onChange={(event) => updatePendingCareDraft({ sleepHours: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        夜醒次数
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.wakes}
                                          onChange={(event) => updatePendingCareDraft({ wakes: event.target.value })}
                                        />
                                      </label>
                                    </div>
                                    <label>
                                      便便
                                      <input
                                        value={pendingDraft.careLogPatch.poop}
                                        onChange={(event) => updatePendingCareDraft({ poop: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      体温
                                      <input
                                        inputMode="decimal"
                                        value={pendingDraft.careLogPatch.temperature}
                                        onChange={(event) => updatePendingCareDraft({ temperature: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      备注
                                      <textarea
                                        value={pendingDraft.careLogPatch.notes}
                                        onChange={(event) => updatePendingCareDraft({ notes: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ) : null}
                                {pendingDraft.reminders.map((item) => (
                                  <fieldset key={item.id}>
                                    <legend>提醒</legend>
                                    <label>
                                      标题
                                      <input
                                        value={item.draft.title}
                                        onChange={(event) =>
                                          updatePendingReminderDraft(item.id, (draft) => ({ ...draft, title: event.target.value }))
                                        }
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        时间模式
                                        <StorySelect
                                          value={item.draft.scheduleMode}
                                          options={REMINDER_SCHEDULE_MODE_OPTIONS}
                                          ariaLabel="待确认提醒时间模式"
                                          onChange={(scheduleMode) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, scheduleMode }))
                                          }
                                        />
                                      </label>
                                      <label>
                                        提醒方式
                                        <StorySelect
                                          value={item.draft.alertMode}
                                          options={REMINDER_ALERT_MODE_OPTIONS}
                                          ariaLabel="待确认提醒方式"
                                          onChange={(alertMode) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, alertMode }))
                                          }
                                        />
                                      </label>
                                    </div>
                                    <div className="pending-effect-grid">
                                      <label>
                                        分类
                                        <StorySelect
                                          value={item.draft.category}
                                          options={REMINDER_CATEGORY_OPTIONS}
                                          ariaLabel="待确认提醒分类"
                                          onChange={(category) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, category }))
                                          }
                                        />
                                      </label>
                                      {item.draft.alertMode === "ringing" ? (
                                        <label>
                                          提示音
                                          <StorySelect
                                            value={item.draft.soundId}
                                            options={REMINDER_SOUND_OPTIONS}
                                            ariaLabel="待确认闹铃提示音"
                                            onChange={(soundId) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, soundId }))
                                            }
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                    {item.draft.scheduleMode === "interval" ? (
                                      <label>
                                        循环间隔（分钟）
                                        <input
                                          type="number"
                                          min={MIN_INTERVAL_MINUTES}
                                          max={MAX_INTERVAL_MINUTES}
                                          step="5"
                                          value={item.draft.intervalMinutes}
                                          onChange={(event) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, intervalMinutes: event.target.value }))
                                          }
                                        />
                                      </label>
                                    ) : (
                                      <div className="pending-effect-grid">
                                        <label>
                                          日期
                                          <input
                                            type="date"
                                            value={item.draft.dueDate}
                                            onChange={(event) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, dueDate: event.target.value }))
                                            }
                                          />
                                        </label>
                                        <label>
                                          时间
                                          <input
                                            type="time"
                                            value={item.draft.dueTime}
                                            onChange={(event) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, dueTime: event.target.value }))
                                            }
                                          />
                                        </label>
                                      </div>
                                    )}
                                  </fieldset>
                                ))}
                                {pendingDraft.memories.map((item) => (
                                  <fieldset key={item.id}>
                                    <legend>记忆</legend>
                                    <label>
                                      内容
                                      <textarea value={item.text} onChange={(event) => updatePendingMemoryDraft(item.id, event.target.value)} />
                                    </label>
                                  </fieldset>
                                ))}
                                {pendingDraft.expenses.map((item, index) => (
                                  <fieldset key={`pending-expense-${index}`}>
                                    <legend>账本支出</legend>
                                    <label>
                                      商品或用途
                                      <input
                                        value={item.title}
                                        onChange={(event) => updatePendingExpenseDraft(index, { title: event.target.value })}
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        金额
                                        <input
                                          inputMode="decimal"
                                          value={item.amount}
                                          onChange={(event) => updatePendingExpenseDraft(index, { amount: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        日期
                                        <input
                                          type="date"
                                          value={item.date}
                                          onChange={(event) => updatePendingExpenseDraft(index, { date: event.target.value })}
                                        />
                                      </label>
                                    </div>
                                    <div className="pending-effect-grid">
                                      <label>
                                        分类
                                        <StorySelect
                                          value={item.category}
                                          options={EXPENSE_CATEGORY_OPTIONS}
                                          ariaLabel="待确认支出分类"
                                          onChange={(category) => updatePendingExpenseDraft(index, { category })}
                                        />
                                      </label>
                                      <label>
                                        商家
                                        <input
                                          value={item.merchant}
                                          onChange={(event) => updatePendingExpenseDraft(index, { merchant: event.target.value })}
                                        />
                                      </label>
                                    </div>
                                    <label>
                                      备注
                                      <textarea
                                        value={item.note}
                                        onChange={(event) => updatePendingExpenseDraft(index, { note: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ))}
                              </div>
                            ) : null
                          ) : (
                            <div className="pending-effect-body">
                              {effect.growthEvent ? <p>成长：{effect.growthEvent.title}</p> : null}
                              {(effect.growthMeasurements ?? []).map((measurement) => {
                                const meta = GROWTH_MEASUREMENT_META[measurement.type];
                                return (
                                  <p key={measurement.id}>
                                    成长数据：{meta.label} {measurement.value}{meta.unit}
                                  </p>
                                );
                              })}
                              {effect.careLogPatch ? <p>照护：{effect.careLogPatch.notes?.join("、") || "已识别照护日志"}</p> : null}
                              {(effect.reminders ?? []).map((reminder) => (
                                <p key={reminder.id}>提醒：{reminder.dueText} {reminder.title}</p>
                              ))}
                              {(effect.memories ?? []).map((memory) => (
                                <p key={memory.id}>记忆：{memory.text}</p>
                              ))}
                              {(effect.expenses ?? []).map((expense) => (
                                <p key={expense.id}>支出：{expense.title} {formatMoney(expense.amount)}</p>
                              ))}
                            </div>
                          )}
                          <div className="pending-effect-actions">
                            {editingPendingId === effect.id ? (
                              <>
                                <button type="button" onClick={() => void savePendingEffectDraft(effect)}>
                                  保存
                                </button>
                                <button
                                  type="button"
                                  className="quiet"
                                  onClick={() => {
                                    setEditingPendingId("");
                                    setPendingDraft(null);
                                  }}
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => beginEditPendingEffect(effect)}>
                                编辑
                              </button>
                            )}
                            {editingPendingId === effect.id ? null : (
                              <>
                                <button type="button" disabled={isConfirmingEffect} onClick={() => void confirmPendingEffect(effect)}>
                                  {isConfirmingEffect ? "保存中" : "确认"}
                                </button>
                                <button type="button" className="quiet" disabled={isConfirmingEffect} onClick={() => void discardPendingEffect(effect)}>
                                  丢弃
                                </button>
                              </>
                            )}
                          </div>
                        </section>
                        );
                      })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form className={`composer ${voiceRecordingActive ? "voice-recording-hidden" : ""}`.trim()} onSubmit={handleSubmit}>
            {chatUploadItems.length || attachments.length ? (
              <div className={`pending-attachments ${isAttachmentTrayOpen ? "expanded" : "collapsed"}`}>
                <button
                  type="button"
                  className="pending-attachment-summary"
                  aria-expanded={isAttachmentTrayOpen}
                  aria-controls="pending-attachment-list"
                  aria-label={canCollapseAttachmentTray ? (isAttachmentTrayOpen ? "收起素材清单" : "展开素材清单") : "素材清单"}
                  title={chatAttachmentLimitLabel}
                  onClick={() => {
                    if (canCollapseAttachmentTray) {
                      setIsAttachmentTrayExpanded((current) => !current);
                    }
                  }}
                >
                  <span className="pending-attachment-summary-copy">
                    <span className="pending-attachment-count">{chatAttachmentCountLabel}</span>
                    {attachmentTrayMetaLabel ? <small>{attachmentTrayMetaLabel}</small> : null}
                  </span>
                  {isChatAttachmentLimitReached ? <span className="pending-attachment-limit full">已达上限</span> : null}
                  {attachmentTrayPreviewItems.length ? (
                    <span className="pending-attachment-stack" aria-hidden="true">
                      {attachmentTrayPreviewItems.map((item) => (
                        <span className="pending-stack-thumb" key={item.id}>
                          {item.kind === "image" && attachmentListSrc(item) ? (
                            <img src={attachmentListSrc(item)} alt="" loading="lazy" decoding="async" />
                          ) : item.kind === "video" && item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                          ) : item.kind === "video" ? (
                            <Video size={14} />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                        </span>
                      ))}
                      {attachmentTrayOverflowCount ? <span className="pending-stack-thumb overflow">+{attachmentTrayOverflowCount}</span> : null}
                    </span>
                  ) : null}
                  {canCollapseAttachmentTray ? <ChevronDown className="pending-attachment-chevron" size={17} aria-hidden="true" /> : null}
                </button>
                {isAttachmentTrayOpen ? (
                  <div className="pending-attachment-list" id="pending-attachment-list">
                    {chatUploadItems.map((item) => (
                      <div className={`pending-item upload-item ${item.status}`} key={item.id}>
                        <div className="pending-preview-button upload-state-icon" aria-hidden="true">
                          {item.kind === "video" ? <Video size={17} /> : <ImageIcon size={17} />}
                        </div>
                        <div className="upload-copy">
                          <span title={item.name}>{item.name}</span>
                          <small>{item.message ?? (item.status === "uploading" ? `上传 ${item.progress}%` : "准备中")}</small>
                          <div className="upload-progress-track" aria-hidden="true">
                            <div className="upload-progress-bar" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {attachments.map((item) => (
                      <div className="pending-item" key={item.id}>
                        <button
                          type="button"
                          className="pending-preview-button"
                          title={item.url ? "查看大图" : item.name}
                          disabled={!item.url}
                          onClick={() => {
                            if (!item.url) return;
                            openPreviewAttachment(item, null);
                          }}
                        >
                          {item.kind === "image" && attachmentListSrc(item) ? (
                            <img src={attachmentListSrc(item)} alt={item.name} loading="lazy" decoding="async" />
                          ) : item.kind === "video" && item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.name} loading="lazy" decoding="async" />
                          ) : (
                            <Video size={18} />
                          )}
                        </button>
                        <span>{item.name}</span>
                        <button
                          type="button"
                          className="pending-remove-button"
                          title="移除"
                          aria-label={`移除 ${item.name}`}
                          onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="composer-row">
              <div className="composer-tools" aria-label="输入工具">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  disabled={!canAttachVisuals || isSubmitting || isUploadingChatMedia}
                  onChange={handleFiles}
                />
                <button
                  type="button"
                  className={`tool-button ${visualToolClassName}`.trim()}
                  title={visualToolTitle}
                  aria-disabled={visualToolGated}
                  disabled={visualToolDisabled}
                  onClick={openMediaPicker}
                >
                  <CameraIcon size={19} />
                </button>
                <button
                  type="button"
                  className={`tool-button voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                  title={composerMode === "voice" ? "切换键盘输入" : "切换语音输入"}
                  aria-label={composerMode === "voice" ? "键盘输入" : "语音输入"}
                  aria-pressed={composerMode === "voice"}
                  disabled={isSubmitting}
                  onClick={toggleComposerMode}
                >
                  {composerMode === "voice" ? <KeyboardIcon size={19} /> : <Mic size={19} />}
                </button>
              </div>
              <div className="composer-input-line">
                {composerMode === "voice" ? (
                  <button
                    type="button"
                    className={`voice-hold-button ${isListening ? "listening" : ""} ${voiceStatus} ${voiceCancelArmed ? "canceling" : ""}`}
                    style={voiceButtonStyle}
                    disabled={isSubmitting}
                    aria-label="按住说话"
                    onPointerDown={startVoicePress}
                    onPointerUp={releaseVoicePress}
                    onPointerCancel={cancelVoicePointer}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <span>{voiceHoldLabel}</span>
                  </button>
                ) : (
                  <textarea
                    value={input}
                    rows={1}
                    onChange={(event) => {
                      inputValueRef.current = event.target.value;
                      setInput(event.target.value);
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`记录${babyNickname}今天的新变化...`}
                    disabled={isSubmitting}
                  />
                )}
                <button className="send-button" type="submit" title={isUploadingChatMedia ? "素材上传中" : isSubmitting ? "处理中" : "发送"} disabled={isSubmitting || isUploadingChatMedia}>
                  <Send size={19} />
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="records-screen tab-content-enter" aria-label="记录">
          {growthEntryOpen ? (
            <GrowthEntryView
              profile={profile}
              growthMeasurements={growthMeasurements}
              canCaregive={canCaregive}
              draft={growthMeasurementDraft}
              editingMeasurementId={editingGrowthMeasurementId}
              onDraftChange={setGrowthMeasurementDraft}
              onSubmit={handleAddGrowthMeasurement}
              onEdit={handleEditGrowthMeasurement}
              onCancelEdit={resetGrowthMeasurementDraft}
              onDelete={handleDeleteGrowthMeasurement}
              onClose={closeGrowthEntry}
            />
          ) : milestonesViewOpen ? (
            <MilestonesView
              profile={profile}
              growthEvents={growthEvents}
              canCaregive={canCaregive}
              onClose={closeMilestones}
              onAchieve={achieveMilestone}
            />
          ) : (
          <>
          <div className="screen-head">
            <div>
              <p className="eyebrow">记录</p>
              <h2>{recordHeading}</h2>
            </div>
            <button type="button" className="small-action" onClick={() => {
              selectRecordDate(todayDate);
              setRecordView("today");
            }}>
              今天
            </button>
          </div>

          <div className="segmented-tabs record-tabs" role="tablist" aria-label="记录视图">
            {RECORD_VIEWS.map((view) => (
              <button
                type="button"
                className={recordView === view.id ? "active" : ""}
                aria-selected={recordView === view.id}
                role="tab"
                key={view.id}
                onClick={() => {
                  if (view.id === "today") selectRecordDate(todayDate);
                  setRecordView(view.id);
                }}
              >
                {view.label}
              </button>
            ))}
          </div>

          {canCaregive ? (
          <section className="records-assistant-entry" aria-label="快速记录入口">
            <div className="records-assistant-head">
              <div>
                <strong>快速记录</strong>
                <small>AI 可以帮你整理成记录，也可以手动记录当天数据</small>
              </div>
              <div className="records-assistant-actions">
                <button
                  type="button"
                  onClick={() => openRecordsAssistant(undefined, { mode: composerMode })}
                >
                  {recordsEntryDrawer === "ai" ? "正在记录" : "AI 自动记录"}
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={openManualRecordDrawer}
                >
                  手动记录
                </button>
              </div>
            </div>
            <div className="quick-row records-quick-row">
              {quickActions.map(({ label, prompt }) => (
                <button type="button" className="records-prompt-link" key={label} onClick={() => quickFill(prompt)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
          ) : null}

          {canCaregive && recordsEntryDrawer
            ? createPortal(
                <div
                  className={`records-entry-scrim ${recordsEntryDrawerClosing ? "is-closing" : "is-open"}`}
                  role="presentation"
                  onClick={closeRecordsEntryDrawer}
                >
                  <section
                    className={`records-entry-drawer ${
                      recordsEntryDrawer === "ai" ? "records-assistant-drawer" : "records-manual-drawer"
                    } ${recordsEntryDrawerClosing ? "is-closing" : "is-open"}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={recordsEntryDrawer === "ai" ? "AI 自动记录" : "手动记录"}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="records-drawer-head">
                      <div>
                        <strong>{recordsEntryDrawer === "ai" ? "AI 自动记录" : "手动记录"}</strong>
                        <small>
                          {recordsEntryDrawer === "ai"
                            ? "说一句或上传照片，我会整理成当天记录"
                            : `保存到${selectedDateIsToday ? "今天" : formatDate(selectedDate)}的时间线`}
                        </small>
                      </div>
                      <button type="button" aria-label="关闭" onClick={closeRecordsEntryDrawer}>
                        <X size={18} />
                      </button>
                    </div>

                    <div className={`records-drawer-body ${recordsEntryDrawer === "ai" ? "records-drawer-body--assistant" : "records-drawer-body--manual"}`}>
                      {recordsEntryDrawer === "ai" ? (
                        <>
                          <div className="records-assistant-main">
                            <div className="records-assistant-body">
                              <Sparkles size={16} />
                              <span>直接描述今天发生了什么，我会整理成记录并同步到今日、趋势和时间线。</span>
                            </div>
                            {pendingEffects.length ? (
                              <div className="records-assistant-pending-list">
                                {pendingEffects.slice(0, 2).map((effect) => {
                                  const isConfirmingEffect = confirmingPendingEffectIds.includes(effect.id);
                                  return (
                                    <section className="records-assistant-pending-card" key={effect.id}>
                                      <Clock3 size={14} />
                                      <div>
                                        <strong>{pendingEffectSummary(effect).join(" / ")}</strong>
                                        <small>待确认记录</small>
                                      </div>
                                      <button type="button" disabled={isConfirmingEffect} onClick={() => void confirmPendingEffect(effect)}>
                                        {isConfirmingEffect ? "保存中" : "确认"}
                                      </button>
                                      <button type="button" className="quiet" disabled={isConfirmingEffect} onClick={() => void discardPendingEffect(effect)}>
                                        丢弃
                                      </button>
                                    </section>
                                  );
                                })}
                              </div>
                            ) : null}
                            <div className="records-assistant-thread" aria-label="最近对话">
                              <span className="records-assistant-section-label">最近相关内容</span>
                              {messages.slice(-3).map((message) => (
                                <article className={`records-assistant-message ${message.role}`} key={message.id}>
                                  <time>{formatTime(message.createdAt)}</time>
                                  <p>{message.text}</p>
                                </article>
                              ))}
                              {isSubmitting ? (
                                <article className="records-assistant-message ai records-assistant-message--processing" role="status" aria-live="polite">
                                  <time>处理中</time>
                                  <p className="records-assistant-processing">
                                    <span className="loading-stars records-assistant-loading-dots" aria-hidden="true">
                                      <i />
                                      <i />
                                      <i />
                                    </span>
                                    <span>正在整理</span>
                                  </p>
                                </article>
                              ) : null}
                            </div>
                            {chatUploadItems.length || attachments.length ? (
                              <div className="records-assistant-attachments">
                                {chatUploadItems.map((item) => (
                                  <span className={`records-assistant-attachment ${item.status}`} key={item.id}>
                                    {item.kind === "video" ? <Video size={13} /> : <ImageIcon size={13} />}
                                    {item.status === "uploading" ? `上传 ${item.progress}%` : item.name}
                                  </span>
                                ))}
                                {attachments.map((item) => (
                                  <span className="records-assistant-attachment" key={item.id}>
                                    {item.kind === "video" ? <Video size={13} /> : item.kind === "audio" ? <Mic size={13} /> : <ImageIcon size={13} />}
                                    {item.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <form className={`records-assistant-composer ${voiceRecordingActive ? "voice-recording-hidden" : ""}`.trim()} onSubmit={handleSubmit}>
                            <div className="records-assistant-tool-row">
                              <button
                                type="button"
                                className={`records-assistant-tool ${visualToolClassName}`.trim()}
                                title={visualToolTitle}
                                aria-disabled={visualToolGated}
                                disabled={visualToolDisabled}
                                onClick={openMediaPicker}
                              >
                                <CameraIcon size={18} />
                                <span>照片</span>
                              </button>
                              <button
                                type="button"
                                className={`records-assistant-tool voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                                title={composerMode === "voice" ? "切换键盘输入" : "切换语音输入"}
                                aria-label={composerMode === "voice" ? "键盘输入" : "语音输入"}
                                aria-pressed={composerMode === "voice"}
                                disabled={!canUseComposerInput}
                                onClick={toggleComposerMode}
                              >
                                {composerMode === "voice" ? <KeyboardIcon size={18} /> : <Mic size={18} />}
                                <span>{composerMode === "voice" ? "键盘" : "语音"}</span>
                              </button>
                            </div>
                            <div className="records-assistant-input-line">
                              {composerMode === "voice" ? (
                                <button
                                  type="button"
                                  className={`voice-hold-button ${isListening ? "listening" : ""} ${voiceStatus} ${voiceCancelArmed ? "canceling" : ""}`}
                                  style={voiceButtonStyle}
                                  disabled={!canUseComposerInput}
                                  aria-label="按住说话"
                                  onPointerDown={startVoicePress}
                                  onPointerUp={releaseVoicePress}
                                  onPointerCancel={cancelVoicePointer}
                                  onContextMenu={(event) => event.preventDefault()}
                                >
                                  <span>{voiceHoldLabel}</span>
                                </button>
                              ) : (
                                <textarea
                                  value={input}
                                  rows={1}
                                  onChange={(event) => {
                                    inputValueRef.current = event.target.value;
                                    setInput(event.target.value);
                                  }}
                                  onKeyDown={handleComposerKeyDown}
                                  placeholder={`记录${babyNickname}今天的新变化...`}
                                  disabled={!canUseComposerInput}
                                />
                              )}
                              <button className="send-button" type="submit" title={isUploadingChatMedia ? "素材上传中" : isSubmitting ? "处理中" : "发送"} disabled={isSubmitting || isUploadingChatMedia}>
                                <Send size={18} />
                              </button>
                            </div>
                          </form>
                        </>
                      ) : (
                        <form className="manual-record-form" onSubmit={saveManualCareEvent}>
                          <div className="manual-record-type-tabs" role="tablist" aria-label="手动记录类型">
                            {MANUAL_RECORD_TYPES.map((option) => (
                              <button
                                type="button"
                                role="tab"
                                aria-selected={manualRecordKind === option.type}
                                className={manualRecordKind === option.type ? "active" : ""}
                                key={option.type}
                                onClick={() => selectManualRecordKind(option.type)}
                              >
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                          <p className="manual-record-type-hint">
                            {MANUAL_RECORD_TYPES.find((option) => option.type === manualRecordKind)?.hint}
                          </p>
                          <div className="manual-record-fields">
                            <fieldset className="manual-picker-field wide">
                              <legend>时间</legend>
                              <div className="manual-choice-grid manual-time-presets">
                                {MANUAL_TIME_PRESETS.map((option) => {
                                  const value = timePresetValue(option.offsetMinutes);
                                  return (
                                    <button
                                      type="button"
                                      className={careEventDraft.time === value ? "active" : ""}
                                      key={option.label}
                                      onClick={() => updateManualCareDraft({ time: value })}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <label className="manual-native-picker">
                                <span>精确时间</span>
                                <input
                                  type="time"
                                  value={normalizeClockText(careEventDraft.time) ?? currentClockText()}
                                  onChange={(inputEvent) => updateManualCareDraft({ time: inputEvent.target.value })}
                                />
                              </label>
                            </fieldset>

                            {manualRecordKind === "milk" ? (
                              <>
                                <fieldset className="manual-stepper-field">
                                  <legend>奶量</legend>
                                  <div className="manual-stepper">
                                    <button type="button" aria-label="减少奶量" onClick={() => adjustManualNumericDraft("amountMl", -10, 120, 10, 300)}>
                                      -
                                    </button>
                                    <strong>
                                      {careEventDraft.amountMl || "--"}
                                      <small>ml</small>
                                    </strong>
                                    <button type="button" aria-label="增加奶量" onClick={() => adjustManualNumericDraft("amountMl", 10, 120, 10, 300)}>
                                      +
                                    </button>
                                  </div>
                                  <div className="manual-choice-grid">
                                    {MANUAL_MILK_AMOUNTS.map((amount) => (
                                      <button
                                        type="button"
                                        className={careEventDraft.amountMl === String(amount) ? "active" : ""}
                                        key={amount}
                                        onClick={() => updateManualCareDraft({ amountMl: String(amount) })}
                                      >
                                        {amount}ml
                                      </button>
                                    ))}
                                  </div>
                                </fieldset>
                                <fieldset className="manual-picker-field">
                                  <legend>奶的类型</legend>
                                  <div className="manual-choice-grid">
                                    {MANUAL_MILK_NOTES.map((note) => (
                                      <button
                                        type="button"
                                        className={careEventDraft.note === note ? "active" : ""}
                                        key={note}
                                        onClick={() => updateManualCareDraft({ note })}
                                      >
                                        {note}
                                      </button>
                                    ))}
                                  </div>
                                </fieldset>
                              </>
                            ) : null}

                            {manualRecordKind === "sleep" ? (
                              <fieldset className="manual-stepper-field wide">
                                <legend>睡眠时长</legend>
                                <div className="manual-stepper">
                                  <button type="button" aria-label="减少睡眠时长" onClick={() => adjustManualNumericDraft("durationHours", -0.25, 1, 0.25, 16, 2)}>
                                    -
                                  </button>
                                  <strong>{sleepDurationText(careEventDraft.durationHours)}</strong>
                                  <button type="button" aria-label="增加睡眠时长" onClick={() => adjustManualNumericDraft("durationHours", 0.25, 1, 0.25, 16, 2)}>
                                    +
                                  </button>
                                </div>
                                <div className="manual-choice-grid manual-choice-grid--wide">
                                  {MANUAL_SLEEP_DURATIONS.map((duration) => (
                                    <button
                                      type="button"
                                      className={careEventDraft.durationHours === duration.value ? "active" : ""}
                                      key={duration.value}
                                      onClick={() => updateManualCareDraft({ durationHours: duration.value })}
                                    >
                                      {duration.label}
                                    </button>
                                  ))}
                                </div>
                              </fieldset>
                            ) : null}

                            {manualRecordKind === "temperature" ? (
                              <fieldset className="manual-stepper-field wide">
                                <legend>体温</legend>
                                <div className="manual-stepper">
                                  <button type="button" aria-label="降低体温" onClick={() => adjustManualNumericDraft("temperature", -0.1, 36.8, 34, 42, 1)}>
                                    -
                                  </button>
                                  <strong>
                                    {careEventDraft.temperature || "未选择"}
                                    <small>°C</small>
                                  </strong>
                                  <button type="button" aria-label="升高体温" onClick={() => adjustManualNumericDraft("temperature", 0.1, 36.8, 34, 42, 1)}>
                                    +
                                  </button>
                                </div>
                                <div className="manual-choice-grid manual-choice-grid--wide">
                                  {MANUAL_TEMPERATURE_OPTIONS.map((temperature) => {
                                    const value = numericDraftText(temperature, 1);
                                    return (
                                      <button
                                        type="button"
                                        className={careEventDraft.temperature === value ? "active" : ""}
                                        key={value}
                                        onClick={() => updateManualCareDraft({ temperature: value })}
                                      >
                                        {value}°C
                                      </button>
                                    );
                                  })}
                                </div>
                              </fieldset>
                            ) : null}

                            {manualRecordKind === "poop" ? (
                              <fieldset className="manual-picker-field wide">
                                <legend>状态</legend>
                                <div className="manual-choice-grid manual-choice-grid--wide">
                                  {MANUAL_POOP_NOTES.map((note) => (
                                    <button
                                      type="button"
                                      className={careEventDraft.note === note ? "active" : ""}
                                      key={note}
                                      onClick={() => updateManualCareDraft({ note })}
                                    >
                                      {note}
                                    </button>
                                  ))}
                                </div>
                              </fieldset>
                            ) : null}

                            {manualRecordKind === "solid" ? (
                              <fieldset className="manual-picker-field wide">
                                <legend>辅食</legend>
                                <div className="manual-choice-grid manual-choice-grid--wide">
                                  {MANUAL_SOLID_NOTES.map((note) => (
                                    <button
                                      type="button"
                                      className={careEventDraft.note === note ? "active" : ""}
                                      key={note}
                                      onClick={() => updateManualCareDraft({ note })}
                                    >
                                      {note}
                                    </button>
                                  ))}
                                </div>
                              </fieldset>
                            ) : null}
                          </div>
                          <div className="records-manual-actions">
                            <button type="button" className="quiet" onClick={closeRecordsEntryDrawer}>
                              取消
                            </button>
                            <button type="submit">保存记录</button>
                          </div>
                        </form>
                      )}
                    </div>
                  </section>
                </div>,
                document.body,
              )
            : null}

          {recordView === "today" ? (
          <section className="summary-card">
            <div className="summary-title">
              <CalendarDays size={18} />
              <span>{selectedDateIsToday ? "今日信息" : "当天信息"}</span>
              {!canCaregive ? <span className="readonly-pill">仅查看</span> : null}
            </div>
            <div className="record-summary-grid">
              <div className="summary-metric growth">
                <img className="summary-metric-icon" src={growthIcon} alt="" />
                <span>成长</span>
                <strong>{selectedGrowthCount} 条</strong>
                <small>{selectedGrowthCount ? "已归档" : "暂无成长"}</small>
              </div>
              <div className="summary-metric keypoint">
                <img className="summary-metric-icon" src={recordsIcon} alt="" />
                <span>关键点</span>
                <strong>{selectedKeyPointCount} 条</strong>
                <small>{selectedKeyPointCount ? "已进入时间线" : selectedDateIsToday ? "等你确认记录" : "暂无归档"}</small>
              </div>
            </div>
            <div className="daily-care-breakdown">
              {dailyCareBreakdowns.map((metric) => (
                <article className={`daily-care-bar-card daily-${metric.key}`} key={metric.key}>
                  <header>
                    <div>
                      <span>{metric.label}</span>
                    </div>
                    <small>{metric.countLabel}</small>
                  </header>
                  {metric.segments.length ? (
                    <>
                      <div className="daily-segment-track" aria-label={`${metric.label}当天分段`}>
                        {metric.segments.map((segment) => (
                          <span
                            className="daily-segment"
                            key={segment.id}
                            style={{ flexGrow: Math.max(segment.grow, 0.1) }}
                            title={`${segment.time ? `${segment.time} ` : ""}${segment.label}`}
                          >
                            <b>
                              {segment.time ? <span>{segment.time}</span> : null}
                              <span>{segment.label}</span>
                            </b>
                          </span>
                        ))}
                      </div>
                      {metric.markers.length ? (
                        <div className="daily-care-times" aria-label={`${metric.label}关键时间`}>
                          {metric.markers.map((marker) => (
                            <span key={marker.id}>
                              <b>{marker.time}</b>
                              <em>{marker.label}</em>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="daily-care-empty">{metric.emptyLabel}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {recordView === "trend" ? (
          <section className="trend-card">
            <div className="section-title">
              <LineChart size={18} />
              <h2>近 7 天分段对比</h2>
            </div>
            {weeklyCareComparison.hasData ? (
              <div className="week-care-chart">
                <article className="week-care-metric week-care-milk">
                  <header>
                    <div>
                      <span>奶量</span>
                      <strong>每天总量，一段代表一次</strong>
                    </div>
                    <small>{weeklyCareComparison.milkAverageLabel}</small>
                  </header>
                  <div className="week-single-bars" aria-label="近7天奶量变化">
                    {weeklyCareComparison.days.map((day) => (
                      <div className={`week-care-day ${day.selected ? "selected" : ""}`} key={`${day.date}-milk`}>
                        <div className="week-value-label">{day.milkValue !== undefined ? <span>{compactValue(day.milkValue, "ml")}</span> : null}</div>
                        <span
                          className={`week-bar-track week-milk ${day.milkValue === undefined ? "empty" : ""}`}
                          title={`${day.date} 奶量 ${compactValue(day.milkValue, "ml")} ${day.milkCount ? `${day.milkCount}次` : ""}`}
                        >
                          <span className="week-segment-stack" style={{ "--bar-height": `${day.milkHeight}%` } as CSSProperties}>
                            {day.milkSegments.map((value, index) => (
                              <i key={`${day.date}-milk-${index}`} style={{ flexGrow: Math.max(value, 0.1) }} />
                            ))}
                          </span>
                        </span>
                        <em>{day.label}</em>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="week-care-metric week-care-sleep">
                  <header>
                    <div>
                      <span>睡眠</span>
                      <strong>每天总时长，一段代表一段睡眠</strong>
                    </div>
                    <small>{weeklyCareComparison.sleepAverageLabel}</small>
                  </header>
                  <div className="week-single-bars" aria-label="近7天睡眠变化">
                    {weeklyCareComparison.days.map((day) => (
                      <div className={`week-care-day ${day.selected ? "selected" : ""}`} key={`${day.date}-sleep`}>
                        <div className="week-value-label">{day.sleepValue !== undefined ? <span>{compactValue(day.sleepValue, "h", 1)}</span> : null}</div>
                        <span
                          className={`week-bar-track week-sleep ${day.sleepValue === undefined ? "empty" : ""}`}
                          title={`${day.date} 睡眠 ${compactValue(day.sleepValue, "h", 1)} ${day.sleepCount ? `${day.sleepCount}段` : ""}`}
                        >
                          <span className="week-segment-stack" style={{ "--bar-height": `${day.sleepHeight}%` } as CSSProperties}>
                            {day.sleepSegments.map((value, index) => (
                              <i key={`${day.date}-sleep-${index}`} style={{ flexGrow: Math.max(value, 0.1) }} />
                            ))}
                          </span>
                        </span>
                        <em>{day.label}</em>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
              <p className="trend-empty">连续记录几天后，我会在这里汇总对比。</p>
            )}
          </section>
          ) : null}

          {recordView === "trend" ? (
          <section className="trend-card growth-trend-card">
            <div className="section-title">
              <LineChart size={18} />
              <h2>成长趋势</h2>
            </div>
            <div className="growth-trend-grid">
              {growthTrendMetrics.map((metric) => (
                <article className={`growth-trend-item ${metric.hasData ? "has-data" : "empty"}`} key={metric.key}>
                  <span>{metric.label}</span>
                  <strong>{metric.valueLabel}</strong>
                  <small>{metric.deltaLabel}</small>
                  <em>{metric.dateLabel}</em>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {recordView === "calendar" ? (
          <section className="calendar-card">
            <div className="calendar-head">
              <button type="button" title="上个月" onClick={() => setCalendarMonth((month) => addMonths(month, -1))}>
                <ChevronLeft size={18} />
              </button>
              <strong>{monthTitle(calendarMonth)}</strong>
              <button type="button" title="下个月" onClick={() => setCalendarMonth((month) => addMonths(month, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="weekday-grid">
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDates.map((date, index) =>
                date ? (
                  <button
                    type="button"
                    className={[
                      date === selectedDate ? "selected" : "",
                      date === todayISO() ? "today" : "",
                      eventDates.has(date) ? "has-event" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={date}
                    onClick={() => selectRecordDate(date)}
                  >
                    <span>{Number(date.slice(-2))}</span>
                  </button>
                ) : (
                  <span className="calendar-blank" key={`blank-${index}`} />
                ),
              )}
            </div>
          </section>
          ) : null}

          {recordView === "today" || recordView === "calendar" ? (
          <section className="day-timeline-card">
            <div className="section-title">
              <Clock3 size={18} />
              <h2>当天时间线</h2>
            </div>
            {selectedEvents.length ? (
              <div className="record-event-list">
                {selectedEvents.map((event) => (
                  <article className={`record-event ${event.type} event-${event.kind} ${swipedTimelineEventId === event.id ? "is-swiped" : ""}`.trim()} key={event.id}>
                    <div className="record-event-rail" aria-hidden="true">
                      <span />
                    </div>
                    <div className="record-event-content">
                      <time className="record-event-time">{event.timeLabel}</time>
                      <div
                        className="record-event-swipe"
                        onPointerDown={(pointerEvent) => beginTimelineEventSwipe(pointerEvent, event)}
                        onPointerUp={(pointerEvent) => finishTimelineEventSwipe(pointerEvent, event)}
                        onPointerCancel={cancelTimelineEventSwipe}
                      >
                        {canEditTimelineEvent(event) && editingCareEventId !== event.id ? (
                          <div className="record-event-actions" aria-hidden={swipedTimelineEventId !== event.id}>
                            <button type="button" className="timeline-action-button edit" onClick={() => beginEditCareTimelineEvent(event)}>
                              <PencilLine size={15} />
                              <span>编辑</span>
                            </button>
                            <button type="button" className="timeline-action-button delete" onClick={() => requestDeleteCareTimelineEvent(event)}>
                              <Trash2 size={15} />
                              <span>删除</span>
                            </button>
                          </div>
                        ) : null}
                        <div
                          className="record-event-card"
                          onClick={() => {
                            if (swipedTimelineEventId === event.id) setSwipedTimelineEventId("");
                          }}
                        >
                          <span className="record-event-icon" aria-hidden="true">
                            <img src={recordEventIconSrc(event)} alt="" />
                          </span>
                          <div className="record-event-copy">
                            <div className="record-event-primary">
                              <h3>{event.title}</h3>
                              <p>{event.body}</p>
                            </div>
                            <div className="record-event-secondary">
                              <div className="tag-row">
                                {event.tags.slice(0, 2).map((tag) => (
                                  <span key={tag}>{tag}</span>
                                ))}
                              </div>
                              {event.recordedBy ? <small className="record-creator">{creatorMetaText(event.recordedBy)}</small> : null}
                            </div>
                          </div>
                          {canCaregive && event.type === "care" && editingCareEventId === event.id ? (
                            <form className="timeline-edit-form" onSubmit={(formEvent) => saveCareTimelineEvent(formEvent, event)}>
                              <label>
                                <span>类型</span>
                                <StorySelect
                                  ariaLabel="时间线事件类型"
                                  value={careEventDraft.type}
                                  options={CARE_EVENT_TYPE_OPTIONS}
                                  onChange={(type) =>
                                    setCareEventDraft((current) => ({ ...current, type }))
                                  }
                                />
                              </label>
                              <label>
                                <span>时间</span>
                                <input
                                  value={careEventDraft.time}
                                  placeholder="例如 18:30"
                                  onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, time: inputEvent.target.value }))}
                                />
                              </label>
                              {careEventDraft.type === "milk" ? (
                                <label>
                                  <span>奶量 ml</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.amountMl}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, amountMl: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              {careEventDraft.type === "sleep" ? (
                                <label>
                                  <span>睡眠 h</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.durationHours}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, durationHours: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              {careEventDraft.type === "temperature" ? (
                                <label>
                                  <span>体温 °C</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.temperature}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, temperature: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              <label className="wide">
                                <span>备注</span>
                                <input
                                  value={careEventDraft.note}
                                  onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, note: inputEvent.target.value }))}
                                />
                              </label>
                              <div className="timeline-edit-actions">
                                <button type="button" className="quiet" onClick={() => setEditingCareEventId("")}>
                                  取消
                                </button>
                                <button type="submit">保存</button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-sticker" aria-hidden="true">
                  <img src={recordsIcon} alt="" />
                </span>
                <p>这一天还没有关键记录。</p>
                {canCaregive ? (
                  <button type="button" onClick={() => quickFill(`今天${babyNickname}发生了什么？`)}>
                    去补充记录
                  </button>
                ) : null}
              </div>
            )}
          </section>
          ) : null}

          {recordView === "growth" ? (
            <>
            <section className="growth-curve-card" aria-label="成长曲线">
              <div className="section-title">
                <LineChart size={18} />
                <h2>成长曲线</h2>
              </div>
              <div className="growth-curve-toolbar" role="tablist" aria-label="成长曲线指标">
                {GROWTH_MEASUREMENT_TYPES.map((type) => {
                  const meta = GROWTH_MEASUREMENT_META[type];
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={growthCurveType === type}
                      className={growthCurveType === type ? "active" : ""}
                      key={type}
                      onClick={() => setGrowthCurveType(type)}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              {growthCurveData.points.length ? (
                <div className="growth-curve-frame">
                  <div className="growth-curve-scale" aria-hidden="true">
                    <span>{growthCurveData.maxLabel}</span>
                    <span>{growthCurveData.minLabel}</span>
                  </div>
                  <svg className="growth-curve-svg" viewBox="0 0 304 144" role="img" aria-label={`${GROWTH_MEASUREMENT_META[growthCurveType].label}变化曲线`}>
                    <line x1="20" x2="284" y1="24" y2="24" />
                    <line x1="20" x2="284" y1="71" y2="71" />
                    <line x1="20" x2="284" y1="118" y2="118" />
                    <polyline points={growthCurveData.polyline} />
                    {growthCurveData.points.map((point) => (
                      <g key={point.id}>
                        <circle cx={point.x} cy={point.y} r="4.5" />
                        <text x={point.x} y="136" textAnchor="middle">
                          {point.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <p className="growth-curve-latest">最新：{growthCurveData.latestLabel}</p>
                </div>
              ) : (
                <p className="growth-curve-empty">先记录一笔{GROWTH_MEASUREMENT_META[growthCurveType].label}，这里会自动生成曲线。</p>
              )}
            </section>
            <section className="growth-entry-card" aria-label="宝宝成长">
              <div className="growth-entry-card-head">
                <h3>成长数据</h3>
                <button type="button" className="growth-entry-card-open" onClick={openGrowthEntry}>
                  {growthMeasurements.length ? "记录 / 查看" : "记一笔"}
                </button>
              </div>
              {growthMeasurements.length > 0 ? (
                <div className="growth-entry-card-stats">
                  {GROWTH_MEASUREMENT_TYPES.map((type) => {
                    const items = growthMeasurements
                      .filter((m) => m.type === type)
                      .sort((a, b) => a.date.localeCompare(b.date));
                    const latest = items[items.length - 1];
                    const meta = GROWTH_MEASUREMENT_META[type];
                    return (
                      <div className="growth-entry-card-stat" key={type}>
                        <span className="growth-entry-card-stat-label">{meta.label}</span>
                        <span className="growth-entry-card-stat-value">
                          {latest ? `${latest.value}${meta.unit}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="growth-entry-card-empty">可以先记一笔身高、体重或头围，之后会更容易回看变化。</p>
              )}
              <button type="button" className="growth-observation-row" onClick={openMilestones}>
                <span className="growth-observation-icon" aria-hidden="true">
                  <Sparkles size={16} />
                </span>
                <span className="growth-observation-copy">
                  <strong>成长观察</strong>
                  <small>记录宝宝最近出现的新动作和第一次</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </section>
            </>
          ) : null}
          </>
          )}
        </section>

        <LedgerView
          babyNickname={babyNickname}
          canCaregive={canCaregive}
          ledgerView={ledgerView}
          setLedgerView={setLedgerView}
          ledgerMonthKey={ledgerMonthKey}
          ledgerYearKey={ledgerYearKey}
          monthExpenses={monthExpenses}
          sortedExpenses={sortedExpenses}
          expenseMonthGroups={expenseMonthGroups}
          ledgerStats={ledgerStats}
          expenseBulkMode={expenseBulkMode}
          selectedExpenseIds={selectedExpenseIds}
          collapsedExpenseMonths={collapsedExpenseMonths}
          openNewExpenseEditor={openNewExpenseEditor}
          openLedgerAssistant={openLedgerAssistant}
          openEditExpenseEditor={openEditExpenseEditor}
          toggleExpenseBulkMode={toggleExpenseBulkMode}
          toggleExpenseMonthCollapse={toggleExpenseMonthCollapse}
          toggleExpenseSelection={toggleExpenseSelection}
          exitExpenseBulkMode={exitExpenseBulkMode}
          requestBulkDeleteExpenses={requestBulkDeleteExpenses}
          openPreviewAttachment={openPreviewAttachment}
        />


        <section className="album-screen tab-content-enter" aria-label="相册">
          <div className="screen-head">
            <div>
              <p className="eyebrow">相册</p>
              <h2>成长回忆库</h2>
            </div>
            <div className="screen-head-actions">
              <input
                ref={albumFileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                disabled={!canCaregive || isUploadingAlbumMedia}
                onChange={handleAlbumFiles}
              />
              <span className="screen-pill">{albumItems.length} 项素材</span>
              {canCaregive ? (
                <button
                  type="button"
                  className="screen-action-button album-upload-button"
                  title={isUploadingAlbumMedia ? "相册素材正在上传" : "上传到相册"}
                  disabled={isUploadingAlbumMedia}
                  onClick={openAlbumMediaPicker}
                >
                  <CameraIcon size={15} />
                  上传
                </button>
              ) : null}
            </div>
          </div>

          <div className="album-summary-strip">
            <span>
              <b>{albumStats.media}</b>
              素材
            </span>
            <span>
              <b>{albumStats.videos}</b>
              视频
            </span>
            <span>
              <b>{albumStats.categories}</b>
              分类
            </span>
          </div>

          <div className="album-category-row" role="tablist" aria-label="相册分类">
            {ALBUM_CATEGORIES.map((category) => (
              <button
                type="button"
                className={albumCategory === category.id ? "active" : ""}
                aria-selected={albumCategory === category.id}
                role="tab"
                key={category.id}
                onClick={() => setAlbumCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          {albumUploadItems.length ? (
            <div className="album-upload-list" aria-live="polite">
              {albumUploadItems.map((item) => (
                <div className={`album-upload-item upload-item ${item.status}`} key={item.id}>
                  <div className="album-upload-icon" aria-hidden="true">
                    {item.kind === "video" ? <Video size={17} /> : <ImageIcon size={17} />}
                  </div>
                  <div className="upload-copy">
                    <span title={item.name}>{item.name}</span>
                    <small>{item.message ?? (item.status === "uploading" ? `上传 ${item.progress}%` : "准备中")}</small>
                    <div className="upload-progress-track" aria-hidden="true">
                      <div className="upload-progress-bar" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {albumGroups.length ? (
            <div className="album-timeline" key={`album-timeline-${albumAnimationSeed}-${albumCategory}`}>
              {albumGroups.map((group, groupIndex) => (
                <section className="album-month-group" key={group.key}>
                  <div className="album-month-head">
                    <h3>{group.label}</h3>
                    <span>{group.items.length} 项</span>
                  </div>
                  <div className="album-photo-grid">
                    {distributeIntoColumns(group.items, 2, albumTileAspect).map((column, columnIndex) => (
                      <div className="album-photo-column" key={columnIndex}>
                        {column.map((item, itemIndex) => {
                          const attachment = item.attachment;
                          return (
                            <article
                              className={`album-photo-tile album-${item.category}`}
                              key={item.id}
                              style={
                                {
                                  "--aspect": albumTileAspect(item),
                                  "--tile-index": (groupIndex * 7 + columnIndex * 3 + itemIndex) % 18,
                                } as CSSProperties
                              }
                            >
                              <button
                                type="button"
                                className="album-photo-thumb"
                                data-vt-item={item.id}
                                onPointerDown={() => {
                                  if (attachment?.kind === "video") prefetchAlbumVideo(attachment.url);
                                }}
                                onClick={(event) => {
                                  if (attachment) openAlbumPreview(event, attachment, item);
                                }}
                                aria-label={`预览 ${item.title}`}
                                disabled={!attachment?.url}
                              >
                                {attachment?.kind === "video" ? (
                                  <AlbumVideoThumbnail
                                    attachment={attachment}
                                    title={item.title}
                                    onRatio={
                                      attachment.width && attachment.height
                                        ? undefined
                                        : (ratio) => recordAlbumRatio(attachment.id, ratio)
                                    }
                                  />
                                ) : attachment ? (
                                  <img
                                    src={attachmentListSrc(attachment)}
                                    alt={item.title}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={
                                      attachment.width && attachment.height
                                        ? undefined
                                        : (event) => {
                                            const el = event.currentTarget;
                                            if (el.naturalWidth && el.naturalHeight)
                                              recordAlbumRatio(attachment.id, el.naturalWidth / el.naturalHeight);
                                          }
                                    }
                                  />
                                ) : (
                                  <img src={albumCategoryIconSrc(item.category)} alt="" loading="lazy" decoding="async" />
                                )}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state album-empty">
              <span className="empty-sticker" aria-hidden="true">
                <img src={growthIcon} alt="" />
              </span>
              <p>还没有这个分类的回忆。</p>
              {canCaregive ? (
                <button type="button" onClick={openAlbumMediaPicker}>
                  上传到相册
                </button>
              ) : null}
            </div>
          )}
        </section>

        <section className="reminders-screen tab-content-enter" aria-label="提醒">
          <div className="screen-head">
            <div className="screen-heading-with-icon">
              {reminderManagementOpen ? (
                <button type="button" className="milestone-back" onClick={closeReminderManagement} aria-label="返回我的">
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              <div>
                <p className="eyebrow">我的</p>
                <h2>提醒管理</h2>
              </div>
            </div>
            <div className="screen-head-actions">
              <span className="screen-pill">{actionableReminderCount} 个未完成待办</span>
              {canCaregive ? (
                <button className="screen-action-button" type="button" onClick={openNewReminderEditor}>
                  <Bell size={16} />
                  新建
                </button>
              ) : null}
            </div>
          </div>

          {canCaregive ? (
            <div className="assistant-actions reminder-actions">
              {REMINDER_QUICK_ACTIONS.map((action) => (
                <button type="button" key={action.label} onClick={() => openReminderQuickDraft(action)}>
                  {action.label === "疫苗" || action.label === "喂药" ? <Syringe size={16} /> : <Bell size={16} />}
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="readonly-copy">当前身份仅可查看提醒，请让照护人新增或完成提醒。</p>
          )}

          {reminderBuckets.today.length === 0 &&
            reminderBuckets.upcoming.length === 0 &&
            reminderBuckets.overdue.length === 0 &&
            reminderBuckets.done.length === 0 ? (
              <div className="reminders-empty-hero">
                <img
                  src={emptyRemindersImg}
                  alt="还没有任何提醒"
                  width={200}
                  height={150}
                  className="reminders-empty-illustration"
                />
                <p className="reminders-empty-copy">还没有任何提醒。从上面点一个常用模板开始吧。</p>
              </div>
          ) : null}

          {[
            { key: "today", title: "今天要做", items: reminderBuckets.today, empty: "今天暂时没有待办。" },
            { key: "upcoming", title: "未来安排", items: reminderBuckets.upcoming, empty: "后面暂时没有安排。" },
            { key: "overdue", title: "已逾期", items: reminderBuckets.overdue, empty: "没有逾期任务。" },
            { key: "done", title: "已完成", items: reminderBuckets.done, empty: "完成后的提醒会留在这里。" },
          ].map((group) => (
            <section className={`reminder-group reminder-group-${group.key}`} key={group.key}>
              <div className="reminder-group-head">
                <h3>{group.title}</h3>
                <span>{group.items.length}</span>
              </div>
              {group.items.length ? (
                <div className="reminder-list">
                  {group.items.map((reminder) => (
                    <article className={`reminder-item ${reminder.category} status-${reminder.status}`} key={reminder.id}>
                      <div className="reminder-icon">
                        {reminder.category === "vaccine" ? <Syringe size={20} /> : <Clock3 size={20} />}
                      </div>
                      <div className="reminder-copy">
                        <h3>{reminder.title}</h3>
                        <p>{reminder.dueText}</p>
                        <div className="reminder-meta">
                          <span>{reminderScheduleLabel(reminder)}</span>
                          <span>{reminderAlertLabel(reminder)}</span>
                          <span>{reminderCategoryLabel(reminder.category)}</span>
                          <span>{reminderStatusLabel(reminder.status)}</span>
                          {reminderRepeatLabel(reminder) ? <span>{reminderRepeatLabel(reminder)}</span> : null}
                          {reminderSoundLabel(reminder) ? <span>{reminderSoundLabel(reminder)}</span> : null}
                          {reminderNotificationLabel(reminder) ? <span>{reminderNotificationLabel(reminder)}</span> : null}
                          <span>{reminder.history[0] ?? "来自家庭记录"}</span>
                        </div>
                      </div>
                      {canCaregive && reminder.status !== "done" ? (
                        <div className="reminder-card-actions">
                          <button type="button" title="标记完成" aria-label={`标记完成 ${reminder.title}`} onClick={() => requestCompleteReminder(reminder)}>
                            <CheckCircle2 size={18} />
                          </button>
                          <button type="button" title="延后提醒" aria-label={`延后提醒 ${reminder.title}`} onClick={() => requestPostponeReminder(reminder)}>
                            <Clock3 size={18} />
                          </button>
                          <button type="button" title="编辑提醒" aria-label={`编辑提醒 ${reminder.title}`} onClick={() => openEditReminderEditor(reminder)}>
                            <PencilLine size={18} />
                          </button>
                          <button type="button" title="删除提醒" aria-label={`删除提醒 ${reminder.title}`} onClick={() => requestDeleteReminder(reminder)}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="reminder-empty">{group.empty}</p>
              )}
            </section>
          ))}
          {reminderEditorOpen ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeReminderEditor}>
              <form
                className="story-modal reminder-editor reminder-form-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reminder-editor-title"
                onSubmit={saveReminderDraft}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="story-modal-head">
                  <div>
                    <p className="eyebrow">提醒设置</p>
                    <h3 id="reminder-editor-title">{editingReminderId ? "编辑提醒" : "新建提醒"}</h3>
                  </div>
                  <button type="button" className="icon-button" onClick={closeReminderEditor} aria-label="关闭">
                    <X size={18} />
                  </button>
                </div>
                <label>
                  提醒标题
                  <input
                    value={reminderDraft.title}
                    onChange={(event) => setReminderDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={reminderDraft.scheduleMode === "interval" ? "比如 喂奶提醒" : "比如 明天体检"}
                  />
                </label>
                <div className="reminder-editor-grid">
                  <label>
                    时间模式
                    <StorySelect
                      value={reminderDraft.scheduleMode}
                      options={REMINDER_SCHEDULE_MODE_OPTIONS}
                      ariaLabel="提醒时间模式"
                      onChange={(scheduleMode) => setReminderDraft((current) => ({ ...current, scheduleMode }))}
                    />
                  </label>
                  <label>
                    提醒方式
                    <StorySelect
                      value={reminderDraft.alertMode}
                      options={REMINDER_ALERT_MODE_OPTIONS}
                      ariaLabel="提醒方式"
                      onChange={(alertMode) => setReminderDraft((current) => ({ ...current, alertMode }))}
                    />
                  </label>
                </div>
                <div className="reminder-editor-grid">
                  <label>
                    分类
                    <StorySelect
                      value={reminderDraft.category}
                      options={REMINDER_CATEGORY_OPTIONS}
                      ariaLabel="提醒分类"
                      onChange={(category) => setReminderDraft((current) => ({ ...current, category }))}
                    />
                  </label>
                  {reminderDraft.alertMode === "ringing" ? (
                    <label>
                      提示音
                      <StorySelect
                        value={reminderDraft.soundId}
                        options={REMINDER_SOUND_OPTIONS}
                        ariaLabel="闹铃提示音"
                        onChange={(soundId) => setReminderDraft((current) => ({ ...current, soundId }))}
                      />
                    </label>
                  ) : null}
                </div>
                {reminderDraft.scheduleMode === "interval" ? (
                  <div className="reminder-alarm-fields">
                    <label>
                      循环间隔（分钟）
                      <input
                        type="number"
                        min={MIN_INTERVAL_MINUTES}
                        max={MAX_INTERVAL_MINUTES}
                        step="5"
                        value={reminderDraft.intervalMinutes}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, intervalMinutes: event.target.value }))}
                      />
                    </label>
                    <p className="form-help">喂奶类循环会优先按最近一次喝奶时间计算；其他循环按当前时间往后推。</p>
                  </div>
                ) : (
                  <div className="reminder-editor-grid">
                    <label>
                      日期
                      <input
                        type="date"
                        value={reminderDraft.dueDate}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      时间
                      <input
                        type="time"
                        value={reminderDraft.dueTime}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, dueTime: event.target.value }))}
                      />
                    </label>
                  </div>
                )}
                {!Capacitor.isNativePlatform() ? <p className="form-help">浏览器里只显示 App 内提醒；安装到移动 App 后会调度手机本地通知。</p> : null}
                <div className="story-modal-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeReminderEditor}>
                    取消
                  </button>
                  <button type="submit" className="screen-action-button">
                    <Save size={16} />
                    保存
                  </button>
                </div>
              </form>
            </div>
          ) : null}
          {postponeReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closePostponeReminderConfirm}>
              <div
                className="story-modal reminder-action-modal reminder-postpone-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="postpone-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge complete-confirm-badge" aria-hidden="true">
                  <Clock3 size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">延后提醒</p>
                  <h3 id="postpone-reminder-title">延后到什么时候？</h3>
                  <p>选择新的提醒时间后，会取消当前已安排的手机通知并重新安排。</p>
                </div>
                <div className="reminder-postpone-fields">
                  <label>
                    日期
                    <input
                      type="date"
                      value={postponeReminderDraft.dueDate}
                      onChange={(event) => setPostponeReminderDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    时间
                    <input
                      type="time"
                      value={postponeReminderDraft.dueTime}
                      onChange={(event) => setPostponeReminderDraft((current) => ({ ...current, dueTime: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closePostponeReminderConfirm}>
                    先不延后
                  </button>
                  <button type="button" className="screen-action-button" onClick={() => void confirmPostponeReminder()}>
                    <Clock3 size={16} />
                    确认延后
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {completeReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeCompleteReminderConfirm}>
              <div
                className="story-modal reminder-action-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge complete-confirm-badge" aria-hidden="true">
                  <CheckCircle2 size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">完成提醒</p>
                  <h3 id="complete-reminder-title">
                    {isIntervalReminder(completeReminderTarget) ? "关闭本次提醒吗？" : "确认已经完成了吗？"}
                  </h3>
                  <p>
                    {isIntervalReminder(completeReminderTarget)
                      ? `“${completeReminderTarget.title}”会关闭本次提醒，并按当前时间重新安排下一次。`
                      : `“${completeReminderTarget.title}”会进入已完成，手机上已经安排的通知也会取消。`}
                  </p>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeCompleteReminderConfirm}>
                    先不完成
                  </button>
                  <button type="button" className="screen-action-button" onClick={() => void confirmCompleteReminder()}>
                    <CheckCircle2 size={16} />
                    确认完成
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {deleteReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeDeleteReminderConfirm}>
              <div
                className="story-modal reminder-action-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge" aria-hidden="true">
                  <BellOff size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">删除提醒</p>
                  <h3 id="delete-reminder-title">确定不再提醒吗？</h3>
                  <p>“{deleteReminderTarget.title}”会从提醒列表移除，已经安排的手机通知或闹铃也会一起取消。</p>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeDeleteReminderConfirm}>
                    先保留
                  </button>
                  <button type="button" className="screen-action-button danger" onClick={() => void confirmDeleteReminder()}>
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="profile-screen tab-content-enter" aria-label="我的">
          <>
          <div className="screen-head">
            <div className="screen-heading-with-icon">
              <img className="screen-head-icon" src={profileIcon} alt="" />
              <div>
                <p className="eyebrow">我的</p>
                <h2>小宝信息</h2>
              </div>
            </div>
            {isProfileEditing ? (
              <button className="screen-action-button quiet" type="button" onClick={cancelProfileEditing}>
                取消
              </button>
            ) : canCaregive ? (
              <button className="screen-action-button" type="button" onClick={startProfileEditing}>
                <PencilLine size={16} />
                编辑
              </button>
            ) : (
              <span className="readonly-pill">仅查看</span>
            )}
          </div>

          <section className="profile-panel app-profile-card">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <img className="storybook-photo-icon" src={companionAvatarIcon} alt="" />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{stageLabel(profile.stage)} · {ageLabel(profile.birthDate)} · {displayProfileValue(profile.region)}</p>
            </div>
            <div className="profile-highlights">
              <div>
                <span>喂养</span>
                <strong>{displayProfileValue(profile.feeding)}</strong>
              </div>
              <div>
                <span>照护人</span>
                <strong>{profile.caregivers.length} 位</strong>
              </div>
            </div>
          </section>

          {!isProfileEditing ? (
            <section className="profile-detail-card">
              <div className="profile-detail-row">
                <span>阶段</span>
                <strong>{stageLabel(profile.stage)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>出生日期</span>
                <strong>{formatFullDate(profile.birthDate)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>预产期</span>
                <strong>{formatFullDate(profile.expectedDate)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>地区</span>
                <strong>{displayProfileValue(profile.region)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>家庭</span>
                <strong>{authFamily?.name ?? "小宝家"}</strong>
              </div>
              <div className="profile-detail-row">
                <span>我的身份</span>
                <strong>{authMember?.roleName ?? "家庭成员"} · {canCaregive ? "照护人" : "仅查看"}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>OTA 版本</span>
                <strong>{runtimeVersion.otaVersion}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>运行状态</span>
                <strong>{runtimeVersion.status} · {runtimeVersion.platform}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>原生版本</span>
                <strong>{runtimeVersion.nativeVersion}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>后端接口</span>
                <strong>{apiBaseUrl}</strong>
              </div>
              <div className="profile-detail-group">
                <span>过敏信息</span>
                <div className="profile-chip-list">
                  {profile.allergies.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <div className="profile-detail-group family-member-group">
                <span>家庭照护人</span>
                <div className="profile-chip-list">
                  {profile.caregivers.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <button type="button" className="profile-reminder-card" onClick={openReminderManagement}>
                <span className="profile-reminder-card__icon" aria-hidden="true">
                  <Bell size={18} />
                </span>
                <span className="profile-reminder-card__copy">
                  <strong>提醒管理</strong>
                  <small>
                    {actionableReminderCount > 0
                      ? `${actionableReminderCount} 个未完成待办，到点会提醒`
                      : "暂无未完成待办，可以管理疫苗、喂药和照护事项"}
                  </small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <section className="profile-pro-card">
                <div className="daily-summary-head">
                  <div>
                    <span className="section-kicker">Pro 内测</span>
                    <h3>{proStatusText}</h3>
                  </div>
                  <span className={`pro-status-pill ${proTrial.enabled ? "enabled" : proApplicationPending ? "pending" : ""}`}>
                    {proTrial.enabled ? "家庭共享" : proApplicationPending ? "等待开通" : "可申请"}
                  </span>
                </div>
                <p>Pro 内测：图片/视频整理、账本 AI 等所有 AI 助手记录均不限次。Free 用户每月可免费体验，用完后申请内测即可继续。</p>
                {!proTrial.enabled && typeof proTrial.freeCallsRemaining === "number" ? (
                  <p className="pro-free-quota-note">
                    本月免费 AI 体验还剩 <b>{proTrial.freeCallsRemaining}</b>
                    {typeof proTrial.freeMonthlyQuota === "number" ? ` / ${proTrial.freeMonthlyQuota}` : ""} 次
                  </p>
                ) : null}
                <div className="ai-usage-panel" aria-label="AI 用量">
                  <div className="ai-usage-head">
                    <div>
                      <span>近 {aiUsageSummary?.days ?? 30} 天 AI 用量</span>
                      <strong>{aiUsageStatus === "loading" && !aiUsageSummary ? "读取中" : `${formatTokenCount(aiUsageSummary?.totalTokens)} tokens`}</strong>
                    </div>
                    <button
                      type="button"
                      className="ai-usage-refresh"
                      onClick={() => void refreshAiUsageSummary({ quiet: false })}
                      disabled={aiUsageStatus === "loading"}
                      aria-label="刷新 AI 用量"
                      title="刷新 AI 用量"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  {aiUsageSummary ? (
                    <>
                      <div className="ai-usage-metrics">
                        <span>
                          <small>调用</small>
                          <b>{formatTokenCount(aiUsageSummary.requestCount)}</b>
                        </span>
                        <span>
                          <small>输入</small>
                          <b>{formatTokenCount(aiUsageSummary.inputTokens)}</b>
                        </span>
                        <span>
                          <small>输出</small>
                          <b>{formatTokenCount(aiUsageSummary.outputTokens)}</b>
                        </span>
                      </div>
                      {aiUsageTopFeatures.length ? (
                        <div className="ai-usage-breakdown">
                          {aiUsageTopFeatures.map((item) => (
                            <span key={item.key}>
                              {aiUsageFeatureLabel(item.feature)}
                              <b>{formatTokenCount(item.totalTokens)}</b>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="ai-usage-note">
                        {aiUsageTopModel ? `主要模型：${aiUsageModelLabel(aiUsageTopModel)}` : "还没有可统计的 AI 调用。"}
                        {aiUsageSummary.unmeteredRequestCount > 0 ? ` 另有 ${aiUsageSummary.unmeteredRequestCount} 次流式调用暂未回传 token。` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="ai-usage-note">{aiUsageStatus === "error" ? "用量暂时读取失败，可以稍后刷新。" : "正在读取家庭 AI 用量。"}</p>
                  )}
                </div>
                {/* R1 (REQ-PRO-001): Pro gating 已启用，非 Pro 家庭展示申请入口 */}
                {!proTrial.enabled ? (
                  <>
                    <div className="pro-redeem-row">
                      <input
                        className="pro-redeem-input"
                        type="text"
                        autoCapitalize="characters"
                        placeholder="输入内测码"
                        value={redeemCodeInput}
                        onChange={(event) => setRedeemCodeInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void redeemProTrialCode();
                        }}
                        disabled={isRedeemingProCode}
                        aria-label="输入内测码"
                      />
                      <button
                        className="pro-redeem-button"
                        type="button"
                        onClick={() => void redeemProTrialCode()}
                        disabled={isRedeemingProCode || !redeemCodeInput.trim()}
                      >
                        {isRedeemingProCode ? "兑换中" : "兑换"}
                      </button>
                    </div>
                    <button
                      className="screen-action-button"
                      type="button"
                      onClick={() => void applyForProTrial("profile")}
                      disabled={isApplyingProTrial || proApplicationPending}
                    >
                      <Sparkles size={16} />
                      {proApplicationPending ? "已提交申请" : "没有码？申请 Pro 内测"}
                    </button>
                  </>
                ) : null}
              </section>
              <section className="profile-detail-card family-members-card" aria-label="家庭成员">
                <div className="family-members-head">
                  <span className="section-kicker"><Users size={14} aria-hidden="true" /> 家庭成员</span>
                  {familyMembers?.canManage ? (
                    <button
                      type="button"
                      className="family-invite-reset"
                      onClick={() => void handleResetFamilyInviteCode()}
                      disabled={familyMemberBusyUserId === "__reset__"}
                    >
                      <RefreshCw size={14} aria-hidden="true" /> 重置邀请码
                    </button>
                  ) : null}
                </div>
                {familyMembersStatus === "loading" && !familyMembers ? (
                  <p className="family-members-empty">正在加载家庭成员…</p>
                ) : familyMembers && familyMembers.members.length ? (
                  <ul className="family-members-list">
                    {familyMembers.members.map((member) => (
                      <li key={member.userId} className="family-member-row">
                        <div className="family-member-main">
                          <strong>{member.roleName}{member.self ? "（我）" : ""}</strong>
                          <small>{member.maskedPhone || "—"} · {member.caregiver ? "照护人" : "仅查看"}</small>
                        </div>
                        {familyMembers.canManage && !member.self ? (
                          <div className="family-member-actions">
                            <button
                              type="button"
                              onClick={() => void handleToggleMemberCaregiver(member)}
                              disabled={familyMemberBusyUserId === member.userId}
                            >
                              {member.caregiver ? "设为仅查看" : "设为照护人"}
                            </button>
                            <button
                              type="button"
                              className="family-member-remove"
                              onClick={() => void handleRemoveFamilyMember(member)}
                              disabled={familyMemberBusyUserId === member.userId}
                              aria-label={`移除 ${member.roleName}`}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="family-members-empty">
                    还没有其他成员。{familyMembers?.canManage ? "把邀请码发给家人即可加入。" : ""}
                  </p>
                )}
                {resetInviteCodeValue ? (
                  <div className="family-invite-result">
                    <span>新邀请码（仅显示这一次，请发给家人）</span>
                    <strong>{resetInviteCodeValue}</strong>
                  </div>
                ) : null}
              </section>
              {canCaregive ? (
                <button className="profile-edit-button" type="button" onClick={startProfileEditing}>
                  <PencilLine size={18} />
                  编辑小宝资料
                </button>
              ) : (
                <p className="readonly-copy">当前身份可以查看家庭共享记录，不能修改小宝资料或写入照护日志。</p>
              )}
              <section className="profile-detail-card profile-legal-card" aria-label="隐私与说明">
                <div className="profile-legal-links">
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("privacy")}>
                    <span>隐私政策</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("terms")}>
                    <span>用户协议</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("children")}>
                    <span>儿童信息说明</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="profile-legal-ai-row">
                  <span>AI 会怎么用你的记录</span>
                  <AiDataNotice />
                </div>
              </section>
              <button className="profile-logout-button" type="button" onClick={() => void handleLogout()}>
                退出登录{(authUser?.maskedPhone ?? authUser?.phone) ? `（${authUser?.maskedPhone ?? authUser?.phone}）` : ""}
              </button>
            </section>
          ) : (
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <label>
                <span>昵称</span>
                <input
                  value={profileDraft.nickname}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, nickname: event.target.value }))}
                />
              </label>
              <label>
                <span>阶段</span>
                <StorySelect
                  ariaLabel="小宝阶段"
                  value={profileDraft.stage}
                  options={STAGE_SELECT_OPTIONS}
                  onChange={(stage) =>
                    setProfileDraft((current) => ({ ...current, stage }))
                  }
                />
              </label>
              <label>
                <span>性别</span>
                <StorySelect
                  ariaLabel="小宝性别"
                  value={profileDraft.gender}
                  options={GENDER_SELECT_OPTIONS}
                  onChange={(gender) => setProfileDraft((current) => ({ ...current, gender }))}
                />
              </label>
              <label>
                <span>出生日期</span>
                <input
                  type="date"
                  value={profileDraft.birthDate}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, birthDate: event.target.value }))}
                />
              </label>
              <label>
                <span>预产期</span>
                <input
                  type="date"
                  value={profileDraft.expectedDate}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, expectedDate: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>出生体重（kg）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="选填，用于生长曲线起点"
                  value={profileDraft.birthWeight ?? ""}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      birthWeight: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label>
                <span>出生身长（cm）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="选填，用于生长曲线起点"
                  value={profileDraft.birthHeight ?? ""}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      birthHeight: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label>
                <span>地区</span>
                <StorySelect
                  ariaLabel="地区"
                  value={profileDraft.region}
                  options={selectOptionsWithCurrent(REGION_SELECT_OPTIONS, profileDraft.region)}
                  onChange={(region) => setProfileDraft((current) => ({ ...current, region }))}
                />
              </label>
              <label>
                <span>喂养方式</span>
                <StorySelect
                  ariaLabel="喂养方式"
                  value={profileDraft.feeding}
                  options={selectOptionsWithCurrent(FEEDING_SELECT_OPTIONS, profileDraft.feeding)}
                  onChange={(feeding) => setProfileDraft((current) => ({ ...current, feeding }))}
                />
              </label>
              <label>
                <span>过敏信息</span>
                <input value={allergiesText} onChange={(event) => setAllergiesText(event.target.value)} />
              </label>
              <div className="profile-form-note">
                <strong>家庭照护人</strong>
                <span>{profile.caregivers.join("、") || "暂无照护人"}</span>
                <small>照护人来自家庭成员，不能在小宝资料里手动修改。</small>
              </div>
              <div className="profile-form-actions">
                <button className="cancel-profile-button" type="button" onClick={cancelProfileEditing}>
                  <X size={18} />
                  取消
                </button>
                <button className="save-profile-button" type="submit">
                  <Save size={18} />
                  保存
                </button>
              </div>
            </form>
          )}
          </>
        </section>

        <aside className="right-rail">
          <section className="insight-panel">
            <div className="section-title">
              <LineChart size={18} />
              <h2>今日照护</h2>
            </div>
            <div className="care-grid">
              <div className="care-tile milk">
                <img className="care-tile-icon" src={milkIcon} alt="" />
                <span>奶量</span>
                <strong>{todayLog?.milkMl ? `${todayLog.milkMl} ml` : "待记录"}</strong>
                <small>{milkTrend}</small>
              </div>
              <div className="care-tile sleep">
                <img className="care-tile-icon" src={sleepIcon} alt="" />
                <span>睡眠</span>
                <strong>{todayLog?.sleepHours ? `${todayLog.sleepHours} h` : "待记录"}</strong>
                <small>{todayLog?.wakes ? `夜醒 ${todayLog.wakes} 次` : "夜醒待记录"}</small>
              </div>
              <div className="care-tile soothe">
                <img className="care-tile-icon" src={temperatureIcon} alt="" />
                <span>哄睡</span>
                <strong>{todayLog?.soothing ? soothingText[todayLog.soothing] : "待观察"}</strong>
                <small>{todayLog?.temperature ? `体温 ${todayLog.temperature}` : "还没看到体温备注"}</small>
              </div>
              <div className="care-tile food">
                <img className="care-tile-icon" src={solidIcon} alt="" />
                <span>辅食</span>
                <strong>{todayLog?.solids?.[0] ?? "未添加"}</strong>
                <small>{profile.allergies.join("、")}</small>
              </div>
            </div>
          </section>

          <section className="timeline-panel">
            <div className="section-title">
              <Sparkles size={18} />
              <h2>成长时间线</h2>
            </div>
            <div className="timeline">
              {[...growthEvents].reverse().slice(0, 5).map((event) => (
                <article className="timeline-item" key={event.id}>
                  <time>{formatDate(event.date)}</time>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.summary}</p>
                    <div className="tag-row">
                      {event.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      {event.mediaKind ? <span>{event.mediaKind === "video" ? "视频" : "照片"}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="reminder-panel">
            <div className="section-title">
              <Bell size={18} />
              <h2>提醒追踪</h2>
            </div>
            <div className="reminder-list">
              {openReminders.slice(0, 5).map((reminder) => (
                <article className={`reminder-item ${reminder.category}`} key={reminder.id}>
                  <div className="reminder-icon">
                    {reminder.category === "vaccine" ? <Syringe size={18} /> : <Clock3 size={18} />}
                  </div>
                  <div>
                    <h3>{reminder.title}</h3>
                    <p>{reminder.dueText}</p>
                  </div>
                  <button type="button" title="标记完成" onClick={() => requestCompleteReminder(reminder)}>
                    <CheckCircle2 size={18} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="assistant-panel">
            <div className="assistant-card">
              <ShieldAlert size={20} />
              <p>健康、疫苗、用药相关内容只做记录和提醒，宝宝不舒服时以医生和社区医院安排为准。</p>
            </div>
            <div className="assistant-card native-card">
              <Smartphone size={20} />
              <p>已按移动 App 架构准备：手机端使用原生相册和本地通知，浏览器端保留预览能力。</p>
            </div>
            <div className="assistant-actions">
              <button type="button" onClick={() => quickFill(`下周二提醒我带${babyNickname}去社区医院打疫苗`)}>
                <Syringe size={16} />
                疫苗
              </button>
              <button type="button" onClick={() => quickFill(`${babyNickname}最近喜欢白噪音和轻拍，10 点左右容易闹觉`)}>
                <Music2 size={16} />
                哄睡
              </button>
            </div>
          </section>
        </aside>
      </div>

      <nav className="mobile-tabbar" aria-label="移动端导航" style={{ "--tab-count": visibleTabs.length } as CSSProperties}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMobileTab === tab.id;
          return (
            <button
              type="button"
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
              key={tab.id}
              onClick={() => switchMobileTab(tab.id)}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      {voiceRecordingActive
        ? createPortal(
            <div
              className={`voice-recording-panel ${voiceCancelArmed ? "canceling" : ""}`.trim()}
              style={voiceButtonStyle}
              role="status"
              aria-live="polite"
            >
              <div className="voice-recording-copy">
                <strong>{voicePanelLabel}</strong>
              </div>
              <div className="voice-wave-bars" aria-hidden="true">
                {Array.from({ length: 56 }, (_, index) => (
                  <span
                    className="voice-wave-bar"
                    key={index}
                    style={{ "--bar-scale": (0.62 + ((index * 7) % 11) / 20).toFixed(2) } as CSSProperties}
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
      {expenseEditorDialog}
      {deleteCareEventDialog}
      {deleteExpenseDialog}
      {bulkDeleteExpensesDialog}
      {settingsLegalDoc ? (
        <LegalDocModal docId={settingsLegalDoc} onClose={() => setSettingsLegalDoc(null)} />
      ) : null}
      {ringingReminder ? (
        <div className="alarm-ringing-overlay" role="dialog" aria-modal="true" aria-labelledby="alarm-ringing-title">
          <div className="alarm-ringing-scene" aria-hidden="true">
            <img src={alarmSceneImage} alt="" />
            <span className="alarm-ringing-glow" />
          </div>
          <section className="alarm-ringing-card">
            <p className="eyebrow">小宝闹铃提醒</p>
            <h2 id="alarm-ringing-title">到提醒时间啦</h2>
            <p className="alarm-ringing-rule">
              {ringingReminder.title}
              {ringingReminder.repeatRule ? ` · 每 ${formatIntervalText(ringingReminder.repeatRule.intervalMinutes)}` : ""}
            </p>
            <p className="alarm-ringing-due">{ringingReminder.dueText || "轻轻看看这次提醒"}</p>
            <button type="button" className="screen-action-button alarm-ringing-close" onClick={() => void closeRingingReminder()}>
              <BellOff size={18} />
              关闭本次
            </button>
            <p className="alarm-ringing-helper">
              {isIntervalReminder(ringingReminder) ? "关闭后会自动安排下一次提醒" : "关闭后本次提醒结束"}
            </p>
          </section>
        </div>
      ) : null}
      {previewAttachment?.url ? (
        <div
          className={`media-preview ${previewMotion}${PREVIEW_VT ? " vt-mode" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="附件预览"
          style={
            previewOriginRect
              ? ({
                  "--preview-flip": `translate(${previewOriginRect.left}px, ${previewOriginRect.top}px) scale(${
                    previewOriginRect.width / (window.innerWidth || 1)
                  }, ${previewOriginRect.height / (window.innerHeight || 1)})`,
                  "--preview-to": "top left",
                } as CSSProperties)
              : undefined
          }
          onClick={handlePreviewClick}
        >
          <div className="media-preview-topbar" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="preview-close"
              aria-label="关闭"
              onClick={(event) => {
                event.stopPropagation();
                closePreviewAttachment();
              }}
            >
              <X size={20} />
            </button>
            {previewAlbumItem ? (
              <div className="media-preview-topinfo">
                <strong>{previewAlbumItem.title}</strong>
                <span>{formatFullDate(previewAlbumItem.date)} · {albumCategoryLabel(previewAlbumItem.category)}</span>
                {previewAlbumItem.recordedBy ? <small>{creatorMetaText(previewAlbumItem.recordedBy)}</small> : null}
              </div>
            ) : null}
            {previewAlbumItem && canCaregive ? (
              <div className="media-preview-menu">
                <button
                  type="button"
                  className="preview-menu-button"
                  aria-label="更多操作"
                  aria-expanded={previewActionsOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewActionsOpen((open) => !open);
                  }}
                >
                  <MoreHorizontal size={20} />
                </button>
                {previewActionsOpen ? (
                  <div className="preview-menu-popover">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPreviewActionsOpen(false);
                        editAlbumItem(previewAlbumItem);
                      }}
                    >
                      <PencilLine size={15} />
                      编辑
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPreviewActionsOpen(false);
                        void removeAlbumItem(previewAlbumItem);
                      }}
                    >
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <figure
            className={previewAlbumItem ? "album-preview-figure" : undefined}
            onPointerDown={onPreviewStagePointerDown}
            onPointerMove={onPreviewStagePointerMove}
            onPointerUp={onPreviewStagePointerEnd}
            onPointerCancel={onPreviewStagePointerEnd}
          >
            {previewAlbumItem && previewCarouselItems.length ? (
              <div className="media-preview-carousel">
                <div className="media-preview-track" ref={previewCarouselTrackRef}>
                  {previewCarouselItems.map((item, index) => {
                    const attachment = item?.attachment;
                    const isCurrent = item?.id === previewAlbumItem.id;
                    return (
                      <div className={`media-preview-slide ${isCurrent ? "current" : ""} ${attachment ? "" : "empty"}`} key={`preview-slide-${index}`}>
                        {attachment?.url ? (
                          attachment.kind === "video" ? (
                            isCurrent ? (
                              <PreviewVideoPlayer attachment={attachment} active bindVideo={bindPreviewVideo} />
                            ) : (
                              <img src={attachment.thumbnailUrl || attachment.url} alt={attachment.name} draggable={false} />
                            )
                          ) : (
                            <img
                              className={isCurrent && previewTransform.scale > 1 ? "is-zoomed" : ""}
                              src={attachment.url}
                              alt={attachment.name}
                              draggable={false}
                              style={isCurrent
                                ? {
                                    transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
                                  }
                                : undefined}
                              onPointerDown={isCurrent ? onPreviewImagePointerDown : undefined}
                              onPointerMove={isCurrent ? onPreviewImagePointerMove : undefined}
                              onPointerUp={isCurrent ? onPreviewImagePointerEnd : undefined}
                              onPointerCancel={isCurrent ? onPreviewImagePointerEnd : undefined}
                            />
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : previewAttachment.kind === "video" ? (
              <PreviewVideoPlayer attachment={previewAttachment} active bindVideo={bindPreviewVideo} />
            ) : (
              <img
                className={previewTransform.scale > 1 ? "is-zoomed" : ""}
                src={previewAttachment.url}
                alt={previewAttachment.name}
                draggable={false}
                style={{
                  transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
                }}
                onPointerDown={onPreviewImagePointerDown}
                onPointerMove={onPreviewImagePointerMove}
                onPointerUp={onPreviewImagePointerEnd}
                onPointerCancel={onPreviewImagePointerEnd}
              />
            )}
          </figure>
        </div>
      ) : null}
    </main>
  );
}

export default App;
