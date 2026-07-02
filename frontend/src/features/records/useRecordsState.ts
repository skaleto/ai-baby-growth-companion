// 记录(今日时间线/成长/里程碑/疫苗/手动记录抽屉)功能的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 records 一族的 state / refs / effect / memo / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。
//
// 调用约定(Option B):App.tsx 在 `canCaregive` 之后「提前」调用本 hook,并把返回值
// 解构回与原来同名的局部变量,因此 App.tsx 里其余引用一律照常编译。`persistRecord`
// (useAppStore 内 useCallback 稳定)/ `deleteAppRecord`(模块级 import)引用稳定,直接按值传入。
// 早于调用点存在的依赖(canCaregive / profile / setProfile /
// growthEvents / setGrowthEvents / growthMeasurements / setGrowthMeasurements / careLogs /
// setCareLogs / setStorageStatus / setActiveMobileTab 等)按值传入。
//
// 与 ledger / reminders 抽取的偏差:
//  1) `showSystemWeakNotice`(handleAddGrowthMeasurement 用)的 useCallback 定义在 hook 调用点之后,
//     故经迟绑定 ref `lateRef` 注入,App 在其定义之后每次渲染刷新该 ref(那时它已就绪)。
//  2) `RecordEvent` / `CareEventDraft` / `RecordsEntryDrawer` 是 App.tsx 内定义并导出的本地类型,
//     本 hook 仅做「类型」import(编译期擦除,不形成运行时循环依赖)。
//  3) `recordsScreenHandlersRef` / `recordsScreenHandlers`(喂给 memo 化 <RecordsScreen/> 的稳定
//     函数包)依赖 App 侧 chat 耦合的 `openRecordsAssistant` / `quickFill` / `composerMode`,故留在
//     App.tsx;本 hook 只返回它需要的各处理函数,bundle 仍在 App 引用解构回来的同名函数,引用稳定性不变。
//  4) `closeRecordsEntryDrawer` / `clearRecordsEntryDrawerCloseTimer` / `openManualRecordDrawer` 及其
//     `recordsEntryDrawerCloseTimerRef` 留在 App.tsx:它们与 App 侧的语音捕获(voiceRecordingActive /
//     cancelVoiceCapture,文件更下方才就绪)、卸载清理 effect、手动记录草稿(manualRecordKind /
//     createCareEventDraft)及一条源码模式回归测试(test:voice-capture-panel 断言 App.tsx 里
//     `closeRecordsEntryDrawer` 中 `if (voiceRecordingActive) cancelVoiceCapture()`)强耦合。它们读取
//     本 hook 解构回去的同名 drawer state/setters。
import {
  type FormEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GROWTH_MEASUREMENT_META, type MobileTab, type RecordView } from "../../appOptions";
import { makeId, todayISO } from "../../data";
import { milestoneTag, type GrowthMilestone } from "../../data/growthMilestones";
import { normalizeCareLogEvent, normalizeGrowthEvent, normalizeGrowthMeasurement } from "../../appStateDomain";
import { careLogWithEventStats } from "../../utils/careLogStats";
import { getVaccineDataSync, refreshVaccineData } from "../../vaccineData";
import { pendingCountForProfile } from "../../vaccineStatus";
import { monthsBetween } from "../../utils/babyAge";
import { careEventsForLog } from "../../utils/careLogHelpers";
import type { RegionCode } from "../../data/vaccineSchedule.fallback";
import { hapticSuccess, hapticWarning } from "../../haptics";
import { type DeleteAppRecord, type PersistRecord } from "../../appStateApi";
import type {
  BabyProfile,
  CareLog,
  GrowthEvent,
  GrowthMeasurement,
  GrowthMeasurementType,
} from "../../types";
import type { CareEventDraft, RecordEvent, RecordsEntryDrawer } from "../../appContracts";

type GrowthMeasurementDraft = {
  type: GrowthMeasurementType;
  value: string;
  date: string;
  note: string;
};

// showSystemWeakNotice(handleAddGrowthMeasurement 用)的 useCallback 定义在 hook 调用点之后,经此迟绑定 ref 注入。
export type RecordsLateDeps = {
  showSystemWeakNotice: (message: string, tone?: "info" | "success" | "warning", durationMs?: number) => void;
};

