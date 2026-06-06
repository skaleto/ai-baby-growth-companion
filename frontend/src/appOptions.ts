import {
  CalendarDays,
  Image as ImageIcon,
  MessageCircle,
  ReceiptText,
  UserRound,
} from "lucide-react";
import type {
  AgentModelId,
  AgentModelOption,
  AlbumItemCategory,
  BabyProfile,
  CareLogEventType,
  ExpenseCategory,
  GrowthMeasurementType,
  Reminder,
  ReminderAlertMode,
  ReminderScheduleMode,
  ReminderSoundId,
} from "./types";

export const MODEL_OPTIONS: AgentModelOption[] = [
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsLowLatency: false,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsLowLatency: false,
  },
  {
    id: "doubao-seed-2.0-pro",
    label: "Doubao Seed 2.0 Pro",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsLowLatency: true,
  },
  {
    id: "doubao-seed-2.0-lite",
    label: "Doubao Seed 2.0 Lite",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsLowLatency: true,
  },
];

export const DEFAULT_MODEL: AgentModelId = "deepseek-v4-pro";

export const MOBILE_TABS = [
  { id: "chat", label: "聊天", icon: MessageCircle },
  { id: "records", label: "记录", icon: CalendarDays },
  { id: "ledger", label: "账本", icon: ReceiptText },
  { id: "album", label: "相册", icon: ImageIcon },
  { id: "profile", label: "我的", icon: UserRound },
] as const;

export type MobileTab = (typeof MOBILE_TABS)[number]["id"];
export type RecordView = "today" | "trend" | "calendar";
export type LedgerView = "month" | "year" | "details";

export const ROLE_OPTIONS = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "月嫂", "保姆", "亲友", "其他"] as const;
export const UNIQUE_ROLE_OPTIONS = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆"] as const;

export const RECORD_VIEWS: Array<{ id: RecordView; label: string }> = [
  { id: "today", label: "今日" },
  { id: "trend", label: "趋势" },
  { id: "calendar", label: "日历" },
];

export const GROWTH_MEASUREMENT_META: Record<
  GrowthMeasurementType,
  { label: string; unit: string; step: string; min: number; max: number }
> = {
  height: { label: "身高", unit: "cm", step: "0.1", min: 20, max: 130 },
  weight: { label: "体重", unit: "kg", step: "0.01", min: 1, max: 60 },
  headCircumference: { label: "头围", unit: "cm", step: "0.1", min: 20, max: 65 },
};

export const GROWTH_MEASUREMENT_TYPES: GrowthMeasurementType[] = ["height", "weight", "headCircumference"];

export const LEDGER_VIEWS: Array<{ id: LedgerView; label: string }> = [
  { id: "month", label: "本月" },
  { id: "year", label: "年度" },
  { id: "details", label: "明细" },
];

export const EXPENSE_CATEGORIES: Array<{ id: ExpenseCategory; label: string }> = [
  { id: "formula", label: "奶粉" },
  { id: "diaper", label: "尿裤" },
  { id: "food", label: "辅食" },
  { id: "clothing", label: "衣物" },
  { id: "toy", label: "玩具" },
  { id: "health", label: "医疗健康" },
  { id: "vaccine", label: "疫苗体检" },
  { id: "daily", label: "日用品" },
  { id: "education", label: "教育娱乐" },
  { id: "other", label: "其他" },
];

export const EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORIES.map((category) => category.id);

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  formula: "#e8a45e",
  diaper: "#7eafd8",
  food: "#c89761",
  clothing: "#b08868",
  toy: "#b894d4",
  health: "#d88276",
  vaccine: "#e9a5a5",
  daily: "#8ac4a8",
  education: "#8d9ed6",
  other: "#a3a8af",
};
export const ALBUM_CATEGORY_VALUES: readonly AlbumItemCategory[] = ["growth", "feeding", "sleep", "health", "reminder", "daily"];
export const CARE_EVENT_TYPE_VALUES: readonly CareLogEventType[] = [
  "milk",
  "sleep",
  "wake",
  "poop",
  "solid",
  "temperature",
  "soothing",
  "note",
];

