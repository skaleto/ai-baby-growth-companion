// 记录 Tab(自 App.tsx 上帝类拆出——架构债 D1/Records 轮,分类法 D12:整屏进 screens/)。
// React.memo:聊天输入草稿(input/composerMode/语音)的逐键 setState 不再重渲染整棵记录树。
//   —— 打字所在的 AI/手动 composer 抽屉本身 createPortal 到 document.body,已被 App 提升为
//      <RecordsScreen/> 的兄弟节点,故草稿 state 不进本屏 props(见 App.tsx 记录区挂载点)。
// memo 生效前提:函数 props 必须引用稳定——App 侧经 recordsScreenHandlers 的 ref 包装保证;
//   数据 props 均为 useMemo/state 产物。DOM 结构与拆分前逐字一致(CSS/手势/快照测试不感知)。
import {
  memo,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LineChart,
  PencilLine,
  Sparkles,
  Syringe,
  Trash2,
} from "lucide-react";
import { GROWTH_MEASUREMENT_META, GROWTH_MEASUREMENT_TYPES, RECORD_VIEWS, type RecordView } from "../appOptions";
import { CARE_EVENT_TYPE_OPTIONS } from "../appOptions";
import { addMonths, creatorMetaText, monthTitle } from "../appStateDomain";
import { todayISO } from "../data";
import { compactValue, type DailyCareBreakdown, type WeeklyCareComparison } from "../recordsDomain";
import { recordEventIconSrc } from "../recordIcons";
import { StorySelect } from "../components/StorySelect";
import { FeedingAlarmCard } from "../components/FeedingAlarmCard";
import { SleepMusicCard } from "../components/SleepMusicCard";
import { SleepMusicScreen } from "./SleepMusicScreen";
import { GrowthEntryView } from "../views/GrowthEntryView";
import { VaccineView } from "../views/VaccineView";
import { MilestonesView } from "../views/MilestonesView";
import type { BabyProfile, GrowthEvent, GrowthMeasurement, GrowthMeasurementType } from "../types";
import type { RegionCode } from "../data/vaccineSchedule.fallback";
import type { GrowthMilestone } from "../data/growthMilestones";
import type {
  CareEventDraft,
  GrowthCurveData,
  GrowthTrendMetric,
  RecordEvent,
  RecordsEntryDrawer,
} from "../appContracts";
import growthIcon from "../assets/storybook-icons/growth.png";
import recordsIcon from "../assets/storybook-icons/records.png";

type GrowthMeasurementDraft = { type: GrowthMeasurementType; value: string; date: string; note: string };

// App 侧经 ref 包装、引用永远稳定的函数 props(同 albumScreenHandlers 的间接模式)。
export type RecordsScreenHandlers = {
  selectRecordDate: (date: string) => void;
  quickFill: (text: string) => void;
  openRecordsAssistant: () => void;
  openManualRecordDrawer: () => void;
  openGrowthEntry: () => void;
  openMilestones: () => void;
  openVaccine: () => void;
  beginTimelineEventSwipe: (event: ReactPointerEvent<HTMLElement>, record: RecordEvent) => void;
  finishTimelineEventSwipe: (event: ReactPointerEvent<HTMLElement>, record: RecordEvent) => void;
  cancelTimelineEventSwipe: () => void;
  canEditTimelineEvent: (record: RecordEvent) => boolean;
  beginEditCareTimelineEvent: (record: RecordEvent) => void;
  requestDeleteCareTimelineEvent: (record: RecordEvent) => void;
  saveCareTimelineEvent: (event: FormEvent, record: RecordEvent) => void;
  handleAddGrowthMeasurement: (event: FormEvent) => void;
  handleEditGrowthMeasurement: (measurement: GrowthMeasurement) => void;
  handleDeleteGrowthMeasurement: (id: string) => void;
  resetGrowthMeasurementDraft: () => void;
  closeGrowthEntry: () => void;
  closeVaccine: () => void;
  setVaccineRegion: (code: RegionCode) => void;
  toggleVaccineDose: (doseId: string, done: boolean) => void;
  closeMilestones: () => void;
  achieveMilestone: (milestone: GrowthMilestone) => void;
};

