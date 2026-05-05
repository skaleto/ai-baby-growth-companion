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
  MessageCircle,
  Mic,
  Music2,
  PencilLine,
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
  X,
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  ChangeEvent,
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { compressConversationSummary, runAgentChatStream } from "./agentApi";
import { ensureMicrophonePermission } from "./audioPermission";
import {
  confirmPendingEffectOnServer,
  deleteAppRecord,
  discardPendingEffectOnServer,
  importAppState,
  readAppState,
  type AppStateCollection,
  type AppStateResponse,
  upsertAppRecord,
  uploadDataUrlAttachment,
} from "./appStateApi";
import { AsrStreamController, runAsrStream } from "./asrApi";
import {
  AuthFamily,
  AuthMember,
  AuthUser,
  clearAuthToken,
  getAuthToken,
  readInviteRoleOptions,
  loginWithInvite,
  logoutCurrentUser,
  readCurrentUser,
  updateFamilyName,
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
  scheduleAlarmReminder,
} from "./nativeAlarm";
import { useStoredState } from "./storage";
import {
  AgentChatResponse,
  AgentBabyProfileContext,
  AgentModelId,
  AgentModelOption,
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
  GrowthEvent,
  MemoryItem,
  PendingEffect,
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

const MODEL_OPTIONS: AgentModelOption[] = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", supportsImageInput: false, supportsVideoInput: false },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", supportsImageInput: false, supportsVideoInput: false },
  { id: "doubao-seed-2.0-pro", label: "Doubao Seed 2.0 Pro", supportsImageInput: true, supportsVideoInput: true },
  { id: "doubao-seed-2.0-lite", label: "Doubao Seed 2.0 Lite", supportsImageInput: true, supportsVideoInput: true },
];

const DEFAULT_MODEL: AgentModelId = "deepseek-v4-pro";

const MOBILE_TABS = [
  { id: "chat", label: "聊天", icon: MessageCircle },
  { id: "records", label: "记录", icon: CalendarDays },
  { id: "album", label: "相册", icon: ImageIcon },
  { id: "reminders", label: "提醒", icon: Bell },
  { id: "profile", label: "我的", icon: UserRound },
] as const;

const ROLE_OPTIONS = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "月嫂", "保姆", "亲友", "其他"] as const;
const UNIQUE_ROLE_OPTIONS = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆"] as const;

const ALBUM_CATEGORIES: Array<{ id: AlbumItemCategory | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "growth", label: "成长" },
  { id: "feeding", label: "喂养" },
  { id: "sleep", label: "睡眠" },
  { id: "health", label: "健康" },
  { id: "reminder", label: "提醒/疫苗" },
];

const RECORD_VIEWS: Array<{ id: RecordView; label: string }> = [
  { id: "today", label: "今日" },
  { id: "trend", label: "趋势" },
  { id: "calendar", label: "日历" },
];

const REMINDER_QUICK_ACTIONS = [
  { label: "疫苗", prompt: "提醒我带小宝去社区医院打疫苗" },
  { label: "体检", prompt: "提醒我带小宝去做体检" },
  { label: "洗澡", prompt: "晚上 8 点提醒我给小宝洗澡" },
  { label: "喂奶闹钟", prompt: "每 3 小时提醒我喂奶" },
  { label: "喂药", prompt: "提醒我给小宝喂药，具体用药以医生医嘱为准" },
  { label: "复诊", prompt: "提醒我带小宝去复诊" },
  { label: "自定义", prompt: "帮我设置一个照护提醒：" },
];

const REMINDER_CHANNELS = {
  schedule: "baby_schedule_v1",
  soft_chime: "baby_alarm_chime_v2",
  soft_bell: "baby_alarm_bell_v2",
} as const;

const LEGACY_REMINDER_CHANNELS = ["baby_alarm_chime_v1", "baby_alarm_bell_v1"];

const REMINDER_SOUND_FILES: Record<ReminderSoundId, string> = {
  soft_chime: "xiaobao_chime.wav",
  soft_bell: "xiaobao_bell.wav",
};

const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 12 * 60;

const StorybookScene = () => (
  <div className="storybook-scene" aria-hidden="true">
    <span className="storybook-sun" />
    <span className="storybook-cloud cloud-one" />
    <span className="storybook-cloud cloud-two" />
    <span className="storybook-star star-one" />
    <span className="storybook-star star-two" />
    <span className="storybook-baby">
      <img src={companionIcon} alt="" />
    </span>
  </div>
);

type MobileTab = (typeof MOBILE_TABS)[number]["id"];

type ComposerMode = "keyboard" | "voice";

type RecordView = "today" | "trend" | "calendar";

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "unsupported" | "error";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

type CompressionStatus = "idle" | "checking" | "compressing" | "done" | "failed";

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
};

type CareEventDraft = {
  type: CareLogEventType;
  time: string;
  amountMl: string;
  durationHours: string;
  temperature: string;
  note: string;
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
  careLogPatch?: PendingCareDraft;
  reminders: PendingReminderDraft[];
  memories: PendingMemoryDraft[];
};

type AlbumMediaDecision = {
  id: string;
  mode: "auto_save" | "ask" | "ignore";
  category: AlbumItemCategory;
  reason: string;
  title?: string;
  tags: string[];
  attachmentId: string;
  sourceMessageId: string;
  createdAt: string;
};

type AlbumEffectPayload = {
  intent?: string;
  targetScope?: "current" | "previous" | "recent" | "unspecified";
  targetKind?: "image" | "video" | "media" | "any";
  refHint?: string;
  category?: AlbumItemCategory;
  reason?: string;
  title?: string;
  tags?: string[];
};

type SelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
};

const ROLE_SELECT_OPTIONS: Array<SelectOption<"" | (typeof ROLE_OPTIONS)[number]>> = [
  { value: "", label: "请选择身份", hint: "新成员首次加入时必选" },
  ...ROLE_OPTIONS.map((role) => ({ value: role, label: role })),
];

const STAGE_SELECT_OPTIONS: Array<SelectOption<BabyProfile["stage"]>> = [
  { value: "born", label: "已出生", hint: "按出生日期计算月龄" },
  { value: "pregnancy", label: "孕期", hint: "按预产期记录准备事项" },
];

const REGION_SELECT_OPTIONS: Array<SelectOption<string>> = [
  { value: "", label: "暂不填写", hint: "之后可以在“我的”里补充" },
  { value: "北京", label: "北京" },
  { value: "上海", label: "上海" },
  { value: "广州", label: "广州" },
  { value: "深圳", label: "深圳" },
  { value: "杭州", label: "杭州" },
  { value: "南京", label: "南京" },
  { value: "苏州", label: "苏州" },
  { value: "成都", label: "成都" },
  { value: "重庆", label: "重庆" },
  { value: "武汉", label: "武汉" },
  { value: "西安", label: "西安" },
  { value: "天津", label: "天津" },
  { value: "其他地区", label: "其他地区", hint: "仅用于给 AI 一个大致地区" },
];

const FEEDING_SELECT_OPTIONS: Array<SelectOption<string>> = [
  { value: "", label: "暂不确定", hint: "之后可以随时修改" },
  { value: "母乳喂养", label: "母乳喂养" },
  { value: "配方奶喂养", label: "配方奶喂养" },
  { value: "混合喂养", label: "混合喂养" },
  { value: "亲喂为主", label: "亲喂为主" },
  { value: "瓶喂为主", label: "瓶喂为主" },
  { value: "已添加辅食", label: "已添加辅食" },
];

const MODEL_SELECT_OPTIONS: Array<SelectOption<AgentModelId>> = MODEL_OPTIONS.map((model) => ({
  value: model.id,
  label: model.label,
  hint: model.supportsImageInput || model.supportsVideoInput ? "支持视觉理解" : "文本对话模型",
}));

const CARE_EVENT_TYPE_OPTIONS: Array<SelectOption<CareLogEventType>> = [
  { value: "milk", label: "喝奶" },
  { value: "sleep", label: "睡觉" },
  { value: "wake", label: "醒来" },
  { value: "poop", label: "便便" },
  { value: "solid", label: "辅食" },
  { value: "temperature", label: "体温" },
  { value: "soothing", label: "哄睡" },
  { value: "note", label: "其他" },
];

const REMINDER_CATEGORY_OPTIONS: Array<SelectOption<Reminder["category"]>> = [
  { value: "care", label: "照护", hint: "喂奶、洗澡、日常护理" },
  { value: "routine", label: "日程", hint: "体检、复诊、普通待办" },
  { value: "vaccine", label: "疫苗", hint: "接种、社区医院安排" },
  { value: "custom", label: "自定义", hint: "其他家庭事项" },
];

const REMINDER_SCHEDULE_MODE_OPTIONS: Array<SelectOption<ReminderScheduleMode>> = [
  { value: "once", label: "提醒一次", hint: "选一个具体日期和时间" },
  { value: "interval", label: "循环提醒", hint: "按固定间隔重复提醒" },
];

const REMINDER_ALERT_MODE_OPTIONS: Array<SelectOption<ReminderAlertMode>> = [
  { value: "notification", label: "普通通知", hint: "到点推送一条消息" },
  { value: "ringing", label: "闹铃响起", hint: "进入全屏提醒页并播放提示音" },
];

const REMINDER_SOUND_OPTIONS: Array<SelectOption<ReminderSoundId>> = [
  { value: "soft_chime", label: "柔和叮咚", hint: "短促、轻一点" },
  { value: "soft_bell", label: "轻铃声", hint: "更清脆一点" },
];

type StorySelectProps<T extends string> = {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
};

function StorySelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "请选择",
  disabled = false,
  className = "",
  title,
}: StorySelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`story-select ${open ? "open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="story-select-trigger"
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className={selectedOption ? "" : "placeholder"}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="story-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled ? true : undefined}
              className={`${option.value === value ? "selected" : ""} ${option.disabled ? "disabled" : ""}`.trim()}
              disabled={option.disabled}
              key={option.value}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.hint ? <small>{option.hint}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const selectOptionsWithCurrent = <T extends string,>(options: Array<SelectOption<T>>, value: T): Array<SelectOption<T>> => {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: value, hint: "当前已保存" }, ...options];
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

type AutoRecordUndo = {
  id: string;
  messageId: string;
  label: string;
  collection: "careLogs";
  recordId: string;
  previous?: CareLog;
  created: boolean;
};

const LEGACY_STORAGE_KEYS = [
  "baby-companion-profile",
  "baby-companion-messages",
  "baby-companion-growth",
  "baby-companion-care",
  "baby-companion-reminders",
  "baby-companion-memories",
  "baby-companion-pending-effects",
  "baby-companion-album-items",
  "baby-companion-conversation-summary",
];

const LEGACY_IMPORT_MARKER_KEY = "baby-companion-legacy-imported";

const readLocalJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const hasLocalArrayItems = (key: string) => {
  const value = readLocalJson(key);
  return Array.isArray(value) && value.length > 0;
};

const hasLegacyLocalState = () => {
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
      hasLocalArrayItems("baby-companion-pending-effects")
    );
  } catch {
    return false;
  }
};

const markLegacyImported = () => {
  try {
    window.localStorage.setItem(LEGACY_IMPORT_MARKER_KEY, "true");
  } catch {
    // Ignore storage failures; backend data remains authoritative after login.
  }
};

const clearLocalAppState = () => {
  try {
    [...LEGACY_STORAGE_KEYS, "baby-companion-thinking-enabled", "baby-companion-model"].forEach((key) =>
      window.localStorage.removeItem(key),
    );
    markLegacyImported();
  } catch {
    // Ignore local storage failures.
  }
};

const blankProfile: BabyProfile = {
  nickname: "",
  stage: "born",
  expectedDate: "",
  birthDate: "",
  region: "",
  feeding: "",
  allergies: [],
  caregivers: [],
};

const hasCompleteProfile = (profile?: Partial<BabyProfile> | null) =>
  Boolean(profile?.nickname?.trim() && (profile.birthDate?.trim() || profile.expectedDate?.trim()));

const suggestedFamilyName = (nickname: string) => `${nickname.trim() || "小宝"}家`;

const textValue = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const normalizeBabyProfile = (value: Partial<BabyProfile> | null | undefined): BabyProfile => ({
  nickname: textValue(value?.nickname),
  stage: value?.stage === "pregnancy" ? "pregnancy" : "born",
  expectedDate: textValue(value?.expectedDate),
  birthDate: textValue(value?.birthDate),
  region: textValue(value?.region),
  feeding: textValue(value?.feeding),
  allergies: stringList(value?.allergies),
  caregivers: stringList(value?.caregivers),
});

const normalizeAttachment = (value: Partial<Attachment> | null | undefined, index: number): Attachment => ({
  id: textValue(value?.id, `attachment-${index}`),
  name: textValue(value?.name, "附件"),
  kind: value?.kind === "video" || value?.kind === "audio" ? value.kind : "image",
  url: textValue(value?.url) || undefined,
  dataUrl: textValue(value?.dataUrl) || undefined,
  mimeType: textValue(value?.mimeType) || undefined,
  filePath: textValue(value?.filePath) || undefined,
  publicUrl: textValue(value?.publicUrl) || undefined,
  width: numberValue(value?.width),
  height: numberValue(value?.height),
});

const normalizeAlbumCategory = (value: unknown): AlbumItemCategory => {
  if (
    value === "growth" ||
    value === "feeding" ||
    value === "sleep" ||
    value === "health" ||
    value === "reminder" ||
    value === "daily"
  ) {
    return value;
  }
  return "daily";
};

const normalizeAlbumItem = (value: Partial<AlbumItem> | null | undefined, index: number): AlbumItem => ({
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
});

const normalizeAlbumPrompt = (value: Partial<AlbumPrompt> | null | undefined, index: number): AlbumPrompt => ({
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

const normalizeChatMessage = (value: Partial<ChatMessage> | null | undefined, index: number): ChatMessage => ({
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

const normalizeCareLogEventType = (value: unknown): CareLogEventType => {
  if (
    value === "milk" ||
    value === "sleep" ||
    value === "wake" ||
    value === "poop" ||
    value === "solid" ||
    value === "temperature" ||
    value === "soothing" ||
    value === "note"
  ) {
    return value;
  }
  return "note";
};

const normalizeClockText = (value: unknown) => {
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

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const localTimeKey = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const reminderTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

const chineseNumberMap: Record<string, number> = {
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

const parseLooseNumber = (value: string | undefined) => {
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

const dateFromLocalParts = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

const setClockOnDate = (date: Date, clockText: string) => {
  const [hour, minute] = clockText.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

const parseWeekdayIndex = (value: string) => {
  if (value === "一" || value === "1") return 1;
  if (value === "二" || value === "2") return 2;
  if (value === "三" || value === "3") return 3;
  if (value === "四" || value === "4") return 4;
  if (value === "五" || value === "5") return 5;
  if (value === "六" || value === "6") return 6;
  return 0;
};

const parseReminderDueAt = (value: Partial<Reminder> | string | null | undefined, now = new Date()): Date | undefined => {
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

const formatReminderDueText = (dueAt: Date) => {
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

const reminderNotificationId = (reminder: Pick<Reminder, "id">, offset = 0) => {
  let hash = 0;
  for (let index = 0; index < reminder.id.length; index += 1) {
    hash = (hash * 31 + reminder.id.charCodeAt(index)) & 0x7fffffff;
  }
  return Math.max(1, (hash + offset) % 2_000_000_000);
};

const normalizeReminderKind = (kind: unknown): ReminderKind =>
  kind === "alarm" || kind === "schedule" ? kind : "schedule";

const normalizeReminderScheduleMode = (mode: unknown, reminderKind?: unknown, repeatRule?: unknown): ReminderScheduleMode => {
  if (mode === "once" || mode === "interval") return mode;
  if (repeatRule && typeof repeatRule === "object") return "interval";
  return reminderKind === "alarm" ? "interval" : "once";
};

const normalizeReminderAlertMode = (mode: unknown, reminderKind?: unknown): ReminderAlertMode => {
  if (mode === "notification" || mode === "ringing") return mode;
  return reminderKind === "alarm" ? "ringing" : "notification";
};

const normalizeReminderSoundId = (soundId: unknown): ReminderSoundId =>
  soundId === "soft_bell" || soundId === "soft_chime" ? soundId : "soft_chime";

const normalizeReminderRepeatRule = (value: unknown): ReminderRepeatRule | undefined => {
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

const isIntervalReminder = (reminder: Pick<Reminder, "scheduleMode" | "repeatRule" | "status">) =>
  reminder.status !== "done" &&
  reminder.scheduleMode === "interval" &&
  reminder.repeatRule?.mode === "fixedInterval";

const isIntervalMilkReminder = (reminder: Pick<Reminder, "scheduleMode" | "repeatRule" | "status">) =>
  isIntervalReminder(reminder) &&
  reminder.repeatRule?.anchorType === "careEvent" &&
  reminder.repeatRule?.careEventType === "milk";

const normalizeReminderSchedule = (reminder: Reminder, now = new Date()): Reminder => {
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

const normalizeEventClockText = (timeValue: unknown, noteValue: unknown) => {
  const directTime = normalizeClockText(timeValue);
  const noteTime = normalizeClockText(noteValue);
  if (directTime && noteTime && directTime.endsWith(":00") && typeof noteValue === "string" && /点\s*半/.test(noteValue)) {
    return noteTime;
  }
  return directTime ?? noteTime;
};

const canonicalCareEventTitle = (type: CareLogEventType, fallback?: string) => {
  if (type === "milk") return "喝奶";
  if (type === "sleep") return "睡觉";
  if (type === "wake") return "醒来";
  if (type === "poop") return "便便";
  if (type === "solid") return "辅食";
  if (type === "temperature") return "体温";
  if (type === "soothing") return "哄睡";
  return fallback || "照护记录";
};

const canonicalCareEventTags = (type: CareLogEventType, tags: string[]) => {
  if (type === "sleep" || type === "wake" || type === "soothing") return ["睡眠"];
  if (type === "note") return tags.length ? tags : ["照护记录"];
  return [canonicalCareEventTitle(type)];
};

const normalizeCareLogEvent = (
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
  };
};

const normalizeCareLog = (value: Partial<CareLog> | null | undefined, index: number): CareLog => ({
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
});

const careEventTimelineKey = (event: CareLogEvent) =>
  [
    event.date,
    event.type,
    event.time ?? "",
    event.amountMl ?? "",
    event.durationHours ?? "",
    event.temperature ?? "",
  ].join("|");

const dedupeCareEvents = (events: CareLogEvent[]) => {
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
    });
  });
  return Array.from(byKey.values());
};

const uniqueTexts = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const dedupeCareLogs = (logs: CareLog[]) => {
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

const normalizeGrowthEvent = (value: Partial<GrowthEvent> | null | undefined, index: number): GrowthEvent => ({
  id: textValue(value?.id, `growth-${index}`),
  type: textValue(value?.type, "daily_growth"),
  title: textValue(value?.title, "成长记录"),
  date: textValue(value?.date, todayISO()),
  summary: textValue(value?.summary),
  firstTime: Boolean(value?.firstTime),
  mediaKind: value?.mediaKind,
  tags: stringList(value?.tags),
});

const normalizeReminder = (value: Partial<Reminder> | null | undefined, index: number): Reminder => {
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

const normalizeMemoryItem = (value: Partial<MemoryItem> | null | undefined, index: number): MemoryItem => ({
  id: textValue(value?.id, `memory-${index}`),
  text: textValue(value?.text),
  category: normalizeMemoryCategory(value?.category),
  confidence: numberValue(value?.confidence) ?? 0.7,
  updatedAt: textValue(value?.updatedAt, new Date().toISOString()),
});

const normalizeConversationSummary = (
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

const normalizePendingEffect = (value: Partial<PendingEffect> | null | undefined, index: number): PendingEffect => ({
  id: textValue(value?.id, `pending-${index}`),
  messageId: textValue(value?.messageId),
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
  status: "pending",
  tags: stringList(value?.tags),
  growthEvent: value?.growthEvent ? normalizeGrowthEvent(value.growthEvent, index) : undefined,
  careLogPatch: value?.careLogPatch ? normalizeCareLog(value.careLogPatch, index) : undefined,
  reminders: Array.isArray(value?.reminders) ? value.reminders.map(normalizeReminder) : [],
  memories: Array.isArray(value?.memories) ? value.memories.map(normalizeMemoryItem) : [],
  safetyAlerts: Array.isArray(value?.safetyAlerts) ? value.safetyAlerts : [],
});

const resolveStateAction = <T,>(action: SetStateAction<T>, current: T): T =>
  typeof action === "function" ? (action as (current: T) => T)(current) : action;

const safeDate = (value: string, dateOnly = false) => {
  if (!value) return null;
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (value: string) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date) : "--:--";
};

const formatDate = (value: string) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date) : "待设置";
};

const formatFullDate = (value: string) => {
  const date = safeDate(value, true);
  return date
    ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date)
    : "待设置";
};

const monthTitle = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${value}-01T00:00:00`));

const ageLabel = (birthDate: string) => {
  const start = safeDate(birthDate, true);
  if (!start) return "待设置生日";
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const months = Math.floor(days / 30);
  return months > 0 ? `${months}个月${days % 30}天` : `${days}天`;
};

const displayProfileValue = (value: string, fallback = "暂未设置") => value.trim() || fallback;

const babyProfileForAgent = (profile: BabyProfile): AgentBabyProfileContext => {
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

const stageLabel = (stage: BabyProfile["stage"]) => (stage === "pregnancy" ? "孕期" : "已出生");

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: string, offset: number) => {
  const source = safeDate(date, true) ?? new Date();
  return toISODate(new Date(source.getFullYear(), source.getMonth(), source.getDate() + offset));
};

const addMonths = (month: string, offset: number) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return toISODate(new Date(year, monthIndex - 1 + offset, 1)).slice(0, 7);
};

const calendarDatesForMonth = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1).getDay();
  const totalDays = new Date(year, monthIndex, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => ""),
    ...Array.from({ length: totalDays }, (_, index) => `${month}-${`${index + 1}`.padStart(2, "0")}`),
  ];
};

const splitListText = (value: string) =>
  value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const currentClockText = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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

const careEventSignature = (event: CareLogEvent, fallbackDate: string) =>
  [
    event.type,
    event.date || fallbackDate,
    event.time ?? "",
    event.amountMl ?? "",
    event.durationHours ?? "",
    event.temperature ?? "",
  ].join("|");

const mergeCareEvent = (existing: CareLogEvent, next: CareLogEvent): CareLogEvent => ({
  ...existing,
  ...next,
  id: existing.id || next.id,
  date: existing.date || next.date,
  time: existing.time ?? next.time,
  title: existing.title ?? next.title,
  amountMl: next.amountMl ?? existing.amountMl,
  durationHours: next.durationHours ?? existing.durationHours,
  temperature: next.temperature ?? existing.temperature,
  note: existing.note ?? next.note,
  tags: [...new Set([...(existing.tags ?? []), ...(next.tags ?? [])])],
});

const dedupeCareEventsForMerge = (events: CareLogEvent[], fallbackDate: string) => {
  const bySignature = new Map<string, CareLogEvent>();
  events.forEach((event) => {
    const normalized = { ...event, date: event.date || fallbackDate };
    const signature = careEventSignature(normalized, fallbackDate);
    const existing = bySignature.get(signature);
    bySignature.set(signature, existing ? mergeCareEvent(existing, normalized) : normalized);
  });
  return Array.from(bySignature.values()).slice(-24);
};