export const MIN_INTERVAL_MINUTES = 10;
export const MAX_INTERVAL_MINUTES = 12 * 60;

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export const ROLE_SELECT_OPTIONS: Array<SelectOption<"" | (typeof ROLE_OPTIONS)[number]>> = [
  { value: "", label: "请选择身份", hint: "新成员首次加入时必选" },
  ...ROLE_OPTIONS.map((role) => ({ value: role, label: role })),
];

export const STAGE_SELECT_OPTIONS: Array<SelectOption<BabyProfile["stage"]>> = [
  { value: "born", label: "已出生", hint: "按出生日期计算月龄" },
  { value: "pregnancy", label: "孕期", hint: "按预产期记录准备事项" },
];

export const GENDER_SELECT_OPTIONS: Array<SelectOption<BabyProfile["gender"]>> = [
  { value: "unknown", label: "暂不填写", hint: "生长曲线需要性别才能更准确" },
  { value: "boy", label: "男孩" },
  { value: "girl", label: "女孩" },
];

export const REGION_SELECT_OPTIONS: Array<SelectOption<string>> = [
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

export const FEEDING_SELECT_OPTIONS: Array<SelectOption<string>> = [
  { value: "", label: "暂不确定", hint: "之后可以随时修改" },
  { value: "母乳喂养", label: "母乳喂养" },
  { value: "配方奶喂养", label: "配方奶喂养" },
  { value: "混合喂养", label: "混合喂养" },
  { value: "亲喂为主", label: "亲喂为主" },
  { value: "瓶喂为主", label: "瓶喂为主" },
  { value: "已添加辅食", label: "已添加辅食" },
];

export const MODEL_SELECT_OPTIONS: Array<SelectOption<AgentModelId>> = MODEL_OPTIONS.map((model) => ({
  value: model.id,
  label: model.label,
  hint: [
    model.supportsImageInput || model.supportsVideoInput ? "支持视觉理解" : "文本对话模型",
    model.supportsLowLatency ? "可选低延迟" : "",
  ]
    .filter(Boolean)
    .join(" · "),
}));

export const isVisualModel = (model: AgentModelOption) => model.supportsImageInput || model.supportsVideoInput;

export const CARE_EVENT_TYPE_OPTIONS: Array<SelectOption<CareLogEventType>> = [
  { value: "milk", label: "喝奶" },
  { value: "sleep", label: "睡觉" },
  { value: "wake", label: "醒来" },
  { value: "poop", label: "便便" },
  { value: "solid", label: "辅食" },
  { value: "temperature", label: "体温" },
  { value: "soothing", label: "哄睡" },
  { value: "note", label: "其他" },
];

export const REMINDER_CATEGORY_OPTIONS: Array<SelectOption<Reminder["category"]>> = [
  { value: "care", label: "照护", hint: "喂奶、洗澡、日常护理" },
  { value: "routine", label: "日程", hint: "体检、复诊、普通待办" },
  { value: "vaccine", label: "疫苗", hint: "接种、社区医院安排" },
  { value: "custom", label: "自定义", hint: "其他家庭事项" },
];

export const REMINDER_SCHEDULE_MODE_OPTIONS: Array<SelectOption<ReminderScheduleMode>> = [
  { value: "once", label: "提醒一次", hint: "选一个具体日期和时间" },
  { value: "interval", label: "循环提醒", hint: "按固定间隔重复提醒" },
];

export const REMINDER_ALERT_MODE_OPTIONS: Array<SelectOption<ReminderAlertMode>> = [
  { value: "notification", label: "普通通知", hint: "到点推送一条消息" },
  { value: "ringing", label: "闹铃响起", hint: "进入全屏提醒页并播放提示音" },
];

export const REMINDER_SOUND_OPTIONS: Array<SelectOption<ReminderSoundId>> = [
  { value: "soft_chime", label: "柔和叮咚", hint: "短促、轻一点" },
  { value: "soft_bell", label: "轻铃声", hint: "更清脆一点" },
];

export const EXPENSE_CATEGORY_OPTIONS: Array<SelectOption<ExpenseCategory>> = EXPENSE_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));