export type RecordsScreenProps = {
  canCaregive: boolean;
  // 视图与日期
  recordView: RecordView;
  recordHeading: string;
  todayDate: string;
  selectedDate: string;
  selectedDateIsToday: boolean;
  calendarMonth: string;
  calendarDates: (string | null)[];
  eventDates: Set<string>;
  // 抽屉/子页开关
  recordsEntryDrawer: RecordsEntryDrawer;
  growthEntryOpen: boolean;
  vaccineViewOpen: boolean;
  milestonesViewOpen: boolean;
  sleepMusicOpen: boolean;
  // 快速记录入口
  quickActions: { label: string; prompt: string }[];
  // 喂奶闹钟卡
  feedingAlarm: { dueAtMs: number | null; intervalMinutes: number | null };
  latestMilkAnchor: { occurredAt: Date } | null | undefined;
  feedingAlarmHandlers: {
    onFed: (amountMl: number | null) => void;
    onPickOther: () => void;
    onSetup: () => void;
  };
  sleepMusicHandlers: { open: () => void; close: () => void };
  // 今日汇总
  selectedGrowthCount: number;
  selectedKeyPointCount: number;
  dailyCareBreakdowns: DailyCareBreakdown[];
  // 趋势
  weeklyCareComparison: WeeklyCareComparison;
  growthTrendMetrics: GrowthTrendMetric[];
  // 时间线
  selectedEvents: RecordEvent[];
  swipedTimelineEventId: string;
  editingCareEventId: string;
  careEventDraft: CareEventDraft;
  // 成长曲线 / 成长录入
  growthCurveType: GrowthMeasurementType;
  growthCurveData: GrowthCurveData;
  profile: BabyProfile;
  growthEvents: GrowthEvent[];
  growthMeasurements: GrowthMeasurement[];
  growthMeasurementDraft: GrowthMeasurementDraft;
  editingGrowthMeasurementId: string;
  vaccinePending: number;
  babyNickname: string;
  // setters(原生 dispatch,引用天然稳定)
  setRecordView: Dispatch<SetStateAction<RecordView>>;
  setCalendarMonth: Dispatch<SetStateAction<string>>;
  setSwipedTimelineEventId: Dispatch<SetStateAction<string>>;
  setEditingCareEventId: Dispatch<SetStateAction<string>>;
  setCareEventDraft: Dispatch<SetStateAction<CareEventDraft>>;
  setGrowthCurveType: Dispatch<SetStateAction<GrowthMeasurementType>>;
  setGrowthMeasurementDraft: Dispatch<SetStateAction<GrowthMeasurementDraft>>;
  handlers: RecordsScreenHandlers;
};

