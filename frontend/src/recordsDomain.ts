// 记录/护理域:从 App.tsx 上帝类抽出的纯计算层(架构债 D1/D6「业务逻辑框架无关、可纯测」,Records 大拆分轮)。
// 纯模块:不引 React/资产/import.meta.env,可被 esbuild 逻辑测试打包。第一刀:奶量/睡眠的取值与分段聚合。
import type { CareLog, CareLogEvent } from "./types";
import { parseTimeSort } from "./utils/careLogHelpers";

/** 仅保留有意义的正数(undefined/NaN/<=0 视为未记录)。 */
export const positiveNumber = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;

export const sumValues = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** 单条护理事件按类取量:milk→奶量 ml,sleep→时长 h。 */
export const careEventValue = (event: CareLogEvent, kind: "milk" | "sleep") =>
  kind === "milk" ? positiveNumber(event.amountMl) : positiveNumber(event.durationHours);

/** 某日某类的全部事件(带量、按时间排序、滤掉无量项)。 */
export const careEventsByKind = (log: CareLog | undefined, kind: "milk" | "sleep") =>
  (log?.events ?? [])
    .filter((event) => event.type === kind)
    .map((event) => ({ event, value: careEventValue(event, kind) }))
    .filter((item): item is { event: CareLogEvent; value: number } => item.value !== undefined)
    .sort((left, right) => parseTimeSort(left.event.time, 0) - parseTimeSort(right.event.time, 0));

/** 没有逐条事件时,把日总量按次数均分成段(用于条形可视化)。 */
export const splitEvenSegments = (total: number | undefined, count: number | undefined) => {
  if (!total || total <= 0) return [];
  const segmentCount = Math.min(12, Math.max(1, Math.round(count ?? 1)));
  return Array.from({ length: segmentCount }, () => total / segmentCount);
};

/** 优先用逐条事件量;退化到「日总量均分」。 */
export const segmentValuesForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  const eventValues = careEventsByKind(log, kind).map((item) => item.value);
  if (eventValues.length) return eventValues;
  if (kind === "milk") return splitEvenSegments(positiveNumber(log?.milkMl), log?.milkTimes);
  return splitEvenSegments(positiveNumber(log?.sleepHours), undefined);
};

/** 当日某类的总量:优先直填字段,否则累加逐条事件。 */
export const totalForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  const direct = kind === "milk" ? positiveNumber(log?.milkMl) : positiveNumber(log?.sleepHours);
  return direct ?? positiveNumber(sumValues(careEventsByKind(log, kind).map((item) => item.value)));
};

/** 当日某类的次数:milk 优先 milkTimes,否则用事件数。 */
export const countForLog = (log: CareLog | undefined, kind: "milk" | "sleep") => {
  if (kind === "milk") {
    return log?.milkTimes ?? (careEventsByKind(log, "milk").length || undefined);
  }
  const sleepEventCount = careEventsByKind(log, "sleep").length;
  return sleepEventCount || undefined;
};
