// 领域拆分 P7:从 appStateDomain 抽出的「本地遗留缓存」读写——localStorage 遗留键的探测/清理/迁移标记。
// 说明:本模块允许触碰 window.localStorage(遗留数据迁移是它的本职);登录后后端数据仍是唯一权威。
import type { BabyProfile } from "../types";

export const LEGACY_STORAGE_KEYS = [
  "baby-companion-profile",
  "baby-companion-messages",
  "baby-companion-growth",
  "baby-companion-growth-measurements",
  "baby-companion-care",
  "baby-companion-reminders",
  "baby-companion-memories",
  "baby-companion-pending-effects",
  "baby-companion-album-items",
  "baby-companion-expenses",
  "baby-companion-conversation-summary",
];

export const LEGACY_IMPORT_MARKER_KEY = "baby-companion-legacy-imported";

export const readLocalJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const hasLocalArrayItems = (key: string) => {
  const value = readLocalJson(key);
  return Array.isArray(value) && value.length > 0;
};

export const hasLegacyLocalState = () => {
  try {
    if (window.localStorage.getItem(LEGACY_IMPORT_MARKER_KEY)) return false;
    const profile = readLocalJson("baby-companion-profile") as Partial<BabyProfile> | null;
    const hasProfile = Boolean(profile?.nickname?.trim() && (profile.birthDate?.trim() || profile.expectedDate?.trim()));
    return (
      hasProfile ||
      hasLocalArrayItems("baby-companion-messages") ||
      hasLocalArrayItems("baby-companion-growth") ||
      hasLocalArrayItems("baby-companion-growth-measurements") ||
      hasLocalArrayItems("baby-companion-care") ||
      hasLocalArrayItems("baby-companion-reminders") ||
      hasLocalArrayItems("baby-companion-memories") ||
      hasLocalArrayItems("baby-companion-pending-effects") ||
      hasLocalArrayItems("baby-companion-expenses")
    );
  } catch {
    return false;
  }
};

export const markLegacyImported = () => {
  try {
    window.localStorage.setItem(LEGACY_IMPORT_MARKER_KEY, "true");
  } catch {
    // Ignore storage failures; backend data remains authoritative after login.
  }
};

export const clearLocalAppState = () => {
  try {
    [...LEGACY_STORAGE_KEYS, "baby-companion-thinking-enabled", "baby-companion-model"].forEach((key) =>
      window.localStorage.removeItem(key),
    );
    markLegacyImported();
  } catch {
    // Ignore local storage failures.
  }
};
