import { albumCategoryFromTags } from "../albumDomain";
import { canonicalCareEventTitle, formatDate, normalizeClockText } from "../appStateDomain";
import { makeId, todayISO } from "../data";
import type { AlbumItemCategory, CareLog, CareLogEvent, CareLogEventType } from "../types";

export const careEventTitleMap: Record<CareLogEventType, string> = {
  milk: "喝奶",
  sleep: "睡觉",
  wake: "醒来",
  poop: "便便",
  solid: "辅食",
  temperature: "体温",
  soothing: "哄睡",
  note: "照护记录",
};

export const soothingText = {
  easy: "好哄睡",
  normal: "正常",
  hard: "偏难",
};

export const careEventSignature = (event: CareLogEvent, fallbackDate: string) =>
  [
    event.type,
    event.date || fallbackDate,
    event.time ?? "",
    event.amountMl ?? "",
    event.durationHours ?? "",
    event.temperature ?? "",
  ].join("|");

export const mergeCareEvent = (existing: CareLogEvent, next: CareLogEvent): CareLogEvent => ({
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

export const dedupeCareEventsForMerge = (events: CareLogEvent[], fallbackDate: string) => {
  const bySignature = new Map<string, CareLogEvent>();
  events.forEach((event) => {
    const normalized = { ...event, date: event.date || fallbackDate };
    const signature = careEventSignature(normalized, fallbackDate);
    const existing = bySignature.get(signature);
    bySignature.set(signature, existing ? mergeCareEvent(existing, normalized) : normalized);
  });
  return Array.from(bySignature.values()).slice(-24);
};

export const mergeUniqueText = (left: string[], right: string[]) => {
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

export const mergeCareLog = (logs: CareLog[], patch: Partial<CareLog>) => {
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

export const parseTimeSort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const normalized = normalizeClockText(value);
  const match = normalized?.match(/(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const inferCareEventType = (text: string): CareLogEventType => {
  if (/奶|喂/.test(text)) return "milk";
  if (/睡|小睡|入睡/.test(text)) return "sleep";
  if (/醒|夜醒/.test(text)) return "wake";
  if (/便便|大便|拉了/.test(text)) return "poop";
  if (/辅食|米粉|蛋黄|菜泥|果泥|肉泥|粥/.test(text)) return "solid";
  if (/体温|发烧|发热/.test(text)) return "temperature";
  if (/哄|闹觉|抱睡/.test(text)) return "soothing";
  return "note";
};

export const noteToCareEvent = (log: CareLog, note: string, index: number): CareLogEvent | null => {
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

export const careEventsForLog = (log: CareLog) => {
  const source = log.events.length
    ? log.events
    : log.notes.map((note, index) => noteToCareEvent(log, note, index)).filter((event): event is CareLogEvent => Boolean(event));
  return source.filter((event) => Boolean(event.time) || event.type !== "note");
};

export const recordTimeLabel = (date: string, time?: string) => `${formatDate(date)}\n${time || "全天"}`;

export const careEventBody = (event: CareLogEvent) =>
  [
    event.amountMl ? `${event.amountMl} ml` : "",
    event.durationHours ? `${event.durationHours} 小时` : "",
    event.temperature ? `${event.temperature}°C` : "",
    event.note ?? "",
  ]
    .filter(Boolean)
    .join("，") || "已记录";

export const careAlbumCategory = (event: CareLogEvent): AlbumItemCategory => {
  if (event.type === "milk" || event.type === "solid") return "feeding";
  if (event.type === "sleep" || event.type === "wake" || event.type === "soothing") return "sleep";
  if (event.type === "temperature" || event.type === "poop") return "health";
  return albumCategoryFromTags(event.tags ?? [], event.note ?? event.title ?? "");
};

export const careAlbumTitle = (event: CareLogEvent) => {
  if (event.type === "milk" && event.amountMl) return `喝奶 ${event.amountMl}ml`;
  if (event.type === "sleep" && event.durationHours) return `睡了 ${event.durationHours} 小时`;
  if (event.type === "temperature" && event.temperature) return `体温 ${event.temperature}°C`;
  return event.title || canonicalCareEventTitle(event.type);
};
