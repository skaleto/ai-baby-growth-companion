// 领域拆分 P7:从 appStateDomain 抽出的「护理日志/事件」归一化 + 去重 + 标题标签单一来源。
// 纯模块红线:不 import 宿主 API;依赖 coerce/dateTime/media 与外部 data/appOptions,不反向依赖上层聚合模块(misc)。
import { todayISO } from "../data";
import { CARE_EVENT_TYPE_VALUES } from "../appOptions";
import type { CareLog, CareLogEvent, CareLogEventType } from "../types";
import { numberValue, stringList, stringMember, textValue, uniqueTexts } from "./coerce";
import { normalizeClockText } from "./dateTime";
import { normalizeRecordedBy } from "./media";

export const normalizeCareLogEventType = (value: unknown): CareLogEventType =>
  stringMember(CARE_EVENT_TYPE_VALUES, value) ? value : "note";

export const normalizeEventClockText = (timeValue: unknown, noteValue: unknown) => {
  const directTime = normalizeClockText(timeValue);
  const noteTime = normalizeClockText(noteValue);
  if (directTime && noteTime && directTime.endsWith(":00") && typeof noteValue === "string" && /点\s*半/.test(noteValue)) {
    return noteTime;
  }
  return directTime ?? noteTime;
};

// 护理事件标题的单一来源(评审 P5)。careLogHelpers 的 careEventTitleMap 直接复用本表,
// 不再各自维护一份同值字面量。注意:这些是「自然语言标题/标签」文案(喝奶/睡觉),与时间线卡片的
// RECORD_EVENT_TYPES(喂奶/睡眠)、下拉 CARE_EVENT_TYPE_OPTIONS(note→其他)是有意的不同文案,勿合并。
export const CARE_EVENT_TITLES: Record<CareLogEventType, string> = {
  milk: "喝奶",
  sleep: "睡觉",
  wake: "醒来",
  poop: "便便",
  solid: "辅食",
  temperature: "体温",
  soothing: "哄睡",
  note: "照护记录",
};

// 与原 if 链逐字等价:已知的非 note 类型返回其固定标题(忽略 fallback);note 及未知类型用 fallback || 照护记录。
export const canonicalCareEventTitle = (type: CareLogEventType, fallback?: string) => {
  if (type !== "note" && CARE_EVENT_TITLES[type]) return CARE_EVENT_TITLES[type];
  return fallback || CARE_EVENT_TITLES.note;
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
