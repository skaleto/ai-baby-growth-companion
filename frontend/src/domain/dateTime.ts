// 领域拆分 P7:从 appStateDomain 抽出的「日期/时间」纯函数簇——中文口语时间解析、本地日期键、日历/年龄格式化。
// 纯模块红线:除 Date/Intl/正则外不 import 宿主 API;不依赖任何 normalize* 领域模型,故位于依赖图底层,可被 reminder/care/profile 直接复用。

export const normalizeClockText = (value: unknown, referenceDate = new Date()) => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const match = raw.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:点\s*(半|\d{1,2}|[一二两三四五六七八九十]{1,3})?|[:：]\s*(\d{1,2}))/);
  if (!match) return undefined;
  const period = match[1] ?? "";
  const parsedHour = parseLooseNumber(match[2]);
  if (parsedHour === undefined) return undefined;
  let hour = parsedHour;
  const minuteText = match[3] ?? match[4];
  const parsedMinute = minuteText === "半" ? 30 : parseLooseNumber(minuteText ?? "0");
  if (parsedMinute === undefined) return undefined;
  const minute = parsedMinute;
  if ((period === "下午" || period === "晚上") && hour < 12) hour += 12;
  if (period === "中午" && hour < 11) hour += 12;
  if (period === "凌晨" && hour === 12) hour = 0;
  if (!period && hour >= 1 && hour <= 12) {
    hour = inferAmbiguousHourForToday(hour, minute, referenceDate);
  }
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return undefined;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const inferAmbiguousHourForToday = (hour: number, minute: number, referenceDate: Date) => {
  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  if (hour === 12) {
    const midnightMinutes = minute;
    const noonMinutes = 12 * 60 + minute;
    if (noonMinutes <= nowMinutes) return 12;
    if (midnightMinutes <= nowMinutes) return 0;
    return 0;
  }
  const morningMinutes = hour * 60 + minute;
  const afternoonMinutes = (hour + 12) * 60 + minute;
  if (afternoonMinutes <= nowMinutes) return hour + 12;
  if (morningMinutes <= nowMinutes) return hour;
  return hour;
};

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const localTimeKey = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const reminderTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

export const chineseNumberMap: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

export const parseLooseNumber = (value: string | undefined) => {
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === "十") return 10;
  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const left = value.slice(0, tenIndex);
    const right = value.slice(tenIndex + 1);
    const tens = left ? chineseNumberMap[left] : 1;
    const ones = right ? chineseNumberMap[right] : 0;
    return tens !== undefined && ones !== undefined ? tens * 10 + ones : undefined;
  }
  return chineseNumberMap[value];
};

export const dateFromLocalParts = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

export const setClockOnDate = (date: Date, clockText: string) => {
  const [hour, minute] = clockText.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

export const parseWeekdayIndex = (value: string) => {
  if (value === "一" || value === "1") return 1;
  if (value === "二" || value === "2") return 2;
  if (value === "三" || value === "3") return 3;
  if (value === "四" || value === "4") return 4;
  if (value === "五" || value === "5") return 5;
  if (value === "六" || value === "6") return 6;
  return 0;
};

export const safeDate = (value: string, dateOnly = false) => {
  if (!value) return null;
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatZhDate = (value: string, options: Intl.DateTimeFormatOptions, fallback: string, dateOnly = false) => {
  const date = safeDate(value, dateOnly);
  return date ? new Intl.DateTimeFormat("zh-CN", options).format(date) : fallback;
};

export const formatTime = (value: string) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date) : "--:--";
};

export const formatDate = (value: string) => formatZhDate(value, { month: "short", day: "numeric" }, "待设置");

export const formatFullDate = (value: string) =>
  formatZhDate(value, { year: "numeric", month: "long", day: "numeric", weekday: "short" }, "待设置", true);

export const formatExpenseDateLabel = (value: string) =>
  formatZhDate(value, { year: "numeric", month: "long", day: "numeric" }, "选择日期", true);

export const monthTitle = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${value}-01T00:00:00`));

export const ageLabel = (birthDate: string) => {
  const start = safeDate(birthDate, true);
  if (!start) return "待设置生日";
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const months = Math.floor(days / 30);
  return months > 0 ? `${months}个月${days % 30}天` : `${days}天`;
};

export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDays = (date: string, offset: number) => {
  const source = safeDate(date, true) ?? new Date();
  return toISODate(new Date(source.getFullYear(), source.getMonth(), source.getDate() + offset));
};

export const addMonths = (month: string, offset: number) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return toISODate(new Date(year, monthIndex - 1 + offset, 1)).slice(0, 7);
};

export const calendarDatesForMonth = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1).getDay();
  const totalDays = new Date(year, monthIndex, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => ""),
    ...Array.from({ length: totalDays }, (_, index) => `${month}-${`${index + 1}`.padStart(2, "0")}`),
  ];
};

export const currentClockText = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};
