// 领域拆分 P7:从 appStateDomain 抽出的「成长事件/体格测量」归一化。
// 纯模块红线:不 import 宿主 API;依赖 coerce/media 与外部 data,不反向依赖上层聚合模块(misc)。
import { todayISO } from "../data";
import type { GrowthEvent, GrowthMeasurement } from "../types";
import { numberValue, stringList, textValue } from "./coerce";
import { normalizeRecordedBy } from "./media";

export const normalizeGrowthEvent = (value: Partial<GrowthEvent> | null | undefined, index: number): GrowthEvent => ({
  id: textValue(value?.id, `growth-${index}`),
  type: textValue(value?.type, "daily_growth"),
  title: textValue(value?.title, "成长记录"),
  date: textValue(value?.date, todayISO()),
  summary: textValue(value?.summary),
  firstTime: Boolean(value?.firstTime),
  mediaKind: value?.mediaKind,
  tags: stringList(value?.tags),
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});

export const normalizeGrowthMeasurement = (
  value: Partial<GrowthMeasurement> | null | undefined,
  index: number,
): GrowthMeasurement => ({
  id: textValue(value?.id, `growth-measurement-${index}`),
  type:
    value?.type === "weight" || value?.type === "headCircumference" ? value.type : "height",
  value: typeof value?.value === "number" && Number.isFinite(value.value) ? value.value : 0,
  date: textValue(value?.date, todayISO()),
  note: textValue(value?.note) || undefined,
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});
