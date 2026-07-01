// 记录页的「AI 自动记录 / 手动记录」全屏抽屉(自 App.tsx 上帝类拆出——架构债 D1,分类法 D12)。
// 这是打字所在的 AI/手动 composer 抽屉,createPortal 到 document.body;从记录区提升为 <RecordsScreen/> 的
// 兄弟节点后,DOM 输出与拆分前逐字一致(CSS/手势/快照测试不感知)——纯移动,非重写。
//
// React.memo:App 本体在无关 setState 时不再带着这棵抽屉树重渲。memo 生效前提——函数 props 引用稳定:
// App 侧经 recordsEntryDrawerHandlers 的 ref 包装保证(镜像 chatScreenHandlers)。
// 数据 props(抽屉开合 / 草稿 / 语音状态 / 待确认 effect / 最近消息等)合理变化时会重渲本块,这是正确的。
//
// 打字隔离:composer 的 <ComposerTextarea> 订阅 composerInput external store——逐键 setState 只重渲该
// textarea,既不触达本抽屉,也不触达 App(见 features/chat/composerInput.tsx)。
import { memo, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Camera as CameraIcon,
  Clock3,
  Image as ImageIcon,
  Keyboard as KeyboardIcon,
  Mic,
  Send,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { currentClockText, formatDate, formatTime, normalizeClockText } from "../appStateDomain";
import { AppTimeField } from "../components/appWheelFields";
import { ComposerTextarea } from "../features/chat/composerInput";
import type {
  Attachment,
  ChatMessage,
  PendingEffect,
} from "../types";
import type {
  CareEventDraft,
  ComposerMode,
  ManualNumericDraftKey,
  ManualRecordKind,
  ManualRecordTypeOption,
  MediaUploadItem,
  RecordsEntryDrawer as RecordsEntryDrawerKind,
} from "../appContracts";

// App 侧经 ref 包装、引用永远稳定的函数 props(同 chatScreenHandlers 的间接模式)。
export type RecordsEntryDrawerHandlers = {
  closeRecordsEntryDrawer: () => void;
  pendingEffectSummary: (effect: PendingEffect) => string[];
  confirmPendingEffect: (effect: PendingEffect) => void;
  discardPendingEffect: (effect: PendingEffect) => void;
  handleSubmit: (event: FormEvent) => void;
  openMediaPicker: () => void;
  toggleComposerMode: () => void;
  startVoicePress: (event: React.PointerEvent<HTMLButtonElement>) => void;
  releaseVoicePress: (event: React.PointerEvent<HTMLButtonElement>) => void;
  cancelVoicePointer: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  saveManualCareEvent: (event: FormEvent) => void;
  selectManualRecordKind: (type: ManualRecordKind) => void;
  updateManualCareDraft: (patch: Partial<CareEventDraft>) => void;
  adjustManualNumericDraft: (
    field: ManualNumericDraftKey,
    delta: number,
    fallback: number,
    min: number,
    max: number,
    decimals?: number,
  ) => void;
  // 纯模块级 helper（App 模块作用域定义、引用稳定，从 App 透传，不可运行时 import App）
  timePresetValue: (offsetMinutes: number) => string;
  numericDraftText: (value: number, decimals?: number) => string;
  sleepDurationText: (value: string) => string;
};

export type RecordsEntryDrawerProps = {
  // 门禁 / 开合
  canCaregive: boolean;
  recordsEntryDrawer: RecordsEntryDrawerKind;
  recordsEntryDrawerClosing: boolean;
  // 日期上下文
  selectedDate: string;
  selectedDateIsToday: boolean;
  // AI 抽屉数据
  pendingEffects: PendingEffect[];
  confirmingPendingEffectIds: string[];
  messages: ChatMessage[];
  isSubmitting: boolean;
  chatUploadItems: MediaUploadItem[];
  attachments: Attachment[];
  // composer / 语音
  voiceRecordingActive: boolean;
  composerMode: ComposerMode;
  canUseComposerInput: boolean;
  isListening: boolean;
  voiceStatus: string;
  voiceCancelArmed: boolean;
  voiceButtonStyle: CSSProperties;
  voiceHoldLabel: string;
  babyNickname: string;
  isUploadingChatMedia: boolean;
  // 视觉工具（相机）门禁
  visualToolClassName: string;
  visualToolTitle: string;
  visualToolGated: boolean;
  visualToolDisabled: boolean;
  // 手动记录
  manualRecordKind: ManualRecordKind;
  careEventDraft: CareEventDraft;
  // 手动记录的模块级常量（App 模块作用域定义、引用稳定，从 App 透传）
  manualRecordTypes: ManualRecordTypeOption[];
  manualTimePresets: { label: string; offsetMinutes: number }[];
  manualMilkAmounts: number[];
  manualMilkNotes: string[];
  manualSleepDurations: { label: string; value: string }[];
  manualTemperatureOptions: number[];
  manualPoopNotes: string[];
  manualSolidNotes: string[];
  handlers: RecordsEntryDrawerHandlers;
};

export const RecordsEntryDrawer = memo(function RecordsEntryDrawer({
  canCaregive,
  recordsEntryDrawer,
  recordsEntryDrawerClosing,
  selectedDate,
  selectedDateIsToday,
  pendingEffects,
  confirmingPendingEffectIds,
  messages,
  isSubmitting,
  chatUploadItems,
  attachments,
  voiceRecordingActive,
  composerMode,
  canUseComposerInput,
  isListening,
  voiceStatus,
  voiceCancelArmed,
  voiceButtonStyle,
  voiceHoldLabel,
  babyNickname,
  isUploadingChatMedia,
  visualToolClassName,
  visualToolTitle,
  visualToolGated,
  visualToolDisabled,
  manualRecordKind,
  careEventDraft,
  manualRecordTypes,
  manualTimePresets,
  manualMilkAmounts,
  manualMilkNotes,
  manualSleepDurations,
  manualTemperatureOptions,
  manualPoopNotes,
  manualSolidNotes,
  handlers,
}: RecordsEntryDrawerProps) {
  const {
    closeRecordsEntryDrawer,
    pendingEffectSummary,
    confirmPendingEffect,
    discardPendingEffect,
    handleSubmit,
    openMediaPicker,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    handleComposerKeyDown,
    saveManualCareEvent,
    selectManualRecordKind,
    updateManualCareDraft,
    adjustManualNumericDraft,
    timePresetValue,
    numericDraftText,
    sleepDurationText,
  } = handlers;

  // 打字所在的 AI/手动 composer 抽屉 createPortal 到 document.body,DOM 输出与拆分前一致;
  // 从记录区提升为 <RecordsScreen/> 的兄弟节点后,打字逐键 setState 只重渲 App,不再触达 memo 的记录树。
  if (!(canCaregive && recordsEntryDrawer)) return null;

  return createPortal(
    <div
      className={`records-entry-scrim app-portal ${recordsEntryDrawerClosing ? "is-closing" : "is-open"}`}
      role="presentation"
      onClick={closeRecordsEntryDrawer}
    >
      <section
        className={`records-entry-drawer ${
          recordsEntryDrawer === "ai" ? "records-assistant-drawer" : "records-manual-drawer"
        } ${recordsEntryDrawerClosing ? "is-closing" : "is-open"}`}
        role="dialog"
        aria-modal="true"
        aria-label={recordsEntryDrawer === "ai" ? "AI 自动记录" : "手动记录"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="records-drawer-head">
          <div>
            <strong>{recordsEntryDrawer === "ai" ? "AI 自动记录" : "手动记录"}</strong>
            <small>
              {recordsEntryDrawer === "ai"
                ? "说一句或上传照片，我会整理成当天记录"
                : `保存到${selectedDateIsToday ? "今天" : formatDate(selectedDate)}的时间线`}
            </small>
          </div>
          <button type="button" aria-label="关闭" onClick={closeRecordsEntryDrawer}>
            <X size={18} />
          </button>
        </div>

        <div className={`records-drawer-body ${recordsEntryDrawer === "ai" ? "records-drawer-body--assistant" : "records-drawer-body--manual"}`}>
          {recordsEntryDrawer === "ai" ? (
            <>
              <div className="records-assistant-main">
                <div className="records-assistant-body">
                  <Sparkles size={16} />
                  <span>直接描述今天发生了什么，我会整理成记录并同步到今日、趋势和时间线。</span>
                </div>
                {pendingEffects.length ? (
                  <div className="records-assistant-pending-list">
                    {pendingEffects.slice(0, 2).map((effect) => {
                      const isConfirmingEffect = confirmingPendingEffectIds.includes(effect.id);
                      return (
                        <section className="records-assistant-pending-card" key={effect.id}>
                          <Clock3 size={14} />
                          <div>
                            <strong>{pendingEffectSummary(effect).join(" / ")}</strong>
                            <small>待确认记录</small>
                          </div>
                          <button type="button" disabled={isConfirmingEffect} onClick={() => void confirmPendingEffect(effect)}>
                            {isConfirmingEffect ? "保存中" : "确认"}
                          </button>
                          <button type="button" className="quiet" disabled={isConfirmingEffect} onClick={() => void discardPendingEffect(effect)}>
                            丢弃
                          </button>
                        </section>
                      );
                    })}
                  </div>
                ) : null}
                <div className="records-assistant-thread" aria-label="最近对话">
                  <span className="records-assistant-section-label">最近相关内容</span>
                  {messages.slice(-3).map((message) => (
                    <article className={`records-assistant-message ${message.role}`} key={message.id}>
                      <time>{formatTime(message.createdAt)}</time>
                      <p>{message.text}</p>
                    </article>
                  ))}
                  {isSubmitting ? (
                    <article className="records-assistant-message ai records-assistant-message--processing" role="status" aria-live="polite">
                      <time>处理中</time>
                      <p className="records-assistant-processing">
                        <span className="loading-stars records-assistant-loading-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span>正在整理</span>
                      </p>
                    </article>
                  ) : null}
                </div>
                {chatUploadItems.length || attachments.length ? (
                  <div className="records-assistant-attachments">
                    {chatUploadItems.map((item) => (
                      <span className={`records-assistant-attachment ${item.status}`} key={item.id}>
                        {item.kind === "video" ? <Video size={13} /> : <ImageIcon size={13} />}
                        {item.status === "uploading" ? `上传 ${item.progress}%` : item.name}
                      </span>
                    ))}
                    {attachments.map((item) => (
                      <span className="records-assistant-attachment" key={item.id}>
                        {item.kind === "video" ? <Video size={13} /> : item.kind === "audio" ? <Mic size={13} /> : <ImageIcon size={13} />}
                        {item.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <form className={`records-assistant-composer ${voiceRecordingActive ? "voice-recording-hidden" : ""}`.trim()} onSubmit={handleSubmit}>
                <div className="records-assistant-tool-row">
                  <button
                    type="button"
                    className={`records-assistant-tool ${visualToolClassName}`.trim()}
                    title={visualToolTitle}
                    aria-disabled={visualToolGated}
                    disabled={visualToolDisabled}
                    onClick={openMediaPicker}
                  >
                    <CameraIcon size={18} />
                    <span>照片</span>
                  </button>
                  <button
                    type="button"
                    className={`records-assistant-tool voice-toggle ${composerMode === "voice" ? "active" : ""}`}
                    title={composerMode === "voice" ? "切换键盘输入" : "切换语音输入"}
                    aria-label={composerMode === "voice" ? "键盘输入" : "语音输入"}
                    aria-pressed={composerMode === "voice"}
                    disabled={!canUseComposerInput}
                    onClick={toggleComposerMode}
                  >
                    {composerMode === "voice" ? <KeyboardIcon size={18} /> : <Mic size={18} />}
                    <span>{composerMode === "voice" ? "键盘" : "语音"}</span>
                  </button>
                </div>
                <div className="records-assistant-input-line">
                  {composerMode === "voice" ? (
                    <button
                      type="button"
                      className={`voice-hold-button ${isListening ? "listening" : ""} ${voiceStatus} ${voiceCancelArmed ? "canceling" : ""}`}
                      style={voiceButtonStyle}
                      disabled={!canUseComposerInput}
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
                      disabled={!canUseComposerInput}
                    />
                  )}
                  <button className="send-button" type="submit" title={isUploadingChatMedia ? "素材上传中" : isSubmitting ? "处理中" : "发送"} disabled={isSubmitting || isUploadingChatMedia}>
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form className="manual-record-form" onSubmit={saveManualCareEvent}>
              <div className="manual-record-type-tabs" role="tablist" aria-label="手动记录类型">
                {manualRecordTypes.map((option) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={manualRecordKind === option.type}
                    className={manualRecordKind === option.type ? "active" : ""}
                    key={option.type}
                    onClick={() => selectManualRecordKind(option.type)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="manual-record-type-hint">
                {manualRecordTypes.find((option) => option.type === manualRecordKind)?.hint}
              </p>
              <div className="manual-record-fields">
                <fieldset className="manual-picker-field wide">
                  <legend>时间</legend>
                  <div className="manual-choice-grid manual-time-presets">
                    {manualTimePresets.map((option) => {
                      const value = timePresetValue(option.offsetMinutes);
                      return (
                        <button
                          type="button"
                          className={careEventDraft.time === value ? "active" : ""}
                          key={option.label}
                          onClick={() => updateManualCareDraft({ time: value })}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="manual-native-picker">
                    <span>精确时间</span>
                    <AppTimeField
                      value={normalizeClockText(careEventDraft.time) ?? currentClockText()}
                      onChange={(value) => updateManualCareDraft({ time: value })}
                    />
                  </label>
                </fieldset>

                {manualRecordKind === "milk" ? (
                  <>
                    <fieldset className="manual-stepper-field">
                      <legend>奶量</legend>
                      <div className="manual-stepper">
                        <button type="button" aria-label="减少奶量" onClick={() => adjustManualNumericDraft("amountMl", -10, 120, 10, 300)}>
                          -
                        </button>
                        <strong>
                          {careEventDraft.amountMl || "--"}
                          <small>ml</small>
                        </strong>
                        <button type="button" aria-label="增加奶量" onClick={() => adjustManualNumericDraft("amountMl", 10, 120, 10, 300)}>
                          +
                        </button>
                      </div>
                      <div className="manual-choice-grid">
                        {manualMilkAmounts.map((amount) => (
                          <button
                            type="button"
                            className={careEventDraft.amountMl === String(amount) ? "active" : ""}
                            key={amount}
                            onClick={() => updateManualCareDraft({ amountMl: String(amount) })}
                          >
                            {amount}ml
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="manual-picker-field">
                      <legend>奶的类型</legend>
                      <div className="manual-choice-grid">
                        {manualMilkNotes.map((note) => (
                          <button
                            type="button"
                            className={careEventDraft.note === note ? "active" : ""}
                            key={note}
                            onClick={() => updateManualCareDraft({ note })}
                          >
                            {note}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                ) : null}

                {manualRecordKind === "sleep" ? (
                  <fieldset className="manual-stepper-field wide">
                    <legend>睡眠时长</legend>
                    <div className="manual-stepper">
                      <button type="button" aria-label="减少睡眠时长" onClick={() => adjustManualNumericDraft("durationHours", -0.25, 1, 0.25, 16, 2)}>
                        -
                      </button>
                      <strong>{sleepDurationText(careEventDraft.durationHours)}</strong>
                      <button type="button" aria-label="增加睡眠时长" onClick={() => adjustManualNumericDraft("durationHours", 0.25, 1, 0.25, 16, 2)}>
                        +
                      </button>
                    </div>
                    <div className="manual-choice-grid manual-choice-grid--wide">
                      {manualSleepDurations.map((duration) => (
                        <button
                          type="button"
                          className={careEventDraft.durationHours === duration.value ? "active" : ""}
                          key={duration.value}
                          onClick={() => updateManualCareDraft({ durationHours: duration.value })}
                        >
                          {duration.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {manualRecordKind === "temperature" ? (
                  <fieldset className="manual-stepper-field wide">
                    <legend>体温</legend>
                    <div className="manual-stepper">
                      <button type="button" aria-label="降低体温" onClick={() => adjustManualNumericDraft("temperature", -0.1, 36.8, 34, 42, 1)}>
                        -
                      </button>
                      <strong>
                        {careEventDraft.temperature || "未选择"}
                        <small>°C</small>
                      </strong>
                      <button type="button" aria-label="升高体温" onClick={() => adjustManualNumericDraft("temperature", 0.1, 36.8, 34, 42, 1)}>
                        +
                      </button>
                    </div>
                    <div className="manual-choice-grid manual-choice-grid--wide">
                      {manualTemperatureOptions.map((temperature) => {
                        const value = numericDraftText(temperature, 1);
                        return (
                          <button
                            type="button"
                            className={careEventDraft.temperature === value ? "active" : ""}
                            key={value}
                            onClick={() => updateManualCareDraft({ temperature: value })}
                          >
                            {value}°C
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : null}

                {manualRecordKind === "poop" ? (
                  <fieldset className="manual-picker-field wide">
                    <legend>状态</legend>
                    <div className="manual-choice-grid manual-choice-grid--wide">
                      {manualPoopNotes.map((note) => (
                        <button
                          type="button"
                          className={careEventDraft.note === note ? "active" : ""}
                          key={note}
                          onClick={() => updateManualCareDraft({ note })}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {manualRecordKind === "solid" ? (
                  <fieldset className="manual-picker-field wide">
                    <legend>辅食</legend>
                    <div className="manual-choice-grid manual-choice-grid--wide">
                      {manualSolidNotes.map((note) => (
                        <button
                          type="button"
                          className={careEventDraft.note === note ? "active" : ""}
                          key={note}
                          onClick={() => updateManualCareDraft({ note })}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </div>
              <div className="records-manual-actions">
                <button type="button" className="quiet" onClick={closeRecordsEntryDrawer}>
                  取消
                </button>
                <button type="submit">保存记录</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
});
