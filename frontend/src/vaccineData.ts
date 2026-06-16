// 疫苗数据层:启动拉 OSS vaccine-data.json → localStorage 缓存;离线/失败/首启回退内置兜底。
// 改数据 = 重传 OSS JSON(不发版)。
import { VACCINE_FALLBACK, type VaccineData } from "./data/vaccineSchedule.fallback";

const CACHE_KEY = "baby-companion-vaccine-data-v1";
const OSS_URL =
  (import.meta.env.VITE_VACCINE_DATA_URL as string | undefined) ||
  "https://ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com/baby-companion/data/vaccine-data.json";

const isVaccineData = (x: unknown): x is VaccineData =>
  !!x && typeof x === "object" &&
  typeof (x as VaccineData).version === "string" &&
  typeof (x as VaccineData).asOf === "string" &&
  Array.isArray((x as VaccineData).doses) &&
  Array.isArray((x as VaccineData).prices);

function readCache(): VaccineData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isVaccineData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 同步:先给缓存或兜底(供首帧),后台再拉新版更新缓存(下次进入生效)。
export function getVaccineDataSync(): VaccineData {
  return readCache() ?? VACCINE_FALLBACK;
}

// 后台刷新:拉 OSS,版本不同则写缓存。失败静默(继续用缓存/兜底)。
export async function refreshVaccineData(): Promise<void> {
  try {
    const res = await fetch(OSS_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    if (!isVaccineData(data)) return;
    const current = readCache();
    if (!current || current.version !== data.version) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    /* 离线/跨域/失败:保持缓存或兜底 */
  }
}
