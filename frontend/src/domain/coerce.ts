// 领域拆分 P7:从 appStateDomain 抽出的「类型强制/取值」共享原语——所有 normalize* 的地基。
// 纯模块红线:不 import React/window 之外的宿主 API,只做纯值转换,便于被任意子模块直接复用。
import type { SetStateAction } from "react";

export const textValue = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

export const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

export const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export const vaccineRecordList = (value: unknown): { doseId: string; date: string }[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is { doseId: string; date: string } =>
          !!item &&
          typeof (item as { doseId?: unknown }).doseId === "string" &&
          typeof (item as { date?: unknown }).date === "string",
      )
    : [];

export const stringMember = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && values.includes(value as T);

export const uniqueTexts = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

export const resolveStateAction = <T,>(action: SetStateAction<T>, current: T): T =>
  typeof action === "function" ? (action as (current: T) => T)(current) : action;

export const splitListText = (value: string) =>
  value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
