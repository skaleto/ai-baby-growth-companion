import type { CareLog } from "../types";

const hasMeaningfulNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const formatCompactNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(value));

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
