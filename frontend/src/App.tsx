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
  Music2,
  PartyPopper,
  ReceiptText,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Syringe,
  UserRound,
  Users,
  Video,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import "./styles/vendor-mobile.css";
import { getPlatform, isAndroidPlatform, isIOSPlatform, isNativePlatform, isPluginAvailable, platformDisplayLabel } from "./platform";
import { type ReminderDraft } from "./reminderDraft";
import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import {
  ChangeEvent,
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { prefetchAlbumVideo } from "./components/albumVideoPlayback";
import { AgentApiError, compressConversationSummary, runAgentChatStream, type AgentStreamStatusType } from "./agentApi";
import {
  ALBUM_CATEGORIES,
  albumCategoryFromTags,
  albumCategoryLabel,
  albumItemFromDecision,
  albumItemFromStandaloneAttachment,
  albumPromptFromDecision,
  albumPromptFromEffectDecision,
  attachmentListSrc,
  decideAlbumMedia,
  dedupeAlbumItems,
  distributeIntoColumns,
  resolveAlbumEffectTarget,
  type AlbumMediaDecision,
} from "./albumDomain";
import { ensureMicrophonePermission } from "./audioPermission";
import {
  confirmPendingEffectOnServer,
  deleteAppRecord,
  discardPendingEffectOnServer,
  type AppStateResponse,
  uploadFileAttachment,
} from "./appStateApi";
import { clearCachedSnapshot, readCachedSnapshotForBoot } from "./appStateCache";
import { normalizeAppStateResponse } from "./appStateContract";
import { AsrStreamController, runAsrStream } from "./asrApi";
import {
  AUTH_EXPIRED_EVENT,
  apiBaseUrl,
  clearAuthToken,
  getAuthToken,
  readCurrentUser,
  refreshAccessToken,
} from "./authApi";
import {
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
  GROWTH_MEASUREMENT_META,
  GROWTH_MEASUREMENT_TYPES,
  LEDGER_VIEWS,
  MAX_INTERVAL_MINUTES,
  MOBILE_TABS,
  MIN_INTERVAL_MINUTES,
  RECORD_VIEWS,
  REMINDER_ALERT_MODE_OPTIONS,
  REMINDER_CATEGORY_OPTIONS,
  REMINDER_SCHEDULE_MODE_OPTIONS,
  REMINDER_SOUND_OPTIONS,
  type LedgerView as LedgerViewId,
  type MobileTab,
  type RecordView,
} from "./appOptions";
import {
  addDays,
  addMonths,
  ageLabel,
  babyProfileForAgent,
  calendarDatesForMonth,
  canonicalCareEventTitle,
  creatorMetaText,
  currentClockText,
  displayProfileValue,
  formatDate,
  formatExpenseDateLabel,
  formatFullDate,
  formatReminderDueText,
  formatTime,
  hasCompleteProfile,
  hasLegacyLocalState,
  isIntervalReminder,
  localDateKey,
  localTimeKey,
  monthTitle,
  normalizeCareLog,
  normalizeCareLogEvent,
  normalizeClockText,
  normalizeMemoryCategory,
  normalizeProTrialStatus,
  normalizeReminder,
  normalizeReminderAlertMode,
  normalizeReminderSchedule,
  normalizeReminderScheduleMode,
  normalizeReminderSoundId,
  parseReminderDueAt,
  reminderNotificationId,
  reminderTimezone,
  splitListText,
  stageLabel,
  stripAttachmentUrlForStorage,
} from "./appStateDomain";
import { AlbumVideoThumbnail } from "./components/AlbumVideoThumbnail";
import { AlbumScreen } from "./components/AlbumScreen";
import { RemindersScreen } from "./screens/RemindersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RecordsScreen, type RecordsScreenHandlers } from "./screens/RecordsScreen";
import { ChatScreen, type ChatScreenHandlers } from "./screens/ChatScreen";
import { AppDialogs, type AppDialogsHandlers } from "./screens/AppDialogs";
import { RecordsEntryDrawer, type RecordsEntryDrawerHandlers } from "./screens/RecordsEntryDrawer";
import { AuthSplash, LoginScreen, OnboardingScreen } from "./screens/AuthScreens";
import { PreviewOverlay, type PreviewOverlayHandlers } from "./screens/PreviewOverlay";
import { SleepMusicScreen } from "./screens/SleepMusicScreen";
import { SleepMusicCard } from "./components/SleepMusicCard";
import { AppDateField, AppTimeField } from "./components/appWheelFields";
import "./posterUpload";
import { reportClientError } from "./errorReporting";
import { StorySelect } from "./components/StorySelect";
import { ConsentGate } from "./components/ConsentGate";
import { AiDataNotice } from "./components/AiDataNotice";
import { LegalDocModal } from "./components/LegalDocModal";
import type { LegalDocId } from "./legalContent";
import {
  AgentChatResponse,
  AgentModelId,
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
  EffectDecision,
  ExpenseCategory,
  GrowthEvent,
  GrowthMeasurement,
  GrowthMeasurementType,
  PendingEffect,
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
// 共享契约类型现居叶子模块 ./appContracts;此处仅 type-only import 回 App.tsx 仍会用到的那几个
//(编译期擦除,零运行时依赖)。其余(AuthStatus / AiUsageStatus / CompressionStatus /
// MediaUploadItem / RecordsEntryDrawer 类型 / PendingEffectDraft 等)App 已不再直接引用,故不 import。
import type {
  CareEventDraft,
  ComposerMode,
  GrowthCurveData,
  GrowthTrendMetric,
  ManualNumericDraftKey,
  ManualRecordKind,
  ManualRecordTypeOption,
  MediaUploadStatus,
  PendingCareDraft,
  PendingGrowthDraft,
  PendingGrowthMeasurementDraft,
  RecordEvent,
  RuntimeVersionInfo,
} from "./appContracts";
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
import { recordEventIconSrc } from "./recordIcons";
import {
  careEventsByKind,
  countForLog,
  positiveNumber,
  segmentValuesForLog,
  splitEvenSegments,
  sumValues,
  totalForLog,
  compactValue,
  buildDailyCareBreakdowns,
  buildWeeklyCareComparison,
  buildCareCurveData,
} from "./recordsDomain";
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
import {
  createExpenseDraft,
  expenseDraftFromExpense,
  expenseFromDraft,
  useLedgerState,
  type ExpenseDraft,
  type LedgerMutators,
} from "./features/ledger/useLedgerState";
import { useRemindersState, type RemindersMutators } from "./features/reminders/useRemindersState";
import {
  useRecordsState,
  type RecordsMutators,
  type RecordsLateDeps,
} from "./features/records/useRecordsState";
import { usePendingEffects, type PendingEffectsLateDeps } from "./features/pendingEffects/usePendingEffects";
import { useAlbumState, type AlbumLateDeps } from "./features/album/useAlbumState";
import { usePreviewState, PREVIEW_VT } from "./features/preview/usePreviewState";
import { useSessionState, type SessionLateDeps } from "./features/session/useSessionState";
import { useAppStore, type StoreLateDeps } from "./features/store/useAppStore";
import { useChatState, type ChatLateDeps } from "./features/chat/useChatState";
import { composerInput, composerInputRef, ComposerTextarea } from "./features/chat/composerInput";
import { hasCareLogContent, isAgentProgressActivity } from "./utils/agentChatShared";
import { MilestonesView } from "./views/MilestonesView";
import { VaccineView } from "./views/VaccineView";
// getVaccineDataSync / refreshVaccineData / pendingCountForProfile / monthsBetween / RegionCode /
// GrowthMilestone / milestoneTag 已随 records 一族迁入 features/records/useRecordsState。
import { GrowthEntryView } from "./views/GrowthEntryView";
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
import { careLogWithEventStats } from "./utils/careLogStats";
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

// App 各子系统之间共享的契约类型(ComposerMode / Auth·AiUsageStatus / CompressionStatus /
// MediaUploadItem·MediaUploadStatus / RuntimeVersionInfo / RecordEvent·RecordEventType /
// CareEventDraft / RecordsEntryDrawer / Manual* / Pending* / GrowthTrendMetric·GrowthCurveData)
// 已抽到叶子模块 ./appContracts —— feature hooks / screens 直接从那里 import,不再反向依赖 App。
// App.tsx 仍会用到的那几个,在上方 import 区从 "./appContracts" type-only import 回来。
// 下面仅保留纯 App 内部私有、外部无人 import 的类型。

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "unsupported" | "error";

type QueuedMediaFile = {
  id: string;
  file: File;
  kind: AttachmentKind;
};

// 预览子系统的类型/常量(PreviewMotion / PreviewOriginRect / previewOriginFromRect /
// PREVIEW_VT / startViewTransition 看门狗)已随预览态一起搬进 features/preview/usePreviewState;
// App 仅从该 hook import PREVIEW_VT(喂 <PreviewOverlay previewVt={PREVIEW_VT}/>)。

type SystemWeakNotice = {
  id: number;
  message: string;
  tone: MobileUpdateNoticeTone;
  progress?: number | null;
  progressMode?: MobileUpdateNoticeDetail["progressMode"];
};

// extractCareEventsFromText / hasExplicitCareRecordSignal / hasExplicitStructuredActionSignal /
// emptyStructuredResponse / suppressImageOnlyCareEffects 随 submitComposerMessage 一族迁入
// features/chat/useChatState(它们只被该提交流用)。

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

// recordEventIconSrc 已迁出到 ./recordIcons(D13:由 recordTypes 注册表驱动,消灭 kind 散弹分支)。

// reminder labels moved to ./utils/reminderLabels

// careAlbumCategory + careAlbumTitle moved to ./utils/careLogHelpers



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

const platformLabel = () => platformDisplayLabel();

let reminderChannelsReady = false;

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

// careLogs 参数保留以维持调用方签名不变;循环提醒一律按当前时间起算(不再按喝奶事件锚定)。
const prepareIntervalReminder = (reminder: Reminder, careLogs: CareLog[], now = new Date()) => {
  void careLogs;
  if (!isIntervalReminder(reminder) || !reminder.repeatRule) return normalizeReminderSchedule(reminder, now);
  const dueAt = nextIntervalDueAt(now, reminder.repeatRule.intervalMinutes, now);
  return normalizeReminderSchedule(
    addReminderHistory(
      {
        ...reminder,
        dueAt: dueAt.toISOString(),
        dueText: formatReminderDueText(dueAt),
        recurrence: `每 ${formatIntervalText(reminder.repeatRule.intervalMinutes)} ${reminder.title || "提醒"}`,
        lastAnchorEventId: undefined,
        lastAnchorAt: now.toISOString(),
        notificationStatus: "pending",
        notificationError: undefined,
      },
      "按当前时间开始循环提醒",
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
  if (!isAndroidPlatform() || reminderChannelsReady) return;
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
      name: "小宝提醒 · 柔和叮咚",
      description: "短促柔和的响铃提醒",
      sound: REMINDER_SOUND_FILES.soft_chime,
      importance: 4,
      visibility: 1,
      vibration: false,
    });
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNELS.soft_bell,
      name: "小宝提醒 · 轻铃声",
      description: "清脆但短促的响铃提醒",
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
  if (!isAndroidPlatform()) return true;
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

  if (!isNativePlatform()) {
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
  if (!isNativePlatform() || !reminder.notificationId) return;
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
        anchorType: "now",
        careEventType: undefined,
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

// pending-effect 纯 draft/effect 构造器(pendingDraftFromEffect / selectedDateFallback /
// growthEventFromPendingDraft / growthMeasurementsFromPendingDraft / careLogPatchFromPendingDraft /
// remindersFromPendingDraft / memoriesFromPendingDraft / expensesFromPendingDraft +
// pendingExpenseDraftFromExpense)只被 pending-effect 处理函数使用,已随之迁入
// features/pendingEffects/usePendingEffects(reminderFromDraft 因也被留在 App 的代码复用,经参数注入)。

// normalizeSoothing / mergeCareEventsWithInferred 随 normalizeAgentResponse 迁入
// features/chat/useChatState;hasCareLogContent 下沉到 ./utils/agentChatShared(本文件与 hook 共用,见顶部 import)。

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

// normalizeAgentResponse / normalizeSources / normalizeSafetyAlerts 随 submitComposerMessage 一族迁入
// features/chat/useChatState(只被该提交流用)。

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

// upsertToolActivity / VOICE_CANCEL_DISTANCE_PX 随 chat 一族迁入 features/chat/useChatState;
// isAgentProgressActivity 下沉到 ./utils/agentChatShared(本文件作为 ChatScreen prop 与 hook 共用,见顶部 import)。

const visibleToolActivitiesForMessage = (message: ChatMessage) => {
  const activities = message.toolActivities ?? [];
  if (message.isStreaming) return activities;
  return activities.filter((activity) => activity.status !== "completed");
};

// failedRunningActivities / fetchAsDataUrl / resizeImageDataUrlForAgent(及其私有 helper)/ agentStatusTag /
// formatAgentFailureMessage / isVisualAttachment / VISUAL_AGENT_MODEL / resolve*ForMessage / mergeVoiceText /
// downsampleAudio / pcm16FromFloat32 / rmsLevel / extractAiTextPreview 随 chat 一族迁入 features/chat/useChatState。

function App() {
  // 性能探针:统计打字时 App 本体重渲次数(镜像 RecordsScreen 的 __recordsRenders);仅 benchmark 置 flag 时计数,生产惰性。
  if (typeof window !== "undefined" && (window as unknown as { __COUNT_APP_RENDERS?: boolean }).__COUNT_APP_RENDERS) {
    const probe = window as unknown as { __appRenders?: number };
    probe.__appRenders = (probe.__appRenders || 0) + 1;
  }
  useStableViewport();
  const legacyLocalStateRef = useRef(hasLegacyLocalState());
  // 中央服务端状态 STORE(13 个 collection 集合 + 归一化 memo + setX 包装 + 持久化/同步函数)已抽到
  // useAppStore。它被 session 与每个 feature hook 消费,故在**最顶部**调用,返回值解构回与原来同名的
  // 局部变量(profile / messages / careLogs / setMessages / persistRecord / applyAppSnapshot …),
  // 故 App 其余引用(feature hooks 的 deps、各 mutatorsRef.current、boot 编排)一律照常。
  // 排序约束:本 hook 调用最早,但其函数依赖的 setProTrial / setOnboardingRequired / authUser /
  // authFamily / proTrial(来自更晚调用的 useSessionState)与 setStorageStatus / backendReadyRef
  // (App-local,定义在本调用点之后)全部经 storeLateRef 注入(镜像 sessionLateRef 模式);App 在它们
  // 都就绪后每次渲染无条件刷新该 ref(见下方 storeLateRef.current = {...})。这些函数只在事件/effect/
  // boot 回调里触发时读取,call-time 不需要,故迟绑定不改运行时语义。
  const storeLateRef = useRef<StoreLateDeps>({
    setProTrial: () => undefined,
    setOnboardingRequired: () => undefined,
    authUser: null,
    authFamily: null,
    proTrial: normalizeProTrialStatus(null),
    setStorageStatus: () => undefined,
    backendReadyRef: { current: false },
  });
  const {
    profile,
    setProfile,
    messages,
    setMessages,
    growthEvents,
    setGrowthEvents,
    growthMeasurements,
    setGrowthMeasurements,
    careLogs,
    setCareLogs,
    reminders,
    setReminders,
    memories,
    setMemories,
    pendingEffects,
    setPendingEffects,
    storedAlbumItemsNormalized,
    setAlbumItems,
    expenses,
    setExpenses,
    conversationSummary,
    setConversationSummary,
    pendingPersistAlbumIdsRef,
    buildAppSnapshot,
    applyAppSnapshot,
    applyEmptyAppSnapshot,
    cacheBackendState,
    loadStateFromBackend,
    applyStateResponse,
    persistRecord,
  } = useAppStore({ lateRef: storeLateRef });
  // 首登知情同意：勾选一次后记住，不再弹。（不是 server collection，是 consent UI，留在 App。）
  const [consentGiven, setConsentGiven] = useStoredState("baby-companion-consent-v1", false);
  // 设置页里点开的隐私/协议/儿童信息静态页。
  const [settingsLegalDoc, setSettingsLegalDoc] = useState<LegalDocId | null>(null);
  // session 一族(auth/login/onboarding/profile-edit/family-member/proTrial/aiUsage)的 state/effect/handlers
  // 已抽到 useSessionState(下方在 canCaregive 后提前调用,返回值解构回同名变量)。
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("records");
  // 性能:没访问过的 Tab 不渲染(冷启动只渲染首 Tab;访问过后保持挂载,行为与从前一致)。
  const visitedMobileTabsRef = useRef<Set<MobileTab>>(new Set());
  visitedMobileTabsRef.current.add(activeMobileTab);
  // records 一族的 state/refs/handlers 已抽到 useRecordsState(下方在 canCaregive 后提前调用)。
  // isProfileEditing / profileDraft / allergiesText 已抽到 useSessionState(同上)。
  // chat 一族(composerMode / voice* / attachments / isAttachmentTrayExpanded / mediaUploadItems /
  // isListening / isSubmitting / compressionStatus + refs/handlers/派生)已抽到 useChatState
  // (下方在 useAlbumState 之前提前调用;它产出 album 依赖的 mediaUploadItems / processSelectedMediaFiles)。
  // input 由独立 external store 持有(见 features/chat/composerInput),打字不再重渲 App 本体;
  // setInput / inputValueRef 留在 App 供 openRecordsAssistant 写入草稿(都走同一 store,语义不变)。
  const setInput = composerInput.set;
  const inputValueRef = composerInputRef;
  // 预览子系统的 state(previewAttachment / previewAlbumItem / previewMotion / previewOriginRect /
  // previewActionsOpen / previewTransform)与全部 preview refs 已抽到 features/preview/usePreviewState;
  // 下方在 useAlbumState **之前**调用该 hook(它产出 useAlbumState 消费的 setPreview* / previewAlbumItemsRef),
  // 返回值解构回同名变量,故 App 其余引用照常。
  const [runtimeVersion, setRuntimeVersion] = useState<RuntimeVersionInfo>(() => ({
    otaVersion: BUILD_OTA_VERSION || "内置包",
    nativeVersion: "检测中",
    bundleId: "检测中",
    platform: getPlatform(),
    status: isNativePlatform() ? "读取中" : "Web 预览",
  }));
  const [systemWeakNotice, setSystemWeakNotice] = useState<SystemWeakNotice | null>(null);
  // isListening / isSubmitting / compressionStatus 已抽到 useChatState。
  const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "offline">("loading");
  // editingPendingId / pendingDraft / confirmingPendingEffectIds 已抽到 usePendingEffects(下方在 canCaregive 后提前调用)。
  const [manualRecordKind, setManualRecordKind] = useState<ManualRecordKind>("milk");
  // editingCareEventId / swipedTimelineEventId / deleteCareEventTarget / careEventDraft /
  // growthCurveType / growthMeasurementDraft / editingGrowthMeasurementId 已抽到 useRecordsState。
  const [ringingReminder, setRingingReminder] = useState<Reminder | null>(null);
  // fileInputRef / asr/audio/voice 一族 ref / isSubmittingRef / submitComposerMessageRef 已抽到 useChatState。
  // albumFileInputRef 已抽到 useAlbumState(下方在 canCaregive 后提前调用)。
  // messageListRef / hasPositionedMessageListRef / messageScrollSignatureRef 随 messageList 自动滚动 useLayoutEffect 留在 App(布局编排)。
  const messageListRef = useRef<HTMLDivElement>(null);
  // closeRecordsEntryDrawer / openManualRecordDrawer 留在 App(见 useRecordsState 偏差④),故其计时器 ref 也留在此。
  const recordsEntryDrawerCloseTimerRef = useRef<number | null>(null);
  // timelineSwipeStartRef 已抽到 useRecordsState。
  const hasPositionedMessageListRef = useRef(false);
  const messageScrollSignatureRef = useRef("");
  const backendReadyRef = useRef(false);
  // pendingPersistAlbumIdsRef(乐观相册项防快照覆盖的 data-loss guard)已随 STORE 迁入 useAppStore,
  // 上方解构回同名 ref(applyAppSnapshot / persistAlbumItemOptimistic / album hook 仍照常读写它)。
  const compressionInFlightRef = useRef(false);
  const compressionResetTimerRef = useRef<number | null>(null);
  const remindersRef = useRef<Reminder[]>([]);
  const handledNativeNotificationKeysRef = useRef<Set<string>>(new Set());
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);
  const systemWeakNoticeTimerRef = useRef<number | null>(null);
  // 全部 preview refs(手势指针/捏合/滑动/翻页 settle/轮播 track/共享可预览列表 previewAlbumItemsRef 等)
  // 已随预览态搬进 features/preview/usePreviewState(下方 hook 返回值解构回同名 ref)。
  const appPlatform = platformLabel();
  const babyNickname = profile.nickname.trim() || "小宝";
  const familySpeakerName = `${babyNickname}家`;
  const withBabyNickname = useCallback(
    (text: string) => text.split("小宝").join(babyNickname),
    [babyNickname],
  );
  // session 一族(auth/login/onboarding/profile-edit/family-member/proTrial/aiUsage)抽到 useSessionState。
  // 本 hook 必须在 canCaregive **之前**调用:它产出 authMember,而 canCaregive 读 authMember,且 canCaregive
  // 又被下方 ledger/reminders/records/album 各 hook 消费(排序约束见 useSessionState 顶部注释)。
  // 因此「在本调用点之后才定义」的依赖(canCaregive 本身、records hook 的 setRecordsEntryDrawer /
  // setRecordsAssistantOpen、reminders hook 的 openReminderManagement,以及 showSystemWeakNotice /
  // persistRecord / loadStateFromBackend / applyEmptyAppSnapshot)经 sessionLateRef 注入,在下方
  // mutators 赋值点统一刷新(沿用 records 的 recordsLateRef 模式)。
  const sessionLateRef = useRef<SessionLateDeps>({
    canCaregive: true,
    setRecordsEntryDrawer: () => undefined,
    setRecordsAssistantOpen: () => undefined,
    openReminderManagement: () => undefined,
    showSystemWeakNotice: () => undefined,
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as SessionLateDeps["persistRecord"],
    loadStateFromBackend: (() => {
      throw new Error("loadStateFromBackend not ready");
    }) as SessionLateDeps["loadStateFromBackend"],
    applyEmptyAppSnapshot: () => undefined,
  });
  const {
    authStatus,
    setAuthStatus,
    authUser,
    setAuthUser,
    authFamily,
    setAuthFamily,
    authMember,
    setAuthMember,
    proTrial,
    setProTrial,
    aiUsageSummary,
    setAiUsageSummary,
    aiUsageStatus,
    setAiUsageStatus,
    familyMembers,
    setFamilyMembers,
    familyMembersStatus,
    setFamilyMembersStatus,
    familyMemberBusyUserId,
    setFamilyMemberBusyUserId,
    resetInviteCodeValue,
    setResetInviteCodeValue,
    isApplyingProTrial,
    setIsApplyingProTrial,
    redeemCodeInput,
    setRedeemCodeInput,
    isRedeemingProCode,
    setIsRedeemingProCode,
    onboardingRequired,
    setOnboardingRequired,
    loginPhone,
    setLoginPhone,
    loginInviteCode,
    setLoginInviteCode,
    loginRoleName,
    setLoginRoleName,
    loginCaregiver,
    setLoginCaregiver,
    loginExistingMember,
    setLoginExistingMember,
    loginError,
    setLoginError,
    occupiedInviteRoles,
    setOccupiedInviteRoles,
    inviteRoleHint,
    setInviteRoleHint,
    inviteFamilyName,
    setInviteFamilyName,
    isCheckingInviteRoles,
    setIsCheckingInviteRoles,
    isLoggingIn,
    setIsLoggingIn,
    onboardingStep,
    setOnboardingStep,
    onboardingDraft,
    setOnboardingDraft,
    onboardingFamilyName,
    setOnboardingFamilyName,
    onboardingFamilyNameTouchedRef,
    onboardingAllergiesText,
    setOnboardingAllergiesText,
    isProfileEditing,
    setIsProfileEditing,
    profileDraft,
    setProfileDraft,
    allergiesText,
    setAllergiesText,
    loginRoleOptions,
    loginSelectedRoleOccupied,
    loginCredentialsReady,
    loginReady,
    refreshAiUsageSummary,
    refreshFamilyMembers,
    handleToggleMemberCaregiver,
    handleRemoveFamilyMember,
    handleResetFamilyInviteCode,
    applyForProTrial,
    redeemProTrialCode,
    handleProfileSubmit,
    handleLoginSubmit,
    handleLogout,
    saveOnboardingProfile,
    resetProfileDraft,
    startProfileEditing,
    cancelProfileEditing,
    profileScreenHandlers,
  } = useSessionState({
    profile,
    setProfile,
    setStorageStatus,
    setActiveMobileTab,
    backendReadyRef,
    legacyLocalStateRef,
    lateRef: sessionLateRef,
  });
  const canCaregive = authMember?.caregiver ?? true;
  const todayDate = todayISO();
  // hasAiQuota / canAttachVisuals 上移到此(原在 useAlbumState 之后):useChatState 需要它们,且必须排在
  // useAlbumState 之前(产出 album 依赖的 mediaUploadItems / processSelectedMediaFiles)。只依赖 proTrial(已就绪)/ canCaregive。
  const freeAiCallsRemaining = proTrial.freeCallsRemaining;
  // 统一边界：Pro 不限次；Free 在每月免费额度内也可用 AI（含图片/视频整理）。剩余未知时不前置拦截，由服务端兜底。
  const hasAiQuota = proTrial.enabled || freeAiCallsRemaining == null || freeAiCallsRemaining > 0;
  const canAttachVisuals = canCaregive && hasAiQuota;
  // useChatState 的迟绑定依赖:persistRecord / applyStateResponse / persistAlbumItemOptimistic /
  // showSystemWeakNotice / applyForProTrial / buildAgentPageContext / messageForStorage 都在本 hook 调用点之后才定义,
  // 经此 ref 注入(沿用 records/album 的 lateRef 模式);在下方它们都就绪后同处刷新。
  const chatLateRef = useRef<ChatLateDeps>({
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as ChatLateDeps["persistRecord"],
    applyStateResponse: () => undefined,
    persistAlbumItemOptimistic: (() => {
      throw new Error("persistAlbumItemOptimistic not ready");
    }) as ChatLateDeps["persistAlbumItemOptimistic"],
    showSystemWeakNotice: () => undefined,
    applyForProTrial: () => undefined,
    buildAgentPageContext: (() => {
      throw new Error("buildAgentPageContext not ready");
    }) as ChatLateDeps["buildAgentPageContext"],
    messageForStorage: (() => {
      throw new Error("messageForStorage not ready");
    }) as ChatLateDeps["messageForStorage"],
  });
  // persistRecord / deleteAppRecord 在下方才定义,故经 ref 注入(沿用本文件 remindersHandlersRef 的间接模式);
  // 定义后每次渲染都无条件刷新这个 ref(见 deleteAppRecord 定义处的赋值)。
  const ledgerMutatorsRef = useRef<LedgerMutators>({
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as LedgerMutators["persistRecord"],
    deleteAppRecord: (() => {
      throw new Error("deleteAppRecord not ready");
    }) as LedgerMutators["deleteAppRecord"],
  });
  const remindersMutatorsRef = useRef<RemindersMutators>({
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as RemindersMutators["persistRecord"],
    deleteAppRecord: (() => {
      throw new Error("deleteAppRecord not ready");
    }) as RemindersMutators["deleteAppRecord"],
  });
  const recordsMutatorsRef = useRef<RecordsMutators>({
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as RecordsMutators["persistRecord"],
    deleteAppRecord: (() => {
      throw new Error("deleteAppRecord not ready");
    }) as RecordsMutators["deleteAppRecord"],
  });
  // handleAddGrowthMeasurement 用的 showSystemWeakNotice 的 useCallback 定义在 hook 调用点之后才就绪,
  // 经此迟绑定 ref 注入;在下方 mutators 赋值点同处刷新(那时它已就绪)。
  const recordsLateRef = useRef<RecordsLateDeps>({
    showSystemWeakNotice: () => undefined,
  });
  // usePendingEffects 的迟绑定依赖:persistRecord / applyAppSnapshot / persistAlbumItemOptimistic /
  // showSystemWeakNotice / messageForStorage 都在本 hook 调用点之后才定义,经此 ref 注入
  // (沿用 records 的 recordsLateRef 模式);在下方它们都就绪后同处刷新。
  const pendingEffectsLateRef = useRef<PendingEffectsLateDeps>({
    persistRecord: (() => {
      throw new Error("persistRecord not ready");
    }) as PendingEffectsLateDeps["persistRecord"],
    applyAppSnapshot: () => undefined,
    persistAlbumItemOptimistic: (() => {
      throw new Error("persistAlbumItemOptimistic not ready");
    }) as PendingEffectsLateDeps["persistAlbumItemOptimistic"],
    showSystemWeakNotice: () => undefined,
    messageForStorage: (message) => message,
  });
  // useAlbumState 的迟绑定依赖:persistAlbumItemOptimistic / applyStateResponse /
  // showSystemWeakNotice / processSelectedMediaFiles 都在本 hook 调用点之后才定义,
  // 经此 ref 注入(沿用 records 的 recordsLateRef 模式);在下方它们都就绪后同处刷新。
  const albumLateRef = useRef<AlbumLateDeps>({
    showSystemWeakNotice: () => undefined,
    applyStateResponse: () => undefined,
    persistAlbumItemOptimistic: (() => {
      throw new Error("persistAlbumItemOptimistic not ready");
    }) as AlbumLateDeps["persistAlbumItemOptimistic"],
    processSelectedMediaFiles: (() => {
      throw new Error("processSelectedMediaFiles not ready");
    }) as AlbumLateDeps["processSelectedMediaFiles"],
    isUploadingAlbumMedia: false,
  });
  const {
    ledgerView,
    setLedgerView,
    expenseEditorOpen,
    setExpenseEditorOpen,
    editingExpenseId,
    setEditingExpenseId,
    expenseDraft,
    setExpenseDraft,
    deleteExpenseTarget,
    setDeleteExpenseTarget,
    expenseBulkMode,
    setExpenseBulkMode,
    selectedExpenseIds,
    setSelectedExpenseIds,
    collapsedExpenseMonths,
    setCollapsedExpenseMonths,
    bulkDeleteExpensesOpen,
    setBulkDeleteExpensesOpen,
    expenseEditorBodyRef,
    expenseOptionalPanelRef,
    settleExpenseOptionalPanel,
    ledgerMonthKey,
    ledgerYearKey,
    sortedExpenses,
    expenseMonthGroups,
    monthExpenses,
    yearExpenses,
    ledgerStats,
    openNewExpenseEditor,
    openEditExpenseEditor,
    closeExpenseEditor,
    saveExpenseDraft,
    requestDeleteExpense,
    closeDeleteExpenseConfirm,
    confirmDeleteExpense,
    exitExpenseBulkMode,
    toggleExpenseBulkMode,
    toggleExpenseSelection,
    toggleExpenseMonthCollapse,
    requestBulkDeleteExpenses,
    closeBulkDeleteExpenses,
    confirmBulkDeleteExpenses,
  } = useLedgerState({ expenses, setExpenses, canCaregive, todayDate, setStorageStatus, mutatorsRef: ledgerMutatorsRef });
  const {
    reminderManagementOpen,
    setReminderManagementOpen,
    reminderEditorOpen,
    setReminderEditorOpen,
    editingReminderId,
    setEditingReminderId,
    reminderDraft,
    setReminderDraft,
    completeReminderTarget,
    setCompleteReminderTarget,
    postponeReminderTarget,
    setPostponeReminderTarget,
    postponeReminderDraft,
    setPostponeReminderDraft,
    deleteReminderTarget,
    setDeleteReminderTarget,
    openNewReminderEditor,
    openReminderQuickDraft,
    openEditReminderEditor,
    closeReminderEditor,
    saveReminderDraft,
    completeReminder,
    requestCompleteReminder,
    closeCompleteReminderConfirm,
    confirmCompleteReminder,
    requestPostponeReminder,
    closePostponeReminderConfirm,
    confirmPostponeReminder,
    requestDeleteReminder,
    closeDeleteReminderConfirm,
    confirmDeleteReminder,
    openReminderManagement,
    closeReminderManagement,
    remindersScreenHandlers,
  } = useRemindersState({
    canCaregive,
    careLogs,
    reminders,
    setReminders,
    setStorageStatus,
    babyNickname,
    withBabyNickname,
    setActiveMobileTab,
    scheduleNativeReminders,
    cancelNativeReminder,
    reminderFromDraft,
    addReminderHistory,
    mutatorsRef: remindersMutatorsRef,
  });
  const {
    recordView,
    setRecordView,
    recordsEntryDrawer,
    setRecordsEntryDrawer,
    recordsEntryDrawerClosing,
    setRecordsEntryDrawerClosing,
    recordsAssistantOpen,
    setRecordsAssistantOpen,
    milestonesViewOpen,
    setMilestonesViewOpen,
    growthEntryOpen,
    setGrowthEntryOpen,
    selectedDate,
    setSelectedDate,
    calendarMonth,
    setCalendarMonth,
    vaccineViewOpen,
    setVaccineViewOpen,
    editingCareEventId,
    setEditingCareEventId,
    swipedTimelineEventId,
    setSwipedTimelineEventId,
    deleteCareEventTarget,
    setDeleteCareEventTarget,
    careEventDraft,
    setCareEventDraft,
    growthCurveType,
    setGrowthCurveType,
    growthMeasurementDraft,
    setGrowthMeasurementDraft,
    editingGrowthMeasurementId,
    setEditingGrowthMeasurementId,
    timelineSwipeStartRef,
    vaccinePending,
    openMilestones,
    closeMilestones,
    openVaccine,
    closeVaccine,
    setVaccineRegion,
    toggleVaccineDose,
    openGrowthEntry,
    resetGrowthMeasurementDraft,
    closeGrowthEntry,
    achieveMilestone,
    handleAddGrowthMeasurement,
    handleEditGrowthMeasurement,
    handleDeleteGrowthMeasurement,
    beginEditCareTimelineEvent,
    saveCareTimelineEvent,
    canEditTimelineEvent,
    beginTimelineEventSwipe,
    finishTimelineEventSwipe,
    cancelTimelineEventSwipe,
    requestDeleteCareTimelineEvent,
    selectRecordDate,
  } = useRecordsState({
    canCaregive,
    profile,
    setProfile,
    growthEvents,
    setGrowthEvents,
    growthMeasurements,
    setGrowthMeasurements,
    careLogs,
    setCareLogs,
    setStorageStatus,
    setActiveMobileTab,
    createCareEventDraft,
    mutatorsRef: recordsMutatorsRef,
    lateRef: recordsLateRef,
  });
  // pending-effect(待确认副作用)/ album-prompt(相册提示)一族抽到 usePendingEffects。同 records:在 canCaregive
  // 之后提前调用,返回值解构回与原来同名的局部变量,故 App 其余引用(chatScreenHandlers 包 / RecordsEntryDrawer props /
  // JSX props)一律照常。reminderFromDraft / scheduleNativeReminders 是 App 模块级纯函数且也被留在 App 的代码复用,按值传入;
  // persistRecord / applyAppSnapshot / persistAlbumItemOptimistic / showSystemWeakNotice / messageForStorage 经 lateRef 迟绑定。
  const {
    editingPendingId,
    setEditingPendingId,
    pendingDraft,
    setPendingDraft,
    confirmingPendingEffectIds,
    setConfirmingPendingEffectIds,
    updateAlbumPromptStatus,
    saveAlbumPrompt,
    ignoreAlbumPrompt,
    confirmPendingEffect,
    discardPendingEffect,
    beginEditPendingEffect,
    savePendingEffectDraft,
    updatePendingGrowthDraft,
    updatePendingGrowthMeasurementDraft,
    updatePendingCareDraft,
    updatePendingReminderDraft,
    updatePendingMemoryDraft,
    updatePendingExpenseDraft,
  } = usePendingEffects({
    canCaregive,
    messages,
    setMessages,
    setAlbumItems,
    setPendingEffects,
    careLogs,
    setStorageStatus,
    pendingPersistAlbumIdsRef,
    reminderFromDraft,
    scheduleNativeReminders,
    lateRef: pendingEffectsLateRef,
  });
  // chat 一族(composer/voice/agent 流式/媒体上传)抽到 useChatState。必须在 useAlbumState **之前**调用:
  // 它产出 album 依赖的 mediaUploadItems / processSelectedMediaFiles。返回值解构回与原来同名的局部变量,
  // 故 App 其余引用(内联 composer JSX / openRecordsAssistant / closeRecordsEntryDrawer / chatScreenHandlers 包 /
  // ChatScreen props)一律照常。
  const {
    composerMode,
    voiceStatus,
    voiceCancelArmed,
    voiceError,
    attachments,
    setAttachments,
    isAttachmentTrayExpanded,
    setIsAttachmentTrayExpanded,
    mediaUploadItems,
    setMediaUploadItems,
    isListening,
    isSubmitting,
    compressionStatus,
    fileInputRef,
    isSubmittingRef,
    chatUploadItems,
    isUploadingChatMedia,
    visibleChatAttachmentCount,
    isChatAttachmentLimitReached,
    chatAttachmentCountLabel,
    chatAttachmentLimitLabel,
    attachmentTrayMetaLabel,
    canCollapseAttachmentTray,
    isAttachmentTrayOpen,
    attachmentTrayPreviewItems,
    attachmentTrayOverflowCount,
    visualToolTitle,
    visualToolGated,
    visualToolDisabled,
    visualToolClassName,
    canUseComposerInput,
    voiceHoldLabel,
    voiceButtonStyle,
    voiceRecordingActive,
    compressionMessage,
    processSelectedMediaFiles,
    handleFiles,
    openMediaPicker,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    cancelVoiceCapture,
    submitComposerMessage,
    handleSubmit,
    handleComposerKeyDown,
  } = useChatState({
    canCaregive,
    hasAiQuota,
    canAttachVisuals,
    recordsEntryDrawerIsAi: recordsEntryDrawer === "ai",
    messages,
    setMessages,
    setAlbumItems,
    setConversationSummary,
    profile,
    careLogs,
    memories,
    setStorageStatus,
    backendReadyRef,
    compressionInFlightRef,
    compressionResetTimerRef,
    lateRef: chatLateRef,
  });
  // 全屏媒体预览子系统(state + 全部 preview refs + 手势/翻页/缩放 handlers + 5 个 hook 自持 effect)。
  // 必须排在 useAlbumState **之前**:useAlbumState 消费下面解构出的 setPreviewAlbumItem / setPreviewAttachment /
  // previewAlbumItemsRef,并回产 previewAlbumIndex / previewCarouselItems(见下)。本 hook 无外部依赖。
  const {
    previewAttachment,
    setPreviewAttachment,
    previewAlbumItem,
    setPreviewAlbumItem,
    previewMotion,
    previewOriginRect,
    previewActionsOpen,
    setPreviewActionsOpen,
    previewTransform,
    previewAlbumItemsRef,
    previewCarouselTrackRef,
    openPreviewAttachment,
    closePreviewAttachment,
    handlePreviewClick,
    bindPreviewVideo,
    onPreviewStagePointerDown,
    onPreviewStagePointerMove,
    onPreviewStagePointerEnd,
    onPreviewImagePointerDown,
    onPreviewImagePointerMove,
    onPreviewImagePointerEnd,
  } = usePreviewState();
  // 只解构 App.tsx 仍直接引用的返回值;hook 内部消费的 derivedAlbumItems / albumItems /
  // filteredAlbumItems / albumRatioOverrides 一族 / openAlbumPreview / handleAlbumFiles /
  // openAlbumMediaPicker 等不在此解构(它们只在 hook 内或经 albumScreenHandlers 间接使用)。
  const {
    albumFileInputRef,
    albumUploadItems,
    albumGroups,
    albumPreviewItems,
    recordAlbumRatio,
    albumTileAspect,
    previewAlbumIndex,
    previewCarouselItems,
    albumStats,
    editAlbumItem,
    removeAlbumItem,
    albumScreenHandlers,
  } = useAlbumState({
    canCaregive,
    messages,
    storedAlbumItemsNormalized,
    setAlbumItems,
    mediaUploadItems,
    previewAlbumItem,
    setPreviewAlbumItem,
    setPreviewAttachment,
    setAttachments,
    previewAlbumItemsRef,
    setStorageStatus,
    setMessages,
    lateRef: albumLateRef,
  });
  // useSessionState 已在 canCaregive 之前调用(见上方;它产出 canCaregive 依赖的 authMember)。
  // freeAiCallsRemaining / hasAiQuota / canAttachVisuals 已上移到 canCaregive 之后(供 useChatState 用)。
  const visibleTabs = MOBILE_TABS;
  // chat 附件托盘 / 语音展示 / 工具门禁 一族派生值已抽到 useChatState(上方提前调用,返回值解构回同名变量)。
  // 仅保留 album 上传态:它由本文件 isUploadingAlbumMedia 派生并喂给 albumLateRef(album hook 的迟绑定依赖)。
  const activeUploadStatuses: MediaUploadStatus[] = ["preparing", "uploading", "processing"];
  const isUploadingAlbumMedia = albumUploadItems.some((item) => activeUploadStatuses.includes(item.status));
  const proApplicationPending = proTrial.application?.status === "pending";
  const proStatusText = proTrial.enabled ? "Pro 内测已开通" : proApplicationPending ? "Pro 内测申请中" : "可申请 Pro 内测";
  const aiUsageTopFeatures = Array.isArray(aiUsageSummary?.byFeature) ? aiUsageSummary.byFeature.slice(0, 3) : [];
  const aiUsageTopModel = Array.isArray(aiUsageSummary?.byModel) ? aiUsageSummary.byModel[0] : undefined;
  const ledgerModalOpen = expenseEditorOpen || Boolean(deleteExpenseTarget) || bulkDeleteExpensesOpen;
  const reminderModalOpen = reminderEditorOpen || Boolean(completeReminderTarget) || Boolean(postponeReminderTarget) || Boolean(deleteReminderTarget);
  const appModalOpen = Boolean(recordsEntryDrawer) || Boolean(deleteCareEventTarget) || Boolean(deleteExpenseTarget) || bulkDeleteExpensesOpen;
  // loginRoleOptions / loginSelectedRoleOccupied / loginCredentialsReady / loginReady 已抽到 useSessionState(上方提前调用,返回值解构回同名变量)。
  const switchMobileTab = (tab: MobileTab) => {
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

  // refreshAiUsageSummary / refreshFamilyMembers / handleToggleMemberCaregiver / handleRemoveFamilyMember /
  // handleResetFamilyInviteCode 已抽到 useSessionState(上方提前调用,返回值解构回同名变量)。

  // 预览手势/翻页/缩放的全部处理函数(clearPreviewTimers / setPreviewCarouselTransform /
  // openPreviewAttachment / closePreviewAttachment / handlePreviewClick / findAdjacent /
  // showAdjacent / bindPreviewVideo / begin·update·finishPreviewSwipe / onPreviewStage·Image* 等)
  // 及 5 个 hook 自持 effect(动作菜单开关/外点关闭/预览切换重置/卸载清理/键盘导航)已搬进
  // features/preview/usePreviewState;上方调用点解构回同名变量,故 App 其余引用照常。

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
  // derivedAlbumItems / albumItems / filteredAlbumItems / albumGroups / albumPreviewItems /
  // albumRatioOverrides 一族 / recordAlbumRatio / albumTileAspect / previewAlbumIndex /
  // previewCarouselItems / albumStats 已抽到 useAlbumState(上方提前调用,返回值解构回同名变量)。
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

  // previewAlbumItemRef 同步 + 卸载 clearPreviewTimers 两个 effect 已随预览态搬进 features/preview/usePreviewState。

  useEffect(() => {
    let alive = true;
    const fallbackVersion = BUILD_OTA_VERSION || "内置包";
    const platform = getPlatform();
    if (!isNativePlatform() || !isPluginAvailable("CapacitorUpdater")) {
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

  // 预览键盘导航(Esc 关闭 / ←→ 切相邻相册项)effect 已随预览态搬进 features/preview/usePreviewState。
  // 下方相邻页预加载 effect 留在 App:它读 useAlbumState 输出的 albumPreviewItems / previewAlbumIndex,
  // 需作为响应式依赖,写进本 hook 会形成对 album 产出的反向依赖(见 usePreviewState 顶注偏差②)。
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
  // 奶量/睡眠改曲线:复用成长曲线的数据形状与 <CurveChart> 渲染(替换原柱状图)。
  const milkCurveData = useMemo(
    () => buildCareCurveData(weeklyCareComparison.days, (day) => day.milkValue, (value) => `${Math.round(value)}ml`),
    [weeklyCareComparison],
  );
  const sleepCurveData = useMemo(
    () => buildCareCurveData(weeklyCareComparison.days, (day) => day.sleepValue, (value) => `${value.toFixed(1)}h`),
    [weeklyCareComparison],
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

  // isSubmittingRef 同步 effect 已抽到 useChatState(hook 内拥有 isSubmitting / isSubmittingRef)。

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

  // 邀请码角色探测 / 已占用身份清空当前选择 / 引导期家庭名自动建议 三个 effect 已抽到 useSessionState
  // (它们只读写 session 一族 state,与 boot/STORE 编排无关)。

  // buildAppSnapshot / applyAppSnapshot / applyEmptyAppSnapshot / resolveCacheAccountKey /
  // cacheBackendState / loadStateFromBackend / applyStateResponse / persistRecord(冷启动秒开缓存 +
  // 后端持久化/同步一族)已随 STORE 迁入 useAppStore(上方最顶部调用,返回值解构回同名函数)。
  // 它们依赖的 setProTrial / setOnboardingRequired / authUser / authFamily / proTrial(session 产出)与
  // setStorageStatus / backendReadyRef(App-local)在此处都已就绪,故在此刷新 storeLateRef(与下方
  // 其它 lateRef 刷新同处;每次渲染无条件刷新)。
  storeLateRef.current = {
    setProTrial,
    setOnboardingRequired,
    authUser,
    authFamily,
    proTrial,
    setStorageStatus,
    backendReadyRef,
  };
  // useLedgerState 在调用点更早,经此 ref 取用 STORE 返回的 mutators;每次渲染都无条件刷新。
  // deleteAppRecord 为模块导入(全程可用),persistRecord 在此处定义后两者皆就绪。
  ledgerMutatorsRef.current = { persistRecord, deleteAppRecord };
  // useRemindersState 同理在调用点更早;persistRecord / deleteAppRecord 在此处都已就绪。
  remindersMutatorsRef.current = { persistRecord, deleteAppRecord };
  // useRecordsState 同理在调用点更早;persistRecord / deleteAppRecord 在此处都已就绪。
  recordsMutatorsRef.current = { persistRecord, deleteAppRecord };
  // showSystemWeakNotice 的 useCallback 定义在 useRecordsState 调用点之后、此处之前,故在此处刷新迟绑定 ref。
  recordsLateRef.current = { showSystemWeakNotice };
  // useSessionState 在调用点最早(canCaregive 之前);其迟绑定依赖(canCaregive / records hook 的
  // setRecordsEntryDrawer / setRecordsAssistantOpen / reminders hook 的 openReminderManagement /
  // showSystemWeakNotice / persistRecord / loadStateFromBackend / applyEmptyAppSnapshot)在此处都已就绪,
  // 每次渲染无条件刷新。
  sessionLateRef.current = {
    canCaregive,
    setRecordsEntryDrawer,
    setRecordsAssistantOpen,
    openReminderManagement,
    showSystemWeakNotice,
    persistRecord,
    loadStateFromBackend,
    applyEmptyAppSnapshot,
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

  // applyForProTrial / redeemProTrialCode 已抽到 useSessionState(上方提前调用,返回值解构回同名变量)。

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
    if (authStatus !== "authenticated" || !isIOSPlatform()) {
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

  // scheduleCompressionStatusReset / runConversationCompression 随 chat 一族迁入 useChatState
  // (提交流尾部触发;compressionInFlightRef / compressionResetTimerRef / setConversationSummary 作为 deps 传入)。

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

  useEffect(() => {
    let cancelled = false;
    const bootstrapAuth = async () => {
      if (!getAuthToken()) {
        setAuthStatus("unauthenticated");
        return;
      }
      // 冷启动秒开(架构债 D11):有 token 且命中本地缓存时,先用缓存即时渲染首页,
      // 不等网络;随后照常跑 readCurrentUser + loadStateFromBackend 在后台刷新对账。
      // 损坏缓存必须按未命中处理(normalizeAppStateResponse 兜底),绝不白屏。
      let paintedFromCache = false;
      try {
        const cached = await readCachedSnapshotForBoot();
        if (!cancelled && cached) {
          const { value } = normalizeAppStateResponse({ empty: false, state: cached.snapshot });
          if (!value.empty && hasCompleteProfile((value.state as Partial<AppStateSnapshot>).profile as BabyProfile | undefined)) {
            applyAppSnapshot(value.state as Partial<AppStateSnapshot>);
            setOnboardingRequired(false);
            setAuthStatus("authenticated");
            paintedFromCache = true;
          }
        }
      } catch {
        // 读缓存失败仅退化为无秒开,继续走网络路径。
      }
      try {
        // auth/me 与 app/state 互不依赖(app/state 用存储里的 token、不用 me 的返回),
        // 并发拉取省掉一个串行往返——真机网络下冷启动到可交互明显更快(大头 app/state 的
        // 下载与 auth/me 的往返重叠)。onboardingRequired 仍以服务端 me 判定为准,
        // loadState 内部的 profile 兜底只在并发期作临时值(此时 authStatus 仍为 checking,不渲染)。
        const [me, loadResult] = await Promise.all([
          readCurrentUser(),
          loadStateFromBackend({ importLegacy: false }),
        ]);
        if (cancelled) return;
        setAuthUser(me.user);
        setAuthFamily(me.family);
        setAuthMember(me.member);
        if (me.onboardingRequired !== undefined) setOnboardingRequired(me.onboardingRequired);
        // 用权威 user id 把刚拉到的 state 写进本地缓存(下次冷启动秒开)。单次抓取——不再二次
        // loadStateFromBackend:boot 期 authUser 尚未 flush,resolveCacheAccountKey 拿不到 id,故在此显式补 key。
        if (loadResult && !loadResult.empty) cacheBackendState(loadResult.state, me.user.id);
        setAuthStatus("authenticated");
      } catch {
        if (cancelled) return;
        // 已秒开则容忍后台刷新失败(弱网/离线):保留缓存视图,标记存储离线,不踢回登录。
        // 真正的 token 失效是 401——apiFetch 会独立清 token 并派发 AUTH_EXPIRED_EVENT
        // (其处理函数会清缓存并转未登录),不依赖这里。
        if (paintedFromCache) {
          backendReadyRef.current = false;
          setStorageStatus("offline");
          return;
        }
        // 未秒开:沿用原行为按未登录处理,并清掉无效 token 与缓存。
        clearAuthToken();
        void clearCachedSnapshot();
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
      // token 失效:清掉秒开缓存,避免下次冷启动用上一个账号的脏快照(账号隔离红线)。
      void clearCachedSnapshot();
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

  // 登录态变化时刷新 AI 用量 / 家庭成员(authStatus 一族)的 effect 已抽到 useSessionState。

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

  // canAttachVisuals 变 false 时清空待发素材/上传队列的 effect 已抽到 useChatState。

  // profile 变化时同步 profileDraft / allergiesText 的 effect 已抽到 useSessionState。

  // readImageDimensionsFromFile / createVideoThumbnailDataUrl / readAgentAttachmentDataUrl /
  // 媒体上传管线(updateMediaUploadItem / uploadMediaFile / queueMediaFiles / processSelectedMediaFiles /
  // handleFiles / openMediaPicker)已抽到 useChatState。

  // openAlbumMediaPicker / albumScreenHandlers(memo 化 AlbumScreen 的稳定函数包)已抽到 useAlbumState。
  // useAlbumState 的迟绑定依赖在此处都已就绪(showSystemWeakNotice / applyStateResponse /
  // persistAlbumItemOptimistic / processSelectedMediaFiles / isUploadingAlbumMedia),每次渲染无条件刷新。
  albumLateRef.current = {
    showSystemWeakNotice,
    applyStateResponse,
    persistAlbumItemOptimistic,
    processSelectedMediaFiles,
    isUploadingAlbumMedia,
  };
  // usePendingEffects 的迟绑定依赖在此处都已就绪(persistRecord / applyAppSnapshot / persistAlbumItemOptimistic /
  // showSystemWeakNotice / messageForStorage),每次渲染无条件刷新。
  pendingEffectsLateRef.current = {
    persistRecord,
    applyAppSnapshot,
    persistAlbumItemOptimistic,
    showSystemWeakNotice,
    messageForStorage,
  };
  // useChatState 的迟绑定依赖在此处都已就绪(persistRecord / applyStateResponse / persistAlbumItemOptimistic /
  // showSystemWeakNotice / applyForProTrial / buildAgentPageContext / messageForStorage),每次渲染无条件刷新。
  chatLateRef.current = {
    persistRecord,
    applyStateResponse,
    persistAlbumItemOptimistic,
    showSystemWeakNotice,
    applyForProTrial,
    buildAgentPageContext,
    messageForStorage,
  };

  // 语音自动提交 / 语音采集管线(clearVoiceAutoSubmitTimer / runVoiceAutoSubmit / prepareVoiceStandby /
  // startVoiceCapture / stopVoiceCapture / cancelVoiceCapture / startVoicePress / releaseVoicePress /
  // cancelVoicePointer + 卸载清理 useEffect)、toggleComposerMode、submitComposerMessage(核心 AI 提交流)、
  // handleSubmit / handleComposerKeyDown 已抽到 useChatState。

  const closeRingingReminder = async () => {
    if (!ringingReminder) return;
    const target = ringingReminder;
    setRingingReminder(null);
    await completeReminder(target);
  };

  // openMilestones / closeMilestones / openVaccine / closeVaccine / setVaccineRegion / toggleVaccineDose /
  // refreshVaccineData useEffect / vaccinePending useMemo / openGrowthEntry / resetGrowthMeasurementDraft /
  // closeGrowthEntry / achieveMilestone / handleAddGrowthMeasurement / handleEditGrowthMeasurement /
  // handleDeleteGrowthMeasurement 已抽到 useRecordsState(上方提前调用)。

  // editAlbumItem / removeAlbumItem 已抽到 useAlbumState(上方提前调用,返回值解构回同名变量;
  // 共享的 persistAlbumItemOptimistic / applyStateResponse 经 albumLateRef 注入)。

  // updateAlbumPromptStatus / saveAlbumPrompt / ignoreAlbumPrompt / confirmPendingEffect / discardPendingEffect /
  // beginEditPendingEffect / savePendingEffectDraft / updatePendingGrowthDraft / updatePendingGrowthMeasurementDraft /
  // updatePendingCareDraft / updatePendingReminderDraft / updatePendingMemoryDraft / updatePendingExpenseDraft 已抽到
  // usePendingEffects(上方提前调用,返回值解构回同名变量;persistRecord / applyAppSnapshot / persistAlbumItemOptimistic /
  // showSystemWeakNotice / messageForStorage 经 pendingEffectsLateRef 注入,reminderFromDraft / scheduleNativeReminders 按值传入)。

  const selectManualRecordKind = (type: ManualRecordKind) => {
    setManualRecordKind(type);
    setCareEventDraft(createCareEventDraft(type));
  };

  // 这三个与 App 侧语音捕获 / 卸载清理 effect / 手动记录草稿强耦合,留在 App;读取 useRecordsState 解构回来的同名 drawer state/setters。
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

  // 哄睡音乐:全屏播放页开关(入口在记录页卡片之下)。
  const [sleepMusicOpen, setSleepMusicOpen] = useState(false);
  const [sleepMusicHandlers] = useState(() => ({ open: () => setSleepMusicOpen(true), close: () => setSleepMusicOpen(false) }));

  // careEventForRecord / beginEditCareTimelineEvent / saveCareTimelineEvent / canEditTimelineEvent /
  // beginTimelineEventSwipe / finishTimelineEventSwipe / cancelTimelineEventSwipe /
  // requestDeleteCareTimelineEvent 已抽到 useRecordsState。
  // closeDeleteCareEventConfirm / confirmDeleteCareTimelineEvent 留在 App(不在抽取范围),读取解构回来的同名 state/setter。

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

  // selectRecordDate 已抽到 useRecordsState。

  // handleProfileSubmit / handleLoginSubmit / handleLogout / saveOnboardingProfile / resetProfileDraft /
  // startProfileEditing / cancelProfileEditing 及 memo 化 <ProfileScreen/> 的稳定函数包 profileScreenHandlers
  // 已抽到 useSessionState(上方提前调用,返回值解构回同名变量)。

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

  // RecordsScreen(memo)的函数 props:同 albumScreenHandlers 的 ref 间接模式,引用永远稳定——
  // 打字草稿(input/composerMode/语音)逐键 setState 不会改变这些 props,故不触发记录树重渲。
  // openRecordsAssistant 经 ref 读到当前 composerMode,因此 composerMode 不必进 RecordsScreen props。
  const recordsScreenHandlersRef = useRef({
    selectRecordDate,
    quickFill,
    openRecordsAssistant,
    openManualRecordDrawer,
    openGrowthEntry,
    openMilestones,
    openVaccine,
    beginTimelineEventSwipe,
    finishTimelineEventSwipe,
    cancelTimelineEventSwipe,
    canEditTimelineEvent,
    beginEditCareTimelineEvent,
    requestDeleteCareTimelineEvent,
    saveCareTimelineEvent,
    handleAddGrowthMeasurement,
    handleEditGrowthMeasurement,
    handleDeleteGrowthMeasurement,
    resetGrowthMeasurementDraft,
    closeGrowthEntry,
    closeVaccine,
    setVaccineRegion,
    toggleVaccineDose,
    closeMilestones,
    achieveMilestone,
    composerMode,
  });
  recordsScreenHandlersRef.current = {
    selectRecordDate,
    quickFill,
    openRecordsAssistant,
    openManualRecordDrawer,
    openGrowthEntry,
    openMilestones,
    openVaccine,
    beginTimelineEventSwipe,
    finishTimelineEventSwipe,
    cancelTimelineEventSwipe,
    canEditTimelineEvent,
    beginEditCareTimelineEvent,
    requestDeleteCareTimelineEvent,
    saveCareTimelineEvent,
    handleAddGrowthMeasurement,
    handleEditGrowthMeasurement,
    handleDeleteGrowthMeasurement,
    resetGrowthMeasurementDraft,
    closeGrowthEntry,
    closeVaccine,
    setVaccineRegion,
    toggleVaccineDose,
    closeMilestones,
    achieveMilestone,
    composerMode,
  };
  const [recordsScreenHandlers] = useState<RecordsScreenHandlers>(() => ({
    selectRecordDate: (date) => recordsScreenHandlersRef.current.selectRecordDate(date),
    quickFill: (text) => recordsScreenHandlersRef.current.quickFill(text),
    openRecordsAssistant: () =>
      recordsScreenHandlersRef.current.openRecordsAssistant(undefined, {
        mode: recordsScreenHandlersRef.current.composerMode,
      }),
    openManualRecordDrawer: () => recordsScreenHandlersRef.current.openManualRecordDrawer(),
    openGrowthEntry: () => recordsScreenHandlersRef.current.openGrowthEntry(),
    openMilestones: () => recordsScreenHandlersRef.current.openMilestones(),
    openVaccine: () => recordsScreenHandlersRef.current.openVaccine(),
    beginTimelineEventSwipe: (event, record) =>
      recordsScreenHandlersRef.current.beginTimelineEventSwipe(event, record),
    finishTimelineEventSwipe: (event, record) =>
      recordsScreenHandlersRef.current.finishTimelineEventSwipe(event, record),
    cancelTimelineEventSwipe: () => recordsScreenHandlersRef.current.cancelTimelineEventSwipe(),
    canEditTimelineEvent: (record) => recordsScreenHandlersRef.current.canEditTimelineEvent(record),
    beginEditCareTimelineEvent: (record) =>
      recordsScreenHandlersRef.current.beginEditCareTimelineEvent(record),
    requestDeleteCareTimelineEvent: (record) =>
      recordsScreenHandlersRef.current.requestDeleteCareTimelineEvent(record),
    saveCareTimelineEvent: (event, record) =>
      recordsScreenHandlersRef.current.saveCareTimelineEvent(event, record),
    handleAddGrowthMeasurement: (event) =>
      recordsScreenHandlersRef.current.handleAddGrowthMeasurement(event),
    handleEditGrowthMeasurement: (measurement) =>
      recordsScreenHandlersRef.current.handleEditGrowthMeasurement(measurement),
    handleDeleteGrowthMeasurement: (id) =>
      recordsScreenHandlersRef.current.handleDeleteGrowthMeasurement(id),
    resetGrowthMeasurementDraft: () => recordsScreenHandlersRef.current.resetGrowthMeasurementDraft(),
    closeGrowthEntry: () => recordsScreenHandlersRef.current.closeGrowthEntry(),
    closeVaccine: () => recordsScreenHandlersRef.current.closeVaccine(),
    setVaccineRegion: (code) => recordsScreenHandlersRef.current.setVaccineRegion(code),
    toggleVaccineDose: (doseId, done) =>
      recordsScreenHandlersRef.current.toggleVaccineDose(doseId, done),
    closeMilestones: () => recordsScreenHandlersRef.current.closeMilestones(),
    achieveMilestone: (milestone) => recordsScreenHandlersRef.current.achieveMilestone(milestone),
  }));

  // ChatScreen(memo)的函数 props:同 recordsScreenHandlers 的 ref 间接模式,引用永远稳定——
  // 打字草稿走 composerInput external store,既不触达本 bundle 也不进 ChatScreen 数据 props。
  const chatScreenHandlersRef = useRef({
    handleSubmit,
    handleFiles,
    handleComposerKeyDown,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    openMediaPicker,
    openPreviewAttachment,
    quickFill,
    saveAlbumPrompt,
    ignoreAlbumPrompt,
    savePendingEffectDraft,
    confirmPendingEffect,
    discardPendingEffect,
    beginEditPendingEffect,
    updatePendingGrowthDraft,
    updatePendingGrowthMeasurementDraft,
    updatePendingCareDraft,
    updatePendingReminderDraft,
    updatePendingMemoryDraft,
    updatePendingExpenseDraft,
  });
  chatScreenHandlersRef.current = {
    handleSubmit,
    handleFiles,
    handleComposerKeyDown,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    openMediaPicker,
    openPreviewAttachment,
    quickFill,
    saveAlbumPrompt,
    ignoreAlbumPrompt,
    savePendingEffectDraft,
    confirmPendingEffect,
    discardPendingEffect,
    beginEditPendingEffect,
    updatePendingGrowthDraft,
    updatePendingGrowthMeasurementDraft,
    updatePendingCareDraft,
    updatePendingReminderDraft,
    updatePendingMemoryDraft,
    updatePendingExpenseDraft,
  };
  const [chatScreenHandlers] = useState<ChatScreenHandlers>(() => ({
    handleSubmit: (event) => chatScreenHandlersRef.current.handleSubmit(event),
    handleFiles: (event) => chatScreenHandlersRef.current.handleFiles(event),
    handleComposerKeyDown: (event) => chatScreenHandlersRef.current.handleComposerKeyDown(event),
    toggleComposerMode: () => chatScreenHandlersRef.current.toggleComposerMode(),
    startVoicePress: (event) => chatScreenHandlersRef.current.startVoicePress(event),
    releaseVoicePress: (event) => chatScreenHandlersRef.current.releaseVoicePress(event),
    cancelVoicePointer: (event) => chatScreenHandlersRef.current.cancelVoicePointer(event),
    openMediaPicker: () => chatScreenHandlersRef.current.openMediaPicker(),
    openPreviewAttachment: (attachment, albumItem) =>
      chatScreenHandlersRef.current.openPreviewAttachment(attachment, albumItem),
    quickFill: (text) => chatScreenHandlersRef.current.quickFill(text),
    saveAlbumPrompt: (messageId, prompt) => chatScreenHandlersRef.current.saveAlbumPrompt(messageId, prompt),
    ignoreAlbumPrompt: (messageId, prompt) => chatScreenHandlersRef.current.ignoreAlbumPrompt(messageId, prompt),
    savePendingEffectDraft: (effect) => void chatScreenHandlersRef.current.savePendingEffectDraft(effect),
    confirmPendingEffect: (effect) => void chatScreenHandlersRef.current.confirmPendingEffect(effect),
    discardPendingEffect: (effect) => void chatScreenHandlersRef.current.discardPendingEffect(effect),
    beginEditPendingEffect: (effect) => chatScreenHandlersRef.current.beginEditPendingEffect(effect),
    updatePendingGrowthDraft: (patch) => chatScreenHandlersRef.current.updatePendingGrowthDraft(patch),
    updatePendingGrowthMeasurementDraft: (id, patch) =>
      chatScreenHandlersRef.current.updatePendingGrowthMeasurementDraft(id, patch),
    updatePendingCareDraft: (patch) => chatScreenHandlersRef.current.updatePendingCareDraft(patch),
    updatePendingReminderDraft: (id, updater) =>
      chatScreenHandlersRef.current.updatePendingReminderDraft(id, updater),
    updatePendingMemoryDraft: (id, text) => chatScreenHandlersRef.current.updatePendingMemoryDraft(id, text),
    updatePendingExpenseDraft: (index, patch) => chatScreenHandlersRef.current.updatePendingExpenseDraft(index, patch),
  }));

  // AppDialogs(memo)的函数 props:同 chatScreenHandlers 的 ref 间接模式,引用永远稳定——
  // 四个顶层对话框(支出编辑/删除支出/删除时间线记录/批量删除)的 JSX 已抽进 screens/AppDialogs.tsx。
  const appDialogsHandlersRef = useRef<AppDialogsHandlers>({
    closeExpenseEditor,
    saveExpenseDraft,
    setExpenseDraft,
    settleExpenseOptionalPanel,
    closeDeleteExpenseConfirm,
    confirmDeleteExpense,
    closeDeleteCareEventConfirm,
    confirmDeleteCareTimelineEvent,
    closeBulkDeleteExpenses,
    confirmBulkDeleteExpenses,
  });
  appDialogsHandlersRef.current = {
    closeExpenseEditor,
    saveExpenseDraft,
    setExpenseDraft,
    settleExpenseOptionalPanel,
    closeDeleteExpenseConfirm,
    confirmDeleteExpense,
    closeDeleteCareEventConfirm,
    confirmDeleteCareTimelineEvent,
    closeBulkDeleteExpenses,
    confirmBulkDeleteExpenses,
  };
  const [appDialogsHandlers] = useState<AppDialogsHandlers>(() => ({
    closeExpenseEditor: () => appDialogsHandlersRef.current.closeExpenseEditor(),
    saveExpenseDraft: (event) => appDialogsHandlersRef.current.saveExpenseDraft(event),
    setExpenseDraft: (action) => appDialogsHandlersRef.current.setExpenseDraft(action),
    settleExpenseOptionalPanel: () => appDialogsHandlersRef.current.settleExpenseOptionalPanel(),
    closeDeleteExpenseConfirm: () => appDialogsHandlersRef.current.closeDeleteExpenseConfirm(),
    confirmDeleteExpense: () => void appDialogsHandlersRef.current.confirmDeleteExpense(),
    closeDeleteCareEventConfirm: () => appDialogsHandlersRef.current.closeDeleteCareEventConfirm(),
    confirmDeleteCareTimelineEvent: () => appDialogsHandlersRef.current.confirmDeleteCareTimelineEvent(),
    closeBulkDeleteExpenses: () => appDialogsHandlersRef.current.closeBulkDeleteExpenses(),
    confirmBulkDeleteExpenses: () => void appDialogsHandlersRef.current.confirmBulkDeleteExpenses(),
  }));

  // PreviewOverlay(memo)的函数 props:同 appDialogsHandlers 的 ref 间接模式,引用永远稳定——
  // 全屏预览浮层 JSX 已抽进 screens/PreviewOverlay.tsx。手势 handler(onPreview*Pointer*)每 render 重建、
  // editAlbumItem/removeAlbumItem 来自 useAlbumState,统一经 ref 包一层,保证 memo 的 handlers 引用不变。
  const previewOverlayHandlersRef = useRef<PreviewOverlayHandlers>({
    handlePreviewClick,
    closePreviewAttachment,
    setPreviewActionsOpen,
    editAlbumItem,
    removeAlbumItem,
    bindPreviewVideo,
    onPreviewStagePointerDown,
    onPreviewStagePointerMove,
    onPreviewStagePointerEnd,
    onPreviewImagePointerDown,
    onPreviewImagePointerMove,
    onPreviewImagePointerEnd,
  });
  previewOverlayHandlersRef.current = {
    handlePreviewClick,
    closePreviewAttachment,
    setPreviewActionsOpen,
    editAlbumItem,
    removeAlbumItem,
    bindPreviewVideo,
    onPreviewStagePointerDown,
    onPreviewStagePointerMove,
    onPreviewStagePointerEnd,
    onPreviewImagePointerDown,
    onPreviewImagePointerMove,
    onPreviewImagePointerEnd,
  };
  const [previewOverlayHandlers] = useState<PreviewOverlayHandlers>(() => ({
    handlePreviewClick: (event) => previewOverlayHandlersRef.current.handlePreviewClick(event),
    closePreviewAttachment: () => previewOverlayHandlersRef.current.closePreviewAttachment(),
    setPreviewActionsOpen: (action) => previewOverlayHandlersRef.current.setPreviewActionsOpen(action),
    editAlbumItem: (item, ui) => previewOverlayHandlersRef.current.editAlbumItem(item, ui),
    removeAlbumItem: (item, ui) => previewOverlayHandlersRef.current.removeAlbumItem(item, ui),
    bindPreviewVideo: (node) => previewOverlayHandlersRef.current.bindPreviewVideo(node),
    onPreviewStagePointerDown: (event) => previewOverlayHandlersRef.current.onPreviewStagePointerDown(event),
    onPreviewStagePointerMove: (event) => previewOverlayHandlersRef.current.onPreviewStagePointerMove(event),
    onPreviewStagePointerEnd: (event) => previewOverlayHandlersRef.current.onPreviewStagePointerEnd(event),
    onPreviewImagePointerDown: (event) => previewOverlayHandlersRef.current.onPreviewImagePointerDown(event),
    onPreviewImagePointerMove: (event) => previewOverlayHandlersRef.current.onPreviewImagePointerMove(event),
    onPreviewImagePointerEnd: (event) => previewOverlayHandlersRef.current.onPreviewImagePointerEnd(event),
  }));

  // RecordsEntryDrawer(memo)的函数 props:同上 ref 间接模式,引用永远稳定——
  // AI/手动 composer 抽屉的 JSX(含 createPortal)已抽进 screens/RecordsEntryDrawer.tsx。
  const recordsEntryDrawerHandlersRef = useRef<RecordsEntryDrawerHandlers>({
    closeRecordsEntryDrawer,
    pendingEffectSummary,
    confirmPendingEffect,
    discardPendingEffect,
    handleSubmit,
    openMediaPicker,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    handleComposerKeyDown,
    saveManualCareEvent,
    selectManualRecordKind,
    updateManualCareDraft,
    adjustManualNumericDraft,
    timePresetValue,
    numericDraftText,
    sleepDurationText,
  });
  recordsEntryDrawerHandlersRef.current = {
    closeRecordsEntryDrawer,
    pendingEffectSummary,
    confirmPendingEffect,
    discardPendingEffect,
    handleSubmit,
    openMediaPicker,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    handleComposerKeyDown,
    saveManualCareEvent,
    selectManualRecordKind,
    updateManualCareDraft,
    adjustManualNumericDraft,
    timePresetValue,
    numericDraftText,
    sleepDurationText,
  };
  const [recordsEntryDrawerHandlers] = useState<RecordsEntryDrawerHandlers>(() => ({
    closeRecordsEntryDrawer: () => recordsEntryDrawerHandlersRef.current.closeRecordsEntryDrawer(),
    pendingEffectSummary: (effect) => recordsEntryDrawerHandlersRef.current.pendingEffectSummary(effect),
    confirmPendingEffect: (effect) => void recordsEntryDrawerHandlersRef.current.confirmPendingEffect(effect),
    discardPendingEffect: (effect) => void recordsEntryDrawerHandlersRef.current.discardPendingEffect(effect),
    handleSubmit: (event) => recordsEntryDrawerHandlersRef.current.handleSubmit(event),
    openMediaPicker: () => recordsEntryDrawerHandlersRef.current.openMediaPicker(),
    toggleComposerMode: () => recordsEntryDrawerHandlersRef.current.toggleComposerMode(),
    startVoicePress: (event) => recordsEntryDrawerHandlersRef.current.startVoicePress(event),
    releaseVoicePress: (event) => recordsEntryDrawerHandlersRef.current.releaseVoicePress(event),
    cancelVoicePointer: (event) => recordsEntryDrawerHandlersRef.current.cancelVoicePointer(event),
    handleComposerKeyDown: (event) => recordsEntryDrawerHandlersRef.current.handleComposerKeyDown(event),
    saveManualCareEvent: (event) => recordsEntryDrawerHandlersRef.current.saveManualCareEvent(event),
    selectManualRecordKind: (type) => recordsEntryDrawerHandlersRef.current.selectManualRecordKind(type),
    updateManualCareDraft: (patch) => recordsEntryDrawerHandlersRef.current.updateManualCareDraft(patch),
    adjustManualNumericDraft: (field, delta, fallback, min, max, decimals) =>
      recordsEntryDrawerHandlersRef.current.adjustManualNumericDraft(field, delta, fallback, min, max, decimals),
    timePresetValue: (offsetMinutes) => recordsEntryDrawerHandlersRef.current.timePresetValue(offsetMinutes),
    numericDraftText: (value, decimals) => recordsEntryDrawerHandlersRef.current.numericDraftText(value, decimals),
    sleepDurationText: (value) => recordsEntryDrawerHandlersRef.current.sleepDurationText(value),
  }));

  // voiceHoldLabel / voiceButtonStyle / voiceRecordingActive / compressionMessage 已抽到 useChatState
  // (上方提前调用,返回值解构回同名变量)。voicePanelLabel 只在本文件下方的 voice-recording-panel JSX 用
  // (非 ChatScreen prop),仅依赖 hook 返回的 voiceCancelArmed,故留在 App 就地派生。
  const voicePanelLabel = voiceCancelArmed ? "松手取消" : "松手发送，上移取消";
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

  // 首登知情同意：未同意前挡住一切（登录/引导/主界面都看不到）。
  if (!consentGiven) {
    return <ConsentGate onAccept={() => setConsentGiven(true)} />;
  }

  if (authStatus === "checking") {
    return <AuthSplash systemWeakNoticeView={systemWeakNoticeView} />;
  }

  if (authStatus === "unauthenticated") {
    return (
      <LoginScreen
        systemWeakNoticeView={systemWeakNoticeView}
        handleLoginSubmit={handleLoginSubmit}
        loginPhone={loginPhone}
        setLoginPhone={setLoginPhone}
        loginInviteCode={loginInviteCode}
        setLoginInviteCode={setLoginInviteCode}
        loginExistingMember={loginExistingMember}
        inviteRoleHint={inviteRoleHint}
        inviteFamilyName={inviteFamilyName}
        loginRoleName={loginRoleName}
        loginRoleOptions={loginRoleOptions}
        setLoginRoleName={setLoginRoleName}
        isCheckingInviteRoles={isCheckingInviteRoles}
        loginCaregiver={loginCaregiver}
        setLoginCaregiver={setLoginCaregiver}
        loginError={loginError}
        isLoggingIn={isLoggingIn}
        loginReady={loginReady}
      />
    );
  }

  if (onboardingRequired) {
    return (
      <OnboardingScreen
        systemWeakNoticeView={systemWeakNoticeView}
        canCaregive={canCaregive}
        authFamily={authFamily}
        authMember={authMember}
        authUser={authUser}
        handleLogout={handleLogout}
        onboardingStep={onboardingStep}
        setOnboardingStep={setOnboardingStep}
        onboardingDraft={onboardingDraft}
        setOnboardingDraft={setOnboardingDraft}
        onboardingFamilyName={onboardingFamilyName}
        setOnboardingFamilyName={setOnboardingFamilyName}
        onboardingAllergiesText={onboardingAllergiesText}
        setOnboardingAllergiesText={setOnboardingAllergiesText}
        onboardingFamilyNameTouchedRef={onboardingFamilyNameTouchedRef}
        saveOnboardingProfile={saveOnboardingProfile}
        loginError={loginError}
        profile={profile}
      />
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

        <ChatScreen
          messages={messages}
          babyNickname={babyNickname}
          familySpeakerName={familySpeakerName}
          compressionMessage={compressionMessage}
          compressionStatus={compressionStatus}
          quickActions={quickActions}
          pendingEffects={pendingEffects}
          confirmingPendingEffectIds={confirmingPendingEffectIds}
          editingPendingId={editingPendingId}
          pendingDraft={pendingDraft}
          composerMode={composerMode}
          voiceHoldLabel={voiceHoldLabel}
          voiceButtonStyle={voiceButtonStyle}
          voiceRecordingActive={voiceRecordingActive}
          isListening={isListening}
          voiceStatus={voiceStatus}
          voiceCancelArmed={voiceCancelArmed}
          isSubmitting={isSubmitting}
          isUploadingChatMedia={isUploadingChatMedia}
          attachments={attachments}
          chatUploadItems={chatUploadItems}
          isAttachmentTrayOpen={isAttachmentTrayOpen}
          canCollapseAttachmentTray={canCollapseAttachmentTray}
          chatAttachmentCountLabel={chatAttachmentCountLabel}
          chatAttachmentLimitLabel={chatAttachmentLimitLabel}
          isChatAttachmentLimitReached={isChatAttachmentLimitReached}
          attachmentTrayMetaLabel={attachmentTrayMetaLabel}
          attachmentTrayPreviewItems={attachmentTrayPreviewItems}
          attachmentTrayOverflowCount={attachmentTrayOverflowCount}
          canAttachVisuals={canAttachVisuals}
          visualToolClassName={visualToolClassName}
          visualToolTitle={visualToolTitle}
          visualToolGated={visualToolGated}
          visualToolDisabled={visualToolDisabled}
          messageListRef={messageListRef}
          fileInputRef={fileInputRef}
          visibleToolActivitiesForMessage={visibleToolActivitiesForMessage}
          isAgentProgressActivity={isAgentProgressActivity}
          askDecisions={askDecisions}
          pendingEffectSummary={pendingEffectSummary}
          hostLabel={hostLabel}
          setRecordsAssistantOpen={setRecordsAssistantOpen}
          setIsAttachmentTrayExpanded={setIsAttachmentTrayExpanded}
          setAttachments={setAttachments}
          setEditingPendingId={setEditingPendingId}
          setPendingDraft={setPendingDraft}
          handlers={chatScreenHandlers}
        />

        <RecordsScreen
          canCaregive={canCaregive}
          recordView={recordView}
          recordHeading={recordHeading}
          todayDate={todayDate}
          selectedDate={selectedDate}
          selectedDateIsToday={selectedDateIsToday}
          calendarMonth={calendarMonth}
          calendarDates={calendarDates}
          eventDates={eventDates}
          recordsEntryDrawer={recordsEntryDrawer}
          growthEntryOpen={growthEntryOpen}
          vaccineViewOpen={vaccineViewOpen}
          milestonesViewOpen={milestonesViewOpen}
          sleepMusicOpen={sleepMusicOpen}
          quickActions={quickActions}
          sleepMusicHandlers={sleepMusicHandlers}
          selectedGrowthCount={selectedGrowthCount}
          selectedKeyPointCount={selectedKeyPointCount}
          dailyCareBreakdowns={dailyCareBreakdowns}
          weeklyCareComparison={weeklyCareComparison}
          milkCurveData={milkCurveData}
          sleepCurveData={sleepCurveData}
          growthTrendMetrics={growthTrendMetrics}
          selectedEvents={selectedEvents}
          swipedTimelineEventId={swipedTimelineEventId}
          editingCareEventId={editingCareEventId}
          careEventDraft={careEventDraft}
          growthCurveType={growthCurveType}
          growthCurveData={growthCurveData}
          profile={profile}
          growthEvents={growthEvents}
          growthMeasurements={growthMeasurements}
          growthMeasurementDraft={growthMeasurementDraft}
          editingGrowthMeasurementId={editingGrowthMeasurementId}
          vaccinePending={vaccinePending}
          babyNickname={babyNickname}
          setRecordView={setRecordView}
          setCalendarMonth={setCalendarMonth}
          setSwipedTimelineEventId={setSwipedTimelineEventId}
          setEditingCareEventId={setEditingCareEventId}
          setCareEventDraft={setCareEventDraft}
          setGrowthCurveType={setGrowthCurveType}
          setGrowthMeasurementDraft={setGrowthMeasurementDraft}
          handlers={recordsScreenHandlers}
        />

        {/* 打字所在的 AI/手动 composer 抽屉(含 createPortal 到 document.body)已抽进 screens/RecordsEntryDrawer.tsx;
            从记录区提升为 <RecordsScreen/> 的兄弟节点后,打字逐键 setState 只重渲 App,不再触达 memo 的记录树。 */}
        <RecordsEntryDrawer
          canCaregive={canCaregive}
          recordsEntryDrawer={recordsEntryDrawer}
          recordsEntryDrawerClosing={recordsEntryDrawerClosing}
          selectedDate={selectedDate}
          selectedDateIsToday={selectedDateIsToday}
          pendingEffects={pendingEffects}
          confirmingPendingEffectIds={confirmingPendingEffectIds}
          messages={messages}
          isSubmitting={isSubmitting}
          chatUploadItems={chatUploadItems}
          attachments={attachments}
          voiceRecordingActive={voiceRecordingActive}
          composerMode={composerMode}
          canUseComposerInput={canUseComposerInput}
          isListening={isListening}
          voiceStatus={voiceStatus}
          voiceCancelArmed={voiceCancelArmed}
          voiceButtonStyle={voiceButtonStyle}
          voiceHoldLabel={voiceHoldLabel}
          babyNickname={babyNickname}
          isUploadingChatMedia={isUploadingChatMedia}
          visualToolClassName={visualToolClassName}
          visualToolTitle={visualToolTitle}
          visualToolGated={visualToolGated}
          visualToolDisabled={visualToolDisabled}
          manualRecordKind={manualRecordKind}
          careEventDraft={careEventDraft}
          manualRecordTypes={MANUAL_RECORD_TYPES}
          manualTimePresets={MANUAL_TIME_PRESETS}
          manualMilkAmounts={MANUAL_MILK_AMOUNTS}
          manualMilkNotes={MANUAL_MILK_NOTES}
          manualSleepDurations={MANUAL_SLEEP_DURATIONS}
          manualTemperatureOptions={MANUAL_TEMPERATURE_OPTIONS}
          manualPoopNotes={MANUAL_POOP_NOTES}
          manualSolidNotes={MANUAL_SOLID_NOTES}
          handlers={recordsEntryDrawerHandlers}
        />

        {visitedMobileTabsRef.current.has("ledger") ? (
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
        ) : null}

        {visitedMobileTabsRef.current.has("album") ? (
        <AlbumScreen
          canCaregive={canCaregive}
          isUploadingAlbumMedia={isUploadingAlbumMedia}
          albumStats={albumStats}
          albumUploadItems={albumUploadItems}
          albumGroups={albumGroups}
          albumFileInputRef={albumFileInputRef}
          albumTileAspect={albumTileAspect}
          onPickFiles={albumScreenHandlers.onPickFiles}
          onOpenPicker={albumScreenHandlers.onOpenPicker}
          onOpenPreview={albumScreenHandlers.onOpenPreview}
          onRecordRatio={recordAlbumRatio}
        />
        ) : null}

        {visitedMobileTabsRef.current.has("profile") ? (
        <>
        <RemindersScreen
          canCaregive={canCaregive}
          reminderManagementOpen={reminderManagementOpen}
          reminderBuckets={reminderBuckets}
          actionableReminderCount={actionableReminderCount}
          reminderEditorOpen={reminderEditorOpen}
          editingReminderId={editingReminderId}
          reminderDraft={reminderDraft}
          completeReminderTarget={completeReminderTarget}
          postponeReminderTarget={postponeReminderTarget}
          postponeReminderDraft={postponeReminderDraft}
          deleteReminderTarget={deleteReminderTarget}
          setReminderDraft={setReminderDraft}
          setPostponeReminderDraft={setPostponeReminderDraft}
          handlers={remindersScreenHandlers}
        />

        <ProfileScreen
          profile={profile}
          profileDraft={profileDraft}
          isProfileEditing={isProfileEditing}
          allergiesText={allergiesText}
          canCaregive={canCaregive}
          actionableReminderCount={actionableReminderCount}
          authUser={authUser}
          authFamily={authFamily}
          authMember={authMember}
          familyMembers={familyMembers}
          familyMembersStatus={familyMembersStatus}
          familyMemberBusyUserId={familyMemberBusyUserId}
          resetInviteCodeValue={resetInviteCodeValue}
          proTrial={proTrial}
          isApplyingProTrial={isApplyingProTrial}
          isRedeemingProCode={isRedeemingProCode}
          redeemCodeInput={redeemCodeInput}
          aiUsageSummary={aiUsageSummary}
          aiUsageStatus={aiUsageStatus}
          runtimeVersion={runtimeVersion}
          setProfileDraft={setProfileDraft}
          setAllergiesText={setAllergiesText}
          setRedeemCodeInput={setRedeemCodeInput}
          setSettingsLegalDoc={setSettingsLegalDoc}
          handlers={profileScreenHandlers}
        />
        </>
        ) : null}

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
              className={`voice-recording-panel app-portal ${voiceCancelArmed ? "canceling" : ""}`.trim()}
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
      <AppDialogs
        expenseEditorOpen={expenseEditorOpen}
        editingExpenseId={editingExpenseId}
        expenseDraft={expenseDraft}
        expenseEditorBodyRef={expenseEditorBodyRef}
        expenseOptionalPanelRef={expenseOptionalPanelRef}
        deleteExpenseTarget={deleteExpenseTarget}
        deleteCareEventTarget={deleteCareEventTarget}
        bulkDeleteExpensesOpen={bulkDeleteExpensesOpen}
        selectedExpenseIds={selectedExpenseIds}
        handlers={appDialogsHandlers}
      />
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
      <PreviewOverlay
        previewAttachment={previewAttachment}
        previewAlbumItem={previewAlbumItem}
        previewMotion={previewMotion}
        previewOriginRect={previewOriginRect}
        previewActionsOpen={previewActionsOpen}
        previewTransform={previewTransform}
        previewCarouselItems={previewCarouselItems}
        previewCarouselTrackRef={previewCarouselTrackRef}
        previewVt={PREVIEW_VT}
        canCaregive={canCaregive}
        handlers={previewOverlayHandlers}
      />
    </main>
  );
}

export default App;
