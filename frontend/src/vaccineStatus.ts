// 疫苗窗口状态(纯函数,可 node 测)。5 态互斥;区域叠加。
import type { DoseStatus, RegionCode, VaccineDose } from "./data/vaccineSchedule.fallback";

const CLOSING_MONTHS = 1; // 距窗口末 ≤1 月 = 尽快约

export function computeDoseStatus(input: {
  ageMonths: number | null;
  ageMonthMin: number;
  ageMonthMax: number;
  doneDate: string | null;
}): DoseStatus {
  const { ageMonths, ageMonthMin, ageMonthMax, doneDate } = input;
  if (doneDate) return "done";
  if (ageMonths == null) return "upcoming"; // 没填生日:当纯参考
  if (ageMonths > ageMonthMax) return "overdue";
  if (ageMonths < ageMonthMin) return "upcoming";
  // 在窗口内:距窗口末 ≤1 月即"尽快约"(设计稿:(max-age)≤1→closing;月龄取整,给足 1 月提前量"别漏别晚")
  return ageMonthMax - ageMonths <= CLOSING_MONTHS ? "closing" : "due";
}

// 区域叠加。`region` 传 "national" 表示"未选省"——只显示 national 苗(一类 + 全国二类);
// 传某省码则叠加 national + 该省 provincial,过滤掉别省。national 苗永远显示。
export function vaccineDosesForRegion<T extends { region: RegionCode }>(doses: T[], region: RegionCode): T[] {
  return doses.filter((d) => d.region === "national" || d.region === region);
}

// 「本阶段待安排」计数:due + closing + overdue。
export function pendingCount(statuses: DoseStatus[]): number {
  return statuses.filter((s) => s === "due" || s === "closing" || s === "overdue").length;
}

// 入口角标用:按 profile 直接算「本阶段待安排」针数(纯函数,可 node 测)。
// 复用区域叠加 + 5 态判定,让记录页入口不打开清单也能给"别漏别晚"的轻提醒。
export function pendingCountForProfile(input: {
  doses: VaccineDose[];
  region: RegionCode;
  ageMonths: number | null;
  doneDoseIds: Set<string>;
}): number {
  const { doses, region, ageMonths, doneDoseIds } = input;
  const statuses = vaccineDosesForRegion(doses, region).map((dose) =>
    computeDoseStatus({
      ageMonths,
      ageMonthMin: dose.ageMonthMin,
      ageMonthMax: dose.ageMonthMax,
      doneDate: doneDoseIds.has(dose.id) ? "done" : null,
    }),
  );
  return pendingCount(statuses);
}
