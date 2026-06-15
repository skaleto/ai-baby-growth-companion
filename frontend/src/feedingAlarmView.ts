// 喂奶闹钟卡片的派生计算(纯函数,无 React / 无资源 import,可进 node 单测)。
// 卡片每 30s 用最新 now 调一次,算出"距上次 / 距下次 / 是否到点"。

export type FeedingAlarmView = {
  hasAlarm: boolean;
  intervalMinutes: number | null;
  sinceLastMs: number | null; // 距上次喂奶(无记录则 null)
  untilNextMs: number | null; // 距下次提醒(到点为 0,过点为负;无闹钟为 null)
  overdue: boolean;
};

export function computeFeedingAlarmView(input: {
  dueAtMs: number | null;
  intervalMinutes: number | null;
  lastMilkAtMs: number | null;
  nowMs: number;
}): FeedingAlarmView {
  const { dueAtMs, intervalMinutes, lastMilkAtMs, nowMs } = input;
  const hasAlarm = dueAtMs != null && intervalMinutes != null;
  const sinceLastMs = lastMilkAtMs != null ? Math.max(0, nowMs - lastMilkAtMs) : null;
  const untilNextMs = hasAlarm && dueAtMs != null ? dueAtMs - nowMs : null;
  const overdue = untilNextMs != null && untilNextMs <= 0;
  return { hasAlarm, intervalMinutes: hasAlarm ? intervalMinutes : null, sinceLastMs, untilNextMs, overdue };
}

// 毫秒 → "1小时20分" / "45分" / "2小时" / "刚刚"。
export function formatDurationCompact(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 1) return "刚刚";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}分`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}