export type UseRecordsStateDeps = {
  canCaregive: boolean;
  profile: BabyProfile;
  setProfile: (action: SetStateAction<BabyProfile>) => void;
  growthEvents: GrowthEvent[];
  setGrowthEvents: (action: SetStateAction<GrowthEvent[]>) => void;
  growthMeasurements: GrowthMeasurement[];
  setGrowthMeasurements: (action: SetStateAction<GrowthMeasurement[]>) => void;
  careLogs: CareLog[];
  setCareLogs: (action: SetStateAction<CareLog[]>) => void;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  setActiveMobileTab: (action: SetStateAction<MobileTab>) => void;
  // careEventDraft 的 useState 初值用;createCareEventDraft 留在 App(被 manual-record 一族复用),按值传入。
  createCareEventDraft: (type: CareEventDraft["type"]) => CareEventDraft;
  // App.tsx 里 persistRecord / deleteAppRecord 的精确签名(单一来源见 appStateApi),引用稳定,按值传入。
  persistRecord: PersistRecord;
  deleteAppRecord: DeleteAppRecord;
  lateRef: MutableRefObject<RecordsLateDeps>;
};

export function useRecordsState({
  canCaregive,
  profile,
  setProfile,
  growthEvents,
  setGrowthEvents,
  growthMeasurements,
  setGrowthMeasurements,
  careLogs,
  setCareLogs,
  setStorageStatus,
  setActiveMobileTab,
  createCareEventDraft,
  persistRecord,
  deleteAppRecord,
  lateRef,
}: UseRecordsStateDeps) {
  const [recordView, setRecordView] = useState<RecordView>("today");
  const [recordsEntryDrawer, setRecordsEntryDrawer] = useState<RecordsEntryDrawer>(null);
  const [recordsEntryDrawerClosing, setRecordsEntryDrawerClosing] = useState(false);
  const [recordsAssistantOpen, setRecordsAssistantOpen] = useState(false);
  const [milestonesViewOpen, setMilestonesViewOpen] = useState(false);
  const [growthEntryOpen, setGrowthEntryOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(todayISO().slice(0, 7));
  const [vaccineViewOpen, setVaccineViewOpen] = useState(false);
  const [editingCareEventId, setEditingCareEventId] = useState("");
  const [swipedTimelineEventId, setSwipedTimelineEventId] = useState("");
  const [deleteCareEventTarget, setDeleteCareEventTarget] = useState<RecordEvent | null>(null);
  const [careEventDraft, setCareEventDraft] = useState<CareEventDraft>(() => createCareEventDraft("milk"));
  const [growthCurveType, setGrowthCurveType] = useState<GrowthMeasurementType>("height");
  const [growthMeasurementDraft, setGrowthMeasurementDraft] = useState<GrowthMeasurementDraft>({
    type: "height",
    value: "",
    date: todayISO(),
    note: "",
  });
  const [editingGrowthMeasurementId, setEditingGrowthMeasurementId] = useState("");

  const timelineSwipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const openMilestones = useCallback(() => {
    setActiveMobileTab("records");
    setRecordsAssistantOpen(false);
    setMilestonesViewOpen(true);
  }, []);
  const closeMilestones = useCallback(() => setMilestonesViewOpen(false), []);
  const openVaccine = useCallback(() => {
    setActiveMobileTab("records");
    setRecordsAssistantOpen(false);
    setVaccineViewOpen(true);
  }, []);
  const closeVaccine = useCallback(() => setVaccineViewOpen(false), []);
  const setVaccineRegion = useCallback(
    (code: RegionCode) => {
      const next = { ...profile, vaccineRegion: code };
      setProfile(next);
      void persistRecord("profile", "default", next, { applyResponse: true }).catch(() => undefined);
    },
    [profile],
  );
  const toggleVaccineDose = useCallback(
    (doseId: string, done: boolean) => {
      if (!canCaregive) return;
      const rest = (profile.vaccineRecords ?? []).filter((r) => r.doseId !== doseId);
      const records = done ? [...rest, { doseId, date: todayISO() }] : rest;
      const next = { ...profile, vaccineRecords: records };
      setProfile(next);
      void persistRecord("profile", "default", next, { applyResponse: true }).catch(() => undefined);
      hapticSuccess();
    },
    [profile, canCaregive],
  );
  useEffect(() => {
    void refreshVaccineData();
  }, []);
  // 入口角标:不打开清单也给「本阶段 N 针待安排」的轻提醒(别漏别晚)。复用纯函数,随 profile 变化重算。
  const vaccinePending = useMemo(() => {
    const data = getVaccineDataSync();
    const region = (profile.vaccineRegion as RegionCode) || "national";
    const ageMonths = monthsBetween(profile.birthDate) ?? null;
    const doneDoseIds = new Set((profile.vaccineRecords ?? []).map((r) => r.doseId));
    return pendingCountForProfile({ doses: data.doses, region, ageMonths, doneDoseIds });
  }, [profile.vaccineRegion, profile.birthDate, profile.vaccineRecords]);
  const openGrowthEntry = useCallback(() => {
    setRecordsEntryDrawer(null);
    setRecordsAssistantOpen(false);
    setGrowthEntryOpen(true);
  }, []);

  const resetGrowthMeasurementDraft = useCallback(() => {
    setEditingGrowthMeasurementId("");
    setGrowthMeasurementDraft({
      type: "height",
      value: "",
      date: todayISO(),
      note: "",
    });
  }, []);
  const closeGrowthEntry = useCallback(() => {
    setGrowthEntryOpen(false);
    resetGrowthMeasurementDraft();
  }, [resetGrowthMeasurementDraft]);

  const achieveMilestone = useCallback((milestone: GrowthMilestone) => {
    if (!canCaregive) return;
    const growth = normalizeGrowthEvent({
      id: makeId("growth"),
      type: "milestone",
      title: milestone.title,
      date: todayISO(),
      summary: milestone.hint,
      firstTime: true,
      tags: [milestoneTag(milestone.id)],
    }, 0);
    setGrowthEvents((current) => [...current, growth]);
    void persistRecord("growthEvents", growth.id, growth).catch(() => setStorageStatus("offline"));
    hapticSuccess();
  }, [canCaregive]);

  const handleAddGrowthMeasurement = (event: FormEvent) => {
    event.preventDefault();
    if (!canCaregive) return;
    const meta = GROWTH_MEASUREMENT_META[growthMeasurementDraft.type];
    const numericValue = Number(growthMeasurementDraft.value);
    if (!Number.isFinite(numericValue) || numericValue < meta.min || numericValue > meta.max) {
      lateRef.current.showSystemWeakNotice(`请输入 ${meta.min}-${meta.max}${meta.unit} 之间的${meta.label}。`, "warning");
      return;
    }
    const existingMeasurement = editingGrowthMeasurementId
      ? growthMeasurements.find((item) => item.id === editingGrowthMeasurementId)
      : undefined;
    const measurement = normalizeGrowthMeasurement(
      {
        ...existingMeasurement,
        id: editingGrowthMeasurementId || makeId("growth-measurement"),
        type: growthMeasurementDraft.type,
        value: numericValue,
        date: growthMeasurementDraft.date || todayISO(),
        note: growthMeasurementDraft.note.trim() || undefined,
      },
      0,
    );
    setGrowthMeasurements((current) => {
      if (!editingGrowthMeasurementId) return [...current, measurement];
      let updated = false;
      const next = current.map((item) => {
        if (item.id !== editingGrowthMeasurementId) return item;
        updated = true;
        return measurement;
      });
      return updated ? next : [...next, measurement];
    });
    void persistRecord("growthMeasurements", measurement.id, measurement).catch(() => setStorageStatus("offline"));
    if (editingGrowthMeasurementId) {
      resetGrowthMeasurementDraft();
    } else {
      setGrowthMeasurementDraft((current) => ({ ...current, value: "", note: "" }));
    }
    hapticSuccess();
  };

  const handleEditGrowthMeasurement = (measurement: GrowthMeasurement) => {
    if (!canCaregive) return;
    setEditingGrowthMeasurementId(measurement.id);
    setGrowthMeasurementDraft({
      type: measurement.type,
      value: String(measurement.value),
      date: measurement.date || todayISO(),
      note: measurement.note ?? "",
    });
  };

  const handleDeleteGrowthMeasurement = (id: string) => {
    if (!canCaregive) return;
    if (editingGrowthMeasurementId === id) resetGrowthMeasurementDraft();
    setGrowthMeasurements((current) => current.filter((item) => item.id !== id));
    void deleteAppRecord("growthMeasurements", id).catch(() => setStorageStatus("offline"));
  };

  // clearRecordsEntryDrawerCloseTimer / closeRecordsEntryDrawer / openManualRecordDrawer 见上方第 4 条偏差,留在 App.tsx。

  const careEventForRecord = (record: RecordEvent) => {
    const log = careLogs.find((item) => item.id === record.careLogId);
    if (!log) return undefined;
    return (
      log.events.find((item) => item.id === record.careEventId) ??
      careEventsForLog(log).find((item) => item.id === record.careEventId)
    );
  };

  const beginEditCareTimelineEvent = (record: RecordEvent) => {
    if (!canCaregive || record.type !== "care" || !record.careLogId) return;
    const event = careEventForRecord(record);
    setSwipedTimelineEventId("");
    setEditingCareEventId(record.id);
    setCareEventDraft({
      type: event?.type ?? (record.kind === "growth" || record.kind === "reminder" ? "note" : record.kind),
      time: event?.time ?? "",
      amountMl: event?.amountMl ? String(event.amountMl) : "",
      durationHours: event?.durationHours ? String(event.durationHours) : "",
      temperature: event?.temperature ? String(event.temperature) : "",
      note: event?.note ?? record.body,
    });
  };

  const saveCareTimelineEvent = (event: FormEvent, record: RecordEvent) => {
    event.preventDefault();
    if (!canCaregive || record.type !== "care" || !record.careLogId) return;
    const currentLog = careLogs.find((item) => item.id === record.careLogId);
    if (!currentLog) return;

    const nextCareEvent = normalizeCareLogEvent(
      {
        id: record.careEventId || makeId("care-event"),
        type: careEventDraft.type,
        date: currentLog.date,
        time: careEventDraft.time,
        amountMl: careEventDraft.amountMl ? Number(careEventDraft.amountMl) : undefined,
        durationHours: careEventDraft.durationHours ? Number(careEventDraft.durationHours) : undefined,
        temperature: careEventDraft.temperature ? Number(careEventDraft.temperature) : undefined,
        note: careEventDraft.note.trim() || undefined,
      },
      0,
      currentLog.date,
    );
    const hasExistingEvent = currentLog.events.some((item) => item.id === nextCareEvent.id);
    const nextLog = careLogWithEventStats({
      ...currentLog,
      events: hasExistingEvent
        ? currentLog.events.map((item) => (item.id === nextCareEvent.id ? nextCareEvent : item))
        : [...currentLog.events, nextCareEvent],
    });

    setCareLogs((current) => current.map((item) => (item.id === nextLog.id ? nextLog : item)));
    void persistRecord("careLogs", nextLog.id, nextLog, { applyResponse: true, mode: "replace" }).catch(() => {
      setStorageStatus("offline");
    });
    setEditingCareEventId("");
    setSwipedTimelineEventId("");
  };

  const canEditTimelineEvent = (record: RecordEvent) =>
    canCaregive && record.type === "care" && Boolean(record.careLogId && record.careEventId);

  const beginTimelineEventSwipe = (event: ReactPointerEvent<HTMLElement>, record: RecordEvent) => {
    if (!canEditTimelineEvent(record)) return;
    timelineSwipeStartRef.current = { id: record.id, x: event.clientX, y: event.clientY };
  };

  const finishTimelineEventSwipe = (event: ReactPointerEvent<HTMLElement>, record: RecordEvent) => {
    const start = timelineSwipeStartRef.current;
    timelineSwipeStartRef.current = null;
    if (!start || start.id !== record.id || !canEditTimelineEvent(record)) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 28 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    setSwipedTimelineEventId(deltaX < 0 ? record.id : "");
  };

  const cancelTimelineEventSwipe = () => {
    timelineSwipeStartRef.current = null;
  };

  const requestDeleteCareTimelineEvent = (record: RecordEvent) => {
    if (!canEditTimelineEvent(record)) return;
    setDeleteCareEventTarget(record);
    setSwipedTimelineEventId("");
    hapticWarning();
  };

  const selectRecordDate = (date: string) => {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
    setEditingCareEventId("");
    setSwipedTimelineEventId("");
    setDeleteCareEventTarget(null);
  };

  return {
    recordView,
    setRecordView,
    recordsEntryDrawer,
    setRecordsEntryDrawer,
    recordsEntryDrawerClosing,
    setRecordsEntryDrawerClosing,
    recordsAssistantOpen,
    setRecordsAssistantOpen,
    milestonesViewOpen,
    setMilestonesViewOpen,
    growthEntryOpen,
    setGrowthEntryOpen,
    selectedDate,
    setSelectedDate,
    calendarMonth,
    setCalendarMonth,
    vaccineViewOpen,
    setVaccineViewOpen,
    editingCareEventId,
    setEditingCareEventId,
    swipedTimelineEventId,
    setSwipedTimelineEventId,
    deleteCareEventTarget,
    setDeleteCareEventTarget,
    careEventDraft,
    setCareEventDraft,
    growthCurveType,
    setGrowthCurveType,
    growthMeasurementDraft,
    setGrowthMeasurementDraft,
    editingGrowthMeasurementId,
    setEditingGrowthMeasurementId,
    timelineSwipeStartRef,
    vaccinePending,
    openMilestones,
    closeMilestones,
    openVaccine,
    closeVaccine,
    setVaccineRegion,
    toggleVaccineDose,
    openGrowthEntry,
    resetGrowthMeasurementDraft,
    closeGrowthEntry,
    achieveMilestone,
    handleAddGrowthMeasurement,
    handleEditGrowthMeasurement,
    handleDeleteGrowthMeasurement,
    beginEditCareTimelineEvent,
    saveCareTimelineEvent,
    canEditTimelineEvent,
    beginTimelineEventSwipe,
    finishTimelineEventSwipe,
    cancelTimelineEventSwipe,
    requestDeleteCareTimelineEvent,
    selectRecordDate,
  };
}
