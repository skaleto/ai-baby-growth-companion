// appContracts —— App 子系统之间共享的「契约类型」中立聚合点(LEAF 模块,编译期擦除)。
//
// 这里只放「被 App.tsx 以外的文件 import」或「被其它已迁移契约类型引用」的共享类型;
// 纯 App 内部私有的类型(VoiceStatus / QueuedMediaFile / SystemWeakNotice 等)仍留在 App.tsx。
//
// 关键约束:本模块必须是叶子——不得 import App(否则又形成对上帝组件的反向依赖,
// 抽出来就白抽了)。只允许 type-only import 其它叶子模块(./types / ./reminderDraft /
// ./features/ledger/useLedgerState 里的 ExpenseDraft;后者对 App/appContracts 无依赖)。
// feature hooks / screens 从这里 import 契约类型,不再 `import type ... from "../App"`。
import type { AttachmentKind, CareLogEventType, GrowthMeasurementType, RecordedBy } from "./types";
import type { ReminderDraft } from "./reminderDraft";
import type { ExpenseDraft } from "./features/ledger/useLedgerState";

export type ComposerMode = "keyboard" | "voice";

// useSessionState 仅做「类型」import 回去(编译期擦除,不形成运行时循环依赖)。
export type AuthStatus = "checking" | "authenticated" | "unauthenticated";
export type AiUsageStatus = "idle" | "loading" | "ready" | "error";

export type CompressionStatus = "idle" | "checking" | "compressing" | "done" | "failed";

type MediaUploadStatus = "preparing" | "uploading" | "processing" | "done" | "failed";
type MediaUploadTarget = "chat" | "album";

// useAlbumState 仅做「类型」import 回去(编译期擦除,不形成运行时循环依赖),
// 用于精确标注它接收的 mediaUploadItems 依赖 / 返回的 albumUploadItems。
export type MediaUploadItem = {
  id: string;
  name: string;
  kind: AttachmentKind;
  target: MediaUploadTarget;
  status: MediaUploadStatus;
  progress: number;
  message?: string;
};

// App.tsx 里 activeUploadStatuses 仍按该联合类型标注,故单独导出供其 type-only import 回去。
export type { MediaUploadStatus };

export type RuntimeVersionInfo = {
  otaVersion: string;
  nativeVersion: string;
  bundleId: string;
  platform: string;
  status: string;
};

export type RecordEventType = "care" | "growth" | "reminder";

export type RecordEvent = {
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

export type CareEventDraft = {
  type: CareLogEventType;
  time: string;
  amountMl: string;
  durationHours: string;
  temperature: string;
  note: string;
};

export type RecordsEntryDrawer = "ai" | "manual" | null;

export type ManualRecordKind = Extract<CareLogEventType, "milk" | "sleep" | "poop" | "temperature" | "solid">;
export type ManualNumericDraftKey = "amountMl" | "durationHours" | "temperature";

export type ManualRecordTypeOption = {
  type: ManualRecordKind;
  label: string;
  hint: string;
};

type PendingReminderDraft = {
  id: string;
  draft: ReminderDraft;
};

type PendingMemoryDraft = {
  id: string;
  text: string;
};

export type PendingGrowthDraft = {
  title: string;
  date: string;
  summary: string;
};

export type PendingGrowthMeasurementDraft = {
  id: string;
  type: GrowthMeasurementType;
  value: string;
  date: string;
  note: string;
};

export type PendingCareDraft = {
  date: string;
  milkMl: string;
  milkTimes: string;
  sleepHours: string;
  wakes: string;
  poop: string;
  temperature: string;
  notes: string;
};

export type PendingEffectDraft = {
  growthEvent?: PendingGrowthDraft;
  growthMeasurements: PendingGrowthMeasurementDraft[];
  careLogPatch?: PendingCareDraft;
  reminders: PendingReminderDraft[];
  memories: PendingMemoryDraft[];
  expenses: ExpenseDraft[];
};

export type GrowthTrendMetric = {
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

export type GrowthCurveData = {
  points: GrowthCurvePoint[];
  polyline: string;
  minLabel: string;
  maxLabel: string;
  latestLabel: string;
};
