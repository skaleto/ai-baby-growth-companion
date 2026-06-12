// 提醒管理屏(自 App.tsx 上帝类拆出——架构债 D1/Records 轮,分类法 D12:整屏进 screens/)。
// React.memo:其余 Tab 的 setState 不再重渲染本屏。函数 props 经 App 侧 ref 包装保证引用稳定。
// DOM 结构与拆分前逐字一致(CSS/测试不感知)。
import { memo, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Bell, BellOff, CheckCircle2, ChevronLeft, Clock3, PencilLine, Save, Syringe, Trash2, X } from "lucide-react";
import { isNativePlatform } from "../platform";
import { StorySelect } from "../components/StorySelect";
import {
  MAX_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
  REMINDER_ALERT_MODE_OPTIONS,
  REMINDER_CATEGORY_OPTIONS,
  REMINDER_SCHEDULE_MODE_OPTIONS,
  REMINDER_SOUND_OPTIONS,
} from "../appOptions";
import { REMINDER_QUICK_ACTIONS } from "../utils/reminderAssets";
import {
  reminderAlertLabel,
  reminderCategoryLabel,
  reminderNotificationLabel,
  reminderRepeatLabel,
  reminderScheduleLabel,
  reminderSoundLabel,
  reminderStatusLabel,
} from "../utils/reminderLabels";
import { isIntervalReminder } from "../appStateDomain";
import type { Reminder } from "../types";
import type { ReminderDraft, ReminderPostponeDraft } from "../reminderDraft";
import emptyRemindersImg from "../assets/illustrations/empty-reminders.png";

type ReminderQuickAction = (typeof REMINDER_QUICK_ACTIONS)[number];

export type RemindersScreenHandlers = {
  closeReminderManagement: () => void;
  openNewReminderEditor: () => void;
  openEditReminderEditor: (reminder: Reminder) => void;
  openReminderQuickDraft: (action: ReminderQuickAction) => void;
  closeReminderEditor: () => void;
  saveReminderDraft: (event: FormEvent) => void;
  requestCompleteReminder: (reminder: Reminder) => void;
  confirmCompleteReminder: () => void;
  closeCompleteReminderConfirm: () => void;
  requestPostponeReminder: (reminder: Reminder) => void;
  confirmPostponeReminder: () => void;
  closePostponeReminderConfirm: () => void;
  requestDeleteReminder: (reminder: Reminder) => void;
  confirmDeleteReminder: () => void;
  closeDeleteReminderConfirm: () => void;
};

export type RemindersScreenProps = {
  canCaregive: boolean;
  reminderManagementOpen: boolean;
  reminderBuckets: { today: Reminder[]; overdue: Reminder[]; upcoming: Reminder[]; done: Reminder[] };
  actionableReminderCount: number;
  reminderEditorOpen: boolean;
  editingReminderId: string;
  reminderDraft: ReminderDraft;
  completeReminderTarget: Reminder | null;
  postponeReminderTarget: Reminder | null;
  postponeReminderDraft: ReminderPostponeDraft;
  deleteReminderTarget: Reminder | null;
  setReminderDraft: Dispatch<SetStateAction<ReminderDraft>>;
  setPostponeReminderDraft: Dispatch<SetStateAction<ReminderPostponeDraft>>;
  handlers: RemindersScreenHandlers;
};

