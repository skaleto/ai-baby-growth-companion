// 待确认副作用(pending-effects)与相册提示(album-prompt)的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 pending-effect / album-prompt 一族的 state 与处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。
//
// 调用约定(Option B,沿用 useRecordsState):App.tsx 在 `canCaregive` 之后「提前」调用本 hook,
// 并把返回值解构回与原来同名的局部变量,因此 App.tsx 里其余引用(chatScreenHandlers 包 /
// RecordsEntryDrawer props / JSX props)一律照常编译。
//
// 依赖注入:
//  - 早于调用点存在的依赖按值传入:messages / setMessages / setAlbumItems / setPendingEffects /
//    careLogs / canCaregive / setStorageStatus / pendingPersistAlbumIdsRef。以及两个 App 模块级
//    纯函数 reminderFromDraft / scheduleNativeReminders(它们定义在 App 组件之上、调用点之前,
//    可直接按值传入;因它们同时被留在 App 的代码复用,不能反向 import App,故经参数传入)。
//  - 定义在 hook 调用点之后的依赖(persistRecord / applyAppSnapshot / persistAlbumItemOptimistic /
//    showSystemWeakNotice / messageForStorage)经 `lateRef` 迟绑定注入(沿用 records 的
//    recordsLateRef 模式);App 在它们都就绪后每次渲染无条件刷新该 ref。
//
// 纯 draft/effect 构造器(pendingDraftFromEffect / growthEventFromPendingDraft / ... /
// expensesFromPendingDraft)只被本 hook 的处理函数使用,故随迁进本文件(其叶子依赖
// reminderDraftFromReminder / expenseDraftFromExpense / expenseFromDraft / splitListText /
// normalizeGrowthEvent / normalizeGrowthMeasurement 都在各自真实模块里,直接 import;
// reminderFromDraft 因也被留在 App 的代码复用,经参数注入)。
//
// `PendingEffectDraft` / `PendingGrowthDraft` / `PendingCareDraft` / `PendingGrowthMeasurementDraft`
// 是 App.tsx 内定义并导出的本地类型,本 hook 仅做「类型」import(编译期擦除,不形成运行时循环依赖)。
import { type MutableRefObject, type SetStateAction, useState } from "react";
import { todayISO } from "../../data";
import { normalizeGrowthEvent, normalizeGrowthMeasurement, splitListText } from "../../appStateDomain";
import { albumItemFromDecision, dedupeAlbumItems } from "../../albumDomain";
import {
  confirmPendingEffectOnServer,
  discardPendingEffectOnServer,
  type AppStateResponse,
} from "../../appStateApi";
import { hapticSuccess } from "../../haptics";
import { appAlert } from "../../components/appDialogs";
import { reminderDraftFromReminder, type ReminderDraft } from "../../reminderDraft";
import { expenseDraftFromExpense, expenseFromDraft, type ExpenseDraft } from "../ledger/useLedgerState";
import type {
  AlbumItem,
  AlbumPrompt,
  AppStateSnapshot,
  CareLog,
  ChatMessage,
  ExpenseItem,
  PendingEffect,
  Reminder,
} from "../../types";
import type {
  PendingCareDraft,
  PendingEffectDraft,
  PendingGrowthDraft,
  PendingGrowthMeasurementDraft,
} from "../../appContracts";

// App.tsx 里 persistRecord 的精确签名(pending-effect / message 持久化用),经 lateRef 注入。
type PersistRecord = <T,>(
  collection: import("../../appStateApi").AppStateCollection,
  id: string,
  item: T,
  options?: { applyResponse?: boolean; mode?: "merge" | "replace" },
) => Promise<AppStateResponse>;

// applyAppSnapshot / persistAlbumItemOptimistic / showSystemWeakNotice / messageForStorage
// 都在 hook 调用点之后才定义,经此迟绑定 ref 注入。
export type PendingEffectsLateDeps = {
  persistRecord: PersistRecord;
  applyAppSnapshot: (state: Partial<AppStateSnapshot>) => void;
  persistAlbumItemOptimistic: (item: AlbumItem) => Promise<AppStateResponse>;
  showSystemWeakNotice: (
    message: string,
    tone?: "info" | "success" | "warning",
    durationMs?: number,
  ) => void;
  messageForStorage: (message: ChatMessage) => ChatMessage;
};

