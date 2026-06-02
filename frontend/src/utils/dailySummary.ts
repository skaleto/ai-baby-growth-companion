import type { CareLog, CareLogEventType, Finding, FindingType, GrowthMeasurement, GrowthMeasurementType, Reminder } from "../types";

export type ActionDomain = "ledger" | "album" | "milestone" | "reminder";

export type ParsedActionTarget = {
  domain: ActionDomain;
  id: string;
} | null;

const VALID_DOMAINS: readonly ActionDomain[] = ["ledger", "album", "milestone", "reminder"];

export function parseActionTarget(target: string): ParsedActionTarget {
  if (!target) return null;
  const sep = target.indexOf(":");
  if (sep <= 0) return null;
  const domain = target.slice(0, sep);
  const id = target.slice(sep + 1);
  if (!id) return null;
  if (!(VALID_DOMAINS as readonly string[]).includes(domain)) return null;
  return { domain: domain as ActionDomain, id };
}

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  family_action_continuity: "家庭接力",
  cross_domain_link: "跨域关联",
  expense_price_compare: "价格对比",
  trend_anomaly: "趋势观察",
  media_milestone_candidate: "里程碑候选",
  memory_recall: "记忆触发",
};

export const FINDING_TYPE_COLOR: Record<FindingType, string> = {
  family_action_continuity: "#7eafd8",
  cross_domain_link: "#e8a45e",
  expense_price_compare: "#b08868",
  trend_anomaly: "#d88276",
  media_milestone_candidate: "#b894d4",
  memory_recall: "#8ac4a8",
};

export function findingsByType(findings: Finding[]): Map<FindingType, Finding[]> {
  const map = new Map<FindingType, Finding[]>();
  for (const f of findings) {
    if (!map.has(f.type)) map.set(f.type, []);
    map.get(f.type)!.push(f);
  }
  return map;
}

export type DailyObservationStatKey = "feeding" | "sleep" | "care" | "growth";

export type DailyObservationStat = {
  key: DailyObservationStatKey;
  label: string;
  value: string;
  detail: string;
  empty: boolean;
};

export type HandoffSection = {
  title: "宝宝今天" | "已完成" | "待接手" | "留意一下";
  items: string[];
};

export type HandoffSummary = {
  sections: HandoffSection[];
  copyText: string;
};

const GROWTH_META: Record<GrowthMeasurementType, { label: string; unit: string }> = {
  height: { label: "身高", unit: "cm" },
  weight: { label: "体重", unit: "kg" },
  headCircumference: { label: "头围", unit: "cm" },
};

const CARE_EVENT_TYPES = new Set<CareLogEventType>(["poop", "temperature", "soothing", "note", "solid"]);

export function buildCareStats(careLog: CareLog | null | undefined): DailyObservationStat[] {
  const events = careLog?.events ?? [];
  const milkEvents = events.filter((event) => event.type === "milk");
  const sleepEvents = events.filter((event) => event.type === "sleep" || event.type === "wake");
  const careEvents = events.filter((event) => CARE_EVENT_TYPES.has(event.type));

  return [
    buildFeedingStat(careLog, milkEvents.length),
    buildSleepStat(careLog, sleepEvents.length),
    buildCareStat(careLog, careEvents.length),
  ];
}

export function buildGrowthStats(
  growthMeasurements: GrowthMeasurement[] | null | undefined,
  selectedDate: string,
): DailyObservationStat {
  const latestByType = new Map<GrowthMeasurementType, GrowthMeasurement>();
  for (const item of growthMeasurements ?? []) {
    if (!item?.type || !Number.isFinite(item.value)) continue;
    if (selectedDate && item.date > selectedDate) continue;
    const existing = latestByType.get(item.type);
    if (!existing || item.date > existing.date) latestByType.set(item.type, item);
  }

  const latest = Array.from(latestByType.values()).sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return growthTypeRank(a.type) - growthTypeRank(b.type);
  });

  if (!latest.length) {
    return {
      key: "growth",
      label: "成长",
      value: "还没记录成长值",
      detail: "身高、体重或头围都可以",
      empty: true,
    };
  }

  const primary = latest[0];
  const primaryMeta = GROWTH_META[primary.type];
  const rest = latest
    .slice(1)
    .sort((a, b) => growthTypeRank(a.type) - growthTypeRank(b.type))
    .map((item) => {
      const meta = GROWTH_META[item.type];
      return `${meta.label} ${formatMeasurementValue(item.value)} ${meta.unit}`;
    });
  const detailParts = rest.length ? rest : [`最近测量 ${shortDate(primary.date)}`];
  if (rest.length) detailParts.push(shortDate(primary.date));

  return {
    key: "growth",
    label: "成长",
    value: `${primaryMeta.label} ${formatMeasurementValue(primary.value)} ${primaryMeta.unit}`,
    detail: detailParts.join(" · "),
    empty: false,
  };
}

