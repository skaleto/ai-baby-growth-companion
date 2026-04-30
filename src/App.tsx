import {
  Baby,
  Bell,
  Brain,
  CalendarDays,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe2,
  HeartPulse,
  Image as ImageIcon,
  Keyboard as KeyboardIcon,
  LineChart,
  MessageCircle,
  Mic,
  Milk,
  Moon,
  Music2,
  PencilLine,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Syringe,
  UserRound,
  Users,
  Utensils,
  Video,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  ChangeEvent,
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { runAgentChatStream } from "./agentApi";
import { AsrStreamController, runAsrStream } from "./asrApi";
import {
  initialCareLogs,
  initialGrowthEvents,
  initialMemories,
  initialMessages,
  initialProfile,
  initialReminders,
  makeId,
  todayISO,
} from "./data";
import { useStoredState } from "./storage";
import {
  AgentChatResponse,
  AgentModelId,
  AgentModelOption,
  AgentSource,
  Attachment,
  BabyProfile,
  CareLog,
  ChatMessage,
  GrowthEvent,
  MemoryItem,
  Reminder,
  ToolActivity,
} from "./types";

const MODEL_OPTIONS: AgentModelOption[] = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", supportsImageInput: false },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", supportsImageInput: false },
  { id: "doubao-seed-2.0-pro", label: "Doubao Seed 2.0 Pro", supportsImageInput: true },
  { id: "doubao-seed-2.0-lite", label: "Doubao Seed 2.0 Lite", supportsImageInput: true },
];

const DEFAULT_MODEL: AgentModelId = "deepseek-v4-pro";

const MOBILE_TABS = [
  { id: "chat", label: "聊天", icon: MessageCircle },
  { id: "records", label: "记录", icon: CalendarDays },
  { id: "reminders", label: "提醒", icon: Bell },
  { id: "profile", label: "我的", icon: UserRound },
] as const;

type MobileTab = (typeof MOBILE_TABS)[number]["id"];

type ComposerMode = "keyboard" | "voice";

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "unsupported" | "error";

type RecordEventType = "message" | "care" | "growth" | "reminder";

type RecordEvent = {
  id: string;
  date: string;
  timeLabel: string;
  sortValue: number;
  type: RecordEventType;
  title: string;
  body: string;
  tags: string[];
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));

const formatFullDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${value}T00:00:00`),
  );

const monthTitle = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${value}-01T00:00:00`));

const ageLabel = (birthDate: string) => {
  const start = new Date(birthDate);
  const end = new Date();
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const months = Math.floor(days / 30);
  return months > 0 ? `${months}个月${days % 30}天` : `${days}天`;
};

const stageLabel = (stage: BabyProfile["stage"]) => (stage === "pregnancy" ? "孕期" : "已出生");

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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
          notes: [...item.notes, ...(patch.notes ?? [])].slice(-6),
        }
      : item,
  );
};

const soothingText = {
  easy: "好哄睡",
  normal: "正常",
  hard: "偏难",
};