export type UsePendingEffectsDeps = {
  canCaregive: boolean;
  messages: ChatMessage[];
  setMessages: (action: SetStateAction<ChatMessage[]>) => void;
  setAlbumItems: (action: SetStateAction<AlbumItem[]>) => void;
  setPendingEffects: (action: SetStateAction<PendingEffect[]>) => void;
  careLogs: CareLog[];
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  pendingPersistAlbumIdsRef: MutableRefObject<Set<string>>;
  // App 模块级纯函数;定义在组件之上、调用点之前,但也被留在 App 的代码复用,故经参数注入(不反向 import App)。
  reminderFromDraft: (draft: ReminderDraft, existing?: Reminder) => Reminder;
  scheduleNativeReminders: (
    newReminders: Reminder[],
    options?: { careLogs?: CareLog[]; anchorInterval?: boolean },
  ) => Promise<Reminder[]>;
  lateRef: MutableRefObject<PendingEffectsLateDeps>;
};

export function usePendingEffects({
  canCaregive,
  messages,
  setMessages,
  setAlbumItems,
  setPendingEffects,
  careLogs,
  setStorageStatus,
  pendingPersistAlbumIdsRef,
  reminderFromDraft,
  scheduleNativeReminders,
  lateRef,
}: UsePendingEffectsDeps) {
  const [editingPendingId, setEditingPendingId] = useState("");
  const [pendingDraft, setPendingDraft] = useState<PendingEffectDraft | null>(null);
  const [confirmingPendingEffectIds, setConfirmingPendingEffectIds] = useState<string[]>([]);

  const selectedDateFallback = (effect: PendingEffect) =>
    effect.createdAt ? effect.createdAt.slice(0, 10) : todayISO();

  const pendingExpenseDraftFromExpense = (expense: ExpenseItem): ExpenseDraft => expenseDraftFromExpense(expense);

  const pendingDraftFromEffect = (effect: PendingEffect): PendingEffectDraft => ({
    growthEvent: effect.growthEvent
      ? {
          title: effect.growthEvent.title ?? "",
          date: effect.growthEvent.date ?? todayISO(),
          summary: effect.growthEvent.summary ?? "",
        }
      : undefined,
    growthMeasurements: (effect.growthMeasurements ?? []).map((measurement) => ({
      id: measurement.id,
      type: measurement.type,
      value: measurement.value ? String(measurement.value) : "",
      date: measurement.date || selectedDateFallback(effect),
      note: measurement.note ?? "",
    })),
    careLogPatch: effect.careLogPatch
      ? {
          date: effect.careLogPatch.date ?? selectedDateFallback(effect),
          milkMl: effect.careLogPatch.milkMl ? String(effect.careLogPatch.milkMl) : "",
          milkTimes: effect.careLogPatch.milkTimes ? String(effect.careLogPatch.milkTimes) : "",
          sleepHours: effect.careLogPatch.sleepHours ? String(effect.careLogPatch.sleepHours) : "",
          wakes: effect.careLogPatch.wakes ? String(effect.careLogPatch.wakes) : "",
          poop: effect.careLogPatch.poop ?? "",
          temperature: effect.careLogPatch.temperature ? String(effect.careLogPatch.temperature) : "",
          notes: effect.careLogPatch.notes?.join("、") ?? "",
        }
      : undefined,
    reminders: (effect.reminders ?? []).map((reminder) => ({
      id: reminder.id,
      draft: reminderDraftFromReminder(reminder),
    })),
    memories: (effect.memories ?? []).map((memory) => ({
      id: memory.id,
      text: memory.text,
    })),
    expenses: (effect.expenses ?? []).map(pendingExpenseDraftFromExpense),
  });

  const growthEventFromPendingDraft = (effect: PendingEffect, draft: PendingGrowthDraft | undefined) =>
    effect.growthEvent && draft
      ? normalizeGrowthEvent({
          ...effect.growthEvent,
          title: draft.title.trim() || effect.growthEvent.title,
          date: draft.date || effect.growthEvent.date,
          summary: draft.summary.trim() || effect.growthEvent.summary,
        }, 0)
      : undefined;

  const growthMeasurementsFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
    (effect.growthMeasurements ?? []).map((measurement, index) => {
      const nextDraft = draft.growthMeasurements.find((item) => item.id === measurement.id);
      if (!nextDraft) return measurement;
      const numericValue = Number(nextDraft.value);
      return normalizeGrowthMeasurement({
        ...measurement,
        type: nextDraft.type,
        value: Number.isFinite(numericValue) ? numericValue : measurement.value,
        date: nextDraft.date || measurement.date,
        note: nextDraft.note.trim() || undefined,
      }, index);
    });

  const careLogPatchFromPendingDraft = (effect: PendingEffect, draft: PendingCareDraft | undefined): Partial<CareLog> | undefined =>
    effect.careLogPatch && draft
      ? {
          ...effect.careLogPatch,
          date: draft.date || effect.careLogPatch.date,
          milkMl: draft.milkMl ? Number(draft.milkMl) : undefined,
          milkTimes: draft.milkTimes ? Number(draft.milkTimes) : undefined,
          sleepHours: draft.sleepHours ? Number(draft.sleepHours) : undefined,
          wakes: draft.wakes ? Number(draft.wakes) : undefined,
          poop: draft.poop.trim() || undefined,
          temperature: draft.temperature ? Number(draft.temperature) : undefined,
          notes: splitListText(draft.notes),
        }
      : undefined;

  const remindersFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
    (effect.reminders ?? []).map((reminder) => {
      const nextDraft = draft.reminders.find((item) => item.id === reminder.id)?.draft;
      return nextDraft ? reminderFromDraft(nextDraft, reminder) : reminder;
    });

  const memoriesFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
    (effect.memories ?? []).map((memory) => {
      const nextDraft = draft.memories.find((item) => item.id === memory.id);
      return nextDraft ? { ...memory, text: nextDraft.text.trim() || memory.text } : memory;
    });

  const expensesFromPendingDraft = (effect: PendingEffect, draft: PendingEffectDraft) =>
    (effect.expenses ?? []).map((expense, index) => {
      const nextDraft = draft.expenses[index];
      return nextDraft ? expenseFromDraft(nextDraft, expense) : expense;
    });

  const updateAlbumPromptStatus = (messageId: string, promptId: string, status: AlbumPrompt["status"]) => {
    const nextMessages = messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            albumPrompts: (message.albumPrompts ?? []).map((prompt) =>
              prompt.id === promptId ? { ...prompt, status } : prompt,
            ),
          }
        : message,
    );
    const updatedMessage = nextMessages.find((message) => message.id === messageId);
    setMessages(nextMessages);
    if (updatedMessage) {
      void lateRef.current.persistRecord("messages", updatedMessage.id, lateRef.current.messageForStorage(updatedMessage)).catch(() => setStorageStatus("offline"));
    }
  };

  const saveAlbumPrompt = async (messageId: string, prompt: AlbumPrompt) => {
    if (!canCaregive) return;
    const sourceMessage = messages.find((message) => message.id === prompt.sourceMessageId);
    const attachment = sourceMessage?.attachments?.find((item) => item.id === prompt.attachmentId);
    if (!sourceMessage || !attachment) {
      updateAlbumPromptStatus(messageId, prompt.id, "ignored");
      return;
    }
    const albumItem = albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment);
    setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
    try {
      await lateRef.current.persistAlbumItemOptimistic(albumItem);
      updateAlbumPromptStatus(messageId, prompt.id, "saved");
      hapticSuccess();
    } catch (error) {
      // This manual save intentionally rolls back on failure (with a visible
      // notice), so drop the pending guard for the item we are removing.
      pendingPersistAlbumIdsRef.current.delete(albumItem.id);
      setAlbumItems((current) => current.filter((item) => item.id !== albumItem.id));
      setStorageStatus("offline");
      lateRef.current.showSystemWeakNotice(
        error instanceof Error ? `保存到相册失败：${error.message}` : "保存到相册失败，请稍后再试",
        "warning",
        3600,
      );
    }
  };

  const ignoreAlbumPrompt = (messageId: string, prompt: AlbumPrompt) => {
    updateAlbumPromptStatus(messageId, prompt.id, "ignored");
  };

  const confirmPendingEffect = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    if (confirmingPendingEffectIds.includes(effect.id)) return;
    setConfirmingPendingEffectIds((current) => (current.includes(effect.id) ? current : [...current, effect.id]));
    try {
      const response = await confirmPendingEffectOnServer(effect.id);
      lateRef.current.applyAppSnapshot(response.state);
      const reminders = effect.reminders ?? [];
      if (reminders.length) {
        const scheduledReminders = await scheduleNativeReminders(reminders, { careLogs });
        for (const reminder of scheduledReminders) {
          await lateRef.current.persistRecord("reminders", reminder.id, reminder, { applyResponse: true });
        }
      }
      setEditingPendingId("");
      setPendingDraft(null);
    } catch (error) {
      void appAlert(error instanceof Error ? error.message : "确认记录失败，请稍后再试。");
    } finally {
      setConfirmingPendingEffectIds((current) => current.filter((id) => id !== effect.id));
    }
  };

  const discardPendingEffect = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    try {
      const response = await discardPendingEffectOnServer(effect.id);
      lateRef.current.applyAppSnapshot(response.state);
      setEditingPendingId("");
      setPendingDraft(null);
    } catch (error) {
      void appAlert(error instanceof Error ? error.message : "丢弃记录失败，请稍后再试。");
    }
  };

  const beginEditPendingEffect = (effect: PendingEffect) => {
    if (!canCaregive) return;
    setEditingPendingId(effect.id);
    setPendingDraft(pendingDraftFromEffect(effect));
  };

  const savePendingEffectDraft = async (effect: PendingEffect) => {
    if (!canCaregive) return;
    if (!pendingDraft) {
      setEditingPendingId("");
      return;
    }
    const nextEffect: PendingEffect = {
      ...effect,
      growthEvent: growthEventFromPendingDraft(effect, pendingDraft.growthEvent),
      growthMeasurements: growthMeasurementsFromPendingDraft(effect, pendingDraft),
      careLogPatch: careLogPatchFromPendingDraft(effect, pendingDraft.careLogPatch),
      reminders: remindersFromPendingDraft(effect, pendingDraft),
      memories: memoriesFromPendingDraft(effect, pendingDraft),
      expenses: expensesFromPendingDraft(effect, pendingDraft),
    };
    setPendingEffects((current) =>
      current.map((item) => (item.id === effect.id ? nextEffect : item)),
    );
    try {
      await lateRef.current.persistRecord("pendingEffects", nextEffect.id, nextEffect);
      setEditingPendingId("");
      setPendingDraft(null);
    } catch {
      void appAlert("保存待确认内容失败，请稍后再试。");
    }
  };

  const updatePendingGrowthDraft = (patch: Partial<PendingGrowthDraft>) => {
    setPendingDraft((current) =>
      current?.growthEvent ? { ...current, growthEvent: { ...current.growthEvent, ...patch } } : current,
    );
  };

  const updatePendingGrowthMeasurementDraft = (id: string, patch: Partial<PendingGrowthMeasurementDraft>) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            growthMeasurements: current.growthMeasurements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          }
        : current,
    );
  };

  const updatePendingCareDraft = (patch: Partial<PendingCareDraft>) => {
    setPendingDraft((current) =>
      current?.careLogPatch ? { ...current, careLogPatch: { ...current.careLogPatch, ...patch } } : current,
    );
  };

  const updatePendingReminderDraft = (id: string, updater: (draft: ReminderDraft) => ReminderDraft) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            reminders: current.reminders.map((item) =>
              item.id === id ? { ...item, draft: updater(item.draft) } : item,
            ),
          }
        : current,
    );
  };

  const updatePendingMemoryDraft = (id: string, text: string) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            memories: current.memories.map((item) => (item.id === id ? { ...item, text } : item)),
          }
        : current,
    );
  };

  const updatePendingExpenseDraft = (index: number, patch: Partial<ExpenseDraft>) => {
    setPendingDraft((current) =>
      current
        ? {
            ...current,
            expenses: current.expenses.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
          }
        : current,
    );
  };

  return {
    editingPendingId,
    setEditingPendingId,
    pendingDraft,
    setPendingDraft,
    confirmingPendingEffectIds,
    setConfirmingPendingEffectIds,
    updateAlbumPromptStatus,
    saveAlbumPrompt,
    ignoreAlbumPrompt,
    confirmPendingEffect,
    discardPendingEffect,
    beginEditPendingEffect,
    savePendingEffectDraft,
    updatePendingGrowthDraft,
    updatePendingGrowthMeasurementDraft,
    updatePendingCareDraft,
    updatePendingReminderDraft,
    updatePendingMemoryDraft,
    updatePendingExpenseDraft,
  };
}
