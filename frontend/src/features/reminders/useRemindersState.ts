// 提醒(日程/循环提醒)管理界面的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 reminders 一族的 state / refs / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。系统本地通知的调度/取消必须与
// 从前完全一致地触发。
//
// 调用约定(Option B):App.tsx 在 `canCaregive` 之后「提前」调用本 hook,并把返回值
// 解构回与原来同名的局部变量,因此 App.tsx 里其余引用一律照常编译。`persistRecord` /
// `deleteAppRecord` 在 App.tsx 里定义得比调用点晚,故通过
// `mutatorsRef` 注入(沿用 App.tsx 既有的 `...Ref.current` 间接模式);App 在它们都就绪
// 之后每次渲染都无条件刷新该 ref。其余在调用点之前就存在的依赖(`canCaregive` /
// `careLogs` / `reminders` / `babyNickname` / `withBabyNickname` 以及 App 模块作用域里的
// 原生调度辅助函数 `scheduleNativeReminders` / `cancelNativeReminder` / `reminderFromDraft`
// / `addReminderHistory`)按值传入。
//
// 与 ledger 抽取的偏差:reminder 的草稿工厂(`createReminderDraft` 等)和类型本就独立放在
// `../../reminderDraft`,App 与本 hook 都从那里 import,不需要像 ledger 那样把它们搬进来;
// `completeReminder` 既被本 hook 的 `confirmCompleteReminder` 使用,也被仍留在 App 的
// 「响铃弹窗关闭」逻辑(`closeRingingReminder`)使用,故它留在本 hook 内并一并返回,供 App 调用。
// `ringingReminder` 响铃状态绑定在 App 内的音频副作用 / iOS 原生通知处理 / 响铃弹窗 JSX 上,
// 不属于本「提醒管理界面」一族,留在 App.tsx。
import {
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES, type MobileTab } from "../../appOptions";
import { formatReminderDueText, isIntervalReminder } from "../../appStateDomain";
import { appAlert } from "../../components/appDialogs";
import { formatIntervalText, reminderDate } from "../../utils/reminderLabels";
import { REMINDER_QUICK_ACTIONS } from "../../utils/reminderAssets";
import {
  createReminderDraft,
  dateFromReminderPostponeDraft,
  reminderDraftFromReminder,
  reminderPostponeDraftFromReminder,
  type ReminderDraft,
  type ReminderPostponeDraft,
} from "../../reminderDraft";
import { type AppStateCollection, type AppStateResponse } from "../../appStateApi";
import type { CareLog, Reminder } from "../../types";

// App.tsx 里 persistRecord / deleteAppRecord 的精确签名,统一经 mutatorsRef 注入。
export type RemindersMutators = {
  persistRecord: <T,>(
    collection: AppStateCollection,
    id: string,
    item: T,
    options?: { applyResponse?: boolean; mode?: "merge" | "replace" },
  ) => Promise<AppStateResponse>;
  deleteAppRecord: (collection: AppStateCollection, id: string) => Promise<AppStateResponse>;
};

export type UseRemindersStateDeps = {
  canCaregive: boolean;
  careLogs: CareLog[];
  reminders: Reminder[];
  setReminders: (action: SetStateAction<Reminder[]>) => void;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  babyNickname: string;
  withBabyNickname: (text: string) => string;
  setActiveMobileTab: (action: SetStateAction<MobileTab>) => void;
  scheduleNativeReminders: (
    newReminders: Reminder[],
    options?: { careLogs?: CareLog[]; anchorInterval?: boolean },
  ) => Promise<Reminder[]>;
  cancelNativeReminder: (reminder: Reminder) => Promise<void>;
  reminderFromDraft: (draft: ReminderDraft, existing?: Reminder) => Reminder;
  addReminderHistory: (reminder: Reminder, entry: string) => Reminder;
  mutatorsRef: MutableRefObject<RemindersMutators>;
};