export function countTodayDataPoints(
  careLog: CareLog | null | undefined,
  growthMeasurements: GrowthMeasurement[] | null | undefined,
  selectedDate: string,
): number {
  let count = 0;
  if (careLog) {
    const aggregateKeys: Array<keyof CareLog> = ["milkMl", "milkTimes", "sleepHours", "wakes", "poop", "temperature", "soothing"];
    count += aggregateKeys.filter((key) => hasMeaningfulValue(careLog[key])).length;
    count += (careLog.solids ?? []).filter((item) => item.trim()).length;
    count += (careLog.notes ?? []).filter((item) => item.trim()).length;
    count += (careLog.events ?? []).length;
  }

  const hasGrowthForDate = (growthMeasurements ?? []).some((item) => item.date <= selectedDate);
  return count + (hasGrowthForDate ? 1 : 0);
}

export function summarizeCareLogEffect(careLogPatch: Partial<CareLog> | null | undefined): string[] {
  if (!careLogPatch) return [];
  const parts: string[] = [];
  if (hasMeaningfulNumber(careLogPatch.milkMl)) parts.push(`喝奶 ${careLogPatch.milkMl} ml`);
  else if (hasMeaningfulNumber(careLogPatch.milkTimes)) parts.push(`喝奶 ${careLogPatch.milkTimes} 次`);

  if (hasMeaningfulNumber(careLogPatch.sleepHours)) parts.push(`睡眠 ${formatCompactNumber(careLogPatch.sleepHours)} 小时`);
  if (careLogPatch.poop) parts.push("便便已记录");
  if (hasMeaningfulNumber(careLogPatch.temperature)) parts.push(`体温 ${formatCompactNumber(careLogPatch.temperature)}`);
  for (const solid of careLogPatch.solids ?? []) {
    if (solid.trim()) parts.push(`辅食：${solid.trim()}`);
  }
  for (const note of careLogPatch.notes ?? []) {
    if (note.trim()) parts.push(note.trim());
  }
  return parts;
}

export function buildCaregiverCompanionLine(
  careLog: CareLog | null | undefined,
  growthMeasurements: GrowthMeasurement[] | null | undefined,
  selectedDate: string,
): string {
  if (hasMeaningfulNumber(careLog?.wakes) && careLog!.wakes! >= 3) {
    return `昨晚记录到 ${careLog!.wakes} 次夜醒，你真的辛苦了。我先帮你把今天的交接整理好。`;
  }
  const eventCount = careLog?.events?.length ?? 0;
  if (eventCount >= 5) {
    return `今天已经记下 ${eventCount} 条照护细节，交接时不用全靠记忆了。`;
  }
  const dataPoints = countTodayDataPoints(careLog, growthMeasurements, selectedDate);
  if (dataPoints > 0) {
    return "今天已经有一些记录了，我先帮你把它们收成一段好交接的内容。";
  }
  return "今天记录还不多，没关系，我先帮你收着已有的。";
}

