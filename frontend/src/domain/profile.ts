// 领域拆分 P7:从 appStateDomain 抽出的「宝宝档案」归一化 + 派生(年龄标签/Agent 上下文)。
// 纯模块红线:不 import 宿主 API;babyProfileForAgent/ageLabel 走 dateTime 的 safeDate,不反向依赖上层聚合模块。
import type { AgentBabyProfileContext, BabyProfile } from "../types";
import { stringList, textValue, vaccineRecordList } from "./coerce";
import { safeDate } from "./dateTime";

export const blankProfile: BabyProfile = {
  nickname: "",
  stage: "born",
  gender: "unknown",
  expectedDate: "",
  birthDate: "",
  region: "",
  feeding: "",
  allergies: [],
  caregivers: [],
};

export const hasCompleteProfile = (profile?: Partial<BabyProfile> | null) =>
  Boolean(profile?.nickname?.trim() && (profile.birthDate?.trim() || profile.expectedDate?.trim()));

export const suggestedFamilyName = (nickname: string) => `${nickname.trim() || "小宝"}家`;

const numericOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

export const normalizeBabyProfile = (value: Partial<BabyProfile> | null | undefined): BabyProfile => ({
  nickname: textValue(value?.nickname),
  stage: value?.stage === "pregnancy" ? "pregnancy" : "born",
  gender: value?.gender === "boy" || value?.gender === "girl" ? value.gender : "unknown",
  expectedDate: textValue(value?.expectedDate),
  birthDate: textValue(value?.birthDate),
  region: textValue(value?.region),
  feeding: textValue(value?.feeding),
  birthWeight: numericOrUndefined(value?.birthWeight),
  birthHeight: numericOrUndefined(value?.birthHeight),
  allergies: stringList(value?.allergies),
  caregivers: stringList(value?.caregivers),
  vaccineRegion: textValue(value?.vaccineRegion) || undefined, // 空串/缺省=未选省→后续默认 national
  vaccineRecords: vaccineRecordList(value?.vaccineRecords),
});

export const displayProfileValue = (value: string, fallback = "暂未设置") => value.trim() || fallback;

export const babyProfileForAgent = (profile: BabyProfile): AgentBabyProfileContext => {
  if (profile.stage === "pregnancy") {
    return {
      ...profile,
      ageLabel: profile.expectedDate ? `孕期，预产期 ${profile.expectedDate}` : "孕期，预产期待设置",
    };
  }

  const birthDate = safeDate(profile.birthDate, true);
  if (!birthDate) {
    return { ...profile, ageLabel: "已出生，生日待设置" };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ageDays = Math.max(0, Math.floor((today.getTime() - birthDate.getTime()) / 86400000));
  const ageWeeks = Math.floor(ageDays / 7);
  const ageMonths = Math.floor(ageDays / 30);
  const daysUntilFullMonth = Math.max(0, 30 - ageDays);
  const fullMonth = ageDays >= 30;
  const label = fullMonth
    ? `出生${ageDays}天，约${ageMonths}个月${ageDays % 30}天`
    : `出生${ageDays}天，未满月，还差${daysUntilFullMonth}天满30天`;

  return {
    ...profile,
    ageDays,
    ageWeeks,
    ageMonths,
    ageLabel: label,
    fullMonth,
    daysUntilFullMonth,
  };
};

export const stageLabel = (stage: BabyProfile["stage"]) => (stage === "pregnancy" ? "孕期" : "已出生");
