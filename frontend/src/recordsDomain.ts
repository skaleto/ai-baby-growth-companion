// 记录/护理域:从 App.tsx 上帝类抽出的纯计算层(架构债 D1/D6「业务逻辑框架无关、可纯测」,Records 大拆分轮)。
// 纯模块:不引 React/资产/import.meta.env,可被 esbuild 逻辑测试打包。第一刀:奶量/睡眠的取值与分段聚合。
import type { CareLog, CareLogEvent } from "./types";
import { parseTimeSort } from "./utils/careLogHelpers";
import { addDays } from "./appStateDomain";
import { todayISO } from "./data";

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

export type DailyCareSegment = {
  id: string;
  time?: string;
  label: string;
  value: number;
  grow: number;
};

export type DailyCareMarker = {
  id: string;
  time: string;
  label: string;
};

export type DailyCareBreakdown = {
  key: "milk" | "sleep";
  label: string;
  totalLabel: string;
  countLabel: string;
  emptyLabel: string;
  segments: DailyCareSegment[];
  markers: DailyCareMarker[];
};

export type WeeklyCareDay = {
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

export type WeeklyCareComparison = {
  days: WeeklyCareDay[];
  hasData: boolean;
  milkAverageLabel: string;
  sleepAverageLabel: string;
};

export const compactValue = (value: number | undefined, unit: string, decimals = 0) => {
  if (value === undefined) return "未记录";
  const text = decimals > 0 ? value.toFixed(decimals).replace(/\.0$/, "") : `${Math.round(value)}`;
  return `${text}${unit}`;
};

export const buildDailyCareBreakdowns = (log: CareLog | undefined): DailyCareBreakdown[] => {
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

export const buildWeeklyCareComparison = (careLogs: CareLog[], selectedDate: string): WeeklyCareComparison => {
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
