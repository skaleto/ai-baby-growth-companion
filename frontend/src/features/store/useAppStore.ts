// 中央服务端状态 STORE(collection 集合 + 持久化/同步)。
//
// 从 App.tsx 这个巨型组件里原样抽出「server-state 仓库」——13 个 useStoredState 集合、8 个归一化 memo、
// 11 个 setX 包装、以及 7 个持久化/同步函数(applyAppSnapshot / applyEmptyAppSnapshot /
// resolveCacheAccountKey / cacheBackendState / loadStateFromBackend / applyStateResponse /
// persistRecord),连同 buildAppSnapshot(loadStateFromBackend 内部用)与乐观相册保护 ref
// pendingPersistAlbumIdsRef。行为与抽出前逐字节一致——只是搬家,不改运行时语义。持久化 + 冷启动
// 秒开缓存是承重红线,必须保持一致地工作。
//
// 调用约定(Option B,沿用 session/records):App.tsx 在**最顶部**(session 与全部 feature hook 之前)
// 调用本 hook——因为其 collection 集合被 session 与每个 feature 消费。返回值解构回与原来同名的局部
// 变量,故 App.tsx 里其余引用一律照常编译。
//
// 排序约束(与 session/records 的关键差异):本 hook 调用得**最早**,但其函数依赖的一批变量
// (setProTrial / setOnboardingRequired / authUser / authFamily / proTrial 来自更晚调用的
// useSessionState;setStorageStatus / backendReadyRef 是 App-local,定义在本调用点之后)全部经
// `lateRef` 注入(镜像 session 的 sessionLateRef 模式);App 在它们都就绪后每次渲染都无条件刷新该 ref。
// 这些函数只在事件处理 / effect 回调 / boot 编排里于「触发时」读取,call-time 不需要,故迟绑定不改
// 运行时语义。pendingPersistAlbumIdsRef 由本 hook 持有并返回(album/pendingEffects 已作为 dep 接收它,
// 保持工作)。
//
// 留在 App.tsx 未迁(orchestration / 跨切面,见任务约束):
//  - `consentGiven`(首登知情同意):不是 server collection,是 consent UI,留在 App;
//  - `bootstrapAuth` + 冷启动 boot useEffect / AUTH_EXPIRED 处理 / token 定时刷新:它们编排 auth,
//    只调用本 hook 返回的 loadStateFromBackend / applyAppSnapshot / cacheBackendState 与 session setters;
//  - attachmentForStorage / messageForStorage / albumItemForStorage / persistAlbumItemOptimistic:
//    与 chat/album 序列化耦合,留在 App(persistRecord 已从本 hook 返回,它们照常调用)。
import { type MutableRefObject, type SetStateAction, useMemo, useRef } from "react";
import { useStoredState } from "../../storage";
import {
  importAppState,
  readAppState,
  upsertAppRecord,
  type AppStateCollection,
  type AppStateResponse,
} from "../../appStateApi";
import { writeCachedSnapshot } from "../../appStateCache";
import {
  blankProfile,
  dedupeCareLogs,
  hasCompleteProfile,
  markLegacyImported,
  mergeAlbumItemsFromSnapshot,
  normalizeAlbumItem,
  normalizeBabyProfile,
  normalizeCareLog,
  normalizeChatMessage,
  normalizeConversationSummary,
  normalizeExpenseItem,
  normalizeGrowthEvent,
  normalizeGrowthMeasurement,
  normalizeMemoryItem,
  normalizePendingEffect,
  normalizeProTrialStatus,
  normalizeReminder,
  resolveStateAction,
  stripAttachmentUrlForStorage,
} from "../../appStateDomain";
import { careLogsWithEventStats } from "../../utils/careLogStats";
import type {
  AlbumItem,
  AppStateSnapshot,
  BabyProfile,
  CareLog,
  ChatMessage,
  ConversationSummary,
  ExpenseItem,
  GrowthEvent,
  GrowthMeasurement,
  MemoryItem,
  PendingEffect,
  ProTrialStatus,
  Reminder,
} from "../../types";

