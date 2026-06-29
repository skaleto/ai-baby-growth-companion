// 记录类型注册表(架构债 D13:消灭散弹式 kind 分支,违反 OCP)。
// 统一时间线事件 RecordEvent.kind 的元数据——加一种记录类型 = 在本表加一行,
// 不再回 App.tsx 各处 if/switch 逐个补 case。纯模块:不引资产、不引 React,
// 可被 esbuild 逻辑测试打包;资产绑定单独放 recordIcons.ts(同 albumIcons.ts 的分离范式)。
import type { CareLogEventType } from "./types";

// 统一时间线事件的 kind 全集 = 护理事件类型 + 成长 + 提醒(与 App.tsx 的 RecordEvent.kind 同构)。
export type RecordEventKind = CareLogEventType | "growth" | "reminder";

// 逻辑图标键(具体 PNG 在 recordIcons.ts 绑定;此处只给键,保持模块纯净)。
export type RecordIconKey =
  | "milk"
  | "sleep"
  | "poop"
  | "solid"
  | "temperature"
  | "growth"
  | "reminder"
  | "records";

export type RecordTypeDef = {
  /** 时间线/卡片展示用的中文短标签。 */
  label: string;
  /** 逻辑图标键,经 recordIcons 解析为资产 URL。 */
  iconKey: RecordIconKey;
};

// 加一种记录类型(用药/体温…)只在此处加一行,其余文件零改动(开闭原则)。
export const RECORD_EVENT_TYPES: Record<RecordEventKind, RecordTypeDef> = {
  milk: { label: "喂奶", iconKey: "milk" },
  sleep: { label: "睡眠", iconKey: "sleep" },
  wake: { label: "夜醒", iconKey: "sleep" },
  soothing: { label: "安抚", iconKey: "sleep" },
  poop: { label: "便便", iconKey: "poop" },
  solid: { label: "辅食", iconKey: "solid" },
  temperature: { label: "体温", iconKey: "temperature" },
  note: { label: "记录", iconKey: "records" },
  growth: { label: "成长", iconKey: "growth" },
  reminder: { label: "提醒", iconKey: "reminder" },
};

/** 查表(未知 kind 兜底到 note,与旧 recordEventIconSrc 的默认 recordsIcon 行为一致)。 */
export const recordEventTypeOf = (kind: RecordEventKind): RecordTypeDef =>
  RECORD_EVENT_TYPES[kind] ?? RECORD_EVENT_TYPES.note;

export const recordEventIconKey = (kind: RecordEventKind): RecordIconKey => recordEventTypeOf(kind).iconKey;

export const recordEventLabel = (kind: RecordEventKind): string => recordEventTypeOf(kind).label;
