// 聊天 Tab(自 App.tsx 上帝类拆出——架构债 D1/Chat 轮,分类法 D12:整屏进 screens/)。
// 这是单屏里最大的渲染块(~750 行):消息列表 + 逐条渲染(附件/相册提示/待确认 effect/记忆卡片)、
// 会话摘要/压缩横幅、以及 chat composer 表单(textarea/发送/语音长按/附件托盘/工具按钮)。
//
// React.memo:App 本体在无关 setState 时不再带着这棵聊天树重渲。memo 生效前提——函数 props
// 必须引用稳定:App 侧经 chatScreenHandlers 的 ref 包装保证(镜像 recordsScreenHandlers)。
// 数据 props(messages / composerMode / 语音状态等)合理变化时会重渲本屏,这是正确的。
//
// 打字隔离:composer 的 <ComposerTextarea> 订阅 composerInput external store——逐键 setState 只
// 重渲该 textarea,既不触达 ChatScreen,也不触达 App(见 features/chat/composerInput.tsx)。
// DOM 结构与拆分前逐字一致(CSS/手势/快照测试不感知)。
import {
  memo,
  type CSSProperties,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  Brain,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Globe2,
  Image as ImageIcon,
  Keyboard as KeyboardIcon,
  Mic,
  Send,
  ShieldAlert,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  EXPENSE_CATEGORY_OPTIONS,
  GROWTH_MEASUREMENT_META,
  GROWTH_MEASUREMENT_TYPES,
  MAX_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
  REMINDER_ALERT_MODE_OPTIONS,
  REMINDER_CATEGORY_OPTIONS,
  REMINDER_SCHEDULE_MODE_OPTIONS,
  REMINDER_SOUND_OPTIONS,
} from "../appOptions";
import { formatTime } from "../appStateDomain";
import { attachmentListSrc } from "../albumDomain";
import { formatMoney } from "../utils/expense";
import { StorySelect } from "../components/StorySelect";
import { AiDataNotice } from "../components/AiDataNotice";
import { AppDateField, AppTimeField } from "../components/appWheelFields";
import { ComposerTextarea } from "../features/chat/composerInput";
import type { ReminderDraft } from "../reminderDraft";
import type { ExpenseDraft } from "../features/ledger/useLedgerState";
import type {
  AlbumPrompt,
  Attachment,
  ChatMessage,
  EffectDecision,
  GrowthMeasurementType,
  PendingEffect,
  ToolActivity,
} from "../types";
import type {
  CompressionStatus,
  MediaUploadItem,
  PendingCareDraft,
  PendingEffectDraft,
  PendingGrowthDraft,
  PendingGrowthMeasurementDraft,
} from "../appContracts";
import companionAvatarIcon from "../assets/storybook-icons/companion-avatar.png";

// App 侧经 ref 包装、引用永远稳定的函数 props(同 recordsScreenHandlers 的间接模式)。
export type ChatScreenHandlers = {
  handleSubmit: (event: FormEvent) => void;
  handleFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  handleComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  toggleComposerMode: () => void;
  startVoicePress: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  releaseVoicePress: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  cancelVoicePointer: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  openMediaPicker: () => void;
  openPreviewAttachment: (attachment: Attachment, albumItem?: null) => void;
  quickFill: (text: string) => void;
  saveAlbumPrompt: (messageId: string, prompt: AlbumPrompt) => void;
  ignoreAlbumPrompt: (messageId: string, prompt: AlbumPrompt) => void;
  savePendingEffectDraft: (effect: PendingEffect) => void;
  confirmPendingEffect: (effect: PendingEffect) => void;
  discardPendingEffect: (effect: PendingEffect) => void;
  beginEditPendingEffect: (effect: PendingEffect) => void;
  updatePendingGrowthDraft: (patch: Partial<PendingGrowthDraft>) => void;
  updatePendingGrowthMeasurementDraft: (id: string, patch: Partial<PendingGrowthMeasurementDraft>) => void;
  updatePendingCareDraft: (patch: Partial<PendingCareDraft>) => void;
  updatePendingReminderDraft: (id: string, updater: (draft: ReminderDraft) => ReminderDraft) => void;
  updatePendingMemoryDraft: (id: string, text: string) => void;
  updatePendingExpenseDraft: (index: number, patch: Partial<ExpenseDraft>) => void;
};