// 在 hook 调用点之后才定义 / 由更晚调用的 useSessionState 产出的依赖,统一经 lateRef 注入(见顶部排序约束):
//  - setProTrial / setOnboardingRequired / authUser / authFamily / proTrial:来自 useSessionState(本 hook 之后调用);
//  - setStorageStatus / backendReadyRef:App-local,定义在本调用点之后。
// 它们只在事件处理 / effect / boot 编排里读取,call-time 不需要。
export type StoreLateDeps = {
  setProTrial: (action: SetStateAction<ProTrialStatus>) => void;
  setOnboardingRequired: (action: SetStateAction<boolean>) => void;
  authUser: { id: string } | null;
  authFamily: { id: string } | null;
  proTrial: ProTrialStatus;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  backendReadyRef: MutableRefObject<boolean>;
};

export type UseAppStoreDeps = {
  lateRef: MutableRefObject<StoreLateDeps>;
};

export function useAppStore({ lateRef }: UseAppStoreDeps) {
  const [storedProfile, setStoredProfile] = useStoredState("baby-companion-profile", blankProfile);
  const [storedMessages, setStoredMessages] = useStoredState<ChatMessage[]>("baby-companion-messages", []);
  const [storedGrowthEvents, setStoredGrowthEvents] = useStoredState<GrowthEvent[]>("baby-companion-growth", []);
  const [storedGrowthMeasurements, setStoredGrowthMeasurements] = useStoredState<GrowthMeasurement[]>("baby-companion-growth-measurements", []);
  const [storedCareLogs, setStoredCareLogs] = useStoredState<CareLog[]>("baby-companion-care", []);
  const [storedReminders, setStoredReminders] = useStoredState<Reminder[]>("baby-companion-reminders", []);
  const [storedMemories, setStoredMemories] = useStoredState<MemoryItem[]>("baby-companion-memories", []);
  const [storedPendingEffects, setStoredPendingEffects] = useStoredState<PendingEffect[]>("baby-companion-pending-effects", []);
  const [storedAlbumItems, setStoredAlbumItems] = useStoredState<AlbumItem[]>("baby-companion-album-items", []);
  const [storedExpenses, setStoredExpenses] = useStoredState<ExpenseItem[]>("baby-companion-expenses", []);
  const [storedConversationSummary, setStoredConversationSummary] = useStoredState<ConversationSummary | null>(
    "baby-companion-conversation-summary",
    null,
  );
  const profile = useMemo(() => normalizeBabyProfile(storedProfile), [storedProfile]);
  const messages = useMemo(() => storedMessages.map(normalizeChatMessage), [storedMessages]);
  const growthEvents = useMemo(() => storedGrowthEvents.map(normalizeGrowthEvent), [storedGrowthEvents]);
  const growthMeasurements = useMemo(() => storedGrowthMeasurements.map(normalizeGrowthMeasurement), [storedGrowthMeasurements]);
  const careLogs = useMemo(() => careLogsWithEventStats(dedupeCareLogs(storedCareLogs.map(normalizeCareLog))), [storedCareLogs]);
  const reminders = useMemo(() => storedReminders.map(normalizeReminder), [storedReminders]);
  const memories = useMemo(() => storedMemories.map(normalizeMemoryItem), [storedMemories]);
  const pendingEffects = useMemo(() => storedPendingEffects.map(normalizePendingEffect), [storedPendingEffects]);
  const storedAlbumItemsNormalized = useMemo(() => storedAlbumItems.map(normalizeAlbumItem), [storedAlbumItems]);
  const expenses = useMemo(() => storedExpenses.map(normalizeExpenseItem), [storedExpenses]);
  const conversationSummary = useMemo(
    () => normalizeConversationSummary(storedConversationSummary),
    [storedConversationSummary],
  );
  const setProfile = (action: SetStateAction<BabyProfile>) =>
    setStoredProfile((current) => normalizeBabyProfile(resolveStateAction(action, normalizeBabyProfile(current))));
  const setMessages = (action: SetStateAction<ChatMessage[]>) =>
    setStoredMessages((current) => resolveStateAction(action, current.map(normalizeChatMessage)).map(normalizeChatMessage));
  const setGrowthEvents = (action: SetStateAction<GrowthEvent[]>) =>
    setStoredGrowthEvents((current) => resolveStateAction(action, current.map(normalizeGrowthEvent)).map(normalizeGrowthEvent));
  const setGrowthMeasurements = (action: SetStateAction<GrowthMeasurement[]>) =>
    setStoredGrowthMeasurements((current) => resolveStateAction(action, current.map(normalizeGrowthMeasurement)).map(normalizeGrowthMeasurement));
  const setCareLogs = (action: SetStateAction<CareLog[]>) =>
    setStoredCareLogs((current) => resolveStateAction(action, current.map(normalizeCareLog)).map(normalizeCareLog));
  const setReminders = (action: SetStateAction<Reminder[]>) =>
    setStoredReminders((current) => resolveStateAction(action, current.map(normalizeReminder)).map(normalizeReminder));
  const setMemories = (action: SetStateAction<MemoryItem[]>) =>
    setStoredMemories((current) => resolveStateAction(action, current.map(normalizeMemoryItem)).map(normalizeMemoryItem));
  const setPendingEffects = (action: SetStateAction<PendingEffect[]>) =>
    setStoredPendingEffects((current) =>
      resolveStateAction(action, current.map(normalizePendingEffect)).map(normalizePendingEffect),
    );
  const setAlbumItems = (action: SetStateAction<AlbumItem[]>) =>
    setStoredAlbumItems((current) => resolveStateAction(action, current.map(normalizeAlbumItem)).map(normalizeAlbumItem));
  const setExpenses = (action: SetStateAction<ExpenseItem[]>) =>
    setStoredExpenses((current) => resolveStateAction(action, current.map(normalizeExpenseItem)).map(normalizeExpenseItem));
  const setConversationSummary = (action: SetStateAction<ConversationSummary | null>) =>
    setStoredConversationSummary((current) =>
      normalizeConversationSummary(resolveStateAction(action, normalizeConversationSummary(current))),
    );

  // Album items whose optimistic persistRecord has not yet succeeded. While an id
  // is here, applyAppSnapshot must not let a backend snapshot that omits it drop
  // the item (production data-loss guard). Removed on persist success.
  const pendingPersistAlbumIdsRef = useRef<Set<string>>(new Set());

  const buildAppSnapshot = (): AppStateSnapshot => ({
    profile,
    messages,
    growthEvents,
    growthMeasurements,
    careLogs,
    reminders,
    memories,
    pendingEffects,
    albumItems: storedAlbumItemsNormalized.map((item) => ({
      ...item,
      attachment: item.attachment ? {
        ...item.attachment,
        url: stripAttachmentUrlForStorage(item.attachment.url),
        publicUrl: stripAttachmentUrlForStorage(item.attachment.publicUrl),
      } : undefined,
    })),
    expenses,
    conversationSummary,
    proTrial: lateRef.current.proTrial,
  });

  const applyAppSnapshot = (state: Partial<AppStateSnapshot>) => {
    if ("profile" in state) setProfile((state.profile ?? blankProfile) as BabyProfile);
    if (state.messages) setMessages(state.messages);
    if (state.growthEvents) setGrowthEvents(state.growthEvents);
    if (state.growthMeasurements) setGrowthMeasurements(state.growthMeasurements);
    if (state.careLogs) setCareLogs(state.careLogs);
    if (state.reminders) setReminders(state.reminders.map(normalizeReminder));
    if (state.memories) setMemories(state.memories);
    if (state.pendingEffects) setPendingEffects(state.pendingEffects);
    if (state.albumItems) {
      const snapshotAlbumItems = state.albumItems;
      // Merge instead of overwrite so optimistic album items still awaiting
      // confirmed persistence survive a snapshot that omits them (data-loss guard).
      setAlbumItems((current) =>
        mergeAlbumItemsFromSnapshot(current, snapshotAlbumItems, pendingPersistAlbumIdsRef.current),
      );
      // Any pending id the backend now reports is confirmed persisted; stop
      // tracking it so the guard set stays bounded and later deletes propagate.
      if (pendingPersistAlbumIdsRef.current.size) {
        snapshotAlbumItems.forEach((item) => pendingPersistAlbumIdsRef.current.delete(item.id));
      }
    }
    if (state.expenses) setExpenses(state.expenses);
    if ("conversationSummary" in state) {
      setConversationSummary((state.conversationSummary ?? null) as ConversationSummary | null);
    }
    if ("proTrial" in state) lateRef.current.setProTrial(normalizeProTrialStatus(state.proTrial ?? null));
  };

  const applyEmptyAppSnapshot = () => {
    applyAppSnapshot({
      profile: blankProfile,
      messages: [],
      growthEvents: [],
      growthMeasurements: [],
      careLogs: [],
      reminders: [],
      memories: [],
      pendingEffects: [],
      conversationSummary: null,
      albumItems: [],
      expenses: [],
      proTrial: normalizeProTrialStatus(null),
    });
  };

  // 冷启动秒开缓存键(架构债 D11):按账号(user id 优先,退化到 family id)分键,绝不跨账号。
  // 启动时优先用入参 accountKey(此刻 React 的 authUser 尚未 flush),其次读已落定的 state。
  const resolveCacheAccountKey = (explicit?: string | null): string | null =>
    explicit || lateRef.current.authUser?.id || lateRef.current.authFamily?.id || null;

  // 把刚成功拉到并应用的后端 state 写进本地缓存(下次冷启动据此秒开)。fire-and-forget,
  // 失败仅退化为无秒开;只缓存非空 state(空账号无可秒开内容,也避免覆盖有效缓存)。
  const cacheBackendState = (state: Partial<AppStateSnapshot>, accountKey?: string | null) => {
    const key = resolveCacheAccountKey(accountKey);
    if (!key) return;
    void writeCachedSnapshot(key, state);
  };

  const loadStateFromBackend = async (
    options: { importLegacy: boolean; onboardingRequired?: boolean; accountKey?: string | null } = { importLegacy: false },
  ) => {
    lateRef.current.setStorageStatus("loading");
    const response = await readAppState();
    if (response.empty) {
      if (options.importLegacy) {
        const imported = await importAppState(buildAppSnapshot());
        applyAppSnapshot(imported.state);
        lateRef.current.setOnboardingRequired(options.onboardingRequired ?? !hasCompleteProfile(imported.state.profile as BabyProfile | undefined));
        markLegacyImported();
        cacheBackendState(imported.state, options.accountKey);
      } else {
        applyEmptyAppSnapshot();
        lateRef.current.setOnboardingRequired(options.onboardingRequired ?? true);
      }
    } else {
      applyAppSnapshot(response.state);
      lateRef.current.setOnboardingRequired(options.onboardingRequired ?? !hasCompleteProfile(response.state.profile as BabyProfile | undefined));
      cacheBackendState(response.state, options.accountKey);
    }
    lateRef.current.backendReadyRef.current = true;
    lateRef.current.setStorageStatus("ready");
    return response;
  };

  const applyStateResponse = (response: { state: Partial<AppStateSnapshot> }) => {
    applyAppSnapshot(response.state);
    lateRef.current.backendReadyRef.current = true;
    lateRef.current.setStorageStatus("ready");
  };

  const persistRecord = async <T,>(
    collection: AppStateCollection,
    id: string,
    item: T,
    options: { applyResponse?: boolean; mode?: "merge" | "replace" } = {},
  ) => {
    try {
      const response = await upsertAppRecord(collection, id, item, { mode: options.mode });
      if (options.applyResponse) applyStateResponse(response);
      else {
        lateRef.current.backendReadyRef.current = true;
        lateRef.current.setStorageStatus("ready");
      }
      return response;
    } catch (error) {
      lateRef.current.backendReadyRef.current = false;
      lateRef.current.setStorageStatus("offline");
      throw error;
    }
  };

  return {
    // collections + normalize memos
    profile,
    setProfile,
    messages,
    setMessages,
    growthEvents,
    setGrowthEvents,
    growthMeasurements,
    setGrowthMeasurements,
    careLogs,
    setCareLogs,
    reminders,
    setReminders,
    memories,
    setMemories,
    pendingEffects,
    setPendingEffects,
    storedAlbumItemsNormalized,
    setAlbumItems,
    expenses,
    setExpenses,
    conversationSummary,
    setConversationSummary,
    // persistence / sync
    pendingPersistAlbumIdsRef,
    buildAppSnapshot,
    applyAppSnapshot,
    applyEmptyAppSnapshot,
    resolveCacheAccountKey,
    cacheBackendState,
    loadStateFromBackend,
    applyStateResponse,
    persistRecord,
  } as const;
}

export type AppStore = ReturnType<typeof useAppStore>;