const mergeUniqueText = (left: string[], right: string[]) => {
  const seen = new Set<string>();
  return [...left, ...right]
    .filter((item) => {
      const signature = item.trim();
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .slice(-6);
};

const mergeCareLog = (logs: CareLog[], patch: Partial<CareLog>) => {
  const date = patch.date ?? todayISO();
  const existing = logs.find((item) => item.date === date);
  if (!existing) {
    return [
      ...logs,
      {
        id: patch.id ?? makeId("care"),
        date,
        milkMl: patch.milkMl,
        milkTimes: patch.milkTimes,
        sleepHours: patch.sleepHours,
        wakes: patch.wakes,
        soothing: patch.soothing,
        solids: patch.solids ?? [],
        poop: patch.poop,
        temperature: patch.temperature,
        notes: patch.notes ?? [],
        events: dedupeCareEventsForMerge(patch.events ?? [], date),
      },
    ];
  }

  return logs.map((item) =>
    item.date === date
      ? {
          ...item,
          milkMl: patch.milkMl ?? item.milkMl,
          milkTimes: patch.milkTimes ?? item.milkTimes,
          sleepHours: patch.sleepHours ?? item.sleepHours,
          wakes: patch.wakes ?? item.wakes,
          soothing: patch.soothing ?? item.soothing,
          solids: [...new Set([...(item.solids ?? []), ...(patch.solids ?? [])])],
          poop: patch.poop ?? item.poop,
          temperature: patch.temperature ?? item.temperature,
          notes: mergeUniqueText(item.notes, patch.notes ?? []),
          events: dedupeCareEventsForMerge([...(item.events ?? []), ...(patch.events ?? [])], date),
        }
      : item,
  );
};

const soothingText = {
  easy: "好哄睡",
  normal: "正常",
  hard: "偏难",
};

const parseTimeSort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const normalized = normalizeClockText(value);
  const match = normalized?.match(/(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
};

const careEventTitleMap: Record<CareLogEventType, string> = {
  milk: "喝奶",
  sleep: "睡觉",
  wake: "醒来",
  poop: "便便",
  solid: "辅食",
  temperature: "体温",
  soothing: "哄睡",
  note: "照护记录",
};

const inferCareEventType = (text: string): CareLogEventType => {
  if (/奶|喂/.test(text)) return "milk";
  if (/睡|小睡|入睡/.test(text)) return "sleep";
  if (/醒|夜醒/.test(text)) return "wake";
  if (/便便|大便|拉了/.test(text)) return "poop";
  if (/辅食|米粉|蛋黄|菜泥|果泥|肉泥|粥/.test(text)) return "solid";
  if (/体温|发烧|发热/.test(text)) return "temperature";
  if (/哄|闹觉|抱睡/.test(text)) return "soothing";
  return "note";
};

const noteToCareEvent = (log: CareLog, note: string, index: number): CareLogEvent | null => {
  const time = normalizeClockText(note);
  const type = inferCareEventType(note);
  if (!time) return null;
  return {
    id: `${log.id}-note-${index}`,
    type,
    date: log.date,
    time,
    title: careEventTitleMap[type],
    note,
    tags: [careEventTitleMap[type]],
  };
};

const careEventsForLog = (log: CareLog) => {
  const source = log.events.length
    ? log.events
    : log.notes.map((note, index) => noteToCareEvent(log, note, index)).filter((event): event is CareLogEvent => Boolean(event));
  return source.filter((event) => Boolean(event.time) || event.type !== "note");
};

const recordTimeLabel = (date: string, time?: string) => `${formatDate(date)}\n${time || "全天"}`;

const careEventBody = (event: CareLogEvent) =>
  [
    event.amountMl ? `${event.amountMl} ml` : "",
    event.durationHours ? `${event.durationHours} 小时` : "",
    event.temperature ? `${event.temperature}°C` : "",
    event.note ?? "",
  ]
    .filter(Boolean)
    .join("，") || "已记录";

const reminderDate = (reminder: Reminder) => {
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

const reminderTimeText = (reminder: Reminder) => {
  const dueAt = parseReminderDueAt(reminder);
  if (dueAt) return localTimeKey(dueAt);
  return normalizeClockText(reminder.dueText) ??
    (reminder.dueText
      .replace(/\d{4}-\d{1,2}-\d{1,2}/, "")
      .trim()
      .slice(0, 12) || undefined);
};

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

const reminderCategoryLabel = (category: Reminder["category"]) => {
  if (category === "vaccine") return "疫苗";
  if (category === "routine") return "日常";
  if (category === "care") return "照护";
  return "自定义";
};

const reminderStatusLabel = (status: Reminder["status"]) => {
  if (status === "done") return "已完成";
  if (status === "missed") return "已逾期";
  return "待完成";
};

const reminderScheduleLabel = (reminder: Reminder) => (reminder.scheduleMode === "interval" ? "循环" : "一次");

const reminderAlertLabel = (reminder: Reminder) => (reminder.alertMode === "ringing" ? "闹铃" : "通知");

const reminderRepeatLabel = (reminder: Reminder) =>
  reminder.repeatRule ? `每 ${formatIntervalText(reminder.repeatRule.intervalMinutes)}` : undefined;

const reminderSoundLabel = (reminder: Reminder) =>
  reminder.alertMode === "ringing"
    ? REMINDER_SOUND_OPTIONS.find((option) => option.value === normalizeReminderSoundId(reminder.soundId))?.label
    : undefined;

const reminderNotificationLabel = (reminder: Reminder) => {
  if (reminder.status === "done") return undefined;
  if (reminder.notificationStatus === "scheduled") return "系统提醒已开启";
  if (reminder.notificationStatus === "scheduled_inexact") return "已降级为普通定时提醒";
  if (reminder.notificationStatus === "permission_denied") return "通知权限未开启";
  if (reminder.notificationStatus === "failed") return "系统提醒失败";
  if (reminder.notificationStatus === "in_app_only") return "仅 App 内提醒";
  return reminder.dueAt ? "待调度系统提醒" : "时间待确认";
};

const albumCategoryLabel = (category: AlbumItemCategory | "all") =>
  ALBUM_CATEGORIES.find((item) => item.id === category)?.label ?? "日常";

const albumCategoryIconSrc = (category: AlbumItemCategory) => {
  if (category === "growth") return growthIcon;
  if (category === "feeding") return milkIcon;
  if (category === "sleep") return sleepIcon;
  if (category === "health") return temperatureIcon;
  if (category === "reminder") return reminderIcon;
  return recordsIcon;
};

const albumCategoryFromTags = (tags: string[], text = ""): AlbumItemCategory => {
  const source = [...tags, text].join(" ");
  if (/奶|喂养|辅食/.test(source)) return "feeding";
  if (/睡|夜醒|哄睡/.test(source)) return "sleep";
  if (/体温|发热|药|过敏|疫苗|医院|体检|健康/.test(source)) return "health";
  if (/提醒|待办|复诊/.test(source)) return "reminder";
  if (/成长|里程碑|第一次|翻身|抬头|爬|走|笑/.test(source)) return "growth";
  return "daily";
};

const careAlbumCategory = (event: CareLogEvent): AlbumItemCategory => {
  if (event.type === "milk" || event.type === "solid") return "feeding";
  if (event.type === "sleep" || event.type === "wake" || event.type === "soothing") return "sleep";
  if (event.type === "temperature" || event.type === "poop") return "health";
  return albumCategoryFromTags(event.tags ?? [], event.note ?? event.title ?? "");
};

const careAlbumTitle = (event: CareLogEvent) => {
  if (event.type === "milk" && event.amountMl) return `喝奶 ${event.amountMl}ml`;
  if (event.type === "sleep" && event.durationHours) return `睡了 ${event.durationHours} 小时`;
  if (event.type === "temperature" && event.temperature) return `体温 ${event.temperature}°C`;
  return event.title || canonicalCareEventTitle(event.type);
};

const albumItemKey = (item: AlbumItem) => `${item.kind}|${item.linkedType ?? ""}|${item.linkedId ?? ""}|${item.attachmentId ?? ""}|${item.date}|${item.title}`;

const dedupeAlbumItems = (items: AlbumItem[]) => {
  const byKey = new Map<string, AlbumItem>();
  items.forEach((item) => {
    const key = albumItemKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  });
  return Array.from(byKey.values()).sort((left, right) => {
    const leftTime = left.occurredAt ?? `${left.date}T00:00:00`;
    const rightTime = right.occurredAt ?? `${right.date}T00:00:00`;
    return rightTime.localeCompare(leftTime);
  });
};

const albumAutoSavePattern =
  /第一次|里程碑|翻身|抬头|爬|站|走路|走了|说话|叫妈妈|叫爸爸|满月|百天|生日|疫苗本|接种证|接种凭证|体检报告|医生通知|病历|留念|纪念|珍贵|成长瞬间|保存到相册|存到相册|收藏/;

const albumAskPattern =
  /宝宝|小宝|孩子|娃|亲子|妈妈抱|爸爸抱|奶瓶|辅食|玩具|衣服|小床|婴儿床|医院|诊室|候诊|社区医院|疫苗|体检|药|药盒|用品|照片|图片|相册/;

const screenshotTextPattern = /截图|截屏|屏幕|页面|界面|聊天记录|App|APP|网页|浏览器|localhost|图里面有啥|图里有啥|这图里面|这个图里面|这张图里面|图里有什么|看一下图/;

const explicitAlbumSavePattern = /保存到相册|存到相册|加入相册|放进相册|收藏|留念|纪念/;

const likelyScreenshotNamePattern = /screenshot|screen|localhost|截屏|截图|网页|浏览器|simulator|emulator/i;

const imageAspectRatio = (attachment: Attachment) => {
  if (!attachment.width || !attachment.height) return undefined;
  return Math.max(attachment.width / attachment.height, attachment.height / attachment.width);
};

const isLikelyScreenshotAttachment = (attachment: Attachment, text = "") => {
  if (attachment.kind !== "image") return false;
  const ratio = imageAspectRatio(attachment);
  const pngLike = attachment.mimeType === "image/png" || /\.png$/i.test(attachment.name);
  return (
    likelyScreenshotNamePattern.test(attachment.name) ||
    screenshotTextPattern.test(text) ||
    (pngLike && ratio !== undefined && ratio > 2.15)
  );
};

const classifyAlbumCategoryFromText = (text: string): AlbumItemCategory => {
  if (/疫苗|接种|体检|医生|医院|病历|报告|药|健康/.test(text)) return "health";
  if (/奶|奶瓶|辅食|米粉|吃/.test(text)) return "feeding";
  if (/睡|小睡|夜醒|哄睡/.test(text)) return "sleep";
  if (/提醒|复诊/.test(text)) return "reminder";
  if (/第一次|里程碑|翻身|抬头|爬|站|走|笑|满月|百天|生日|成长/.test(text)) return "growth";
  return "daily";
};

const albumTitleFromText = (text: string, attachment: Attachment) => {
  const clean = text.replace(/保存到相册|存到相册|加入相册|放进相册|收藏|留念|纪念/g, "").trim();
  return clean ? clean.slice(0, 18) : attachment.name || "值得收藏的素材";
};

const isAlbumMediaAttachment = (attachment: Attachment) => attachment.kind === "image" || attachment.kind === "video";

const mediaKindLabel = (attachment: Attachment) => (attachment.kind === "video" ? "视频" : "照片");

const decideAlbumMedia = (message: ChatMessage, attachment: Attachment): AlbumMediaDecision => {
  const text = message.text === "上传了新的成长素材" ? "" : message.text;
  const source = `${text} ${attachment.name}`;
  const createdAt = new Date().toISOString();
  const base = {
    id: makeId("album-decision"),
    attachmentId: attachment.id,
    sourceMessageId: message.id,
    createdAt,
  };
  if (!isAlbumMediaAttachment(attachment)) {
    return { ...base, mode: "ignore", category: "daily", reason: "第一版相册只自动处理照片和视频。", tags: ["忽略"] };
  }
  if (isLikelyScreenshotAttachment(attachment, text)) {
    return { ...base, mode: "ignore", category: "daily", reason: "这看起来是 App、网页或聊天截图，不会保存到成长相册。", tags: ["截图"] };
  }
  const category = classifyAlbumCategoryFromText(source);
  if (albumAutoSavePattern.test(source) || explicitAlbumSavePattern.test(text)) {
    return {
      ...base,
      mode: "auto_save",
      category,
      reason: "用户表达了明确的留念或成长记录意图。",
      title: albumTitleFromText(text, attachment),
      tags: [albumCategoryLabel(category), mediaKindLabel(attachment)],
    };
  }
  if (albumAskPattern.test(source)) {
    return {
      ...base,
      mode: "ask",
      category,
      reason: "这段素材可能和宝宝照护有关，但还不确定是否值得长期保存。",
      title: albumTitleFromText(text, attachment),
      tags: [albumCategoryLabel(category), "待确认"],
    };
  }
  return { ...base, mode: "ignore", category: "daily", reason: "没有识别到值得保存到相册的明确生活或成长信号。", tags: ["忽略"] };
};

const albumPromptFromDecision = (decision: AlbumMediaDecision): AlbumPrompt => ({
  id: decision.id,
  attachmentId: decision.attachmentId,
  sourceMessageId: decision.sourceMessageId,
  title: decision.title || "值得收藏的素材",
  category: decision.category,
  reason: decision.reason,
  tags: decision.tags,
  status: "pending",
  createdAt: decision.createdAt,
});

const albumItemFromDecision = (decision: AlbumMediaDecision, message: ChatMessage, attachment: Attachment): AlbumItem => ({
  id: `album-media-${message.id}-${attachment.id}`,
  kind: "media",
  title: decision.title || albumTitleFromText(message.text, attachment),
  date: message.createdAt.slice(0, 10),
  occurredAt: message.createdAt,
  category: decision.category,
  tags: decision.tags.length ? decision.tags : [albumCategoryLabel(decision.category), mediaKindLabel(attachment)],
  attachmentId: attachment.id,
  attachment,
  linkedType: "chatMessage",
  linkedId: message.id,
  source: "rule",
});

const isVisibleAlbumMedia = (item: AlbumItem) =>
  item.kind === "media" &&
  Boolean(
    item.attachment &&
      isAlbumMediaAttachment(item.attachment) &&
      (item.attachment.url || item.attachment.publicUrl) &&
      !isLikelyScreenshotAttachment(item.attachment, item.title),
  );

const normalizeAlbumCategoryValue = (value: unknown): AlbumItemCategory =>
  value === "growth" ||
  value === "feeding" ||
  value === "sleep" ||
  value === "health" ||
  value === "reminder" ||
  value === "daily"
    ? value
    : "daily";

const albumEffectPayload = (decision: EffectDecision): AlbumEffectPayload => {
  if (!decision.payload || typeof decision.payload !== "object") return {};
  const raw = decision.payload as Record<string, unknown>;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === "string") : [];
  return {
    intent: typeof raw.intent === "string" ? raw.intent : undefined,
    targetScope:
      raw.targetScope === "current" || raw.targetScope === "previous" || raw.targetScope === "recent" || raw.targetScope === "unspecified"
        ? raw.targetScope
        : undefined,
    targetKind:
      raw.targetKind === "image" || raw.targetKind === "video" || raw.targetKind === "media" || raw.targetKind === "any"
        ? raw.targetKind
        : undefined,
    refHint: typeof raw.refHint === "string" ? raw.refHint : undefined,
    category: normalizeAlbumCategoryValue(raw.category),
    reason: typeof raw.reason === "string" ? raw.reason : decision.reason,
    title: typeof raw.title === "string" ? raw.title : undefined,
    tags,
  };
};

const albumEffectAllowsAttachment = (payload: AlbumEffectPayload, attachment: Attachment) => {
  if (!isAlbumMediaAttachment(attachment)) return false;
  if (payload.targetKind === "video" && attachment.kind !== "video") return false;
  if (payload.targetKind === "image" && attachment.kind !== "image") return false;
  return true;
};

const resolveAlbumEffectTarget = (
  decision: EffectDecision,
  candidateMessages: ChatMessage[],
): { message: ChatMessage; attachment: Attachment; payload: AlbumEffectPayload } | null => {
  const payload = albumEffectPayload(decision);
  if (payload.intent && payload.intent !== "save_to_album") return null;
  const orderedMessages = [...candidateMessages].reverse();
  for (const message of orderedMessages) {
    const orderedAttachments = [...(message.attachments ?? [])].reverse();
    for (const attachment of orderedAttachments) {
      if (!albumEffectAllowsAttachment(payload, attachment)) continue;
      if (isLikelyScreenshotAttachment(attachment, `${payload.refHint ?? ""} ${message.text}`)) continue;
      return { message, attachment, payload };
    }
  }
  return null;
};

const albumPromptFromEffectDecision = (
  decision: EffectDecision,
  sourceMessage: ChatMessage,
  attachment: Attachment,
): AlbumPrompt => {
  const payload = albumEffectPayload(decision);
  const category = payload.category ?? classifyAlbumCategoryFromText(`${sourceMessage.text} ${payload.refHint ?? ""}`);
  return {
    id: decision.id || makeId("album-decision"),
    attachmentId: attachment.id,
    sourceMessageId: sourceMessage.id,
    title: payload.title || albumTitleFromText(payload.refHint || sourceMessage.text, attachment),
    category,
    reason: payload.reason || decision.reason || `这段${mediaKindLabel(attachment)}可能值得保存到相册。`,
    tags: uniqueTexts([albumCategoryLabel(category), mediaKindLabel(attachment), ...(payload.tags ?? [])]).slice(0, 6),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
};

const albumItemFromEffectDecision = (
  decision: EffectDecision,
  sourceMessage: ChatMessage,
  attachment: Attachment,
): AlbumItem => {
  const prompt = albumPromptFromEffectDecision(decision, sourceMessage, attachment);
  return {
    ...albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment),
    source: "agent",
  };
};

const buildDerivedAlbumItems = (
  messages: ChatMessage[],
  growthEvents: GrowthEvent[],
  careLogs: CareLog[],
  reminders: Reminder[],
): AlbumItem[] => {
  void growthEvents;
  void careLogs;
  void reminders;
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const mediaItems = messages.flatMap((message) =>
    (message.albumPrompts ?? [])
      .filter((prompt) => prompt.status === "saved")
      .map((prompt) => {
        const sourceMessage = messageById.get(prompt.sourceMessageId);
        const attachment = sourceMessage?.attachments?.find((item) => item.id === prompt.attachmentId);
        return sourceMessage && attachment ? albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment) : null;
      })
      .filter((item): item is AlbumItem => Boolean(item)),
  );

  return dedupeAlbumItems(mediaItems);
};

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

const careEventValue = (event: CareLogEvent, kind: "milk" | "sleep") =>
  kind === "milk" ? positiveNumber(event.amountMl) : positiveNumber(event.durationHours);

const careEventsByKind = (log: CareLog | undefined, kind: "milk" | "sleep") =>
  (log?.events ?? [])
    .filter((event) => event.type === kind)
    .map((event) => ({ event, value: careEventValue(event, kind) }))
    .filter((item): item is { event: CareLogEvent; value: number } => item.value !== undefined)
    .sort((left, right) => parseTimeSort(left.event.time, 0) - parseTimeSort(right.event.time, 0));

const careLogWithEventStats = (log: CareLog): CareLog => {
  const events = dedupeCareEventsForMerge(log.events ?? [], log.date);
  const allMilkEvents = events.filter((event) => event.type === "milk");
  const milkEvents = allMilkEvents.filter((event) => positiveNumber(event.amountMl) !== undefined);
  const allSleepEvents = events.filter((event) => event.type === "sleep");
  const sleepEvents = allSleepEvents.filter((event) => positiveNumber(event.durationHours) !== undefined);
  const wakeEvents = events.filter((event) => event.type === "wake");
  const solidEvents = events.filter((event) => event.type === "solid" && event.note);
  const poopEvent = [...events].reverse().find((event) => event.type === "poop" && event.note);
  const temperatureEvent = [...events].reverse().find((event) => event.type === "temperature" && positiveNumber(event.temperature) !== undefined);
  const soothingEvent = [...events].reverse().find((event) => event.type === "soothing");

  return {
    ...log,
    events,
    milkMl: allMilkEvents.length ? (milkEvents.length ? Math.round(sumValues(milkEvents.map((event) => event.amountMl ?? 0))) : undefined) : log.milkMl,
    milkTimes: allMilkEvents.length ? (milkEvents.length || undefined) : log.milkTimes,
    sleepHours: allSleepEvents.length ? (sleepEvents.length ? Number(sumValues(sleepEvents.map((event) => event.durationHours ?? 0)).toFixed(1)) : undefined) : log.sleepHours,
    wakes: wakeEvents.length ? wakeEvents.length : log.wakes,
    soothing: soothingEvent ? "normal" : log.soothing,
    solids: solidEvents.length ? Array.from(new Set([...log.solids, ...solidEvents.map((event) => event.note!).filter(Boolean)])) : log.solids,
    poop: poopEvent?.note ?? log.poop,
    temperature: temperatureEvent?.temperature ?? log.temperature,
  };
};

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

const formatIntervalText = (minutes: number) => {
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} 小时 ${rest} 分钟`;
};

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

const shouldUseNativeReminderScheduler = (reminder: Reminder) =>
  isNativeAlarmAvailable() && (isIntervalReminder(reminder) || reminder.alertMode === "ringing");

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
        notificationError: "Android 通知权限未开启，提醒会保留在 App 内。",
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
            ? "Android 精确闹钟权限未开启，已安排提醒，但可能不够准时。"
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

const pendingDraftFromEffect = (effect: PendingEffect): PendingEffectDraft => ({
  growthEvent: effect.growthEvent
    ? {
        title: effect.growthEvent.title ?? "",
        date: effect.growthEvent.date ?? todayISO(),
        summary: effect.growthEvent.summary ?? "",
      }
    : undefined,
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
  reminders: effect.reminders.map((reminder) => ({
    id: reminder.id,
    draft: reminderDraftFromReminder(reminder),
  })),
  memories: effect.memories.map((memory) => ({
    id: memory.id,
    text: memory.text,
  })),
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
  effect.reminders.map((reminder) => {
    const nextDraft = draft.reminders.find((item) => item.id === reminder.id)?.draft;
    return nextDraft ? reminderFromDraft(nextDraft, reminder) : reminder;
  });

const memoriesFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
  effect.memories.map((memory) => {
    const nextDraft = draft.memories.find((item) => item.id === memory.id);
    return nextDraft ? { ...memory, text: nextDraft.text.trim() || memory.text } : memory;
  });

function normalizeReminderCategory(category: string | undefined): Reminder["category"] {
  if (category === "vaccine" || category === "routine" || category === "care" || category === "custom") {
    return category;
  }
  return "custom";
}

function normalizeReminderStatus(status: string | undefined): Reminder["status"] {
  if (status === "open" || status === "done" || status === "missed") return status;
  return "open";
}

function normalizeMemoryCategory(category: string | undefined): MemoryItem["category"] {
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

  return {
    aiText: result.aiText,
    tags: result.tags ?? [],
    growthEvent,
    careLogPatch,
    reminders,
    memories,
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

const careLogPatchFromDecision = (decision: EffectDecision, parentText: string): Partial<CareLog> | undefined => {
  if (decision.type !== "careLog" || !decision.payload || typeof decision.payload !== "object") return undefined;
  const raw = decision.payload as Partial<CareLog>;
  if (!hasCareLogContent(raw)) return undefined;
  const date = raw.date ?? todayISO();
  const modelEvents = (raw.events ?? []).map((item, index) => ({
    ...normalizeCareLogEvent(item, index, date),
    id: item.id || makeId("care-event"),
  }));
  const inferredEvents = extractCareEventsFromText(parentText, date);
  return {
    ...raw,
    date,
    soothing: normalizeSoothing(raw.soothing),
    solids: raw.solids ?? [],
    events: mergeCareEventsWithInferred(modelEvents, inferredEvents),
    notes: raw.notes?.length ? raw.notes : [parentText],
  };
};

const decisionSummary = (decision: EffectDecision) => {
  if (decision.type === "careLog") return "照护日志";
  if (decision.type === "reminder") return "提醒";
  if (decision.type === "growthEvent") return "成长事件";
  return "长期记忆";
};

const hasPendingEffectContent = (effect: Pick<PendingEffect, "growthEvent" | "careLogPatch" | "reminders" | "memories">) =>
  Boolean(
    effect.growthEvent ||
      (effect.careLogPatch && hasCareLogContent(effect.careLogPatch)) ||
      effect.reminders.length ||
      effect.memories.length,
  );

const pendingEffectSummary = (effect: PendingEffect) => [
  effect.growthEvent ? `成长：${effect.growthEvent.title}` : "",
  effect.careLogPatch && hasCareLogContent(effect.careLogPatch) ? "照护日志" : "",
  effect.reminders.length ? `提醒 ${effect.reminders.length} 条` : "",
  effect.memories.length ? `记忆 ${effect.memories.length} 条` : "",
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

const upsertToolActivity = (items: ToolActivity[] | undefined, activity: ToolActivity) => {
  const current = items ?? [];
  if (current.some((item) => item.id === activity.id)) {
    return current.map((item) => (item.id === activity.id ? activity : item));
  }
  return [...current, activity];
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

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
  const legacyLocalStateRef = useRef(hasLegacyLocalState());
  const [storedProfile, setStoredProfile] = useStoredState("baby-companion-profile", blankProfile);
  const [storedMessages, setStoredMessages] = useStoredState<ChatMessage[]>("baby-companion-messages", []);
  const [storedGrowthEvents, setStoredGrowthEvents] = useStoredState<GrowthEvent[]>("baby-companion-growth", []);
  const [storedCareLogs, setStoredCareLogs] = useStoredState<CareLog[]>("baby-companion-care", []);
  const [storedReminders, setStoredReminders] = useStoredState<Reminder[]>("baby-companion-reminders", []);
  const [storedMemories, setStoredMemories] = useStoredState<MemoryItem[]>("baby-companion-memories", []);
  const [storedPendingEffects, setStoredPendingEffects] = useStoredState<PendingEffect[]>("baby-companion-pending-effects", []);
  const [storedAlbumItems, setStoredAlbumItems] = useStoredState<AlbumItem[]>("baby-companion-album-items", []);
  const [storedConversationSummary, setStoredConversationSummary] = useStoredState<ConversationSummary | null>(
    "baby-companion-conversation-summary",
    null,
  );
  const [thinkingEnabled, setThinkingEnabled] = useStoredState("baby-companion-thinking-enabled", false);
  const [selectedModel, setSelectedModel] = useStoredState<AgentModelId>("baby-companion-model", DEFAULT_MODEL);
  const profile = useMemo(() => normalizeBabyProfile(storedProfile), [storedProfile]);
  const messages = useMemo(() => storedMessages.map(normalizeChatMessage), [storedMessages]);
  const growthEvents = useMemo(() => storedGrowthEvents.map(normalizeGrowthEvent), [storedGrowthEvents]);
  const careLogs = useMemo(() => dedupeCareLogs(storedCareLogs.map(normalizeCareLog)), [storedCareLogs]);
  const reminders = useMemo(() => storedReminders.map(normalizeReminder), [storedReminders]);
  const memories = useMemo(() => storedMemories.map(normalizeMemoryItem), [storedMemories]);
  const pendingEffects = useMemo(() => storedPendingEffects.map(normalizePendingEffect), [storedPendingEffects]);
  const storedAlbumItemsNormalized = useMemo(() => storedAlbumItems.map(normalizeAlbumItem), [storedAlbumItems]);
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
  const setConversationSummary = (action: SetStateAction<ConversationSummary | null>) =>
    setStoredConversationSummary((current) =>
      normalizeConversationSummary(resolveStateAction(action, normalizeConversationSummary(current))),
    );
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => (getAuthToken() ? "checking" : "unauthenticated"));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authFamily, setAuthFamily] = useState<AuthFamily | null>(null);
  const [authMember, setAuthMember] = useState<AuthMember | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginInviteCode, setLoginInviteCode] = useState("");
  const [loginRoleName, setLoginRoleName] = useState<"" | (typeof ROLE_OPTIONS)[number]>("");
  const [loginCaregiver, setLoginCaregiver] = useState<boolean | null>(null);
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
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");
  const [recordView, setRecordView] = useState<RecordView>("today");
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
  const [voiceError, setVoiceError] = useState("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "offline">("loading");
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>("idle");
  const [editingPendingId, setEditingPendingId] = useState("");
  const [pendingDraft, setPendingDraft] = useState<PendingEffectDraft | null>(null);
  const [autoRecordUndos, setAutoRecordUndos] = useState<AutoRecordUndo[]>([]);
  const [isCareLogEditing, setIsCareLogEditing] = useState(false);
  const [careLogDraft, setCareLogDraft] = useState({
    milkMl: "",
    milkTimes: "",
    sleepHours: "",
    wakes: "",
    soothing: "",
    solids: "",
    poop: "",
    temperature: "",
    notes: "",
  });
  const [editingCareEventId, setEditingCareEventId] = useState("");
  const [careEventDraft, setCareEventDraft] = useState<CareEventDraft>({
    type: "milk",
    time: "",
    amountMl: "",
    durationHours: "",
    temperature: "",
    note: "",
  });
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState("");
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(() => createReminderDraft());
  const [completeReminderTarget, setCompleteReminderTarget] = useState<Reminder | null>(null);
  const [deleteReminderTarget, setDeleteReminderTarget] = useState<Reminder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const voiceAutoSubmitTimerRef = useRef<number | null>(null);
  const inputValueRef = useRef(input);
  const isSubmittingRef = useRef(isSubmitting);
  const submitComposerMessageRef = useRef<((textOverride?: string, options?: { skipVoiceStop?: boolean }) => Promise<void>) | null>(null);
  const hasPositionedMessageListRef = useRef(false);
  const messageScrollSignatureRef = useRef("");
  const backendReadyRef = useRef(false);
  const compressionInFlightRef = useRef(false);
  const compressionResetTimerRef = useRef<number | null>(null);
  const intervalReminderRescheduleRef = useRef("");
  const remindersRef = useRef<Reminder[]>([]);
  const appPlatform = platformLabel();
  const currentModel = MODEL_OPTIONS.find((model) => model.id === selectedModel) ?? MODEL_OPTIONS[0];
  const canCaregive = authMember?.caregiver ?? true;
  const visibleTabs = canCaregive ? MOBILE_TABS : MOBILE_TABS.filter((tab) => tab.id !== "chat");
  const canAttachVisuals = canCaregive && (currentModel.supportsImageInput || currentModel.supportsVideoInput);
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
  const loginReady = Boolean(loginRoleName && loginCaregiver !== null && !loginSelectedRoleOccupied);
  const switchMobileTab = (tab: MobileTab) => {
    setActiveMobileTab(tab);
  };

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
      done: sorted.filter((item) => item.status === "done").reverse(),
    };
  }, [reminders, todayDate]);
  const actionableReminderCount = reminderBuckets.today.length + reminderBuckets.overdue.length;
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
  const derivedAlbumItems = useMemo(
    () => buildDerivedAlbumItems(messages, growthEvents, careLogs, reminders),
    [messages, growthEvents, careLogs, reminders],
  );
  const albumItems = useMemo(
    () => dedupeAlbumItems([...storedAlbumItemsNormalized, ...derivedAlbumItems]).filter(isVisibleAlbumMedia),
    [storedAlbumItemsNormalized, derivedAlbumItems],
  );
  const filteredAlbumItems = useMemo(
    () => albumItems.filter((item) => albumCategory === "all" || item.category === albumCategory),
    [albumItems, albumCategory],
  );
  const albumStats = useMemo(
    () => ({
      media: albumItems.length,
      videos: albumItems.filter((item) => item.attachment?.kind === "video").length,
      categories: new Set(albumItems.map((item) => item.category)).size,
    }),
    [albumItems],
  );
  const selectedCareLog = careLogs.find((item) => item.date === selectedDate);
  const selectedKeyPointCount = selectedEvents.length;
  const selectedGrowthCount = selectedEvents.filter((event) => event.type === "growth").length;
  const selectedDateIsToday = selectedDate === todayDate;
  const milkTrend = useMemo(() => {
    const recent = careLogs.slice(-3).map((item) => item.milkMl ?? 0).filter(Boolean);
    if (recent.length < 2) return "继续收集中";
    const delta = recent[recent.length - 1] - recent[0];
    return delta >= 0 ? `近3次 +${delta} ml` : `近3次 ${delta} ml`;
  }, [careLogs]);
  const weeklyCareComparison = useMemo(() => buildWeeklyCareComparison(careLogs, selectedDate), [careLogs, selectedDate]);
  const dailyCareBreakdowns = useMemo(() => buildDailyCareBreakdowns(selectedCareLog), [selectedCareLog]);
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
    pendingEffectSummaries: pendingEffects.slice(0, 6).map((effect) => ({
      id: effect.id,
      createdAt: effect.createdAt,
      tags: effect.tags,
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

  useEffect(
    () => () => {
      if (compressionResetTimerRef.current !== null) window.clearTimeout(compressionResetTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const normalizedCode = loginInviteCode.trim();
    const compactCode = normalizedCode.replace(/\s+/g, "");
    if (compactCode.length < 6) {
      setOccupiedInviteRoles([]);
      setInviteRoleHint("");
      setInviteFamilyName("");
      setIsCheckingInviteRoles(false);
      return undefined;
    }

    let cancelled = false;
    setIsCheckingInviteRoles(true);
    const timer = window.setTimeout(() => {
      readInviteRoleOptions(normalizedCode)
        .then((result) => {
          if (cancelled) return;
          const occupied = result.occupiedRoles.filter((role) =>
            (UNIQUE_ROLE_OPTIONS as readonly string[]).includes(role),
          );
          const familyName = result.familyName || "小宝家";
          setOccupiedInviteRoles(occupied);
          setInviteFamilyName(familyName);
          setInviteRoleHint(
            occupied.length
              ? `${familyName} 已有：${occupied.join("、")}`
              : `${familyName} 可选择家庭身份`,
          );
        })
        .catch((error) => {
          if (cancelled) return;
          setOccupiedInviteRoles([]);
          setInviteFamilyName("");
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
  }, [loginInviteCode]);

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
    careLogs,
    reminders,
    memories,
    pendingEffects,
    albumItems: storedAlbumItemsNormalized,
    conversationSummary,
    thinkingEnabled,
    selectedModel,
  });

  const applyAppSnapshot = (state: Partial<AppStateSnapshot>) => {
    if ("profile" in state) setProfile((state.profile ?? blankProfile) as BabyProfile);
    if (state.messages) setMessages(state.messages);
    if (state.growthEvents) setGrowthEvents(state.growthEvents);
    if (state.careLogs) setCareLogs(state.careLogs);
    if (state.reminders) setReminders(state.reminders.map(normalizeReminder));
    if (state.memories) setMemories(state.memories);
    if (state.pendingEffects) setPendingEffects(state.pendingEffects);
    if (state.albumItems) setAlbumItems(state.albumItems);
    if ("conversationSummary" in state) {
      setConversationSummary((state.conversationSummary ?? null) as ConversationSummary | null);
    }
    if (state.thinkingEnabled !== undefined) setThinkingEnabled(state.thinkingEnabled);
    if (state.selectedModel) setSelectedModel(state.selectedModel);
  };

  const applyEmptyAppSnapshot = () => {
    applyAppSnapshot({
      profile: blankProfile,
      messages: [],
      growthEvents: [],
      careLogs: [],
      reminders: [],
      memories: [],
      pendingEffects: [],
      conversationSummary: null,
      thinkingEnabled,
      selectedModel,
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

  const isAppStateResponse = (value: unknown): value is AppStateResponse =>
    Boolean(value && typeof value === "object" && "state" in value);

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

  useEffect(() => {
    if (authStatus !== "authenticated" || !isNativeAlarmAvailable()) return undefined;

    let cancelled = false;
    const syncNativeAlarmEvents = async () => {
      try {
        const events = await consumeAlarmEvents();
        if (cancelled || !events.length) return;

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
                ? "Android 精确闹钟权限未开启，已安排提醒，但可能不够准时。"
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
    const storedUrl = attachment.publicUrl || (attachment.url?.startsWith("data:") ? undefined : attachment.url?.split("?")[0]);
    return {
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      url: storedUrl,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      publicUrl: attachment.publicUrl,
      width: attachment.width,
      height: attachment.height,
    };
  };

  const messageForStorage = (message: ChatMessage): ChatMessage => ({
    ...message,
    attachments: message.attachments?.map(attachmentForStorage),
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

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list || activeMobileTab !== "chat") return;

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
  }, [messages, isSubmitting, activeMobileTab]);

  useEffect(() => {
    if (!canCaregive && activeMobileTab === "chat") {
      setActiveMobileTab("records");
    }
  }, [activeMobileTab, canCaregive]);

  useEffect(() => {
    if (canAttachVisuals) return;
    setAttachments([]);
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

  useEffect(() => {
    setCareLogDraft({
      milkMl: selectedCareLog?.milkMl ? String(selectedCareLog.milkMl) : "",
      milkTimes: selectedCareLog?.milkTimes ? String(selectedCareLog.milkTimes) : "",
      sleepHours: selectedCareLog?.sleepHours ? String(selectedCareLog.sleepHours) : "",
      wakes: selectedCareLog?.wakes ? String(selectedCareLog.wakes) : "",
      soothing: selectedCareLog?.soothing ?? "",
      solids: selectedCareLog?.solids?.join("、") ?? "",
      poop: selectedCareLog?.poop ?? "",
      temperature: selectedCareLog?.temperature ? String(selectedCareLog.temperature) : "",
      notes: selectedCareLog?.notes?.join("、") ?? "",
    });
    setIsCareLogEditing(false);
  }, [selectedCareLog?.id, selectedDate]);

  const readImageDimensions = (dataUrl: string): Promise<Pick<Attachment, "width" | "height">> =>
    new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({});
      image.src = dataUrl;
    });

  const uploadMediaDataUrl = async (
    id: string,
    name: string,
    kind: AttachmentKind,
    dataUrl: string,
    dimensions?: Pick<Attachment, "width" | "height">,
  ): Promise<Attachment> => {
    if (!canCaregive) throw new Error("当前身份仅可查看，不能上传附件。");
    const uploaded = await uploadDataUrlAttachment({ id, name, kind, dataUrl });
    return {
      id: uploaded.id,
      name: uploaded.name,
      kind: uploaded.kind,
      url: uploaded.url,
      publicUrl: uploaded.publicUrl,
      filePath: uploaded.filePath,
      mimeType: uploaded.mimeType,
      width: dimensions?.width,
      height: dimensions?.height,
    };
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCaregive || !canAttachVisuals) {
      event.target.value = "";
      return;
    }

    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    try {
      const next = await Promise.all(
        files.map(async (file) => {
          const id = makeId("attachment");
          const dataUrl = await readFileAsDataUrl(file);
          const kind: AttachmentKind = file.type.startsWith("video/") ? "video" : "image";
          const dimensions = kind === "image" ? await readImageDimensions(dataUrl) : {};
          return uploadMediaDataUrl(id, file.name, kind, dataUrl, dimensions);
        }),
      );
      setAttachments((current) => [...current, ...next].slice(0, 4));
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: error instanceof Error ? `素材上传失败：${error.message}` : "素材上传失败，请稍后再试。",
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
    event.target.value = "";
  };

  const openMediaPicker = async () => {
    if (!canCaregive || !canAttachVisuals) return;

    if (fileInputRef.current) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const photo = await NativeCamera.getPhoto({
        quality: 82,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: "添加成长素材",
        promptLabelPhoto: "从相册选择",
        promptLabelPicture: "拍照",
        promptLabelCancel: "取消",
      });

      if (!photo.dataUrl) return;

      const nativeAttachment = await uploadMediaDataUrl(
        makeId("attachment"),
        `成长照片-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.jpeg`,
        "image",
        photo.dataUrl,
        await readImageDimensions(photo.dataUrl),
      );
      setAttachments((current) => [...current, nativeAttachment].slice(0, 4));
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: error instanceof Error ? `素材上传失败：${error.message}` : "素材上传失败，请稍后再试。",
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
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

  const stopVoiceCapture = (autoSubmit = false, keepStandby = true) => {
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

  useEffect(
    () => () => {
      voiceSessionRef.current += 1;
      voiceShouldStopRef.current = true;
      voiceAutoSubmitRef.current = false;
      voicePressingRef.current = false;
      clearVoiceAutoSubmitTimer();
      cleanupLocalVoiceCapture();
      stopVoiceStandbyStream();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
    },
    [],
  );

  const toggleComposerMode = () => {
    if (!canCaregive || isSubmitting) return;
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
    if ((!text && attachments.length === 0) || isSubmittingRef.current) return;
    hapticLight();

    const submittedAttachments = attachments;
    const parentMessage: ChatMessage = {
      id: makeId("msg"),
      role: "parent",
      text: text || "上传了新的成长素材",
      createdAt: new Date().toISOString(),
      attachments: submittedAttachments,
    };
    const albumDecisions = submittedAttachments.map((attachment) => decideAlbumMedia(parentMessage, attachment));
    let autoAlbumItems = albumDecisions
      .filter((decision) => decision.mode === "auto_save")
      .map((decision) => {
        const attachment = submittedAttachments.find((item) => item.id === decision.attachmentId);
        return attachment ? albumItemFromDecision(decision, parentMessage, attachment) : null;
      })
      .filter((item): item is AlbumItem => Boolean(item));
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
      tags: [thinkingEnabled ? "深度思考" : "处理中"],
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
      const agentAttachments = await Promise.all(
        submittedAttachments.map(async (item) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          dataUrl:
            canAttachVisuals && (item.kind === "image" || item.kind === "video")
              ? item.dataUrl ?? (item.url ? await fetchAsDataUrl(item.url) : undefined)
              : undefined,
        })),
      );
      let reasoningText = "";
      let contentText = "";
      const agentResponse = await runAgentChatStream(
        {
          message: parentMessage.text,
          model: currentModel.id,
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
          thinkingEnabled,
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
                      tags: activity.status === "running" ? ["查询中"] : message.tags,
                    }
                  : message,
              ),
            );
          },
          onStatus: (status) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id && !contentText
                  ? { ...message, text: status.message, tags: [status.type === "planning" ? "理解中" : "查找中"] }
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
      const hasServerDecisions = result.effectDecisions.length > 0;
      const albumEffectSavedLabels: string[] = [];
      let albumEffectMissingTarget = false;

      if (hasServerDecisions) {
        const albumEffectCandidates = [...messages, parentMessage];
        result.effectDecisions.forEach((decision) => {
          if (decision.type !== "albumItem" || decision.mode === "ignore") return;
          const target = resolveAlbumEffectTarget(decision, albumEffectCandidates);
          if (!target) {
            albumEffectMissingTarget = true;
            return;
          }
          if (decision.mode === "auto") {
            autoAlbumItems = dedupeAlbumItems([
              albumItemFromEffectDecision(decision, target.message, target.attachment),
              ...autoAlbumItems,
            ]);
            albumEffectSavedLabels.push(mediaKindLabel(target.attachment));
            return;
          }
          albumPrompts = [
            ...albumPrompts,
            albumPromptFromEffectDecision(decision, target.message, target.attachment),
          ];
        });
      }

      if (albumEffectSavedLabels.length) {
        const savedLabel = uniqueTexts(albumEffectSavedLabels).join("和") || "素材";
        const savedText = `已把刚才的${savedLabel}保存到相册啦。`;
        aiText = /无法|没办法|不能|需要.*确认|前端.*确认/.test(aiText) ? savedText : `${aiText}\n\n${savedText}`;
      } else if (albumEffectMissingTarget) {
        aiText = `${aiText}\n\n我没有找到要保存的照片或视频，可以重新发一下素材再告诉我保存到相册。`;
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

      let pendingGrowthEvent: GrowthEvent | undefined = hasServerDecisions ? undefined : result.growthEvent;
      let pendingCareLogPatch: Partial<CareLog> | undefined = hasServerDecisions ? undefined : result.careLogPatch;
      let pendingReminders: Reminder[] = hasServerDecisions ? [] : result.reminders;
      let pendingMemories: MemoryItem[] = hasServerDecisions ? [] : result.memories;
      const autoCareLogPatches: Partial<CareLog>[] = [];
      let autoReminderCandidates: Reminder[] = [];

      if (hasServerDecisions) {
        result.effectDecisions.forEach((decision, index) => {
          if (decision.mode === "ignore") return;
          if (decision.type === "careLog") {
            const patch = careLogPatchFromDecision(decision, parentMessage.text);
            if (!patch) return;
            if (decision.mode === "auto") autoCareLogPatches.push(patch);
            else pendingCareLogPatch = patch;
            return;
          }
          if (!decision.payload || typeof decision.payload !== "object") return;
          if (decision.type === "growthEvent") {
            const growth = normalizeGrowthEvent(decision.payload as Partial<GrowthEvent>, index);
            if (decision.mode === "pending") pendingGrowthEvent = growth;
          }
          if (decision.type === "reminder") {
            const reminder = normalizeReminder(decision.payload as Partial<Reminder>, index);
            if (decision.mode === "auto") autoReminderCandidates = [...autoReminderCandidates, reminder];
            if (decision.mode === "pending") pendingReminders = [...pendingReminders, reminder];
          }
          if (decision.type === "memory") {
            const memory = normalizeMemoryItem(decision.payload as Partial<MemoryItem>, index);
            if (decision.mode === "pending") pendingMemories = [...pendingMemories, memory];
          }
        });
      } else if (isAutoRecordableCareLog(result.careLogPatch, result.safetyAlerts) && result.careLogPatch) {
        autoCareLogPatches.push(result.careLogPatch);
        pendingCareLogPatch = undefined;
      }

      const autoRecordedCareLogs: CareLog[] = [];
      const autoUndos: AutoRecordUndo[] = [];
      if (autoCareLogPatches.length) {
        let nextLogs = careLogs;
        autoCareLogPatches.forEach((patch) => {
          const targetDate = patch.date ?? todayISO();
          const previous = nextLogs.find((item) => item.date === targetDate);
          nextLogs = mergeCareLog(nextLogs, patch);
          const nextLog = nextLogs.find((item) => item.date === targetDate);
          if (nextLog) {
            autoRecordedCareLogs.push(nextLog);
            autoUndos.push({
              id: makeId("undo"),
              messageId: aiMessage.id,
              label: decisionSummary({ id: "", mode: "auto", type: "careLog", payload: patch }),
              collection: "careLogs",
              recordId: nextLog.id,
              previous,
              created: !previous,
            });
          }
        });
        setCareLogs(nextLogs);
        setAutoRecordUndos((current) => [...autoUndos, ...current]);
      }
      if (autoAlbumItems.length) {
        setAlbumItems((current) => dedupeAlbumItems([...autoAlbumItems, ...current]));
      }
      const autoScheduledReminders = autoReminderCandidates.length
        ? await scheduleNativeReminders(autoReminderCandidates, { careLogs })
        : [];
      if (autoScheduledReminders.length) {
        setReminders((current) => {
          const byId = new Map(current.map((reminder) => [reminder.id, reminder]));
          autoScheduledReminders.forEach((reminder) => byId.set(reminder.id, reminder));
          return Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
        });
      }
      if (autoUndos.length || autoAlbumItems.length || autoScheduledReminders.length) hapticSuccess();
      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      const pendingEffect: PendingEffect = {
        id: makeId("effect"),
        messageId: aiMessage.id,
        createdAt: new Date().toISOString(),
        status: "pending",
        tags: result.tags,
        growthEvent: pendingGrowthEvent,
        careLogPatch: pendingCareLogPatch,
        reminders: pendingReminders,
        memories: pendingMemories,
        safetyAlerts: result.safetyAlerts,
      };
      const persistenceTasks: Array<() => Promise<unknown>> = [
        () => persistRecord("messages", parentMessage.id, messageForStorage(parentMessage)),
        () => persistRecord("messages", aiMessage.id, messageForStorage(aiMessage)),
      ];
      if (autoRecordedCareLogs.length) {
        autoRecordedCareLogs.forEach((log) => {
          persistenceTasks.push(() => persistRecord("careLogs", log.id, log));
        });
      }
      if (autoAlbumItems.length) {
        autoAlbumItems.forEach((item) => {
          persistenceTasks.push(() => persistRecord("albumItems", item.id, item));
        });
      }
      if (autoScheduledReminders.length) {
        autoScheduledReminders.forEach((reminder) => {
          persistenceTasks.push(() => persistRecord("reminders", reminder.id, reminder));
        });
      }
      if (hasPendingEffectContent(pendingEffect)) {
        setPendingEffects((current) => [pendingEffect, ...current]);
        persistenceTasks.push(() => persistRecord("pendingEffects", pendingEffect.id, pendingEffect));
      }
      try {
        let lastStateResponse: AppStateResponse | undefined;
        for (const task of persistenceTasks) {
          const response = await task();
          if (isAppStateResponse(response)) lastStateResponse = response;
        }
        if (autoRecordedCareLogs.length && lastStateResponse) {
          applyStateResponse(lastStateResponse);
        }
        void runConversationCompression();
      } catch {
        // Local state stays usable; the status chip tells the parent that the backend sync needs attention.
      }
    } catch (error) {
      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: error instanceof Error ? `AI 服务暂时不可用：${error.message}` : "AI 服务暂时不可用，请稍后再试。",
        createdAt: new Date().toISOString(),
        tags: ["系统"],
        isStreaming: false,
        toolActivities,
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

  const postponeReminder = async (target: Reminder) => {
    if (!canCaregive) return;
    await cancelNativeReminder(target);
    const sourceDueAt = parseReminderDueAt(target) ?? new Date();
    const postponedAt = new Date(sourceDueAt);
    if (target.alertMode === "ringing" || target.scheduleMode === "interval") {
      postponedAt.setMinutes(postponedAt.getMinutes() + 30);
    } else {
      postponedAt.setDate(postponedAt.getDate() + 1);
    }
    const baseReminder: Reminder = {
      ...target,
      status: "open",
      dueAt: postponedAt.toISOString(),
      dueText: formatReminderDueText(postponedAt),
      notificationStatus: "pending",
      notificationError: undefined,
      history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 顺延到 ${formatReminderDueText(postponedAt)}`, ...target.history],
    };
    const [scheduledReminder] = await scheduleNativeReminders([baseReminder], {
      careLogs: target.scheduleMode === "interval" ? [] : careLogs,
      anchorInterval: target.scheduleMode !== "interval",
    });
    const nextReminder = scheduledReminder ?? baseReminder;
    setReminders((current) => current.map((item) => (item.id === target.id ? nextReminder : item)));
    void persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
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
    void persistRecord("albumItems", nextItem.id, nextItem).catch(() => setStorageStatus("offline"));
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

  const saveAlbumPrompt = (messageId: string, prompt: AlbumPrompt) => {
    if (!canCaregive) return;
    const sourceMessage = messages.find((message) => message.id === prompt.sourceMessageId);
    const attachment = sourceMessage?.attachments?.find((item) => item.id === prompt.attachmentId);
    if (!sourceMessage || !attachment) {
      updateAlbumPromptStatus(messageId, prompt.id, "ignored");
      return;
    }
    const albumItem = albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment);
    setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
    updateAlbumPromptStatus(messageId, prompt.id, "saved");
    void persistRecord("albumItems", albumItem.id, albumItem).catch(() => setStorageStatus("offline"));
  };

  const ignoreAlbumPrompt = (messageId: string, prompt: AlbumPrompt) => {
    updateAlbumPromptStatus(messageId, prompt.id, "ignored");
  };

  const confirmPendingEffect = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    try {
      const response = await confirmPendingEffectOnServer(effect.id);
      applyAppSnapshot(response.state);
      if (effect.reminders.length) {
        const scheduledReminders = await scheduleNativeReminders(effect.reminders, { careLogs });
        for (const reminder of scheduledReminders) {
          await persistRecord("reminders", reminder.id, reminder, { applyResponse: true });
        }
      }
      setEditingPendingId("");
      setPendingDraft(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "确认记录失败，请稍后再试。");
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

  const undoAutoRecord = async (undo: AutoRecordUndo) => {
    if (!canCaregive) return;
    setAutoRecordUndos((current) => current.filter((item) => item.id !== undo.id));
    if (undo.collection === "careLogs") {
      if (undo.created) {
        setCareLogs((current) => current.filter((item) => item.id !== undo.recordId));
        try {
          await deleteAppRecord("careLogs", undo.recordId);
        } catch {
          setStorageStatus("offline");
        }
        return;
      }
      if (undo.previous) {
        setCareLogs((current) => current.map((item) => (item.id === undo.recordId ? undo.previous! : item)));
        try {
          await persistRecord("careLogs", undo.previous.id, undo.previous, { applyResponse: true, mode: "replace" });
        } catch {
          setStorageStatus("offline");
        }
      }
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
      careLogPatch: careLogPatchFromPendingDraft(effect, pendingDraft.careLogPatch),
      reminders: remindersFromPendingDraft(effect, pendingDraft),
      memories: memoriesFromPendingDraft(effect, pendingDraft),
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

  const saveCareLogDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const patch: Partial<CareLog> = {
      id: selectedCareLog?.id ?? makeId("care"),
      date: selectedDate,
      milkMl: careLogDraft.milkMl ? Number(careLogDraft.milkMl) : undefined,
      milkTimes: careLogDraft.milkTimes ? Number(careLogDraft.milkTimes) : undefined,
      sleepHours: careLogDraft.sleepHours ? Number(careLogDraft.sleepHours) : undefined,
      wakes: careLogDraft.wakes ? Number(careLogDraft.wakes) : undefined,
      soothing: careLogDraft.soothing ? (careLogDraft.soothing as CareLog["soothing"]) : undefined,
      solids: splitListText(careLogDraft.solids),
      poop: careLogDraft.poop.trim() || undefined,
      temperature: careLogDraft.temperature ? Number(careLogDraft.temperature) : undefined,
      notes: splitListText(careLogDraft.notes),
    };
    const nextLogs = mergeCareLog(careLogs, patch);
    const nextLog = nextLogs.find((item) => item.date === selectedDate);
    setCareLogs(nextLogs);
    if (nextLog) {
      void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() => undefined);
    }
    setIsCareLogEditing(false);
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
  };

  const selectRecordDate = (date: string) => {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
    setEditingCareEventId("");
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
    if (!loginRoleName || loginCaregiver === null) {
      setLoginError("请先选择家庭身份和是否照护人。");
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await loginWithInvite(loginPhone, loginInviteCode, loginRoleName, loginCaregiver);
      setAuthUser(response.user);
      setAuthFamily(response.family);
      setAuthMember(response.member);
      await loadStateFromBackend({
        importLegacy: response.member.caregiver && response.legacyImportAllowed && legacyLocalStateRef.current,
        onboardingRequired: response.onboardingRequired,
      });
      setAuthStatus("authenticated");
      setActiveMobileTab(response.member.caregiver ? "chat" : "records");
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
    setIsCareLogEditing(false);
    setActiveMobileTab("chat");
    setInviteFamilyName("");
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
      setActiveMobileTab("chat");
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

  const quickFill = (text: string) => {
    if (!canCaregive) return;
    setInput(text);
    setActiveMobileTab("chat");
  };

  const voiceHoldLabel =
    voiceStatus === "error"
      ? voiceError || "语音识别暂时不可用"
      : voiceStatus === "unsupported"
        ? voiceError || "当前环境不支持语音输入"
        : isListening
          ? voiceTranscript || (voiceStatus === "connecting" ? "正在连接语音识别..." : "正在听，松开结束")
          : voiceStatus === "processing"
            ? voiceTranscript || "正在整理文字..."
            : voiceTranscript || input.trim() || "按住说话";
  const voiceButtonStyle = { "--voice-level": voiceLevel.toFixed(3) } as CSSProperties;
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

  if (authStatus === "checking") {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <StorybookScene />
          <h1>小宝记</h1>
          <p>正在确认登录状态...</p>
          <span className="loading-stars auth-loading" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </section>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <main className="app-shell auth-shell">
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
              退出登录{authUser?.phone ? `（${authUser.phone}）` : ""}
            </button>
          </section>
        </main>
      );
    }
    const progress = onboardingStep + 1;
    return (
      <main className="app-shell auth-shell">
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
    <main className={`app-shell mobile-tab-${activeMobileTab}`}>
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
            <span>今日已整理 {messages.filter((item) => item.role === "parent").length} 条</span>
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

        <section className="chat-panel" aria-label="每日聊天记录">
          <div className="chat-head">
            <div className="chat-companion-head">
              <div className="companion-badge" aria-hidden="true">
                <span className="companion-cloud" />
                <img className="companion-icon-img" src={companionAvatarIcon} alt="" />
              </div>
              <div>
                <p className="eyebrow">小宝伙伴陪你记</p>
                <h2>今天和小宝发生了什么</h2>
              </div>
            </div>
            <div className="head-actions">
              <button
                type="button"
                className="icon-button"
                title={canAttachVisuals ? "照片或视频" : "当前模型不支持视觉理解"}
                disabled={!canAttachVisuals || isSubmitting}
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
          </div>

          <div className="chat-prelude">
            {compressionMessage ? (
              <div className={`compression-notice ${compressionStatus}`} role="status">
                <Brain size={15} />
                <span>{compressionMessage}</span>
              </div>
            ) : null}

            <div className="quick-row">
              <button type="button" onClick={() => quickFill("今天喝奶 5 次，每次大概 120ml，晚上醒了 3 次")}>
                <img className="quick-icon-img" src={milkIcon} alt="" />
                喂奶
              </button>
              <button type="button" onClick={() => quickFill("晚上 8 点提醒我给小宝洗澡")}>
                <img className="quick-icon-img" src={reminderIcon} alt="" />
                提醒
              </button>
              <button type="button" onClick={() => quickFill("今天小宝第一次自己扶着沙发站起来了")}>
                <img className="quick-icon-img" src={growthIcon} alt="" />
                里程碑
              </button>
              <button type="button" onClick={() => quickFill("为什么这两天小宝更难哄睡？")}>
                <CircleHelp size={16} />
                问问AI
              </button>
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
                  {message.role === "parent" ? <span>{profile.nickname + "家"}</span> : null}
                  <time>{formatTime(message.createdAt)}</time>
                </div>
                {message.role === "ai" && message.reasoning ? (
                  <details className="reasoning-box" open={message.isStreaming}>
                    <summary>{message.isStreaming ? "思考中" : "思考过程"}</summary>
                    <p>{message.reasoning}</p>
                  </details>
                ) : null}
                {message.role === "ai" && message.toolActivities?.length ? (
                  <div className="tool-activity-list">
                    {message.toolActivities.map((activity) => (
                      <div className={`tool-activity ${activity.status}`} key={activity.id}>
                        <Globe2 size={14} />
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
                        onClick={() => item.url && setPreviewAttachment(item)}
                        disabled={!item.url}
                        title={item.url ? "查看大图" : item.name}
                      >
                        {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : null}
                        {item.kind === "video" && item.url ? <video src={item.url} muted /> : null}
                        {!item.url ? <ImageIcon size={18} /> : null}
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
                {message.role === "ai" && autoRecordUndos.some((undo) => undo.messageId === message.id) ? (
                  <div className="auto-effect-list">
                    {autoRecordUndos
                      .filter((undo) => undo.messageId === message.id)
                      .map((undo) => (
                        <section className="auto-effect-card" key={undo.id}>
                          <CheckCircle2 size={16} />
                          <div>
                            <strong>已自动记录{undo.label}</strong>
                            <span>这条很明确，所以先帮你记好了。</span>
                          </div>
                          <button type="button" onClick={() => void undoAutoRecord(undo)}>
                            撤销
                          </button>
                        </section>
                      ))}
                  </div>
                ) : null}
                {message.role === "ai" &&
                pendingEffects.some((effect) => effect.messageId === message.id) ? (
                  <div className="pending-effect-list">
                    {pendingEffects
                      .filter((effect) => effect.messageId === message.id)
                      .map((effect) => (
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
                              </div>
                            ) : null
                          ) : (
                            <div className="pending-effect-body">
                              {effect.growthEvent ? <p>成长：{effect.growthEvent.title}</p> : null}
                              {effect.careLogPatch ? <p>照护：{effect.careLogPatch.notes?.join("、") || "已识别照护日志"}</p> : null}
                              {effect.reminders.map((reminder) => (
                                <p key={reminder.id}>提醒：{reminder.dueText} {reminder.title}</p>
                              ))}
                              {effect.memories.map((memory) => (
                                <p key={memory.id}>记忆：{memory.text}</p>
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
                                <button type="button" onClick={() => void confirmPendingEffect(effect)}>
                                  确认
                                </button>
                                <button type="button" className="quiet" onClick={() => void discardPendingEffect(effect)}>
                                  丢弃
                                </button>
                              </>
                            )}
                          </div>
                        </section>
                      ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            {attachments.length ? (
              <div className="pending-attachments">
                {attachments.map((item) => (
                  <div className="pending-item" key={item.id}>
                    <button
                      type="button"
                      className="pending-preview-button"
                      title={item.url ? "查看大图" : item.name}
                      disabled={!item.url}
                      onClick={() => item.url && setPreviewAttachment(item)}
                    >
                      {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : <Video size={18} />}
                    </button>
                    <span>{item.name}</span>
                    <button
                      type="button"
                      title="移除"
                      onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
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
                  disabled={!canAttachVisuals || isSubmitting}
                  onChange={handleFiles}
                />
                <StorySelect
                  className="model-select"
                  title="模型"
                  ariaLabel="模型"
                  value={currentModel.id}
                  disabled={isSubmitting}
                  options={MODEL_SELECT_OPTIONS}
                  onChange={setSelectedModel}
                />
                <button
                  type="button"
                  className="tool-button"
                  title={canAttachVisuals ? "上传照片或视频" : "当前模型不支持视觉理解"}
                  disabled={!canAttachVisuals || isSubmitting}
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
                <button
                  type="button"
                  className={`tool-button thinking-button ${thinkingEnabled ? "active" : ""}`}
                  title={thinkingEnabled ? "深度思考已开启" : "开启深度思考"}
                  aria-label="深度思考"
                  aria-pressed={thinkingEnabled}
                  disabled={isSubmitting}
                  onClick={() => setThinkingEnabled((enabled) => !enabled)}
                >
                  <Brain size={19} />
                </button>
              </div>
              <div className="composer-input-line">
                {composerMode === "voice" ? (
                  <button
                    type="button"
                    className={`voice-hold-button ${isListening ? "listening" : ""} ${voiceStatus}`}
                    style={voiceButtonStyle}
                    disabled={isSubmitting}
                    aria-label="按住说话"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        // Some WebViews can reject pointer capture during long-press gestures.
                      }
                      voicePressingRef.current = true;
                      startVoiceCapture();
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      try {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      } catch {
                        // The pointer may already be released when the native view cancels a gesture.
                      }
                      stopVoiceCapture(true);
                    }}
                    onPointerCancel={() => stopVoiceCapture()}
                    onPointerLeave={() => {
                      if (isListening) stopVoiceCapture();
                    }}
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
                    placeholder="记录小宝今天的新变化..."
                    disabled={isSubmitting}
                  />
                )}
                <button className="send-button" type="submit" title={isSubmitting ? "处理中" : "发送"} disabled={isSubmitting}>
                  <Send size={19} />
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="records-screen" aria-label="记录">
          <div className="screen-head">
            <div>
              <p className="eyebrow">记录</p>
              <h2>{selectedDateIsToday ? "今天的总览" : formatFullDate(selectedDate)}</h2>
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
                  <article className={`record-event ${event.type} event-${event.kind}`} key={event.id}>
                    <time>{event.timeLabel}</time>
                    <div>
                      <span className="record-event-icon" aria-hidden="true">
                        <img src={recordEventIconSrc(event)} alt="" />
                      </span>
                      <h3>{event.title}</h3>
                      <p>{event.body}</p>
                      <div className="tag-row">
                        {event.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      {canCaregive && event.type === "care" ? (
                        editingCareEventId === event.id ? (
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
                        ) : (
                          <button type="button" className="timeline-edit-button" onClick={() => beginEditCareTimelineEvent(event)}>
                            编辑
                          </button>
                        )
                      ) : null}
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
                  <button type="button" onClick={() => quickFill("今天小宝发生了什么？")}>
                    去补充记录
                  </button>
                ) : null}
              </div>
            )}
          </section>
          ) : null}
        </section>

        <section className="album-screen" aria-label="相册">
          <div className="screen-head">
            <div>
              <p className="eyebrow">相册</p>
              <h2>成长回忆库</h2>
            </div>
            <span className="screen-pill">{albumItems.length} 项素材</span>
          </div>

          <section className="album-overview-card">
            <div className="album-hero-copy">
              <img src={companionAvatarIcon} alt="" />
              <div>
                <strong>只收藏值得回看的照片和视频</strong>
                <p>根据上传时的文字和媒体元数据做保守判断，截图和普通随手素材不会自动进相册。</p>
              </div>
            </div>
            <div className="album-stats">
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
          </section>

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

          {filteredAlbumItems.length ? (
            <div className="album-grid">
              {filteredAlbumItems.map((item) => (
                <article className={`album-card album-${item.category} ${item.kind}`} key={item.id}>
                  {item.kind === "media" && item.attachment?.url ? (
                    <button
                      type="button"
                      className="album-thumb"
                      onClick={() => item.attachment && setPreviewAttachment(item.attachment)}
                      aria-label={`预览 ${item.title}`}
                    >
                      {item.attachment.kind === "video" ? (
                        <video src={item.attachment.url} muted playsInline />
                      ) : (
                        <img src={item.attachment.url} alt={item.title} />
                      )}
                    </button>
                  ) : (
                    <span className="album-event-icon" aria-hidden="true">
                      <img src={albumCategoryIconSrc(item.category)} alt="" />
                    </span>
                  )}
                  <div className="album-card-body">
                    <span>{formatFullDate(item.date)} · {albumCategoryLabel(item.category)}</span>
                    <h3>{item.title}</h3>
                    <div className="tag-row">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="album-card-actions">
                      <button
                        type="button"
                        onClick={() => {
                          selectRecordDate(item.date);
                          setRecordView("calendar");
                          switchMobileTab("records");
                        }}
                      >
                        查看当天
                      </button>
                      {canCaregive ? (
                        <button type="button" onClick={() => editAlbumItem(item)}>
                          编辑
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state album-empty">
              <span className="empty-sticker" aria-hidden="true">
                <img src={growthIcon} alt="" />
              </span>
              <p>还没有这个分类的回忆。</p>
              {canCaregive ? (
                <button type="button" onClick={() => switchMobileTab("chat")}>
                  去上传值得收藏的素材
                </button>
              ) : null}
            </div>
          )}
        </section>

        <section className="reminders-screen" aria-label="提醒">
          <div className="screen-head">
            <div>
              <p className="eyebrow">提醒</p>
              <h2>照护任务中心</h2>
            </div>
            <div className="screen-head-actions">
              <span className="screen-pill">{actionableReminderCount} 个今日/逾期待办</span>
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
                <button type="button" key={action.label} onClick={() => quickFill(action.prompt)}>
                  {action.label === "疫苗" || action.label === "喂药" ? <Syringe size={16} /> : <Bell size={16} />}
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="readonly-copy">当前身份仅可查看提醒，请让照护人新增或完成提醒。</p>
          )}

          {[
            { key: "today", title: "今天要做", items: reminderBuckets.today, empty: "今天暂时没有待办。" },
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
                        {reminder.category === "vaccine" ? <Syringe size={18} /> : <Clock3 size={18} />}
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
                          <button type="button" title="标记完成" onClick={() => requestCompleteReminder(reminder)}>
                            <CheckCircle2 size={18} />
                          </button>
                          <button type="button" title={reminder.scheduleMode === "interval" || reminder.alertMode === "ringing" ? "稍后 30 分钟" : "顺延一天"} onClick={() => void postponeReminder(reminder)}>
                            <Clock3 size={18} />
                          </button>
                          <button type="button" title="编辑提醒" onClick={() => openEditReminderEditor(reminder)}>
                            <PencilLine size={18} />
                          </button>
                          <button type="button" title="删除提醒" onClick={() => requestDeleteReminder(reminder)}>
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
            <div className="story-modal-backdrop" role="presentation" onMouseDown={closeReminderEditor}>
              <form className="story-modal reminder-editor" onSubmit={saveReminderDraft} onMouseDown={(event) => event.stopPropagation()}>
                <div className="story-modal-head">
                  <div>
                    <p className="eyebrow">提醒设置</p>
                    <h3>{editingReminderId ? "编辑提醒" : "新建提醒"}</h3>
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
                {!Capacitor.isNativePlatform() ? <p className="form-help">浏览器里只显示 App 内提醒；安装到 Android 后会调度手机本地通知。</p> : null}
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
          {completeReminderTarget ? (
            <div className="story-modal-backdrop" role="presentation" onMouseDown={closeCompleteReminderConfirm}>
              <div
                className="story-modal delete-confirm-modal"
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
            <div className="story-modal-backdrop" role="presentation" onMouseDown={closeDeleteReminderConfirm}>
              <div
                className="story-modal delete-confirm-modal"
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
                  <p>
                    “{deleteReminderTarget.title}”会从提醒列表移除，已经安排的手机通知或闹铃也会一起取消。
                  </p>
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

        <section className="profile-screen" aria-label="我的">
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
              {canCaregive ? (
                <button className="profile-edit-button" type="button" onClick={startProfileEditing}>
                  <PencilLine size={18} />
                  编辑小宝资料
                </button>
              ) : (
                <p className="readonly-copy">当前身份可以查看家庭共享记录，不能修改小宝资料或写入照护日志。</p>
              )}
              <button className="profile-logout-button" type="button" onClick={() => void handleLogout()}>
                退出登录{authUser?.phone ? `（${authUser.phone}）` : ""}
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
                <small>{todayLog?.temperature ? `体温 ${todayLog.temperature}` : "无异常标记"}</small>
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
              <p>健康、疫苗、用药相关内容只做记录和提醒，异常情况以医生和社区医院安排为准。</p>
            </div>
            <div className="assistant-card native-card">
              <Smartphone size={20} />
              <p>已按移动 App 架构准备：手机端使用原生相机/相册和本地通知，浏览器端保留预览能力。</p>
            </div>
            <div className="assistant-actions">
              <button type="button" onClick={() => quickFill("下周二提醒我带小宝去社区医院打疫苗")}>
                <Syringe size={16} />
                疫苗
              </button>
              <button type="button" onClick={() => quickFill("小宝最近喜欢白噪音和轻拍，10 点左右容易闹觉")}>
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
      {previewAttachment?.url ? (
        <div className="media-preview" role="dialog" aria-modal="true" aria-label="附件预览" onClick={() => setPreviewAttachment(null)}>
          <button className="media-preview-close" type="button" aria-label="关闭预览" onClick={() => setPreviewAttachment(null)}>
            <X size={20} />
          </button>
          <figure>
            {previewAttachment.kind === "video" ? (
              <video src={previewAttachment.url} controls autoPlay onClick={(event) => event.stopPropagation()} />
            ) : (
              <img src={previewAttachment.url} alt={previewAttachment.name} />
            )}
            <figcaption>{previewAttachment.name}</figcaption>
          </figure>
        </div>
      ) : null}
    </main>
  );
}

export default App;