export type ChatScreenProps = {
  // 数据(随聊天/输入/语音合理变化,变化即重渲本屏——正确)
  messages: ChatMessage[];
  babyNickname: string;
  familySpeakerName: string;
  compressionMessage: string;
  compressionStatus: CompressionStatus;
  quickActions: { label: string; prompt: string; Icon: LucideIcon }[];
  pendingEffects: PendingEffect[];
  confirmingPendingEffectIds: string[];
  editingPendingId: string;
  pendingDraft: PendingEffectDraft | null;
  // composer / 语音
  composerMode: "keyboard" | "voice";
  voiceHoldLabel: string;
  voiceButtonStyle: CSSProperties;
  voiceRecordingActive: boolean;
  isListening: boolean;
  voiceStatus: string;
  voiceCancelArmed: boolean;
  isSubmitting: boolean;
  isUploadingChatMedia: boolean;
  // 附件 / 上传托盘
  attachments: Attachment[];
  chatUploadItems: MediaUploadItem[];
  isAttachmentTrayOpen: boolean;
  canCollapseAttachmentTray: boolean;
  chatAttachmentCountLabel: string;
  chatAttachmentLimitLabel: string;
  isChatAttachmentLimitReached: boolean;
  attachmentTrayMetaLabel: string;
  attachmentTrayPreviewItems: Attachment[];
  attachmentTrayOverflowCount: number;
  // 视觉工具(相机)门禁
  canAttachVisuals: boolean;
  visualToolClassName: string;
  visualToolTitle: string;
  visualToolGated: boolean;
  visualToolDisabled: boolean;
  // refs(引用天然稳定)
  messageListRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  // 纯模块级 helper(模块作用域定义、引用稳定,从 App 透传,不可运行时 import App)
  visibleToolActivitiesForMessage: (message: ChatMessage) => ToolActivity[];
  isAgentProgressActivity: (activity: ToolActivity) => boolean;
  askDecisions: (decisions: EffectDecision[] | undefined) => { id: string; question: string; missingFields: string[] }[];
  pendingEffectSummary: (effect: PendingEffect) => string[];
  hostLabel: (url: string) => string;
  // setters(原生 dispatch,引用天然稳定)
  setRecordsAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setIsAttachmentTrayExpanded: Dispatch<SetStateAction<boolean>>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setEditingPendingId: Dispatch<SetStateAction<string>>;
  setPendingDraft: Dispatch<SetStateAction<PendingEffectDraft | null>>;
  handlers: ChatScreenHandlers;
};

