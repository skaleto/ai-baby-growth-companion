// 账本(记账/支出)功能的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 ledger 一族的 state / refs / memo / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。
//
// 调用约定(Option B):App.tsx 在 `canCaregive` 之后「提前」调用本 hook,并把返回值
// 解构回与原来同名的局部变量,因此 App.tsx 里其余引用一律照常编译。`persistRecord` /
// `deleteAppRecord` 在 App.tsx 里定义得比调用点晚,故通过 `mutatorsRef` 注入(沿用
// App.tsx 既有的 `...Ref.current` 间接模式);App 在 `deleteAppRecord` 定义之后每次渲染
// 都无条件刷新该 ref。`setStorageStatus` 定义得早,直接按值传入。
//
// `createExpenseDraft` / `expenseDraftFromExpense` / `expenseFromDraft` / `ExpenseDraft`
// 原本是 App.tsx 的模块内私有定义,且仍被留在 App.tsx 的代码(pending-effect 草稿、
// useState 初值等)引用;因为不能从组件文件反向 import(会成环),这里把它们一并搬入并
// 导出,App.tsx 改为从本模块 import 回去。
import {
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { EXPENSE_CATEGORIES, type LedgerView as LedgerViewId } from "../../appOptions";
import { makeId, todayISO } from "../../data";
import { normalizeExpenseItem } from "../../appStateDomain";
import { appAlert, appConfirm } from "../../components/appDialogs";
import {
  expenseMonthKey,
  expenseYearKey,
  formatMoney,
  groupExpensesByMonth,
  sumExpenses,
} from "../../utils/expense";
import { type AppStateCollection, type AppStateResponse } from "../../appStateApi";
import type { ExpenseCategory, ExpenseItem } from "../../types";

export type ExpenseDraft = {
  title: string;
  amount: string;
  category: ExpenseCategory;
  date: string;
  quantity: string;
  unitPrice: string;
  merchant: string;
  note: string;
  brand: string;
  spec: string;
  source: ExpenseItem["source"];
};

export function createExpenseDraft(baseDate = todayISO()): ExpenseDraft {
  return {
    title: "",
    amount: "",
    category: "other",
    date: baseDate,
    quantity: "",
    unitPrice: "",
    merchant: "",
    note: "",
    brand: "",
    spec: "",
    source: "manual",
  };
}

export function expenseDraftFromExpense(expense: ExpenseItem): ExpenseDraft {
  return {
    title: expense.title,
    amount: expense.amount ? String(expense.amount) : "",
    category: expense.category,
    date: expense.date,
    quantity: expense.quantity ? String(expense.quantity) : "",
    unitPrice: expense.unitPrice ? String(expense.unitPrice) : "",
    merchant: expense.merchant ?? "",
    note: expense.note ?? "",
    brand: expense.brand ?? "",
    spec: expense.spec ?? "",
    source: expense.source,
  };
}

export function expenseFromDraft(draft: ExpenseDraft, existing?: ExpenseItem): ExpenseItem {
  const now = new Date().toISOString();
  const amount = Number(draft.amount);
  const quantity = draft.quantity ? Number(draft.quantity) : undefined;
  const unitPrice = draft.unitPrice ? Number(draft.unitPrice) : undefined;
  return normalizeExpenseItem(
    {
      id: existing?.id ?? makeId("expense"),
      title: draft.title.trim() || "小宝支出",
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
      currency: "CNY",
      category: draft.category,
      date: draft.date || todayISO(),
      quantity: quantity && Number.isFinite(quantity) ? quantity : undefined,
      unitPrice: unitPrice && Number.isFinite(unitPrice) ? Math.round(unitPrice * 100) / 100 : undefined,
      merchant: draft.merchant.trim() || undefined,
      note: draft.note.trim() || undefined,
      brand: draft.brand.trim() || undefined,
      spec: draft.spec.trim() || undefined,
      attachmentIds: existing?.attachmentIds ?? [],
      attachments: existing?.attachments,
      source: draft.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      recordedBy: existing?.recordedBy,
      createdByUserId: existing?.createdByUserId,
    },
    0,
  );
}

// App.tsx 里 persistRecord / deleteAppRecord 的精确签名,经 mutatorsRef 注入。
export type LedgerMutators = {
  persistRecord: <T,>(
    collection: AppStateCollection,
    id: string,
    item: T,
    options?: { applyResponse?: boolean; mode?: "merge" | "replace" },
  ) => Promise<AppStateResponse>;
  deleteAppRecord: (collection: AppStateCollection, id: string) => Promise<AppStateResponse>;
};

export type UseLedgerStateDeps = {
  expenses: ExpenseItem[];
  setExpenses: (action: SetStateAction<ExpenseItem[]>) => void;
  canCaregive: boolean;
  todayDate: string;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  mutatorsRef: MutableRefObject<LedgerMutators>;
};

export function useLedgerState({
  expenses,
  setExpenses,
  canCaregive,
  todayDate,
  setStorageStatus,
  mutatorsRef,
}: UseLedgerStateDeps) {
  const [ledgerView, setLedgerView] = useState<LedgerViewId>("month");
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => createExpenseDraft());
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseItem | null>(null);
  const [expenseBulkMode, setExpenseBulkMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(() => new Set());
  const [collapsedExpenseMonths, setCollapsedExpenseMonths] = useState<Set<string>>(() => new Set());
  const [bulkDeleteExpensesOpen, setBulkDeleteExpensesOpen] = useState(false);

  const expenseEditorBodyRef = useRef<HTMLDivElement>(null);
  const expenseOptionalPanelRef = useRef<HTMLDetailsElement>(null);

  const settleExpenseOptionalPanel = useCallback(() => {
    const body = expenseEditorBodyRef.current;
    const panel = expenseOptionalPanelRef.current;
    if (!body || !panel || !panel.open) return;
    const target = panel.querySelector("textarea") ?? panel;
    const alignTarget = () => {
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const safeBottom = bodyRect.bottom - 22;
      const safeTop = bodyRect.top + 12;
      if (targetRect.bottom > safeBottom) {
        body.scrollTop += targetRect.bottom - safeBottom;
      } else if (targetRect.top < safeTop) {
        body.scrollTop -= safeTop - targetRect.top;
      }
    };
    window.requestAnimationFrame(alignTarget);
    window.setTimeout(alignTarget, 90);
    window.setTimeout(alignTarget, 240);
  }, []);

  const ledgerMonthKey = todayDate.slice(0, 7);
  const ledgerYearKey = todayDate.slice(0, 4);
  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => `${right.date}-${right.updatedAt}`.localeCompare(`${left.date}-${left.updatedAt}`)),
    [expenses],
  );
  const expenseMonthGroups = useMemo(() => groupExpensesByMonth(sortedExpenses), [sortedExpenses]);
  const monthExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expenseMonthKey(expense.date) === ledgerMonthKey),
    [sortedExpenses, ledgerMonthKey],
  );
  const yearExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expenseYearKey(expense.date) === ledgerYearKey),
    [sortedExpenses, ledgerYearKey],
  );
  const ledgerStats = useMemo(() => {
    const categoryTotals = EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: sumExpenses(monthExpenses.filter((expense) => expense.category === category.id)),
    })).filter((item) => item.total > 0);
    const maxCategoryTotal = Math.max(1, ...categoryTotals.map((item) => item.total));
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
      const month = `${ledgerYearKey}-${String(index + 1).padStart(2, "0")}`;
      return {
        month,
        label: `${index + 1}月`,
        total: sumExpenses(yearExpenses.filter((expense) => expenseMonthKey(expense.date) === month)),
      };
    });
    const maxMonthlyTotal = Math.max(1, ...monthlyTotals.map((item) => item.total));
    return {
      monthTotal: sumExpenses(monthExpenses),
      yearTotal: sumExpenses(yearExpenses),
      categoryTotals,
      maxCategoryTotal,
      monthlyTotals,
      maxMonthlyTotal,
      largest: monthExpenses.slice().sort((left, right) => right.amount - left.amount).slice(0, 3),
    };
  }, [ledgerYearKey, monthExpenses, yearExpenses]);

  // 仅 saveExpenseDraft 使用,保持私有(不返回)。
  const expenseForStorage = (expense: ExpenseItem): ExpenseItem => ({
    ...(({ attachments: _attachments, recordedBy: _recordedBy, createdByUserId: _createdByUserId, ...rest }) => rest)(expense),
  });

  const openNewExpenseEditor = () => {
    if (!canCaregive) return;
    setEditingExpenseId("");
    setExpenseDraft(createExpenseDraft(todayDate));
    setExpenseEditorOpen(true);
  };

  const openEditExpenseEditor = (expense: ExpenseItem) => {
    if (!canCaregive) return;
    setEditingExpenseId(expense.id);
    setExpenseDraft(expenseDraftFromExpense(expense));
    setExpenseEditorOpen(true);
  };

  const closeExpenseEditor = () => {
    setExpenseEditorOpen(false);
    setEditingExpenseId("");
    setExpenseDraft(createExpenseDraft(todayDate));
  };

  const saveExpenseDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const amount = Number(expenseDraft.amount);
    if (!expenseDraft.title.trim()) {
      void appAlert("请填写商品名或用途。");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      void appAlert("请填写实际支付金额。");
      return;
    }
    const existing = editingExpenseId ? expenses.find((item) => item.id === editingExpenseId) : undefined;
    if (existing) {
      const delta = Math.abs(amount - existing.amount);
      const needsConfirm = amount >= 1000 || (existing.amount > 0 && delta / existing.amount >= 0.5 && delta >= 100);
      if (needsConfirm && !(await appConfirm({ title: "确认金额", content: `确认把「${existing.title}」的金额改为 ${formatMoney(amount)} 吗？` }))) return;
    }
    const nextExpense = expenseFromDraft(expenseDraft, existing);
    setExpenses((current) => {
      const withoutCurrent = current.filter((item) => item.id !== nextExpense.id);
      return [nextExpense, ...withoutCurrent].sort((left, right) =>
        `${right.date}-${right.updatedAt}`.localeCompare(`${left.date}-${left.updatedAt}`),
      );
    });
    try {
      await mutatorsRef.current.persistRecord("expenses", nextExpense.id, expenseForStorage(nextExpense), { applyResponse: true, mode: "replace" });
      closeExpenseEditor();
    } catch {
      setStorageStatus("offline");
      closeExpenseEditor();
    }
  };

  const requestDeleteExpense = (expense: ExpenseItem) => {
    if (!canCaregive) return;
    setDeleteExpenseTarget(expense);
  };

  const closeDeleteExpenseConfirm = () => {
    setDeleteExpenseTarget(null);
  };

  const confirmDeleteExpense = async () => {
    if (!canCaregive || !deleteExpenseTarget) return;
    const target = deleteExpenseTarget;
    setDeleteExpenseTarget(null);
    setExpenses((current) => current.filter((item) => item.id !== target.id));
    try {
      await mutatorsRef.current.deleteAppRecord("expenses", target.id);
    } catch {
      setStorageStatus("offline");
    }
  };

  const exitExpenseBulkMode = useCallback(() => {
    setExpenseBulkMode(false);
    setSelectedExpenseIds(new Set());
  }, []);

  const toggleExpenseBulkMode = useCallback(() => {
    setExpenseBulkMode((current) => {
      if (current) setSelectedExpenseIds(new Set());
      return !current;
    });
  }, []);

  const toggleExpenseSelection = useCallback((id: string) => {
    setSelectedExpenseIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpenseMonthCollapse = useCallback((monthKey: string) => {
    setCollapsedExpenseMonths((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const requestBulkDeleteExpenses = useCallback(() => {
    if (!canCaregive || selectedExpenseIds.size === 0) return;
    setBulkDeleteExpensesOpen(true);
  }, [canCaregive, selectedExpenseIds]);

  const closeBulkDeleteExpenses = useCallback(() => {
    setBulkDeleteExpensesOpen(false);
  }, []);

  const confirmBulkDeleteExpenses = useCallback(async () => {
    if (!canCaregive || selectedExpenseIds.size === 0) return;
    const targets = Array.from(selectedExpenseIds);
    setBulkDeleteExpensesOpen(false);
    setExpenses((current) => current.filter((item) => !selectedExpenseIds.has(item.id)));
    setSelectedExpenseIds(new Set());
    setExpenseBulkMode(false);
    for (const id of targets) {
      try {
        await mutatorsRef.current.deleteAppRecord("expenses", id);
      } catch {
        setStorageStatus("offline");
      }
    }
  }, [canCaregive, selectedExpenseIds]);

  return {
    ledgerView,
    setLedgerView,
    expenseEditorOpen,
    setExpenseEditorOpen,
    editingExpenseId,
    setEditingExpenseId,
    expenseDraft,
    setExpenseDraft,
    deleteExpenseTarget,
    setDeleteExpenseTarget,
    expenseBulkMode,
    setExpenseBulkMode,
    selectedExpenseIds,
    setSelectedExpenseIds,
    collapsedExpenseMonths,
    setCollapsedExpenseMonths,
    bulkDeleteExpensesOpen,
    setBulkDeleteExpensesOpen,
    expenseEditorBodyRef,
    expenseOptionalPanelRef,
    settleExpenseOptionalPanel,
    ledgerMonthKey,
    ledgerYearKey,
    sortedExpenses,
    expenseMonthGroups,
    monthExpenses,
    yearExpenses,
    ledgerStats,
    openNewExpenseEditor,
    openEditExpenseEditor,
    closeExpenseEditor,
    saveExpenseDraft,
    requestDeleteExpense,
    closeDeleteExpenseConfirm,
    confirmDeleteExpense,
    exitExpenseBulkMode,
    toggleExpenseBulkMode,
    toggleExpenseSelection,
    toggleExpenseMonthCollapse,
    requestBulkDeleteExpenses,
    closeBulkDeleteExpenses,
    confirmBulkDeleteExpenses,
  };
}
