import { EXPENSE_CATEGORIES } from "../appOptions";
import { todayISO } from "../data";
import type { ExpenseCategory, ExpenseItem } from "../types";

export const expenseCategoryLabel = (category: ExpenseCategory) =>
  EXPENSE_CATEGORIES.find((item) => item.id === category)?.label ?? "其他";

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount || 0);

export const formatMoneyCompact = (amount: number) => {
  const value = Number.isFinite(amount) ? Math.abs(amount) : 0;
  if (value === 0) return "0";
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  if (value >= 100) return `${Math.round(value)}`;
  return value.toFixed(value % 1 === 0 ? 0 : 1);
};

export const expenseMonthKey = (date: string) =>
  date && date.length >= 7 ? date.slice(0, 7) : todayISO().slice(0, 7);

export const expenseYearKey = (date: string) =>
  date && date.length >= 4 ? date.slice(0, 4) : todayISO().slice(0, 4);

export const sumExpenses = (items: ExpenseItem[]) =>
  items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);

export const expenseSourceLabel = (source: ExpenseItem["source"]) =>
  source === "agent" ? "AI" : "手动";

export const expenseMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return year && month ? `${year} 年 ${Number(month)} 月` : monthKey;
};

export type ExpenseMonthGroup = {
  monthKey: string;
  label: string;
  total: number;
  items: ExpenseItem[];
};

export const groupExpensesByMonth = (items: ExpenseItem[]): ExpenseMonthGroup[] => {
  const byMonth = new Map<string, ExpenseItem[]>();
  for (const item of items) {
    const key = expenseMonthKey(item.date);
    const bucket = byMonth.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byMonth.set(key, [item]);
    }
  }
  const groups: ExpenseMonthGroup[] = [];
  byMonth.forEach((monthItems, monthKey) => {
    groups.push({
      monthKey,
      label: expenseMonthLabel(monthKey),
      total: sumExpenses(monthItems),
      items: monthItems,
    });
  });
  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
};