export const RemindersScreen = memo(function RemindersScreen({
  canCaregive,
  reminderManagementOpen,
  reminderBuckets,
  actionableReminderCount,
  reminderEditorOpen,
  editingReminderId,
  reminderDraft,
  completeReminderTarget,
  postponeReminderTarget,
  postponeReminderDraft,
  deleteReminderTarget,
  setReminderDraft,
  setPostponeReminderDraft,
  handlers,
}: RemindersScreenProps) {
  const {
    closeReminderManagement,
    openNewReminderEditor,
    openEditReminderEditor,
    openReminderQuickDraft,
    closeReminderEditor,
    saveReminderDraft,
    requestCompleteReminder,
    confirmCompleteReminder,
    closeCompleteReminderConfirm,
    requestPostponeReminder,
    confirmPostponeReminder,
    closePostponeReminderConfirm,
    requestDeleteReminder,
    confirmDeleteReminder,
    closeDeleteReminderConfirm,
  } = handlers;
  return (
        <section className="reminders-screen tab-content-enter" aria-label="提醒">
          <div className="screen-head">
            <div className="screen-heading-with-icon">
              {reminderManagementOpen ? (
                <button type="button" className="milestone-back" onClick={closeReminderManagement} aria-label="返回我的">
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              <div>
                <p className="eyebrow">我的</p>
                <h2>提醒管理</h2>
              </div>
            </div>
            <div className="screen-head-actions">
              <span className="screen-pill">{actionableReminderCount} 个未完成待办</span>
              {canCaregive ? (
                <button className="screen-action-button" type="button" onClick={openNewReminderEditor}>
                  <Bell size={16} />
                  新建
                </button>
              ) : null}
            </div>
          </div>

          {canCaregive ? (
            <div className="assistant-actions reminder-actions">
              {REMINDER_QUICK_ACTIONS.map((action) => (
                <button type="button" key={action.label} onClick={() => openReminderQuickDraft(action)}>
                  {action.label === "疫苗" || action.label === "喂药" ? <Syringe size={16} /> : <Bell size={16} />}
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="readonly-copy">当前身份仅可查看提醒，请让照护人新增或完成提醒。</p>
          )}

          {reminderBuckets.today.length === 0 &&
            reminderBuckets.upcoming.length === 0 &&
            reminderBuckets.overdue.length === 0 &&
            reminderBuckets.done.length === 0 ? (
              <div className="reminders-empty-hero">
                <img
                  src={emptyRemindersImg}
                  alt="还没有任何提醒"
                  width={200}
                  height={150}
                  className="reminders-empty-illustration"
                />
                <p className="reminders-empty-copy">还没有任何提醒。从上面点一个常用模板开始吧。</p>
              </div>
          ) : null}

          {[
            { key: "today", title: "今天要做", items: reminderBuckets.today, empty: "今天暂时没有待办。" },
            { key: "upcoming", title: "未来安排", items: reminderBuckets.upcoming, empty: "后面暂时没有安排。" },
            { key: "overdue", title: "已逾期", items: reminderBuckets.overdue, empty: "没有逾期任务。" },
            { key: "done", title: "已完成", items: reminderBuckets.done, empty: "完成后的提醒会留在这里。" },
          ].map((group) => (
            <section className={`reminder-group reminder-group-${group.key}`} key={group.key}>
              <div className="reminder-group-head">
                <h3>{group.title}</h3>
                <span>{group.items.length}</span>
              </div>
              {group.items.length ? (
                <div className="reminder-list">
                  {group.items.map((reminder) => (
                    <article className={`reminder-item ${reminder.category} status-${reminder.status}`} key={reminder.id}>
                      <div className="reminder-icon">
                        {reminder.category === "vaccine" ? <Syringe size={20} /> : <Clock3 size={20} />}
                      </div>
                      <div className="reminder-copy">
                        <h3>{reminder.title}</h3>
                        <p>{reminder.dueText}</p>
                        <div className="reminder-meta">
                          <span>{reminderScheduleLabel(reminder)}</span>
                          <span>{reminderAlertLabel(reminder)}</span>
                          <span>{reminderCategoryLabel(reminder.category)}</span>
                          <span>{reminderStatusLabel(reminder.status)}</span>
                          {reminderRepeatLabel(reminder) ? <span>{reminderRepeatLabel(reminder)}</span> : null}
                          {reminderSoundLabel(reminder) ? <span>{reminderSoundLabel(reminder)}</span> : null}
                          {reminderNotificationLabel(reminder) ? <span>{reminderNotificationLabel(reminder)}</span> : null}
                          <span>{reminder.history[0] ?? "来自家庭记录"}</span>
                        </div>
                      </div>
                      {canCaregive && reminder.status !== "done" ? (
                        <div className="reminder-card-actions">
                          <button type="button" title="标记完成" aria-label={`标记完成 ${reminder.title}`} onClick={() => requestCompleteReminder(reminder)}>
                            <CheckCircle2 size={18} />
                          </button>
                          <button type="button" title="延后提醒" aria-label={`延后提醒 ${reminder.title}`} onClick={() => requestPostponeReminder(reminder)}>
                            <Clock3 size={18} />
                          </button>
                          <button type="button" title="编辑提醒" aria-label={`编辑提醒 ${reminder.title}`} onClick={() => openEditReminderEditor(reminder)}>
                            <PencilLine size={18} />
                          </button>
                          <button type="button" title="删除提醒" aria-label={`删除提醒 ${reminder.title}`} onClick={() => requestDeleteReminder(reminder)}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="reminder-empty">{group.empty}</p>
              )}
            </section>
          ))}
          {reminderEditorOpen ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeReminderEditor}>
              <form
                className="story-modal reminder-editor reminder-form-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reminder-editor-title"
                onSubmit={saveReminderDraft}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="story-modal-head">
                  <div>
                    <p className="eyebrow">提醒设置</p>
                    <h3 id="reminder-editor-title">{editingReminderId ? "编辑提醒" : "新建提醒"}</h3>
                  </div>
                  <button type="button" className="icon-button" onClick={closeReminderEditor} aria-label="关闭">
                    <X size={18} />
                  </button>
                </div>
                <label>
                  提醒标题
                  <input
                    value={reminderDraft.title}
                    onChange={(event) => setReminderDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={reminderDraft.scheduleMode === "interval" ? "比如 喂奶提醒" : "比如 明天体检"}
                  />
                </label>
                <div className="reminder-editor-grid">
                  <label>
                    时间模式
                    <StorySelect
                      value={reminderDraft.scheduleMode}
                      options={REMINDER_SCHEDULE_MODE_OPTIONS}
                      ariaLabel="提醒时间模式"
                      onChange={(scheduleMode) => setReminderDraft((current) => ({ ...current, scheduleMode }))}
                    />
                  </label>
                  <label>
                    提醒方式
                    <StorySelect
                      value={reminderDraft.alertMode}
                      options={REMINDER_ALERT_MODE_OPTIONS}
                      ariaLabel="提醒方式"
                      onChange={(alertMode) => setReminderDraft((current) => ({ ...current, alertMode }))}
                    />
                  </label>
                </div>
                <div className="reminder-editor-grid">
                  <label>
                    分类
                    <StorySelect
                      value={reminderDraft.category}
                      options={REMINDER_CATEGORY_OPTIONS}
                      ariaLabel="提醒分类"
                      onChange={(category) => setReminderDraft((current) => ({ ...current, category }))}
                    />
                  </label>
                  {reminderDraft.alertMode === "ringing" ? (
                    <label>
                      提示音
                      <StorySelect
                        value={reminderDraft.soundId}
                        options={REMINDER_SOUND_OPTIONS}
                        ariaLabel="闹铃提示音"
                        onChange={(soundId) => setReminderDraft((current) => ({ ...current, soundId }))}
                      />
                    </label>
                  ) : null}
                </div>
                {reminderDraft.scheduleMode === "interval" ? (
                  <div className="reminder-alarm-fields">
                    <label>
                      循环间隔（分钟）
                      <input
                        type="number"
                        min={MIN_INTERVAL_MINUTES}
                        max={MAX_INTERVAL_MINUTES}
                        step="5"
                        value={reminderDraft.intervalMinutes}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, intervalMinutes: event.target.value }))}
                      />
                    </label>
                    <p className="form-help">喂奶类循环会优先按最近一次喝奶时间计算；其他循环按当前时间往后推。</p>
                  </div>
                ) : (
                  <div className="reminder-editor-grid">
                    <label>
                      日期
                      <input
                        type="date"
                        value={reminderDraft.dueDate}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      时间
                      <input
                        type="time"
                        value={reminderDraft.dueTime}
                        onChange={(event) => setReminderDraft((current) => ({ ...current, dueTime: event.target.value }))}
                      />
                    </label>
                  </div>
                )}
                {!isNativePlatform() ? <p className="form-help">浏览器里只显示 App 内提醒；安装到移动 App 后会调度手机本地通知。</p> : null}
                <div className="story-modal-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeReminderEditor}>
                    取消
                  </button>
                  <button type="submit" className="screen-action-button">
                    <Save size={16} />
                    保存
                  </button>
                </div>
              </form>
            </div>
          ) : null}
          {postponeReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closePostponeReminderConfirm}>
              <div
                className="story-modal reminder-action-modal reminder-postpone-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="postpone-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge complete-confirm-badge" aria-hidden="true">
                  <Clock3 size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">延后提醒</p>
                  <h3 id="postpone-reminder-title">延后到什么时候？</h3>
                  <p>选择新的提醒时间后，会取消当前已安排的手机通知并重新安排。</p>
                </div>
                <div className="reminder-postpone-fields">
                  <label>
                    日期
                    <input
                      type="date"
                      value={postponeReminderDraft.dueDate}
                      onChange={(event) => setPostponeReminderDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    时间
                    <input
                      type="time"
                      value={postponeReminderDraft.dueTime}
                      onChange={(event) => setPostponeReminderDraft((current) => ({ ...current, dueTime: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closePostponeReminderConfirm}>
                    先不延后
                  </button>
                  <button type="button" className="screen-action-button" onClick={() => void confirmPostponeReminder()}>
                    <Clock3 size={16} />
                    确认延后
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {completeReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeCompleteReminderConfirm}>
              <div
                className="story-modal reminder-action-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge complete-confirm-badge" aria-hidden="true">
                  <CheckCircle2 size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">完成提醒</p>
                  <h3 id="complete-reminder-title">
                    {isIntervalReminder(completeReminderTarget) ? "关闭本次提醒吗？" : "确认已经完成了吗？"}
                  </h3>
                  <p>
                    {isIntervalReminder(completeReminderTarget)
                      ? `“${completeReminderTarget.title}”会关闭本次提醒，并按当前时间重新安排下一次。`
                      : `“${completeReminderTarget.title}”会进入已完成，手机上已经安排的通知也会取消。`}
                  </p>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeCompleteReminderConfirm}>
                    先不完成
                  </button>
                  <button type="button" className="screen-action-button" onClick={() => void confirmCompleteReminder()}>
                    <CheckCircle2 size={16} />
                    确认完成
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {deleteReminderTarget ? (
            <div className="story-modal-backdrop reminder-sheet-backdrop" role="presentation" onMouseDown={closeDeleteReminderConfirm}>
              <div
                className="story-modal reminder-action-modal delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-reminder-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="delete-confirm-badge" aria-hidden="true">
                  <BellOff size={22} />
                </div>
                <div className="delete-confirm-copy">
                  <p className="eyebrow">删除提醒</p>
                  <h3 id="delete-reminder-title">确定不再提醒吗？</h3>
                  <p>“{deleteReminderTarget.title}”会从提醒列表移除，已经安排的手机通知或闹铃也会一起取消。</p>
                </div>
                <div className="story-modal-actions delete-confirm-actions">
                  <button type="button" className="screen-action-button quiet" onClick={closeDeleteReminderConfirm}>
                    先保留
                  </button>
                  <button type="button" className="screen-action-button danger" onClick={() => void confirmDeleteReminder()}>
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
  );
});