export function useRemindersState({
  canCaregive,
  careLogs,
  reminders,
  setReminders,
  setStorageStatus,
  babyNickname,
  withBabyNickname,
  setActiveMobileTab,
  scheduleNativeReminders,
  cancelNativeReminder,
  reminderFromDraft,
  addReminderHistory,
  mutatorsRef,
}: UseRemindersStateDeps) {
  const [reminderManagementOpen, setReminderManagementOpen] = useState(false);
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState("");
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(() => createReminderDraft());
  const [completeReminderTarget, setCompleteReminderTarget] = useState<Reminder | null>(null);
  const [postponeReminderTarget, setPostponeReminderTarget] = useState<Reminder | null>(null);
  const [postponeReminderDraft, setPostponeReminderDraft] = useState<ReminderPostponeDraft>(() => reminderPostponeDraftFromReminder());
  const [deleteReminderTarget, setDeleteReminderTarget] = useState<Reminder | null>(null);

  const openNewReminderEditor = () => {
    if (!canCaregive) return;
    setEditingReminderId("");
    setReminderDraft(createReminderDraft());
    setReminderEditorOpen(true);
  };

  const openReminderQuickDraft = (action: (typeof REMINDER_QUICK_ACTIONS)[number]) => {
    if (!canCaregive) return;
    const draft = createReminderDraft();
    const nextDraft: ReminderDraft = {
      ...draft,
      title: withBabyNickname(action.prompt)
        .replace(/提醒我|帮我设置一个|：/g, "")
        .trim()
        .slice(0, 24) || action.label,
    };
    if (action.label === "疫苗") {
      nextDraft.title = `带${babyNickname}去社区医院打疫苗`;
      nextDraft.category = "vaccine";
    } else if (action.label === "体检") {
      nextDraft.title = `带${babyNickname}去做体检`;
      nextDraft.category = "routine";
    } else if (action.label === "洗澡") {
      nextDraft.title = `给${babyNickname}洗澡`;
      nextDraft.category = "care";
      nextDraft.dueTime = "20:00";
    } else if (action.label === "喂药") {
      nextDraft.title = `给${babyNickname}喂药`;
      nextDraft.category = "care";
    } else if (action.label === "复诊") {
      nextDraft.title = `带${babyNickname}去复诊`;
      nextDraft.category = "routine";
    } else if (action.label === "自定义") {
      nextDraft.title = "";
      nextDraft.category = "custom";
    }
    setEditingReminderId("");
    setReminderDraft(nextDraft);
    setReminderEditorOpen(true);
  };

  const openEditReminderEditor = (reminder: Reminder) => {
    if (!canCaregive) return;
    setEditingReminderId(reminder.id);
    setReminderDraft(reminderDraftFromReminder(reminder));
    setReminderEditorOpen(true);
  };

  const closeReminderEditor = () => {
    setReminderEditorOpen(false);
    setEditingReminderId("");
    setReminderDraft(createReminderDraft());
  };

  const saveReminderDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    if (reminderDraft.scheduleMode === "once" && (!reminderDraft.dueDate || !reminderDraft.dueTime)) {
      void appAlert("请选择提醒日期和时间。");
      return;
    }
    if (reminderDraft.scheduleMode === "interval") {
      const intervalMinutes = Number(reminderDraft.intervalMinutes);
      if (!Number.isFinite(intervalMinutes) || intervalMinutes < MIN_INTERVAL_MINUTES || intervalMinutes > MAX_INTERVAL_MINUTES) {
        void appAlert(`循环间隔需要在 ${formatIntervalText(MIN_INTERVAL_MINUTES)} 到 ${formatIntervalText(MAX_INTERVAL_MINUTES)} 之间。`);
        return;
      }
    }

    const existing = editingReminderId ? reminders.find((item) => item.id === editingReminderId) : undefined;
    if (existing) await cancelNativeReminder(existing);
    const baseReminder = reminderFromDraft(reminderDraft, existing);
    const [scheduledReminder] = await scheduleNativeReminders([baseReminder], { careLogs });
    const nextReminder = scheduledReminder ?? baseReminder;
    setReminders((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      byId.set(nextReminder.id, nextReminder);
      return Array.from(byId.values()).sort((left, right) => reminderDate(left).localeCompare(reminderDate(right)));
    });
    try {
      await mutatorsRef.current.persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true });
      closeReminderEditor();
    } catch {
      setStorageStatus("offline");
      closeReminderEditor();
    }
  };

  const completeReminder = async (target: Reminder) => {
    if (!canCaregive) return;
    await cancelNativeReminder(target);
    if (isIntervalReminder(target) && target.repeatRule) {
      const completedAt = new Date();
      const nextDueAt = new Date(completedAt.getTime() + target.repeatRule.intervalMinutes * 60 * 1000);
      const baseReminder: Reminder = addReminderHistory(
        {
          ...target,
          status: "open",
          dueAt: nextDueAt.toISOString(),
          dueText: formatReminderDueText(nextDueAt),
          lastAnchorEventId: target.lastAnchorEventId ?? undefined,
          lastAnchorAt: target.lastAnchorAt ?? completedAt.toISOString(),
          notificationStatus: "pending",
          notificationError: undefined,
        },
        `${new Intl.DateTimeFormat("zh-CN").format(completedAt)} 已完成本次，按完成时间顺延下一次`,
      );
      const [scheduledReminder] = await scheduleNativeReminders([baseReminder], { careLogs: [], anchorInterval: false });
      const nextReminder = scheduledReminder ?? baseReminder;
      setReminders((current) => current.map((item) => (item.id === target.id ? nextReminder : item)));
      void mutatorsRef.current.persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
      return;
    }
    const nextReminder: Reminder = {
      ...target,
      status: "done",
      notificationStatus: target.notificationStatus === "scheduled" ? "cancelled" : target.notificationStatus,
      history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 已完成`, ...target.history],
    };
    setReminders((current) =>
      current.map((item) => (item.id === target.id ? nextReminder : item)),
    );
    void mutatorsRef.current.persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
  };

  const requestCompleteReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setCompleteReminderTarget(target);
  };

  const closeCompleteReminderConfirm = () => {
    setCompleteReminderTarget(null);
  };

  const confirmCompleteReminder = async () => {
    if (!canCaregive || !completeReminderTarget) return;
    const target = completeReminderTarget;
    setCompleteReminderTarget(null);
    await completeReminder(target);
  };

  const requestPostponeReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setPostponeReminderDraft(reminderPostponeDraftFromReminder(target));
    setPostponeReminderTarget(target);
  };

  const closePostponeReminderConfirm = () => {
    setPostponeReminderTarget(null);
  };

  const postponeReminder = async (target: Reminder, postponedAt: Date) => {
    if (!canCaregive) return;
    await cancelNativeReminder(target);
    const baseReminder: Reminder = {
      ...target,
      status: "open",
      dueAt: postponedAt.toISOString(),
      dueText: formatReminderDueText(postponedAt),
      notificationStatus: "pending",
      notificationError: undefined,
      history: [`${new Intl.DateTimeFormat("zh-CN").format(new Date())} 延后到 ${formatReminderDueText(postponedAt)}`, ...target.history],
    };
    const [scheduledReminder] = await scheduleNativeReminders([baseReminder], {
      careLogs: target.scheduleMode === "interval" ? [] : careLogs,
      anchorInterval: target.scheduleMode !== "interval",
    });
    const nextReminder = scheduledReminder ?? baseReminder;
    setReminders((current) => current.map((item) => (item.id === target.id ? nextReminder : item)));
    void mutatorsRef.current.persistRecord("reminders", nextReminder.id, nextReminder, { applyResponse: true }).catch(() => undefined);
  };

  const confirmPostponeReminder = async () => {
    if (!canCaregive || !postponeReminderTarget) return;
    const postponedAt = dateFromReminderPostponeDraft(postponeReminderDraft);
    if (!postponedAt || postponedAt.getTime() <= Date.now()) {
      void appAlert("请选择晚于现在的提醒时间。");
      return;
    }
    const target = postponeReminderTarget;
    setPostponeReminderTarget(null);
    await postponeReminder(target, postponedAt);
  };

  const requestDeleteReminder = (target: Reminder) => {
    if (!canCaregive) return;
    setDeleteReminderTarget(target);
  };

  const closeDeleteReminderConfirm = () => {
    setDeleteReminderTarget(null);
  };

  const confirmDeleteReminder = async () => {
    if (!canCaregive || !deleteReminderTarget) return;
    const target = deleteReminderTarget;
    setDeleteReminderTarget(null);
    await cancelNativeReminder(target);
    setReminders((current) => current.filter((item) => item.id !== target.id));
    void mutatorsRef.current.deleteAppRecord("reminders", target.id).catch(() => setStorageStatus("offline"));
  };

  const openReminderManagement = useCallback(() => {
    setActiveMobileTab("profile");
    setReminderManagementOpen(true);
  }, []);
  const closeReminderManagement = useCallback(() => setReminderManagementOpen(false), []);

  // RemindersScreen(memo)的函数 props:同 albumScreenHandlers 的 ref 间接模式,引用永远稳定。
  const remindersHandlersRef = useRef({
    closeReminderManagement, openNewReminderEditor, openEditReminderEditor, openReminderQuickDraft,
    closeReminderEditor, saveReminderDraft, requestCompleteReminder, confirmCompleteReminder,
    closeCompleteReminderConfirm, requestPostponeReminder, confirmPostponeReminder,
    closePostponeReminderConfirm, requestDeleteReminder, confirmDeleteReminder, closeDeleteReminderConfirm,
  });
  remindersHandlersRef.current = {
    closeReminderManagement, openNewReminderEditor, openEditReminderEditor, openReminderQuickDraft,
    closeReminderEditor, saveReminderDraft, requestCompleteReminder, confirmCompleteReminder,
    closeCompleteReminderConfirm, requestPostponeReminder, confirmPostponeReminder,
    closePostponeReminderConfirm, requestDeleteReminder, confirmDeleteReminder, closeDeleteReminderConfirm,
  };
  const [remindersScreenHandlers] = useState(() => ({
    closeReminderManagement: () => remindersHandlersRef.current.closeReminderManagement(),
    openNewReminderEditor: () => remindersHandlersRef.current.openNewReminderEditor(),
    openEditReminderEditor: (reminder: Reminder) => remindersHandlersRef.current.openEditReminderEditor(reminder),
    openReminderQuickDraft: (action: (typeof REMINDER_QUICK_ACTIONS)[number]) => remindersHandlersRef.current.openReminderQuickDraft(action),
    closeReminderEditor: () => remindersHandlersRef.current.closeReminderEditor(),
    saveReminderDraft: (event: FormEvent) => { void remindersHandlersRef.current.saveReminderDraft(event); },
    requestCompleteReminder: (reminder: Reminder) => remindersHandlersRef.current.requestCompleteReminder(reminder),
    confirmCompleteReminder: () => { void remindersHandlersRef.current.confirmCompleteReminder(); },
    closeCompleteReminderConfirm: () => remindersHandlersRef.current.closeCompleteReminderConfirm(),
    requestPostponeReminder: (reminder: Reminder) => remindersHandlersRef.current.requestPostponeReminder(reminder),
    confirmPostponeReminder: () => { void remindersHandlersRef.current.confirmPostponeReminder(); },
    closePostponeReminderConfirm: () => remindersHandlersRef.current.closePostponeReminderConfirm(),
    requestDeleteReminder: (reminder: Reminder) => remindersHandlersRef.current.requestDeleteReminder(reminder),
    confirmDeleteReminder: () => { void remindersHandlersRef.current.confirmDeleteReminder(); },
    closeDeleteReminderConfirm: () => remindersHandlersRef.current.closeDeleteReminderConfirm(),
  }));

  return {
    reminderManagementOpen,
    setReminderManagementOpen,
    reminderEditorOpen,
    setReminderEditorOpen,
    editingReminderId,
    setEditingReminderId,
    reminderDraft,
    setReminderDraft,
    completeReminderTarget,
    setCompleteReminderTarget,
    postponeReminderTarget,
    setPostponeReminderTarget,
    postponeReminderDraft,
    setPostponeReminderDraft,
    deleteReminderTarget,
    setDeleteReminderTarget,
    openNewReminderEditor,
    openReminderQuickDraft,
    openEditReminderEditor,
    closeReminderEditor,
    saveReminderDraft,
    completeReminder,
    requestCompleteReminder,
    closeCompleteReminderConfirm,
    confirmCompleteReminder,
    requestPostponeReminder,
    closePostponeReminderConfirm,
    confirmPostponeReminder,
    requestDeleteReminder,
    closeDeleteReminderConfirm,
    confirmDeleteReminder,
    openReminderManagement,
    closeReminderManagement,
    remindersScreenHandlers,
  };
}