export const RecordsScreen = memo(function RecordsScreen({
  canCaregive,
  recordView,
  recordHeading,
  todayDate,
  selectedDate,
  selectedDateIsToday,
  calendarMonth,
  calendarDates,
  eventDates,
  recordsEntryDrawer,
  growthEntryOpen,
  vaccineViewOpen,
  milestonesViewOpen,
  sleepMusicOpen,
  quickActions,
  feedingAlarm,
  latestMilkAnchor,
  feedingAlarmHandlers,
  sleepMusicHandlers,
  selectedGrowthCount,
  selectedKeyPointCount,
  dailyCareBreakdowns,
  weeklyCareComparison,
  growthTrendMetrics,
  selectedEvents,
  swipedTimelineEventId,
  editingCareEventId,
  careEventDraft,
  growthCurveType,
  growthCurveData,
  profile,
  growthEvents,
  growthMeasurements,
  growthMeasurementDraft,
  editingGrowthMeasurementId,
  vaccinePending,
  babyNickname,
  setRecordView,
  setCalendarMonth,
  setSwipedTimelineEventId,
  setEditingCareEventId,
  setCareEventDraft,
  setGrowthCurveType,
  setGrowthMeasurementDraft,
  handlers,
}: RecordsScreenProps) {
  const {
    selectRecordDate,
    quickFill,
    openRecordsAssistant,
    openManualRecordDrawer,
    openGrowthEntry,
    openMilestones,
    openVaccine,
    beginTimelineEventSwipe,
    finishTimelineEventSwipe,
    cancelTimelineEventSwipe,
    canEditTimelineEvent,
    beginEditCareTimelineEvent,
    requestDeleteCareTimelineEvent,
    saveCareTimelineEvent,
    handleAddGrowthMeasurement,
    handleEditGrowthMeasurement,
    handleDeleteGrowthMeasurement,
    resetGrowthMeasurementDraft,
    closeGrowthEntry,
    closeVaccine,
    setVaccineRegion,
    toggleVaccineDose,
    closeMilestones,
    achieveMilestone,
  } = handlers;

  return (
        <section className="records-screen tab-content-enter" aria-label="记录">
          {((): null => {
            // 渲染探针(默认关闭零开销):__COUNT_RECORDS_RENDERS 置位时统计记录子树渲染次数。
            // D1 核心指标——拆出 memo 化 RecordsScreen 前,打字会逐键重渲整棵记录树;拆后应≈0。
            if (typeof window !== "undefined" && (window as unknown as { __COUNT_RECORDS_RENDERS?: boolean }).__COUNT_RECORDS_RENDERS) {
              const w = window as unknown as { __recordsRenders?: number };
              w.__recordsRenders = (w.__recordsRenders || 0) + 1;
            }
            return null;
          })()}
          {growthEntryOpen ? (
            <GrowthEntryView
              profile={profile}
              growthMeasurements={growthMeasurements}
              canCaregive={canCaregive}
              draft={growthMeasurementDraft}
              editingMeasurementId={editingGrowthMeasurementId}
              onDraftChange={setGrowthMeasurementDraft}
              onSubmit={handleAddGrowthMeasurement}
              onEdit={handleEditGrowthMeasurement}
              onCancelEdit={resetGrowthMeasurementDraft}
              onDelete={handleDeleteGrowthMeasurement}
              onClose={closeGrowthEntry}
            />
          ) : vaccineViewOpen ? (
            <VaccineView
              profile={profile}
              canCaregive={canCaregive}
              onClose={closeVaccine}
              onSetRegion={setVaccineRegion}
              onToggleDose={toggleVaccineDose}
            />
          ) : milestonesViewOpen ? (
            <MilestonesView
              profile={profile}
              growthEvents={growthEvents}
              canCaregive={canCaregive}
              onClose={closeMilestones}
              onAchieve={achieveMilestone}
            />
          ) : (
          <>
          <div className="screen-head">
            <div>
              <p className="eyebrow">记录</p>
              <h2>{recordHeading}</h2>
            </div>
            <button type="button" className="small-action" onClick={() => {
              selectRecordDate(todayDate);
              setRecordView("today");
            }}>
              今天
            </button>
          </div>

          <div className="segmented-tabs record-tabs" role="tablist" aria-label="记录视图">
            {RECORD_VIEWS.map((view) => (
              <button
                type="button"
                className={recordView === view.id ? "active" : ""}
                aria-selected={recordView === view.id}
                role="tab"
                key={view.id}
                onClick={() => {
                  if (view.id === "today") selectRecordDate(todayDate);
                  setRecordView(view.id);
                }}
              >
                {view.label}
              </button>
            ))}
          </div>

          {canCaregive ? (
          <section className="records-assistant-entry" aria-label="快速记录入口">
            <div className="records-assistant-head">
              <div>
                <strong>快速记录</strong>
                <small>AI 可以帮你整理成记录，也可以手动记录当天数据</small>
              </div>
              <div className="records-assistant-actions">
                <button
                  type="button"
                  onClick={() => openRecordsAssistant()}
                >
                  {recordsEntryDrawer === "ai" ? "正在记录" : "AI 自动记录"}
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={openManualRecordDrawer}
                >
                  手动记录
                </button>
              </div>
            </div>
            <div className="quick-row records-quick-row">
              {quickActions.map(({ label, prompt }) => (
                <button type="button" className="records-prompt-link" key={label} onClick={() => quickFill(prompt)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
          ) : null}

          <FeedingAlarmCard
            canCaregive={canCaregive}
            dueAtMs={feedingAlarm.dueAtMs}
            intervalMinutes={feedingAlarm.intervalMinutes}
            lastMilkAtMs={latestMilkAnchor ? latestMilkAnchor.occurredAt.getTime() : null}
            onFed={feedingAlarmHandlers.onFed}
            onPickOther={feedingAlarmHandlers.onPickOther}
            onSetup={feedingAlarmHandlers.onSetup}
          />

          <SleepMusicCard onOpen={sleepMusicHandlers.open} />

          {sleepMusicOpen ? createPortal(<SleepMusicScreen onClose={sleepMusicHandlers.close} />, document.body) : null}


          {recordView === "today" ? (
          <section className="summary-card">
            <div className="summary-title">
              <CalendarDays size={18} />
              <span>{selectedDateIsToday ? "今日信息" : "当天信息"}</span>
              {!canCaregive ? <span className="readonly-pill">仅查看</span> : null}
            </div>
            <div className="record-summary-grid">
              <div className="summary-metric growth">
                <img className="summary-metric-icon" src={growthIcon} alt="" />
                <span>成长</span>
                <strong>{selectedGrowthCount} 条</strong>
                <small>{selectedGrowthCount ? "已归档" : "暂无成长"}</small>
              </div>
              <div className="summary-metric keypoint">
                <img className="summary-metric-icon" src={recordsIcon} alt="" />
                <span>关键点</span>
                <strong>{selectedKeyPointCount} 条</strong>
                <small>{selectedKeyPointCount ? "已进入时间线" : selectedDateIsToday ? "等你确认记录" : "暂无归档"}</small>
              </div>
            </div>
            <div className="daily-care-breakdown">
              {dailyCareBreakdowns.map((metric) => (
                <article className={`daily-care-bar-card daily-${metric.key}`} key={metric.key}>
                  <header>
                    <div>
                      <span>{metric.label}</span>
                    </div>
                    <small>{metric.countLabel}</small>
                  </header>
                  {metric.segments.length ? (
                    <>
                      <div className="daily-segment-track" aria-label={`${metric.label}当天分段`}>
                        {metric.segments.map((segment) => (
                          <span
                            className="daily-segment"
                            key={segment.id}
                            style={{ flexGrow: Math.max(segment.grow, 0.1) }}
                            title={`${segment.time ? `${segment.time} ` : ""}${segment.label}`}
                          >
                            <b>
                              {segment.time ? <span>{segment.time}</span> : null}
                              <span>{segment.label}</span>
                            </b>
                          </span>
                        ))}
                      </div>
                      {metric.markers.length ? (
                        <div className="daily-care-times" aria-label={`${metric.label}关键时间`}>
                          {metric.markers.map((marker) => (
                            <span key={marker.id}>
                              <b>{marker.time}</b>
                              <em>{marker.label}</em>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="daily-care-empty">{metric.emptyLabel}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {recordView === "trend" ? (
          <section className="trend-card">
            <div className="section-title">
              <LineChart size={18} />
              <h2>近 7 天分段对比</h2>
            </div>
            {weeklyCareComparison.hasData ? (
              <div className="week-care-chart">
                <article className="week-care-metric week-care-milk">
                  <header>
                    <div>
                      <span>奶量</span>
                      <strong>每天总量，一段代表一次</strong>
                    </div>
                    <small>{weeklyCareComparison.milkAverageLabel}</small>
                  </header>
                  <div className="week-single-bars" aria-label="近7天奶量变化">
                    {weeklyCareComparison.days.map((day) => (
                      <div className={`week-care-day ${day.selected ? "selected" : ""}`} key={`${day.date}-milk`}>
                        <div className="week-value-label">{day.milkValue !== undefined ? <span>{compactValue(day.milkValue, "ml")}</span> : null}</div>
                        <span
                          className={`week-bar-track week-milk ${day.milkValue === undefined ? "empty" : ""}`}
                          title={`${day.date} 奶量 ${compactValue(day.milkValue, "ml")} ${day.milkCount ? `${day.milkCount}次` : ""}`}
                        >
                          <span className="week-segment-stack" style={{ "--bar-height": `${day.milkHeight}%` } as CSSProperties}>
                            {day.milkSegments.map((value, index) => (
                              <i key={`${day.date}-milk-${index}`} style={{ flexGrow: Math.max(value, 0.1) }} />
                            ))}
                          </span>
                        </span>
                        <em>{day.label}</em>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="week-care-metric week-care-sleep">
                  <header>
                    <div>
                      <span>睡眠</span>
                      <strong>每天总时长，一段代表一段睡眠</strong>
                    </div>
                    <small>{weeklyCareComparison.sleepAverageLabel}</small>
                  </header>
                  <div className="week-single-bars" aria-label="近7天睡眠变化">
                    {weeklyCareComparison.days.map((day) => (
                      <div className={`week-care-day ${day.selected ? "selected" : ""}`} key={`${day.date}-sleep`}>
                        <div className="week-value-label">{day.sleepValue !== undefined ? <span>{compactValue(day.sleepValue, "h", 1)}</span> : null}</div>
                        <span
                          className={`week-bar-track week-sleep ${day.sleepValue === undefined ? "empty" : ""}`}
                          title={`${day.date} 睡眠 ${compactValue(day.sleepValue, "h", 1)} ${day.sleepCount ? `${day.sleepCount}段` : ""}`}
                        >
                          <span className="week-segment-stack" style={{ "--bar-height": `${day.sleepHeight}%` } as CSSProperties}>
                            {day.sleepSegments.map((value, index) => (
                              <i key={`${day.date}-sleep-${index}`} style={{ flexGrow: Math.max(value, 0.1) }} />
                            ))}
                          </span>
                        </span>
                        <em>{day.label}</em>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
              <p className="trend-empty">连续记录几天后，我会在这里汇总对比。</p>
            )}
          </section>
          ) : null}

          {recordView === "trend" ? (
          <section className="trend-card growth-trend-card">
            <div className="section-title">
              <LineChart size={18} />
              <h2>成长趋势</h2>
            </div>
            <div className="growth-trend-grid">
              {growthTrendMetrics.map((metric) => (
                <article className={`growth-trend-item ${metric.hasData ? "has-data" : "empty"}`} key={metric.key}>
                  <span>{metric.label}</span>
                  <strong>{metric.valueLabel}</strong>
                  <small>{metric.deltaLabel}</small>
                  <em>{metric.dateLabel}</em>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {recordView === "calendar" ? (
          <section className="calendar-card">
            <div className="calendar-head">
              <button type="button" title="上个月" onClick={() => setCalendarMonth((month) => addMonths(month, -1))}>
                <ChevronLeft size={18} />
              </button>
              <strong>{monthTitle(calendarMonth)}</strong>
              <button type="button" title="下个月" onClick={() => setCalendarMonth((month) => addMonths(month, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="weekday-grid">
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDates.map((date, index) =>
                date ? (
                  <button
                    type="button"
                    className={[
                      date === selectedDate ? "selected" : "",
                      date === todayISO() ? "today" : "",
                      eventDates.has(date) ? "has-event" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={date}
                    onClick={() => selectRecordDate(date)}
                  >
                    <span>{Number(date.slice(-2))}</span>
                  </button>
                ) : (
                  <span className="calendar-blank" key={`blank-${index}`} />
                ),
              )}
            </div>
          </section>
          ) : null}

          {recordView === "today" || recordView === "calendar" ? (
          <section className="day-timeline-card">
            <div className="section-title">
              <Clock3 size={18} />
              <h2>当天时间线</h2>
            </div>
            {selectedEvents.length ? (
              <div className="record-event-list">
                {selectedEvents.map((event) => (
                  <article className={`record-event ${event.type} event-${event.kind} ${swipedTimelineEventId === event.id ? "is-swiped" : ""}`.trim()} key={event.id}>
                    <div className="record-event-rail" aria-hidden="true">
                      <span />
                    </div>
                    <div className="record-event-content">
                      <time className="record-event-time">{event.timeLabel}</time>
                      <div
                        className="record-event-swipe"
                        onPointerDown={(pointerEvent) => beginTimelineEventSwipe(pointerEvent, event)}
                        onPointerUp={(pointerEvent) => finishTimelineEventSwipe(pointerEvent, event)}
                        onPointerCancel={cancelTimelineEventSwipe}
                      >
                        {canEditTimelineEvent(event) && editingCareEventId !== event.id ? (
                          <div className="record-event-actions" aria-hidden={swipedTimelineEventId !== event.id}>
                            <button type="button" className="timeline-action-button edit" onClick={() => beginEditCareTimelineEvent(event)}>
                              <PencilLine size={15} />
                              <span>编辑</span>
                            </button>
                            <button type="button" className="timeline-action-button delete" onClick={() => requestDeleteCareTimelineEvent(event)}>
                              <Trash2 size={15} />
                              <span>删除</span>
                            </button>
                          </div>
                        ) : null}
                        <div
                          className="record-event-card"
                          onClick={() => {
                            if (swipedTimelineEventId === event.id) setSwipedTimelineEventId("");
                          }}
                        >
                          <span className="record-event-icon" aria-hidden="true">
                            <img src={recordEventIconSrc(event.kind)} alt="" />
                          </span>
                          <div className="record-event-copy">
                            <div className="record-event-primary">
                              <h3>{event.title}</h3>
                              <p>{event.body}</p>
                            </div>
                            <div className="record-event-secondary">
                              <div className="tag-row">
                                {event.tags.slice(0, 2).map((tag) => (
                                  <span key={tag}>{tag}</span>
                                ))}
                              </div>
                              {event.recordedBy ? <small className="record-creator">{creatorMetaText(event.recordedBy)}</small> : null}
                            </div>
                          </div>
                          {canCaregive && event.type === "care" && editingCareEventId === event.id ? (
                            <form className="timeline-edit-form" onSubmit={(formEvent) => saveCareTimelineEvent(formEvent, event)}>
                              <label>
                                <span>类型</span>
                                <StorySelect
                                  ariaLabel="时间线事件类型"
                                  value={careEventDraft.type}
                                  options={CARE_EVENT_TYPE_OPTIONS}
                                  onChange={(type) =>
                                    setCareEventDraft((current) => ({ ...current, type }))
                                  }
                                />
                              </label>
                              <label>
                                <span>时间</span>
                                <input
                                  value={careEventDraft.time}
                                  placeholder="例如 18:30"
                                  onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, time: inputEvent.target.value }))}
                                />
                              </label>
                              {careEventDraft.type === "milk" ? (
                                <label>
                                  <span>奶量 ml</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.amountMl}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, amountMl: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              {careEventDraft.type === "sleep" ? (
                                <label>
                                  <span>睡眠 h</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.durationHours}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, durationHours: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              {careEventDraft.type === "temperature" ? (
                                <label>
                                  <span>体温 °C</span>
                                  <input
                                    inputMode="decimal"
                                    value={careEventDraft.temperature}
                                    onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, temperature: inputEvent.target.value }))}
                                  />
                                </label>
                              ) : null}
                              <label className="wide">
                                <span>备注</span>
                                <input
                                  value={careEventDraft.note}
                                  onChange={(inputEvent) => setCareEventDraft((current) => ({ ...current, note: inputEvent.target.value }))}
                                />
                              </label>
                              <div className="timeline-edit-actions">
                                <button type="button" className="quiet" onClick={() => setEditingCareEventId("")}>
                                  取消
                                </button>
                                <button type="submit">保存</button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-sticker" aria-hidden="true">
                  <img src={recordsIcon} alt="" />
                </span>
                <p>这一天还没有关键记录。</p>
                {canCaregive ? (
                  <button type="button" onClick={() => quickFill(`今天${babyNickname}发生了什么？`)}>
                    去补充记录
                  </button>
                ) : null}
              </div>
            )}
          </section>
          ) : null}

          {recordView === "growth" ? (
            <>
            <section className="growth-curve-card" aria-label="成长曲线">
              <div className="section-title">
                <LineChart size={18} />
                <h2>成长曲线</h2>
              </div>
              <div className="growth-curve-toolbar" role="tablist" aria-label="成长曲线指标">
                {GROWTH_MEASUREMENT_TYPES.map((type) => {
                  const meta = GROWTH_MEASUREMENT_META[type];
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={growthCurveType === type}
                      className={growthCurveType === type ? "active" : ""}
                      key={type}
                      onClick={() => setGrowthCurveType(type)}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              {growthCurveData.points.length ? (
                <div className="growth-curve-frame">
                  <div className="growth-curve-scale" aria-hidden="true">
                    <span>{growthCurveData.maxLabel}</span>
                    <span>{growthCurveData.minLabel}</span>
                  </div>
                  <svg className="growth-curve-svg" viewBox="0 0 304 144" role="img" aria-label={`${GROWTH_MEASUREMENT_META[growthCurveType].label}变化曲线`}>
                    <line x1="20" x2="284" y1="24" y2="24" />
                    <line x1="20" x2="284" y1="71" y2="71" />
                    <line x1="20" x2="284" y1="118" y2="118" />
                    <polyline points={growthCurveData.polyline} />
                    {growthCurveData.points.map((point) => (
                      <g key={point.id}>
                        <circle cx={point.x} cy={point.y} r="4.5" />
                        <text x={point.x} y="136" textAnchor="middle">
                          {point.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <p className="growth-curve-latest">最新：{growthCurveData.latestLabel}</p>
                </div>
              ) : (
                <p className="growth-curve-empty">先记录一笔{GROWTH_MEASUREMENT_META[growthCurveType].label}，这里会自动生成曲线。</p>
              )}
            </section>
            <section className="growth-entry-card" aria-label="宝宝成长">
              <div className="growth-entry-card-head">
                <h3>成长数据</h3>
                <button type="button" className="growth-entry-card-open" onClick={openGrowthEntry}>
                  {growthMeasurements.length ? "记录 / 查看" : "记一笔"}
                </button>
              </div>
              {growthMeasurements.length > 0 ? (
                <div className="growth-entry-card-stats">
                  {GROWTH_MEASUREMENT_TYPES.map((type) => {
                    const items = growthMeasurements
                      .filter((m) => m.type === type)
                      .sort((a, b) => a.date.localeCompare(b.date));
                    const latest = items[items.length - 1];
                    const meta = GROWTH_MEASUREMENT_META[type];
                    return (
                      <div className="growth-entry-card-stat" key={type}>
                        <span className="growth-entry-card-stat-label">{meta.label}</span>
                        <span className="growth-entry-card-stat-value">
                          {latest ? `${latest.value}${meta.unit}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="growth-entry-card-empty">可以先记一笔身高、体重或头围，之后会更容易回看变化。</p>
              )}
              <button type="button" className="growth-observation-row" onClick={openMilestones}>
                <span className="growth-observation-icon" aria-hidden="true">
                  <Sparkles size={16} />
                </span>
                <span className="growth-observation-copy">
                  <strong>成长观察</strong>
                  <small>记录宝宝最近出现的新动作和第一次</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="growth-observation-row" onClick={openVaccine}>
                <span className="growth-observation-icon" aria-hidden="true">
                  <Syringe size={16} />
                </span>
                <span className="growth-observation-copy">
                  <strong>疫苗接种</strong>
                  <small>按月龄看该打哪些苗,别漏别晚</small>
                </span>
                {vaccinePending > 0 ? (
                  <span className="growth-observation-badge">{vaccinePending} 针待安排</span>
                ) : null}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </section>
            </>
          ) : null}
          </>
          )}
        </section>
  );
});