export const ChatScreen = memo(function ChatScreen({
  messages,
  babyNickname,
  familySpeakerName,
  compressionMessage,
  compressionStatus,
  quickActions,
  pendingEffects,
  confirmingPendingEffectIds,
  editingPendingId,
  pendingDraft,
  composerMode,
  voiceHoldLabel,
  voiceButtonStyle,
  voiceRecordingActive,
  isListening,
  voiceStatus,
  voiceCancelArmed,
  isSubmitting,
  isUploadingChatMedia,
  attachments,
  chatUploadItems,
  isAttachmentTrayOpen,
  canCollapseAttachmentTray,
  chatAttachmentCountLabel,
  chatAttachmentLimitLabel,
  isChatAttachmentLimitReached,
  attachmentTrayMetaLabel,
  attachmentTrayPreviewItems,
  attachmentTrayOverflowCount,
  canAttachVisuals,
  visualToolClassName,
  visualToolTitle,
  visualToolGated,
  visualToolDisabled,
  messageListRef,
  fileInputRef,
  visibleToolActivitiesForMessage,
  isAgentProgressActivity,
  askDecisions,
  pendingEffectSummary,
  hostLabel,
  setRecordsAssistantOpen,
  setIsAttachmentTrayExpanded,
  setAttachments,
  setEditingPendingId,
  setPendingDraft,
  handlers,
}: ChatScreenProps) {
  const {
    handleSubmit,
    handleFiles,
    handleComposerKeyDown,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    openMediaPicker,
    openPreviewAttachment,
    quickFill,
    saveAlbumPrompt,
    ignoreAlbumPrompt,
    savePendingEffectDraft,
    confirmPendingEffect,
    discardPendingEffect,
    beginEditPendingEffect,
    updatePendingGrowthDraft,
    updatePendingGrowthMeasurementDraft,
    updatePendingCareDraft,
    updatePendingReminderDraft,
    updatePendingMemoryDraft,
    updatePendingExpenseDraft,
  } = handlers;

  return (
        <section className="chat-panel tab-content-enter" aria-label="每日聊天记录">
          <div className="chat-head">
            <div className="chat-companion-head">
              <div className="companion-badge" aria-hidden="true">
                <span className="companion-cloud" />
                <img className="companion-icon-img" src={companionAvatarIcon} alt="" />
              </div>
              <div>
                <p className="eyebrow">陪你记录{babyNickname}</p>
                <h2>今天想记点什么？</h2>
              </div>
            </div>
            <div className="head-actions">
              <AiDataNotice />
              <button
                type="button"
                className={`icon-button ${visualToolClassName}`.trim()}
                title={visualToolTitle}
                aria-disabled={visualToolGated}
                disabled={visualToolDisabled}
                onClick={openMediaPicker}
              >
                <CameraIcon size={18} />
              </button>
              <button
                type="button"
                className={`icon-button voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                title={composerMode === "voice" ? "键盘" : "语音"}
                onClick={toggleComposerMode}
              >
                {composerMode === "voice" ? <KeyboardIcon size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <button
              type="button"
              className="icon-button records-assistant-close"
              title="收起记录助手"
              aria-label="收起记录助手"
              onClick={() => setRecordsAssistantOpen(false)}
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="chat-prelude">
            {compressionMessage ? (
              <div className={`compression-notice ${compressionStatus}`} role="status">
                <Brain size={15} />
                <span>{compressionMessage}</span>
              </div>
            ) : null}

            <div className="quick-row">
              {quickActions.map(({ label, prompt, Icon }) => (
                <button type="button" className="quick-action" key={label} onClick={() => quickFill(prompt)}>
                  <span className="quick-action__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="quick-action__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="message-list" ref={messageListRef}>
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                {message.role === "ai" ? (
                  <span className="message-companion" aria-hidden="true">
                    <img src={companionAvatarIcon} alt="" />
                  </span>
                ) : null}
                <div className={`message-meta ${message.role === "ai" ? "message-meta-ai" : ""}`}>
                  {message.role === "parent" ? <span>{familySpeakerName}</span> : null}
                  <time>{formatTime(message.createdAt)}</time>
                </div>
                {message.role === "ai" && message.reasoning ? (
                  <details className="reasoning-box" open={message.isStreaming}>
                    <summary>{message.isStreaming ? "思考中" : "思考过程"}</summary>
                    <p>{message.reasoning}</p>
                  </details>
                ) : null}
                {message.role === "ai" && visibleToolActivitiesForMessage(message).length ? (
                  <div className="tool-activity-list">
                    {visibleToolActivitiesForMessage(message).map((activity) => (
                      <div className={`tool-activity ${activity.status}`} key={activity.id}>
                        {isAgentProgressActivity(activity) ? (
                          activity.status === "completed" ? (
                            <CheckCircle2 size={14} />
                          ) : activity.status === "failed" ? (
                            <X size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )
                        ) : (
                          <Globe2 size={14} />
                        )}
                        <span>{activity.message}</span>
                        {activity.query ? <small>{activity.query}</small> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.safetyAlerts?.length ? (
                  <div className="safety-alert-list">
                    {message.safetyAlerts.map((alert) => (
                      <div className={`safety-alert ${alert.level}`} key={`${alert.category}-${alert.message}`}>
                        <ShieldAlert size={15} />
                        <div>
                          <strong>{alert.message}</strong>
                          <span>{alert.recommendedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className={`message-text ${message.isStreaming ? "streaming" : ""}`}>
                  {message.isStreaming ? (
                    <span className="loading-stars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                  <p>{message.text}</p>
                </div>
                {message.sources?.length ? (
                  <div className="source-list" aria-label="联网查询来源">
                    {message.sources.map((source) => (
                      <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                        {hostLabel(source.url) ? <small>{hostLabel(source.url)}</small> : null}
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.attachments?.length ? (
                  <div className="attachment-strip">
                    {message.attachments.map((item) => (
                      <button
                        type="button"
                        className="attachment-thumb"
                        key={item.id}
                        onClick={() => {
                          if (!item.url) return;
                          openPreviewAttachment(item, null);
                        }}
                        disabled={!item.url}
                        title={item.url ? "查看大图" : item.name}
                      >
                        {item.kind === "image" && attachmentListSrc(item) ? (
                          <img src={attachmentListSrc(item)} alt={item.name} loading="lazy" decoding="async" />
                        ) : null}
                        {item.kind === "video" && item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.name} loading="lazy" decoding="async" />
                        ) : null}
                        {item.kind === "video" && !item.thumbnailUrl ? <Video size={20} /> : null}
                        {!item.url && item.kind !== "video" ? <ImageIcon size={18} /> : null}
                        <span>{item.kind === "video" ? "视频" : item.kind === "audio" ? "语音" : "照片"}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.tags?.length ? (
                  <div className="tag-row">
                    {message.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
                {message.role === "ai" && askDecisions(message.effectDecisions).length ? (
                  <div className="ask-effect-list">
                    {askDecisions(message.effectDecisions).map((decision) => (
                      <section className="ask-effect-card" key={decision.id}>
                        <CircleHelp size={16} />
                        <div>
                          <strong>需要补充一点信息</strong>
                          <span>{decision.question}</span>
                          {decision.missingFields.length ? (
                            <small>还需要：{decision.missingFields.join("、")}</small>
                          ) : null}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}
                {message.role === "ai" && message.albumPrompts?.length ? (
                  <div className="album-prompt-list">
                    {message.albumPrompts.map((prompt) => (
                      <section className={`album-prompt-card status-${prompt.status}`} key={prompt.id}>
                        <ImageIcon size={16} />
                        <div>
                          <strong>{prompt.status === "saved" ? "已保存到相册" : prompt.status === "ignored" ? "已忽略这段素材" : "这段素材可能值得保存到相册"}</strong>
                          <span>{prompt.status === "pending" ? "要保存吗？" : prompt.title}</span>
                          <small>{prompt.reason}</small>
                        </div>
                        {prompt.status === "pending" ? (
                          <div className="album-prompt-actions">
                            <button type="button" onClick={() => saveAlbumPrompt(message.id, prompt)}>
                              保存到相册
                            </button>
                            <button type="button" className="quiet" onClick={() => ignoreAlbumPrompt(message.id, prompt)}>
                              忽略
                            </button>
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : null}
                {message.role === "ai" &&
                pendingEffects.some((effect) => effect.messageId === message.id) ? (
                  <div className="pending-effect-list">
                    {pendingEffects
                      .filter((effect) => effect.messageId === message.id)
                      .map((effect) => {
                        const isConfirmingEffect = confirmingPendingEffectIds.includes(effect.id);
                        return (
                        <section className="pending-effect-card" key={effect.id}>
                          <div className="pending-effect-head">
                            <div>
                              <span>待确认记录</span>
                              <strong>{pendingEffectSummary(effect).join(" / ")}</strong>
                            </div>
                            <Clock3 size={16} />
                          </div>
                          {editingPendingId === effect.id ? (
                            pendingDraft ? (
                              <div className="pending-effect-form">
                                {pendingDraft.growthEvent ? (
                                  <fieldset>
                                    <legend>成长事件</legend>
                                    <label>
                                      标题
                                      <input
                                        value={pendingDraft.growthEvent.title}
                                        onChange={(event) => updatePendingGrowthDraft({ title: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      日期
                                      <AppDateField
                                        value={pendingDraft.growthEvent.date}
                                        onChange={(value) => updatePendingGrowthDraft({ date: value })}
                                      />
                                    </label>
                                    <label>
                                      摘要
                                      <textarea
                                        value={pendingDraft.growthEvent.summary}
                                        onChange={(event) => updatePendingGrowthDraft({ summary: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ) : null}
                                {pendingDraft.growthMeasurements.map((measurement) => {
                                  const meta = GROWTH_MEASUREMENT_META[measurement.type];
                                  return (
                                    <fieldset key={measurement.id}>
                                      <legend>成长数据</legend>
                                      <div className="pending-effect-grid">
                                        <label>
                                          类型
                                          <StorySelect
                                            value={measurement.type}
                                            options={GROWTH_MEASUREMENT_TYPES.map((type) => ({
                                              value: type,
                                              label: GROWTH_MEASUREMENT_META[type].label,
                                            }))}
                                            ariaLabel="待确认成长数据类型"
                                            onChange={(type) =>
                                              updatePendingGrowthMeasurementDraft(measurement.id, { type: type as GrowthMeasurementType })
                                            }
                                          />
                                        </label>
                                        <label>
                                          数值（{meta.unit}）
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            step={meta.step}
                                            min={meta.min}
                                            max={meta.max}
                                            value={measurement.value}
                                            onChange={(event) =>
                                              updatePendingGrowthMeasurementDraft(measurement.id, { value: event.target.value })
                                            }
                                          />
                                        </label>
                                      </div>
                                      <label>
                                        日期
                                        <AppDateField
                                          value={measurement.date}
                                          onChange={(value) =>
                                            updatePendingGrowthMeasurementDraft(measurement.id, { date: value })
                                          }
                                        />
                                      </label>
                                      <label>
                                        备注
                                        <textarea
                                          value={measurement.note}
                                          onChange={(event) =>
                                            updatePendingGrowthMeasurementDraft(measurement.id, { note: event.target.value })
                                          }
                                        />
                                      </label>
                                    </fieldset>
                                  );
                                })}
                                {pendingDraft.careLogPatch ? (
                                  <fieldset>
                                    <legend>照护记录</legend>
                                    <label>
                                      日期
                                      <AppDateField
                                        value={pendingDraft.careLogPatch.date}
                                        onChange={(value) => updatePendingCareDraft({ date: value })}
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        奶量 ml
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.milkMl}
                                          onChange={(event) => updatePendingCareDraft({ milkMl: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        喝奶次数
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.milkTimes}
                                          onChange={(event) => updatePendingCareDraft({ milkTimes: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        睡眠小时
                                        <input
                                          inputMode="decimal"
                                          value={pendingDraft.careLogPatch.sleepHours}
                                          onChange={(event) => updatePendingCareDraft({ sleepHours: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        夜醒次数
                                        <input
                                          inputMode="numeric"
                                          value={pendingDraft.careLogPatch.wakes}
                                          onChange={(event) => updatePendingCareDraft({ wakes: event.target.value })}
                                        />
                                      </label>
                                    </div>
                                    <label>
                                      便便
                                      <input
                                        value={pendingDraft.careLogPatch.poop}
                                        onChange={(event) => updatePendingCareDraft({ poop: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      体温
                                      <input
                                        inputMode="decimal"
                                        value={pendingDraft.careLogPatch.temperature}
                                        onChange={(event) => updatePendingCareDraft({ temperature: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      备注
                                      <textarea
                                        value={pendingDraft.careLogPatch.notes}
                                        onChange={(event) => updatePendingCareDraft({ notes: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ) : null}
                                {pendingDraft.reminders.map((item) => (
                                  <fieldset key={item.id}>
                                    <legend>提醒</legend>
                                    <label>
                                      标题
                                      <input
                                        value={item.draft.title}
                                        onChange={(event) =>
                                          updatePendingReminderDraft(item.id, (draft) => ({ ...draft, title: event.target.value }))
                                        }
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        时间模式
                                        <StorySelect
                                          value={item.draft.scheduleMode}
                                          options={REMINDER_SCHEDULE_MODE_OPTIONS}
                                          ariaLabel="待确认提醒时间模式"
                                          onChange={(scheduleMode) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, scheduleMode }))
                                          }
                                        />
                                      </label>
                                      <label>
                                        提醒方式
                                        <StorySelect
                                          value={item.draft.alertMode}
                                          options={REMINDER_ALERT_MODE_OPTIONS}
                                          ariaLabel="待确认提醒方式"
                                          onChange={(alertMode) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, alertMode }))
                                          }
                                        />
                                      </label>
                                    </div>
                                    <div className="pending-effect-grid">
                                      <label>
                                        分类
                                        <StorySelect
                                          value={item.draft.category}
                                          options={REMINDER_CATEGORY_OPTIONS}
                                          ariaLabel="待确认提醒分类"
                                          onChange={(category) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, category }))
                                          }
                                        />
                                      </label>
                                      {item.draft.alertMode === "ringing" ? (
                                        <label>
                                          提示音
                                          <StorySelect
                                            value={item.draft.soundId}
                                            options={REMINDER_SOUND_OPTIONS}
                                            ariaLabel="待确认闹铃提示音"
                                            onChange={(soundId) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, soundId }))
                                            }
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                    {item.draft.scheduleMode === "interval" ? (
                                      <label>
                                        循环间隔（分钟）
                                        <input
                                          type="number"
                                          min={MIN_INTERVAL_MINUTES}
                                          max={MAX_INTERVAL_MINUTES}
                                          step="5"
                                          value={item.draft.intervalMinutes}
                                          onChange={(event) =>
                                            updatePendingReminderDraft(item.id, (draft) => ({ ...draft, intervalMinutes: event.target.value }))
                                          }
                                        />
                                      </label>
                                    ) : (
                                      <div className="pending-effect-grid">
                                        <label>
                                          日期
                                          <AppDateField
                                            value={item.draft.dueDate}
                                            onChange={(value) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, dueDate: value }))
                                            }
                                          />
                                        </label>
                                        <label>
                                          时间
                                          <AppTimeField
                                            value={item.draft.dueTime}
                                            onChange={(value) =>
                                              updatePendingReminderDraft(item.id, (draft) => ({ ...draft, dueTime: value }))
                                            }
                                          />
                                        </label>
                                      </div>
                                    )}
                                  </fieldset>
                                ))}
                                {pendingDraft.memories.map((item) => (
                                  <fieldset key={item.id}>
                                    <legend>记忆</legend>
                                    <label>
                                      内容
                                      <textarea value={item.text} onChange={(event) => updatePendingMemoryDraft(item.id, event.target.value)} />
                                    </label>
                                  </fieldset>
                                ))}
                                {pendingDraft.expenses.map((item, index) => (
                                  <fieldset key={`pending-expense-${index}`}>
                                    <legend>账本支出</legend>
                                    <label>
                                      商品或用途
                                      <input
                                        value={item.title}
                                        onChange={(event) => updatePendingExpenseDraft(index, { title: event.target.value })}
                                      />
                                    </label>
                                    <div className="pending-effect-grid">
                                      <label>
                                        金额
                                        <input
                                          inputMode="decimal"
                                          value={item.amount}
                                          onChange={(event) => updatePendingExpenseDraft(index, { amount: event.target.value })}
                                        />
                                      </label>
                                      <label>
                                        日期
                                        <AppDateField
                                          value={item.date}
                                          onChange={(value) => updatePendingExpenseDraft(index, { date: value })}
                                        />
                                      </label>
                                    </div>
                                    <div className="pending-effect-grid">
                                      <label>
                                        分类
                                        <StorySelect
                                          value={item.category}
                                          options={EXPENSE_CATEGORY_OPTIONS}
                                          ariaLabel="待确认支出分类"
                                          onChange={(category) => updatePendingExpenseDraft(index, { category })}
                                        />
                                      </label>
                                      <label>
                                        商家
                                        <input
                                          value={item.merchant}
                                          onChange={(event) => updatePendingExpenseDraft(index, { merchant: event.target.value })}
                                        />
                                      </label>
                                    </div>
                                    <label>
                                      备注
                                      <textarea
                                        value={item.note}
                                        onChange={(event) => updatePendingExpenseDraft(index, { note: event.target.value })}
                                      />
                                    </label>
                                  </fieldset>
                                ))}
                              </div>
                            ) : null
                          ) : (
                            <div className="pending-effect-body">
                              {effect.growthEvent ? <p>成长：{effect.growthEvent.title}</p> : null}
                              {(effect.growthMeasurements ?? []).map((measurement) => {
                                const meta = GROWTH_MEASUREMENT_META[measurement.type];
                                return (
                                  <p key={measurement.id}>
                                    成长数据：{meta.label} {measurement.value}{meta.unit}
                                  </p>
                                );
                              })}
                              {effect.careLogPatch ? <p>照护：{effect.careLogPatch.notes?.join("、") || "已识别照护日志"}</p> : null}
                              {(effect.reminders ?? []).map((reminder) => (
                                <p key={reminder.id}>提醒：{reminder.dueText} {reminder.title}</p>
                              ))}
                              {(effect.memories ?? []).map((memory) => (
                                <p key={memory.id}>记忆：{memory.text}</p>
                              ))}
                              {(effect.expenses ?? []).map((expense) => (
                                <p key={expense.id}>支出：{expense.title} {formatMoney(expense.amount)}</p>
                              ))}
                            </div>
                          )}
                          <div className="pending-effect-actions">
                            {editingPendingId === effect.id ? (
                              <>
                                <button type="button" onClick={() => void savePendingEffectDraft(effect)}>
                                  保存
                                </button>
                                <button
                                  type="button"
                                  className="quiet"
                                  onClick={() => {
                                    setEditingPendingId("");
                                    setPendingDraft(null);
                                  }}
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => beginEditPendingEffect(effect)}>
                                编辑
                              </button>
                            )}
                            {editingPendingId === effect.id ? null : (
                              <>
                                <button type="button" disabled={isConfirmingEffect} onClick={() => void confirmPendingEffect(effect)}>
                                  {isConfirmingEffect ? "保存中" : "确认"}
                                </button>
                                <button type="button" className="quiet" disabled={isConfirmingEffect} onClick={() => void discardPendingEffect(effect)}>
                                  丢弃
                                </button>
                              </>
                            )}
                          </div>
                        </section>
                        );
                      })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form className={`composer ${voiceRecordingActive ? "voice-recording-hidden" : ""}`.trim()} onSubmit={handleSubmit}>
            {chatUploadItems.length || attachments.length ? (
              <div className={`pending-attachments ${isAttachmentTrayOpen ? "expanded" : "collapsed"}`}>
                <button
                  type="button"
                  className="pending-attachment-summary"
                  aria-expanded={isAttachmentTrayOpen}
                  aria-controls="pending-attachment-list"
                  aria-label={canCollapseAttachmentTray ? (isAttachmentTrayOpen ? "收起素材清单" : "展开素材清单") : "素材清单"}
                  title={chatAttachmentLimitLabel}
                  onClick={() => {
                    if (canCollapseAttachmentTray) {
                      setIsAttachmentTrayExpanded((current) => !current);
                    }
                  }}
                >
                  <span className="pending-attachment-summary-copy">
                    <span className="pending-attachment-count">{chatAttachmentCountLabel}</span>
                    {attachmentTrayMetaLabel ? <small>{attachmentTrayMetaLabel}</small> : null}
                  </span>
                  {isChatAttachmentLimitReached ? <span className="pending-attachment-limit full">已达上限</span> : null}
                  {attachmentTrayPreviewItems.length ? (
                    <span className="pending-attachment-stack" aria-hidden="true">
                      {attachmentTrayPreviewItems.map((item) => (
                        <span className="pending-stack-thumb" key={item.id}>
                          {item.kind === "image" && attachmentListSrc(item) ? (
                            <img src={attachmentListSrc(item)} alt="" loading="lazy" decoding="async" />
                          ) : item.kind === "video" && item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                          ) : item.kind === "video" ? (
                            <Video size={14} />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                        </span>
                      ))}
                      {attachmentTrayOverflowCount ? <span className="pending-stack-thumb overflow">+{attachmentTrayOverflowCount}</span> : null}
                    </span>
                  ) : null}
                  {canCollapseAttachmentTray ? <ChevronDown className="pending-attachment-chevron" size={17} aria-hidden="true" /> : null}
                </button>
                {isAttachmentTrayOpen ? (
                  <div className="pending-attachment-list" id="pending-attachment-list">
                    {chatUploadItems.map((item) => (
                      <div className={`pending-item upload-item ${item.status}`} key={item.id}>
                        <div className="pending-preview-button upload-state-icon" aria-hidden="true">
                          {item.kind === "video" ? <Video size={17} /> : <ImageIcon size={17} />}
                        </div>
                        <div className="upload-copy">
                          <span title={item.name}>{item.name}</span>
                          <small>{item.message ?? (item.status === "uploading" ? `上传 ${item.progress}%` : "准备中")}</small>
                          <div className="upload-progress-track" aria-hidden="true">
                            <div className="upload-progress-bar" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {attachments.map((item) => (
                      <div className="pending-item" key={item.id}>
                        <button
                          type="button"
                          className="pending-preview-button"
                          title={item.url ? "查看大图" : item.name}
                          disabled={!item.url}
                          onClick={() => {
                            if (!item.url) return;
                            openPreviewAttachment(item, null);
                          }}
                        >
                          {item.kind === "image" && attachmentListSrc(item) ? (
                            <img src={attachmentListSrc(item)} alt={item.name} loading="lazy" decoding="async" />
                          ) : item.kind === "video" && item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.name} loading="lazy" decoding="async" />
                          ) : (
                            <Video size={18} />
                          )}
                        </button>
                        <span>{item.name}</span>
                        <button
                          type="button"
                          className="pending-remove-button"
                          title="移除"
                          aria-label={`移除 ${item.name}`}
                          onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="composer-row">
              <div className="composer-tools" aria-label="输入工具">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  disabled={!canAttachVisuals || isSubmitting || isUploadingChatMedia}
                  onChange={handleFiles}
                />
                <button
                  type="button"
                  className={`tool-button ${visualToolClassName}`.trim()}
                  title={visualToolTitle}
                  aria-disabled={visualToolGated}
                  disabled={visualToolDisabled}
                  onClick={openMediaPicker}
                >
                  <CameraIcon size={19} />
                </button>
                <button
                  type="button"
                  className={`tool-button voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                  title={composerMode === "voice" ? "切换键盘输入" : "切换语音输入"}
                  aria-label={composerMode === "voice" ? "键盘输入" : "语音输入"}
                  aria-pressed={composerMode === "voice"}
                  disabled={isSubmitting}
                  onClick={toggleComposerMode}
                >
                  {composerMode === "voice" ? <KeyboardIcon size={19} /> : <Mic size={19} />}
                </button>
              </div>
              <div className="composer-input-line">
                {composerMode === "voice" ? (
                  <button
                    type="button"
                    className={`voice-hold-button ${isListening ? "listening" : ""} ${voiceStatus} ${voiceCancelArmed ? "canceling" : ""}`}
                    style={voiceButtonStyle}
                    disabled={isSubmitting}
                    aria-label="按住说话"
                    onPointerDown={startVoicePress}
                    onPointerUp={releaseVoicePress}
                    onPointerCancel={cancelVoicePointer}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <span>{voiceHoldLabel}</span>
                  </button>
                ) : (
                  <ComposerTextarea
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`记录${babyNickname}今天的新变化...`}
                    disabled={isSubmitting}
                  />
                )}
                <button className="send-button" type="submit" title={isUploadingChatMedia ? "素材上传中" : isSubmitting ? "处理中" : "发送"} disabled={isSubmitting || isUploadingChatMedia}>
                  <Send size={19} />
                </button>
              </div>
            </div>
          </form>
        </section>
  );
});