export function buildHandoffSummary(input: {
  babyNickname: string;
  careLog: CareLog | null | undefined;
  growthMeasurements: GrowthMeasurement[] | null | undefined;
  selectedDate: string;
  reminders: Reminder[] | null | undefined;
  pendingEffectCount?: number;
  observations?: string[];
}): HandoffSummary {
  const todayItems = [
    `喂养：${handoffFeeding(input.careLog)}`,
    `睡眠：${handoffSleep(input.careLog)}`,
    `护理：${handoffCare(input.careLog)}`,
    `成长：${handoffGrowth(input.growthMeasurements, input.selectedDate)}`,
  ];
  const doneItems = (input.reminders ?? [])
    .filter((reminder) => reminder.status === "done")
    .slice(0, 3)
    .map((reminder) => `${reminder.title}（${reminder.dueText}）`);
  const openReminderItems = (input.reminders ?? [])
    .filter((reminder) => reminder.status !== "done")
    .slice(0, 3)
    .map((reminder) => `${reminder.title}（${reminder.dueText}）`);
  const pendingItems = input.pendingEffectCount && input.pendingEffectCount > 0 ? [`待确认记录 ${input.pendingEffectCount} 条`] : [];
  const attentionItems = (input.observations ?? []).filter(Boolean).slice(0, 3);

  const sections: HandoffSection[] = [
    { title: "宝宝今天", items: todayItems },
    { title: "已完成", items: doneItems.length ? doneItems : ["还没看到已完成提醒"] },
    { title: "待接手", items: [...openReminderItems, ...pendingItems].length ? [...openReminderItems, ...pendingItems] : ["还没看到待接手事项"] },
    { title: "留意一下", items: attentionItems.length ? attentionItems : ["还没看到需要特别交接的记录"] },
  ];

  const copyText = sections
    .map((section) => `${section.title === "宝宝今天" ? `${input.babyNickname}今天` : section.title}：\n${section.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");

  return { sections, copyText };
}

function buildFeedingStat(careLog: CareLog | null | undefined, milkEventCount: number): DailyObservationStat {
  if (hasMeaningfulNumber(careLog?.milkMl)) {
    return {
      key: "feeding",
      label: "喂养",
      value: `${careLog!.milkMl} ml`,
      detail: hasMeaningfulNumber(careLog?.milkTimes) ? `${careLog!.milkTimes} 次喂养` : "今天喂养",
      empty: false,
    };
  }
  if (hasMeaningfulNumber(careLog?.milkTimes)) {
    return { key: "feeding", label: "喂养", value: `${careLog!.milkTimes} 次`, detail: "今天喂养", empty: false };
  }
  if (milkEventCount > 0) {
    return { key: "feeding", label: "喂养", value: `${milkEventCount} 次`, detail: "来自照护时间线", empty: false };
  }
  return { key: "feeding", label: "喂养", value: "还没看到喂养记录", detail: "可以先随手记一条", empty: true };
}

function handoffFeeding(careLog: CareLog | null | undefined): string {
  if (hasMeaningfulNumber(careLog?.milkMl) && hasMeaningfulNumber(careLog?.milkTimes)) return `${careLog!.milkMl} ml，${careLog!.milkTimes} 次`;
  if (hasMeaningfulNumber(careLog?.milkMl)) return `${careLog!.milkMl} ml`;
  if (hasMeaningfulNumber(careLog?.milkTimes)) return `${careLog!.milkTimes} 次`;
  return "还没看到相关记录";
}

function handoffSleep(careLog: CareLog | null | undefined): string {
  const parts: string[] = [];
  if (hasMeaningfulNumber(careLog?.sleepHours)) parts.push(`${formatOneDecimal(careLog!.sleepHours)} 小时`);
  if (hasMeaningfulNumber(careLog?.wakes)) parts.push(`夜醒 ${careLog!.wakes} 次`);
  return parts.length ? parts.join("，") : "还没看到相关记录";
}

function handoffCare(careLog: CareLog | null | undefined): string {
  const parts: string[] = [];
  if (careLog?.poop) parts.push("便便已记录");
  if (hasMeaningfulNumber(careLog?.temperature)) parts.push(`体温 ${formatCompactNumber(careLog!.temperature)}`);
  return parts.length ? parts.join("，") : "还没看到相关记录";
}

function handoffGrowth(growthMeasurements: GrowthMeasurement[] | null | undefined, selectedDate: string): string {
  const stat = buildGrowthStats(growthMeasurements, selectedDate);
  return stat.empty ? "还没看到相关记录" : stat.value;
}

function buildSleepStat(careLog: CareLog | null | undefined, sleepEventCount: number): DailyObservationStat {
  if (hasMeaningfulNumber(careLog?.sleepHours)) {
    return {
      key: "sleep",
      label: "睡眠",
      value: `${formatOneDecimal(careLog!.sleepHours)} 小时`,
      detail: hasMeaningfulNumber(careLog?.wakes) ? `夜醒 ${careLog!.wakes} 次` : "今天睡眠",
      empty: false,
    };
  }
  if (sleepEventCount > 0) {
    return { key: "sleep", label: "睡眠", value: `${sleepEventCount} 段`, detail: "来自照护时间线", empty: false };
  }
  return { key: "sleep", label: "睡眠", value: "还没看到睡眠记录", detail: "有记录会更完整", empty: true };
}

function buildCareStat(careLog: CareLog | null | undefined, careEventCount: number): DailyObservationStat {
  if (careLog?.poop) {
    return {
      key: "care",
      label: "护理",
      value: "便便已记录",
      detail: hasMeaningfulNumber(careLog.temperature) ? `体温 ${formatCompactNumber(careLog.temperature)}` : careEventCount ? `护理记录 ${careEventCount} 条` : "今天护理",
      empty: false,
    };
  }
  if (hasMeaningfulNumber(careLog?.temperature)) {
    return { key: "care", label: "护理", value: `体温 ${formatCompactNumber(careLog!.temperature)}`, detail: careEventCount ? `护理记录 ${careEventCount} 条` : "今天护理", empty: false };
  }
  if (careEventCount > 0) {
    return { key: "care", label: "护理", value: `护理记录 ${careEventCount} 条`, detail: "便便、体温或备注", empty: false };
  }
  return { key: "care", label: "护理", value: "还没看到护理记录", detail: "便便、体温或备注都可以", empty: true };
}

function growthTypeRank(type: GrowthMeasurementType): number {
  if (type === "weight") return 0;
  if (type === "height") return 1;
  return 2;
}

function shortDate(date: string): string {
  return date.length >= 10 ? date.slice(5, 10) : date;
}

function formatOneDecimal(value: number): string {
  return value.toFixed(1);
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatMeasurementValue(value: number): string {
  return String(value);
}

function hasMeaningfulNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}
