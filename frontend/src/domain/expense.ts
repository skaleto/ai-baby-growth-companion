// 领域拆分 P7:从 appStateDomain 抽出的「支出记账」归一化。
// 纯模块红线:不 import 宿主 API;依赖 coerce/media 与外部 data/appOptions,不反向依赖上层聚合模块。
import { makeId, todayISO } from "../data";
import { EXPENSE_CATEGORY_IDS } from "../appOptions";
import type { ExpenseCategory, ExpenseItem } from "../types";
import { numberValue, stringList, stringMember, textValue } from "./coerce";
import { normalizeAttachment, normalizeRecordedBy } from "./media";

export const normalizeExpenseCategory = (value: unknown): ExpenseCategory =>
  stringMember(EXPENSE_CATEGORY_IDS, value) ? value : "other";

export const normalizeExpenseItem = (value: Partial<ExpenseItem> | null | undefined, index: number): ExpenseItem => {
  const now = new Date().toISOString();
  const amount = numberValue(value?.amount) ?? 0;
  return {
    id: textValue(value?.id, makeId("expense")),
    title: textValue(value?.title, "小宝支出"),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: textValue(value?.currency, "CNY"),
    category: normalizeExpenseCategory(value?.category),
    date: textValue(value?.date, todayISO()),
    quantity: numberValue(value?.quantity),
    unitPrice: numberValue(value?.unitPrice),
    merchant: textValue(value?.merchant) || undefined,
    note: textValue(value?.note) || undefined,
    brand: textValue(value?.brand) || undefined,
    spec: textValue(value?.spec) || undefined,
    attachmentIds: stringList(value?.attachmentIds),
    attachments: Array.isArray(value?.attachments)
      ? value.attachments.map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
      : undefined,
    source: value?.source === "agent" ? "agent" : "manual",
    createdAt: textValue(value?.createdAt, now),
    updatedAt: textValue(value?.updatedAt, now),
    recordedBy: normalizeRecordedBy(value?.recordedBy),
    createdByUserId: textValue(value?.createdByUserId) || undefined,
  };
};