const summarizeCareLog = (log: CareLog) => {
  const parts = [
    log.milkMl ? `奶量 ${log.milkMl}ml` : "",
    log.milkTimes ? `喝奶 ${log.milkTimes} 次` : "",
    log.sleepHours ? `睡眠 ${log.sleepHours}h` : "",
    log.wakes ? `夜醒 ${log.wakes} 次` : "",
    log.soothing ? `哄睡${soothingText[log.soothing]}` : "",
    log.solids.length ? `辅食 ${log.solids.join("、")}` : "",
    log.temperature ? `体温 ${log.temperature}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("，") : log.notes.join("，") || "这天有一条照护记录。";
};

const parseTimeSort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const match = value.match(/(\d{1,2})\s*(?:点|:|：)\s*(\d{1,2})?/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
};

const reminderDate = (reminder: Reminder) => {
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

const buildRecordEvents = (
  messages: ChatMessage[],
  careLogs: CareLog[],
  growthEvents: GrowthEvent[],
  reminders: Reminder[],
): RecordEvent[] => {
  const messageEvents: RecordEvent[] = messages.map((message) => ({
    id: `record-${message.id}`,
    date: message.createdAt.slice(0, 10),
    timeLabel: formatTime(message.createdAt),
    sortValue: new Date(message.createdAt).getHours() * 60 + new Date(message.createdAt).getMinutes(),
    type: "message",
    title: message.role === "parent" ? "你记录了一句话" : "AI 整理反馈",
    body: message.text,
    tags: message.tags ?? [message.role === "parent" ? "聊天" : "AI"],
  }));

  const careEvents: RecordEvent[] = careLogs.map((log) => ({
    id: `record-${log.id}`,
    date: log.date,
    timeLabel: "照护",
    sortValue: 7 * 60,
    type: "care",
    title: "照护日志",
    body: summarizeCareLog(log),
    tags: ["照护"],
  }));

  const growthRecords: RecordEvent[] = growthEvents.map((event) => ({
    id: `record-${event.id}`,
    date: event.date,
    timeLabel: event.firstTime ? "第一次" : "成长",
    sortValue: 12 * 60,
    type: "growth",
    title: event.title,
    body: event.summary,
    tags: event.tags,
  }));

  const reminderEvents: RecordEvent[] = reminders.map((reminder) => ({
    id: `record-${reminder.id}`,
    date: reminderDate(reminder),
    timeLabel: reminder.dueText,
    sortValue: parseTimeSort(reminder.dueText, 20 * 60),
    type: "reminder",
    title: reminder.title,
    body: reminder.status === "done" ? "已完成" : reminder.dueText,
    tags: [reminder.category === "vaccine" ? "疫苗" : "提醒"],
  }));

  return [...messageEvents, ...careEvents, ...growthRecords, ...reminderEvents].sort(
    (left, right) => left.date.localeCompare(right.date) || left.sortValue - right.sortValue,
  );
};

const platformLabel = () => {
  if (!Capacitor.isNativePlatform()) return "浏览器预览";
  return Capacitor.getPlatform() === "ios" ? "iOS App" : "Android App";
};

const nextReminderDate = (dueText: string) => {
  const now = new Date();
  const next = new Date(now.getTime() + 60 * 60 * 1000);
  const monthDay = dueText.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const time = dueText.match(/(\d{1,2})\s*(?:点|:|：)\s*(\d{1,2})?/);

  if (monthDay) {
    next.setMonth(Number(monthDay[1]) - 1, Number(monthDay[2]));
  } else if (/后天/.test(dueText)) {
    next.setDate(now.getDate() + 2);
  } else if (/明天|下周|周[一二三四五六日天]/.test(dueText)) {
    next.setDate(now.getDate() + 1);
  }

  if (time) {
    next.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0);
  } else {
    next.setHours(9, 0, 0, 0);
  }

  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
};

const scheduleNativeReminders = async (newReminders: Reminder[]) => {
  if (!Capacitor.isNativePlatform() || newReminders.length === 0) return;

  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: newReminders.map((reminder, index) => ({
        id: Math.floor(Date.now() % 2_000_000_000) + index,
        title: reminder.title,
        body: `${reminder.dueText} · 打开小宝成长伙伴确认是否完成`,
        schedule: { at: nextReminderDate(reminder.dueText) },
      })),
    });
  } catch {
    // Native notification permission can be declined; the in-app reminder still remains.
  }
};

const normalizeReminderCategory = (category: string | undefined): Reminder["category"] => {
  if (category === "vaccine" || category === "routine" || category === "care" || category === "custom") {
    return category;
  }
  return "custom";
};

const normalizeReminderStatus = (status: string | undefined): Reminder["status"] => {
  if (status === "open" || status === "done" || status === "missed") return status;
  return "open";
};

const normalizeMemoryCategory = (category: string | undefined): MemoryItem["category"] => {
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
};

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
      patch.notes?.length,
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
      ? {
          ...result.careLogPatch,
          date: result.careLogPatch.date ?? todayISO(),
          soothing: normalizeSoothing(result.careLogPatch.soothing),
          solids: result.careLogPatch.solids ?? [],
          notes: result.careLogPatch.notes?.length ? result.careLogPatch.notes : [parentText],
        }
      : undefined;

  const reminders: Reminder[] = (result.reminders ?? [])
    .filter((item) => item.title || item.dueText)
    .map((item) => ({
      id: item.id ?? makeId("reminder"),
      title: item.title ?? "新的照护提醒",
      dueText: item.dueText ?? "待确认时间",
      category: normalizeReminderCategory(item.category),
      recurrence: item.recurrence,
      status: normalizeReminderStatus(item.status),
      createdAt: item.createdAt ?? now,
      history: item.history ?? [],
    }));

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
  const [profile, setProfile] = useStoredState("baby-companion-profile", initialProfile);
  const [messages, setMessages] = useStoredState("baby-companion-messages", initialMessages);
  const [growthEvents, setGrowthEvents] = useStoredState("baby-companion-growth", initialGrowthEvents);
  const [careLogs, setCareLogs] = useStoredState("baby-companion-care", initialCareLogs);
  const [reminders, setReminders] = useStoredState("baby-companion-reminders", initialReminders);
  const [memories, setMemories] = useStoredState("baby-companion-memories", initialMemories);
  const [thinkingEnabled, setThinkingEnabled] = useStoredState("baby-companion-thinking-enabled", false);
  const [selectedModel, setSelectedModel] = useStoredState<AgentModelId>("baby-companion-model", DEFAULT_MODEL);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(todayISO().slice(0, 7));
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<BabyProfile>(profile);
  const [allergiesText, setAllergiesText] = useState(profile.allergies.join("、"));
  const [caregiversText, setCaregiversText] = useState(profile.caregivers.join("、"));
  const [composerMode, setComposerMode] = useState<ComposerMode>("keyboard");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const asrControllerRef = useRef<AsrStreamController | null>(null);
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
  const hasPositionedMessageListRef = useRef(false);
  const messageScrollSignatureRef = useRef("");
  const appPlatform = platformLabel();
  const currentModel = MODEL_OPTIONS.find((model) => model.id === selectedModel) ?? MODEL_OPTIONS[0];
  const canAttachImages = currentModel.supportsImageInput;

  const todayLog = careLogs.find((item) => item.date === todayISO()) ?? careLogs[careLogs.length - 1];
  const openReminders = reminders.filter((item) => item.status === "open");
  const recordEvents = useMemo(
    () => buildRecordEvents(messages, careLogs, growthEvents, reminders),
    [messages, careLogs, growthEvents, reminders],
  );
  const eventDates = useMemo(() => new Set(recordEvents.map((event) => event.date)), [recordEvents]);
  const calendarDates = useMemo(() => calendarDatesForMonth(calendarMonth), [calendarMonth]);
  const selectedEvents = useMemo(
    () => recordEvents.filter((event) => event.date === selectedDate),
    [recordEvents, selectedDate],
  );
  const selectedCareLog = careLogs.find((item) => item.date === selectedDate);
  const selectedMessageCount = selectedEvents.filter((event) => event.type === "message").length;
  const selectedGrowthCount = selectedEvents.filter((event) => event.type === "growth").length;
  const selectedReminderCount = selectedEvents.filter((event) => event.type === "reminder").length;
  const selectedDateIsToday = selectedDate === todayISO();
  const milkTrend = useMemo(() => {
    const recent = careLogs.slice(-3).map((item) => item.milkMl ?? 0).filter(Boolean);
    if (recent.length < 2) return "继续收集中";
    const delta = recent[recent.length - 1] - recent[0];
    return delta >= 0 ? `近3次 +${delta} ml` : `近3次 ${delta} ml`;
  }, [careLogs]);

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
    if (canAttachImages) return;
    setAttachments([]);
  }, [canAttachImages]);

  useEffect(() => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
    setCaregiversText(profile.caregivers.join("、"));
  }, [profile]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canAttachImages) {
      event.target.value = "";
      return;
    }

    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image"));
    const next = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        return {
          id: makeId("attachment"),
          name: file.name,
          kind: "image",
          url: dataUrl,
          dataUrl,
        } satisfies Attachment;
      }),
    );
    setAttachments((current) => [...current, ...next].slice(0, 4));
    event.target.value = "";
  };

  const openMediaPicker = async () => {
    if (!canAttachImages) return;

    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
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

      const nativeAttachment: Attachment = {
        id: makeId("attachment"),
        name: `成长照片-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.jpeg`,
        kind: "image",
        url: photo.dataUrl,
        dataUrl: photo.dataUrl,
      };
      setAttachments((current) => [...current, nativeAttachment].slice(0, 4));
    } catch {
      // Users can cancel the native picker; no UI recovery is needed.
    }
  };

  const sendBufferedVoiceSamples = (flush = false) => {
    const samplesPerChunk = 3200;
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

  const cleanupLocalVoiceCapture = () => {
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
    stream?.getTracks().forEach((track) => track.stop());

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

  const stopVoiceCapture = () => {
    voiceShouldStopRef.current = true;
    cleanupLocalVoiceCapture();
    finishVoiceStream();
  };

  const startVoiceCapture = async () => {
    if (isSubmitting || isListening) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境无法访问麦克风");
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境不支持实时音频采集");
      return;
    }

    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    voiceShouldStopRef.current = false;
    voiceEndedRef.current = false;
    voiceAsrReadyRef.current = false;
    voiceBaseTextRef.current = input.trim();
    voiceSampleBufferRef.current = [];
    setVoiceTranscript("");
    setVoiceError("");
    setVoiceLevel(0);
    setVoiceStatus("connecting");
    setIsListening(true);

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
        setVoiceTranscript(text);
        setInput(mergeVoiceText(voiceBaseTextRef.current, text));
      },
      onFinal: (text) => {
        if (voiceSessionRef.current !== sessionId) return;
        setVoiceTranscript(text);
        setInput(mergeVoiceText(voiceBaseTextRef.current, text));
        if (voiceEndedRef.current) {
          setVoiceStatus("idle");
          asrControllerRef.current?.close();
          asrControllerRef.current = null;
        }
      },
      onError: (message) => {
        if (voiceSessionRef.current !== sessionId) return;
        voiceShouldStopRef.current = true;
        setVoiceError(message);
        setVoiceStatus("error");
        cleanupLocalVoiceCapture();
        asrControllerRef.current?.close();
        asrControllerRef.current = null;
      },
      onClose: () => {
        if (voiceSessionRef.current !== sessionId) return;
        cleanupLocalVoiceCapture();
        asrControllerRef.current = null;
        setVoiceStatus((current) => (current === "error" || current === "unsupported" ? current : "idle"));
      },
    });
    asrControllerRef.current = controller;

    let capturedStream: MediaStream | null = null;
    try {
      capturedStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

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
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
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
      setVoiceStatus(voiceAsrReadyRef.current ? "listening" : "connecting");
    } catch (error) {
      capturedStream?.getTracks().forEach((track) => track.stop());
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请在系统设置中允许录音"
          : "无法启动麦克风，请稍后再试";
      setVoiceError(message);
      setVoiceStatus("error");
      cleanupLocalVoiceCapture();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      voiceSessionRef.current += 1;
      voiceShouldStopRef.current = true;
      cleanupLocalVoiceCapture();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
    },
    [],
  );

  const toggleComposerMode = () => {
    if (isSubmitting) return;
    if (composerMode === "voice") {
      stopVoiceCapture();
      setComposerMode("keyboard");
      return;
    }

    setComposerMode("voice");
    setVoiceStatus("idle");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || isSubmitting) return;

    const submittedAttachments = attachments;
    const parentMessage: ChatMessage = {
      id: makeId("msg"),
      role: "parent",
      text: text || "上传了新的成长素材",
      createdAt: new Date().toISOString(),
      attachments: submittedAttachments,
    };
    const pendingAiMessage: ChatMessage = {
      id: makeId("msg"),
      role: "ai",
      text: thinkingEnabled ? "正在深度思考..." : "正在生成最终回复...",
      createdAt: new Date().toISOString(),
      tags: [thinkingEnabled ? "深度思考" : "处理中"],
      reasoning: "",
      isStreaming: true,
      toolActivities: [],
    };

    setIsSubmitting(true);
    stopVoiceCapture();
    setInput("");
    setAttachments([]);
    setMessages((current) => [...current, parentMessage, pendingAiMessage].slice(-32));

    let toolActivities: ToolActivity[] = [];
    try {
      let reasoningText = "";
      let contentText = "";
      const agentResponse = await runAgentChatStream(
        {
          message: parentMessage.text,
          model: currentModel.id,
          babyProfile: profile,
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
          thinkingEnabled,
          attachments: submittedAttachments.map((item) => ({
            id: item.id,
            name: item.name,
            kind: item.kind,
            dataUrl: canAttachImages && item.kind === "image" ? item.dataUrl : undefined,
          })),
        },
        {
          onReasoning: (delta) => {
            reasoningText += delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? { ...message, reasoning: reasoningText, text: "正在思考并整理..." }
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
        },
      );
      const result = normalizeAgentResponse(agentResponse, parentMessage.text);
      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: result.aiText,
        createdAt: new Date().toISOString(),
        tags: result.tags,
        reasoning: reasoningText,
        isStreaming: false,
        toolActivities,
        sources: result.sources,
      };

      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      if (result.growthEvent) setGrowthEvents((current) => [...current, result.growthEvent!]);
      if (result.careLogPatch) setCareLogs((current) => mergeCareLog(current, result.careLogPatch!));
      if (result.reminders.length) setReminders((current) => [...result.reminders, ...current]);
      if (result.memories.length) setMemories((current) => [...result.memories, ...current].slice(0, 10));
      await scheduleNativeReminders(result.reminders);
      if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light });
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const completeReminder = (target: Reminder) => {
    setReminders((current) =>
      current.map((item) =>
        item.id === target.id
          ? {
              ...item,
              status: "done",
              history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 已完成`, ...item.history],
            }
          : item,
      ),
    );
  };

  const selectRecordDate = (date: string) => {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
  };

  const handleProfileSubmit = (event: FormEvent) => {
    event.preventDefault();
    const allergies = splitListText(allergiesText);
    const caregivers = splitListText(caregiversText);

    setProfile({
      ...profileDraft,
      nickname: profileDraft.nickname.trim() || initialProfile.nickname,
      birthDate: profileDraft.birthDate || initialProfile.birthDate,
      expectedDate: profileDraft.expectedDate || initialProfile.expectedDate,
      region: profileDraft.region.trim() || initialProfile.region,
      feeding: profileDraft.feeding.trim() || initialProfile.feeding,
      allergies: allergies.length ? allergies : ["暂未发现"],
      caregivers: caregivers.length ? caregivers : initialProfile.caregivers,
    });
    setIsProfileEditing(false);
    setActiveMobileTab("profile");
  };

  const resetProfileDraft = () => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
    setCaregiversText(profile.caregivers.join("、"));
  };

  const startProfileEditing = () => {
    resetProfileDraft();
    setIsProfileEditing(true);
  };

  const cancelProfileEditing = () => {
    resetProfileDraft();
    setIsProfileEditing(false);
  };

  const quickFill = (text: string) => {
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

  return (
    <main className={`app-shell mobile-tab-${activeMobileTab}`}>
      <section className="topbar" aria-label="今日概览">
        <div className="brand-block">
          <div className="brand-mark">
            <Baby size={24} />
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
            <span>{appPlatform}</span>
          </div>
        </div>
      </section>

      <div className="workspace">
        <aside className="left-rail">
          <section className="profile-panel">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <Baby size={54} />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{profile.region} · {profile.feeding}</p>
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
            <div>
              <p className="eyebrow">5分钟记录</p>
              <h2>今天和小宝发生了什么</h2>
            </div>
            <div className="head-actions">
              <button
                type="button"
                className="icon-button"
                title={canAttachImages ? "照片" : "当前模型不支持图片理解"}
                disabled={!canAttachImages || isSubmitting}
                onClick={openMediaPicker}
              >
                <CameraIcon size={18} />
              </button>
              <button
                type="button"
                className={`icon-button ${composerMode === "voice" ? "active" : ""}`}
                title={composerMode === "voice" ? "键盘" : "语音"}
                onClick={toggleComposerMode}
              >
                {composerMode === "voice" ? <KeyboardIcon size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>

          <div className="quick-row">
            <button type="button" onClick={() => quickFill("今天喝奶 5 次，每次大概 120ml，晚上醒了 3 次")}>
              <Milk size={16} />
              喂奶
            </button>
            <button type="button" onClick={() => quickFill("晚上 8 点提醒我给小宝洗澡")}>
              <Bell size={16} />
              提醒
            </button>
            <button type="button" onClick={() => quickFill("今天小宝第一次自己扶着沙发站起来了")}>
              <Sparkles size={16} />
              里程碑
            </button>
            <button type="button" onClick={() => quickFill("为什么这两天小宝更难哄睡？")}>
              <CircleHelp size={16} />
              问问AI
            </button>
          </div>

          <div className="message-list" ref={messageListRef}>
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <span>{message.role === "ai" ? "AI" : profile.nickname + "家"}</span>
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
                <p>{message.text}</p>
                {message.sources?.length ? (
                  <div className="source-list" aria-label="联网查询来源">
                    {message.sources.map((source) => (
                      <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.attachments?.length ? (
                  <div className="attachment-strip">
                    {message.attachments.map((item) => (
                      <div className="attachment-thumb" key={item.id}>
                        {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : null}
                        {item.kind === "video" && item.url ? <video src={item.url} muted /> : null}
                        {!item.url ? <ImageIcon size={18} /> : null}
                        <span>{item.kind === "video" ? "视频" : item.kind === "audio" ? "语音" : "照片"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.tags?.length ? (
                  <div className="tag-row">
                    {message.tags.map((tag) => <span key={tag}>{tag}</span>)}
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
                    {item.kind === "image" && item.url ? <img src={item.url} alt={item.name} /> : <Video size={18} />}
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
                  accept="image/*"
                  multiple
                  hidden
                  disabled={!canAttachImages || isSubmitting}
                  onChange={handleFiles}
                />
                <select
                  className="model-select"
                  title="模型"
                  aria-label="模型"
                  value={currentModel.id}
                  disabled={isSubmitting}
                  onChange={(event) => setSelectedModel(event.target.value as AgentModelId)}
                >
                  {MODEL_OPTIONS.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="tool-button"
                  title={canAttachImages ? "上传图片" : "当前模型不支持图片理解"}
                  disabled={!canAttachImages || isSubmitting}
                  onClick={openMediaPicker}
                >
                  <CameraIcon size={19} />
                </button>
                <button
                  type="button"
                  className={`tool-button ${composerMode === "voice" ? "active" : ""}`}
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
                      startVoiceCapture();
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      try {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      } catch {
                        // The pointer may already be released when the native view cancels a gesture.
                      }
                      stopVoiceCapture();
                    }}
                    onPointerCancel={stopVoiceCapture}
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
                    onChange={(event) => setInput(event.target.value)}
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
            <button type="button" className="small-action" onClick={() => selectRecordDate(todayISO())}>
              今天
            </button>
          </div>

          <section className="summary-card">
            <div className="summary-title">
              <CalendarDays size={18} />
              <span>{selectedDateIsToday ? "今日信息" : "当天信息"}</span>
            </div>
            <div className="record-summary-grid">
              <div>
                <span>奶量</span>
                <strong>{selectedCareLog?.milkMl ? `${selectedCareLog.milkMl} ml` : "未记录"}</strong>
                <small>{selectedCareLog?.milkTimes ? `${selectedCareLog.milkTimes} 次` : "次数待记录"}</small>
              </div>
              <div>
                <span>睡眠</span>
                <strong>{selectedCareLog?.sleepHours ? `${selectedCareLog.sleepHours} h` : "未记录"}</strong>
                <small>{selectedCareLog?.wakes ? `夜醒 ${selectedCareLog.wakes} 次` : "夜醒待记录"}</small>
              </div>
              <div>
                <span>成长</span>
                <strong>{selectedGrowthCount} 条</strong>
                <small>{selectedGrowthCount ? "已归档" : "暂无成长"}</small>
              </div>
              <div>
                <span>提醒</span>
                <strong>{selectedReminderCount} 条</strong>
                <small>{openReminders.length} 个待办</small>
              </div>
              <div>
                <span>聊天</span>
                <strong>{selectedMessageCount} 条</strong>
                <small>{selectedDateIsToday ? "今天的对话" : "当天对话"}</small>
              </div>
            </div>
          </section>

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

          <section className="day-timeline-card">
            <div className="section-title">
              <Clock3 size={18} />
              <h2>当天时间线</h2>
            </div>
            {selectedEvents.length ? (
              <div className="record-event-list">
                {selectedEvents.map((event) => (
                  <article className={`record-event ${event.type}`} key={event.id}>
                    <time>{event.timeLabel}</time>
                    <div>
                      <h3>{event.title}</h3>
                      <p>{event.body}</p>
                      <div className="tag-row">
                        {event.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CalendarDays size={22} />
                <p>这一天还没有记录。</p>
                <button type="button" onClick={() => quickFill("今天小宝发生了什么？")}>
                  去聊天记录
                </button>
              </div>
            )}
          </section>
        </section>

        <section className="reminders-screen" aria-label="提醒">
          <div className="screen-head">
            <div>
              <p className="eyebrow">提醒</p>
              <h2>照护提醒</h2>
            </div>
            <span className="screen-pill">{openReminders.length} 个待办</span>
          </div>
          <div className="reminder-list">
            {openReminders.slice(0, 8).map((reminder) => (
              <article className={`reminder-item ${reminder.category}`} key={reminder.id}>
                <div className="reminder-icon">
                  {reminder.category === "vaccine" ? <Syringe size={18} /> : <Clock3 size={18} />}
                </div>
                <div>
                  <h3>{reminder.title}</h3>
                  <p>{reminder.dueText}</p>
                </div>
                <button type="button" title="标记完成" onClick={() => completeReminder(reminder)}>
                  <CheckCircle2 size={18} />
                </button>
              </article>
            ))}
          </div>
          <div className="assistant-actions reminder-actions">
            <button type="button" onClick={() => quickFill("下周二提醒我带小宝去社区医院打疫苗")}>
              <Syringe size={16} />
              疫苗
            </button>
            <button type="button" onClick={() => quickFill("晚上 8 点提醒我给小宝洗澡")}>
              <Bell size={16} />
              日常
            </button>
          </div>
        </section>

        <section className="profile-screen" aria-label="我的">
          <div className="screen-head">
            <div>
              <p className="eyebrow">我的</p>
              <h2>小宝信息</h2>
            </div>
            {isProfileEditing ? (
              <button className="screen-action-button quiet" type="button" onClick={cancelProfileEditing}>
                取消
              </button>
            ) : (
              <button className="screen-action-button" type="button" onClick={startProfileEditing}>
                <PencilLine size={16} />
                编辑
              </button>
            )}
          </div>

          <section className="profile-panel app-profile-card">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <Baby size={54} />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{stageLabel(profile.stage)} · {ageLabel(profile.birthDate)} · {profile.region}</p>
            </div>
            <div className="profile-highlights">
              <div>
                <span>喂养</span>
                <strong>{profile.feeding}</strong>
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
                <strong>{profile.region}</strong>
              </div>
              <div className="profile-detail-group">
                <span>过敏信息</span>
                <div className="profile-chip-list">
                  {profile.allergies.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <div className="profile-detail-group">
                <span>照护人</span>
                <div className="profile-chip-list">
                  {profile.caregivers.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <button className="profile-edit-button" type="button" onClick={startProfileEditing}>
                <PencilLine size={18} />
                编辑小宝资料
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
                <select
                  value={profileDraft.stage}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, stage: event.target.value as BabyProfile["stage"] }))
                  }
                >
                  <option value="born">已出生</option>
                  <option value="pregnancy">孕期</option>
                </select>
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
                <input
                  value={profileDraft.region}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, region: event.target.value }))}
                />
              </label>
              <label>
                <span>喂养方式</span>
                <input
                  value={profileDraft.feeding}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, feeding: event.target.value }))}
                />
              </label>
              <label>
                <span>过敏信息</span>
                <input value={allergiesText} onChange={(event) => setAllergiesText(event.target.value)} />
              </label>
              <label>
                <span>照护人</span>
                <input value={caregiversText} onChange={(event) => setCaregiversText(event.target.value)} />
              </label>
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
                <Milk size={19} />
                <span>奶量</span>
                <strong>{todayLog?.milkMl ? `${todayLog.milkMl} ml` : "待记录"}</strong>
                <small>{milkTrend}</small>
              </div>
              <div className="care-tile sleep">
                <Moon size={19} />
                <span>睡眠</span>
                <strong>{todayLog?.sleepHours ? `${todayLog.sleepHours} h` : "待记录"}</strong>
                <small>{todayLog?.wakes ? `夜醒 ${todayLog.wakes} 次` : "夜醒待记录"}</small>
              </div>
              <div className="care-tile soothe">
                <HeartPulse size={19} />
                <span>哄睡</span>
                <strong>{todayLog?.soothing ? soothingText[todayLog.soothing] : "待观察"}</strong>
                <small>{todayLog?.temperature ? `体温 ${todayLog.temperature}` : "无异常标记"}</small>
              </div>
              <div className="care-tile food">
                <Utensils size={19} />
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
                  <button type="button" title="标记完成" onClick={() => completeReminder(reminder)}>
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

      <nav className="mobile-tabbar" aria-label="移动端导航">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMobileTab === tab.id;
          return (
            <button
              type="button"
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id)}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

export default App;
