// 聊天 / 语音 / Agent 流式 / 媒体上传一族的状态与逻辑(架构债 D1:从 App 上帝组件抽出 chat LOGIC)。
//
// 从 App.tsx 这个巨型组件里原样抽出 chat 一族的 state / refs / effect / 处理函数 / 派生值,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。**这是核心 AI 功能**:发送消息、流式回答、
// 工具调用、语音输入、媒体上传、附件处理必须与从前完全一致地工作。Move, not rewrite。
//
// 调用约定(Option B,沿用 ledger / reminders / records / album / session):App.tsx「提前」调用本 hook,
// 并把返回值解构回与原来同名的局部变量,因此 App.tsx 里其余引用(openRecordsAssistant /
// closeRecordsEntryDrawer / chatScreenHandlers 包 / 内联 composer JSX / ChatScreen props)一律照常编译。
//
// 排序约束(关键):本 hook 产出 `mediaUploadItems` + `processSelectedMediaFiles`,而 useAlbumState
// 消费它们(albumUploadItems 由 mediaUploadItems 派生;album 选图也走 processSelectedMediaFiles)。
// 故本 hook 必须排在 useAlbumState **之前**调用。App 把本 hook 返回的 mediaUploadItems /
// processSelectedMediaFiles 传进 useAlbumState。
//
// 留在 App.tsx(作 deps 传入;晚定义的经 chatLateRef 注入)——见任务约束「too woven, LEAVE in App」:
//  - STORE:messages / setMessages / setAlbumItems / setConversationSummary / profile / careLogs /
//    memories / setStorageStatus 等(早定义,按值传入)。
//  - composerInput store:本 hook 经 composerInput.get()/.set()(从 ./composerInput import)读写草稿,
//    与 App 原本经 inputValueRef/setInput 的写法逐字节一致;<ComposerTextarea> 留在 ChatScreen 不动。
//  - 持久化 / 编排(定义比本 hook 调用点晚,经 chatLateRef 注入):persistRecord / applyStateResponse /
//    persistAlbumItemOptimistic / showSystemWeakNotice / applyForProTrial / buildAgentPageContext /
//    readAppState。buildAgentPageContext 深耦合 records/ledger/pending-effect 一族(activeMobileTab /
//    selectedEvents / openReminders / sortedExpenses / pendingEffectSummary …),故留在 App,提交时经
//    chatLateRef 在 call-time 调用。
//  - 渲染/编排(留在 App,读本 hook 解构回的同名值):openRecordsAssistant(用 composerMode /
//    toggleComposerMode / openMediaPicker)、closeRecordsEntryDrawer(records 偏差④,用 voiceRecordingActive /
//    cancelVoiceCapture,且 test:voice-capture-panel 断言该行留在 App)、messageList 自动滚动 useLayoutEffect
//    (耦合 activeMobileTab / recordsAssistantOpen / messageListRef,属布局编排)、chatScreenHandlers 稳定包
//    (混入 openPreviewAttachment / quickFill / pending-effect / album-prompt 一族 App-resident 处理函数,
//    故整包留在 App;App 解构回本 hook 的 chat 处理函数后按原结构组装,引用稳定性不变)。
//  - 共享 ref:backendReadyRef(被 bootstrap/auth 等多处用)、compressionInFlightRef /
//    compressionResetTimerRef(后者还被 App 卸载清理 effect 引用,为保该 effect 逐字节不变而留在 App),
//    按值传入。messageListRef / hasPositionedMessageListRef / messageScrollSignatureRef 随滚动 effect 留在 App。
//  - 派生依赖:canCaregive / hasAiQuota / canAttachVisuals(后者还被 App 一个 effect 用)/ recordsEntryDrawer
//    (canUseComposerInput 用,records state)按值传入。
//
// 与 album 抽取一致:本 hook 直接 import 的 agentApi / albumDomain / 上传管线等模块全程可用,无运行时环;
// 对 App-local 类型只做「类型」import(编译期擦除)。chat 外也引用的纯判定 isAgentProgressActivity /
// hasCareLogContent 下沉到 ../../utils/agentChatShared,App 与本 hook 各自 import(不反向 import App)。
import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { AgentApiError, compressConversationSummary, runAgentChatStream, type AgentStreamStatusType } from "../../agentApi";
import {
  albumItemFromDecision,
  albumItemFromStandaloneAttachment,
  albumPromptFromDecision,
  albumPromptFromEffectDecision,
  decideAlbumMedia,
  dedupeAlbumItems,
  resolveAlbumEffectTarget,
  type AlbumMediaDecision,
} from "../../albumDomain";
import { ensureMicrophonePermission } from "../../audioPermission";
import { readAppState, type AppStateResponse, type PersistRecord, uploadFileAttachment } from "../../appStateApi";
import { AsrStreamController, runAsrStream } from "../../asrApi";
import { makeId, todayISO } from "../../data";
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess, hapticWarning } from "../../haptics";
import { resolveMediaCaptureDate } from "../../mediaCaptureDate";
import { isNativeMediaPickerAvailable, isNativeMediaPickerCancel, pickNativeMediaFiles } from "../../nativeMediaPicker";
import { reportClientError } from "../../errorReporting";
import { babyProfileForAgent, currentClockText, normalizeCareLogEvent, normalizeClockText, normalizeExpenseItem, normalizeMemoryCategory, normalizeReminder } from "../../appStateDomain";
import { careEventTitleMap, inferCareEventType } from "../../utils/careLogHelpers";
import { positiveNumber } from "../../recordsDomain";
import {
  AGENT_IMAGE_MAX_EDGE_BATCH,
  AGENT_IMAGE_MAX_EDGE_SINGLE,
  AGENT_IMAGE_TARGET_CHARS_LARGE_BATCH,
  AGENT_IMAGE_TARGET_CHARS_SINGLE,
  AGENT_IMAGE_TARGET_CHARS_SMALL_BATCH,
  MAX_AGENT_ATTACHMENT_DATA_URL_CHARS,
  MAX_ALBUM_PICKER_ATTACHMENTS,
  MAX_CHAT_ATTACHMENTS,
  VIDEO_THUMBNAIL_TIMEOUT_MS,
  formatFileSize,
  maxMediaUploadBytes,
} from "../../utils/uploadLimits";
import { isAgentProgressActivity, hasCareLogContent } from "../../utils/agentChatShared";
import { DEFAULT_MODEL } from "../../appOptions";
import { composerInput, composerInputRef } from "./composerInput";
import type {
  AgentChatResponse,
  AgentModelId,
  AgentPageContext,
  AgentSource,
  AlbumItem,
  AppStateSnapshot,
  Attachment,
  AttachmentKind,
  BabyProfile,
  CareLog,
  CareLogEvent,
  ChatMessage,
  ConversationSummary,
  ExpenseItem,
  GrowthEvent,
  MemoryItem,
  Reminder,
  SafetyAlert,
  ToolActivity,
} from "../../types";
import type { ComposerMode, CompressionStatus, MediaUploadItem } from "../../appContracts";

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "unsupported" | "error";
type MediaUploadStatus = "preparing" | "uploading" | "processing" | "done" | "failed";
type MediaUploadTarget = "chat" | "album";
type QueuedMediaFile = { id: string; file: File; kind: AttachmentKind };

const VOICE_CANCEL_DISTANCE_PX = 76;
const VISUAL_AGENT_MODEL: AgentModelId = "doubao-seed-2.0-pro";

const simpleCareRecordPattern =
  /(喝|奶|母乳|配方奶|睡|醒|拉|尿|便便|辅食|体温|发烧|身高|体重|头围|ml|毫升|cm|kg|记一下|记录|提醒|花了|买了|记账)/i;

const thinkingIntentPattern =
  /(为什么|怎么|怎么办|原因|分析|评估|对比|规划|计划|方案|建议|趋势|复盘|总结|是否|要不要|可不可以|需不需要|如何)/;

const isVisualAttachment = (attachment: Attachment) => attachment.kind === "image" || attachment.kind === "video";

const resolveAgentModelForMessage = (text: string, messageAttachments: Attachment[]): AgentModelId => {
  if (messageAttachments.some(isVisualAttachment)) return VISUAL_AGENT_MODEL;
  return DEFAULT_MODEL;
};

const resolveThinkingForMessage = (text: string, messageAttachments: Attachment[]) => {
  if (messageAttachments.some(isVisualAttachment)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (simpleCareRecordPattern.test(trimmed) && trimmed.length < 80) return false;
  return trimmed.length >= 120 || thinkingIntentPattern.test(trimmed);
};

const resolveLowLatencyForMessage = (model: AgentModelId, messageAttachments: Attachment[]) =>
  model.startsWith("doubao-") && messageAttachments.some(isVisualAttachment);

const mergeVoiceText = (baseText: string, transcript: string) => {
  const base = baseText.trim();
  const text = transcript.trim();
  if (!base) return text;
  if (!text) return base;
  return `${base}${/[，。！？,.!?]$/.test(base) ? "" : " "}${text}`;
};

const downsampleAudio = (input: Float32Array, inputRate: number, outputRate: number) => {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += input[cursor];
    }
    output[index] = sum / Math.max(1, end - start);
  }

  return output;
};

const pcm16FromFloat32 = (input: Float32Array) => {
  const output = new Uint8Array(input.length * 2);
  const view = new DataView(output.buffer);
  input.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });
  return output;
};

const rmsLevel = (input: Float32Array) => {
  if (!input.length) return 0;
  const sum = input.reduce((total, sample) => total + sample * sample, 0);
  return Math.min(1, Math.sqrt(sum / input.length) * 6);
};

const extractAiTextPreview = (jsonContent: string) => {
  const keyIndex = jsonContent.indexOf('"aiText"');
  if (keyIndex < 0) return "";

  const colonIndex = jsonContent.indexOf(":", keyIndex);
  if (colonIndex < 0) return "";

  const quoteIndex = jsonContent.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) return "";

  let value = "";
  let escaping = false;
  for (let index = quoteIndex + 1; index < jsonContent.length; index += 1) {
    const char = jsonContent[index];
    if (escaping) {
      value += char === "n" ? "\n" : char === "t" ? "\t" : char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') return value;
    value += char;
  }

  return value;
};

const extractCareEventsFromText = (text: string, date: string) =>
  text
    .split(/[。；;\n]/)
    .flatMap((sentence) => sentence.split(/(?=(?:凌晨|早上|上午|中午|下午|晚上)?\s*\d{1,2}\s*(?:点|:|：))/))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): CareLogEvent | null => {
      const type = inferCareEventType(part);
      const explicitTime = normalizeClockText(part);
      const time = explicitTime ?? (/刚刚|刚才|现在/.test(part) ? currentClockText() : undefined);
      if (!time || type === "note") return null;
      const amountText = part.match(/(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i)?.[1];
      const durationText = part.match(/(\d+(?:\.\d+)?)\s*(?:小时|h)/i)?.[1];
      const temperatureText = part.match(/体温\s*(\d+(?:\.\d+)?)/)?.[1];
      return {
        id: makeId("care-event"),
        type,
        date,
        time,
        title: careEventTitleMap[type],
        amountMl: amountText ? Number(amountText) : undefined,
        durationHours: durationText ? Number(durationText) : undefined,
        temperature: temperatureText ? Number(temperatureText) : undefined,
        note: part,
        tags: [careEventTitleMap[type]],
      };
    })
    .filter((event): event is CareLogEvent => Boolean(event))
    .slice(0, 12);

const hasExplicitCareRecordSignal = (text: string) => {
  const events = extractCareEventsFromText(text, todayISO());
  if (
    events.some((event) => {
      if (event.type === "milk") return positiveNumber(event.amountMl) !== undefined;
      if (event.type === "sleep") return positiveNumber(event.durationHours) !== undefined;
      if (event.type === "temperature") return positiveNumber(event.temperature) !== undefined;
      return event.type === "poop" || event.type === "solid" || event.type === "wake" || event.type === "soothing";
    })
  ) {
    return true;
  }
  return /喝奶\s*\d+\s*次|奶量\s*\d+|睡眠\s*\d+(?:\.\d+)?\s*(?:小时|h)|夜醒\s*\d+\s*次|体温\s*\d+(?:\.\d+)?/.test(text);
};

const hasExplicitStructuredActionSignal = (text: string) =>
  hasExplicitCareRecordSignal(text) ||
  /(提醒|记得|待办|复诊|保存到相册|存到相册|加入相册|留念|纪念|第一次|里程碑|满月|百天|生日|疫苗本|接种证|体检报告|医生通知|病历)/.test(text);

const emptyStructuredResponse = (response: AgentChatResponse): AgentChatResponse => ({
  ...response,
  growthEvent: null,
  careLogPatch: null,
  reminders: [],
  memories: [],
  effectDecisions: [],
});

const suppressImageOnlyCareEffects = (
  response: AgentChatResponse,
  parentText: string,
  attachments: Attachment[],
  albumDecisions: AlbumMediaDecision[] = [],
): AgentChatResponse => {
  if (!attachments.some((item) => item.kind === "image" || item.kind === "video")) return response;
  const screenshotDescriptionOnly =
    albumDecisions.some((decision) => decision.mode === "ignore" && decision.tags.includes("截图")) &&
    !hasExplicitStructuredActionSignal(parentText);
  if (screenshotDescriptionOnly) return emptyStructuredResponse(response);
  if (hasExplicitCareRecordSignal(parentText)) return response;
  return {
    ...response,
    careLogPatch: null,
    effectDecisions: (response.effectDecisions ?? []).filter((decision) => decision.type !== "careLog"),
  };
};

const normalizeSoothing = (value: CareLog["soothing"] | undefined): CareLog["soothing"] | undefined => {
  if (value === "easy" || value === "normal" || value === "hard") return value;
  return undefined;
};

const mergeCareEventsWithInferred = (modelEvents: CareLogEvent[], inferredEvents: CareLogEvent[]) => {
  if (!modelEvents.length) return inferredEvents;

  const usedInferredIndexes = new Set<number>();
  const merged = modelEvents.map((event, index) => {
    const inferredIndex = inferredEvents.findIndex(
      (candidate, candidateIndex) =>
        !usedInferredIndexes.has(candidateIndex) &&
        (candidate.type === event.type || !event.time || candidate.note === event.note || candidate.title === event.title),
    );
    const inferred = inferredEvents[inferredIndex >= 0 ? inferredIndex : index];
    if (inferredIndex >= 0) usedInferredIndexes.add(inferredIndex);

    return {
      ...event,
      id: event.id || inferred?.id || makeId("care-event"),
      time: event.time ?? inferred?.time,
      amountMl: event.amountMl ?? inferred?.amountMl,
      durationHours: event.durationHours ?? inferred?.durationHours,
      temperature: event.temperature ?? inferred?.temperature,
      note: event.note ?? inferred?.note,
      tags: event.tags?.length ? event.tags : inferred?.tags,
    };
  });

  const extras = inferredEvents.filter(
    (candidate, index) =>
      !usedInferredIndexes.has(index) &&
      !merged.some((event) => event.type === candidate.type && event.time === candidate.time && event.note === candidate.note),
  );
  return [...merged, ...extras].slice(0, 12);
};

const normalizeAgentResponse = (result: AgentChatResponse, parentText: string) => {
  const now = new Date().toISOString();
  const growthEvent: GrowthEvent | undefined =
    result.growthEvent && (result.growthEvent.title || result.growthEvent.summary)
      ? {
          id: result.growthEvent.id ?? makeId("growth"),
          type: result.growthEvent.type ?? "daily_growth",
          title: result.growthEvent.title ?? "新的成长瞬间",
          date: result.growthEvent.date ?? todayISO(),
          summary: result.growthEvent.summary ?? `${parentText}。`,
          firstTime: Boolean(result.growthEvent.firstTime),
          mediaKind: result.growthEvent.mediaKind,
          tags: result.growthEvent.tags ?? ["成长"],
        }
      : undefined;

  const careLogPatch =
    result.careLogPatch && hasCareLogContent(result.careLogPatch)
      ? (() => {
          const date = result.careLogPatch?.date ?? todayISO();
          const modelEvents = (result.careLogPatch?.events ?? []).map((item, index) => ({
            ...normalizeCareLogEvent(item, index, date),
            id: item.id || makeId("care-event"),
          }));
          const inferredEvents = extractCareEventsFromText(parentText, date);
          const events = mergeCareEventsWithInferred(modelEvents, inferredEvents);
          return {
            ...result.careLogPatch,
            date,
            soothing: normalizeSoothing(result.careLogPatch.soothing),
            solids: result.careLogPatch.solids ?? [],
            events,
            notes: result.careLogPatch.notes?.length ? result.careLogPatch.notes : [parentText],
          };
        })()
      : undefined;

  const reminders: Reminder[] = (result.reminders ?? [])
    .filter((item) => item.title || item.dueText)
    .map((item, index) =>
      normalizeReminder(
        {
          id: item.id ?? makeId("reminder"),
          title: item.title ?? "新的照护提醒",
          reminderKind: item.reminderKind,
          dueText: item.dueText ?? "待确认时间",
          dueAt: item.dueAt,
          timeSourceText: item.timeSourceText,
          timezone: item.timezone,
          notificationId: item.notificationId,
          notificationStatus: item.notificationStatus,
          notificationError: item.notificationError,
          category: item.category,
          recurrence: item.recurrence,
          scheduleMode: item.scheduleMode,
          alertMode: item.alertMode,
          repeatRule: item.repeatRule,
          soundId: item.soundId,
          lastAnchorEventId: item.lastAnchorEventId,
          lastAnchorAt: item.lastAnchorAt,
          status: item.status,
          createdAt: item.createdAt ?? now,
          history: item.history ?? [],
        },
        index,
      ),
    );

  const memories: MemoryItem[] = (result.memories ?? [])
    .filter((item) => item.text?.trim())
    .map((item) => ({
      id: item.id ?? makeId("memory"),
      text: item.text!.trim(),
      category: normalizeMemoryCategory(item.category),
      confidence: item.confidence ?? 0.72,
      updatedAt: item.updatedAt ?? now,
    }));

  const expenses: ExpenseItem[] = (result.expenses ?? [])
    .filter((item) => item.title?.trim() || item.amount)
    .map((item, index) =>
      normalizeExpenseItem(
        {
          ...item,
          id: item.id ?? makeId("expense"),
          date: item.date || todayISO(),
          source: "agent",
          createdAt: item.createdAt ?? now,
          updatedAt: item.updatedAt ?? now,
        },
        index,
      ),
    );

  return {
    aiText: result.aiText,
    tags: result.tags ?? [],
    growthEvent,
    careLogPatch,
    reminders,
    memories,
    expenses,
    sources: normalizeSources(result.sources ?? []),
    safetyAlerts: normalizeSafetyAlerts(result.safetyAlerts),
    effectDecisions: result.effectDecisions ?? [],
  };
};

const normalizeSources = (sources: AgentSource[]) =>
  sources
    .filter((source) => source.title?.trim() && source.url?.trim())
    .map((source) => ({
      title: source.title.trim(),
      url: source.url.trim(),
      snippet: source.snippet?.trim() ?? "",
    }))
    .slice(0, 5);

const normalizeSafetyAlerts = (alerts: SafetyAlert[] | null | undefined): SafetyAlert[] =>
  (alerts ?? [])
    .filter((alert) => alert.message?.trim())
    .map((alert) => {
      const level: SafetyAlert["level"] = alert.level === "urgent" ? "urgent" : "notice";
      const category: SafetyAlert["category"] = alert.category ?? "general";

      return {
        level,
        category,
        message: alert.message,
        recommendedAction: alert.recommendedAction ?? "请结合宝宝状态，必要时咨询医生。",
      };
    })
    .slice(0, 3);

const upsertToolActivity = (items: ToolActivity[] | undefined, activity: ToolActivity) => {
  const current = items ?? [];
  if (current.some((item) => item.id === activity.id)) {
    return current.map((item) => (item.id === activity.id ? activity : item));
  }
  return [...current, activity];
};

const failedRunningActivities = (items: ToolActivity[]) =>
  items.map((item) => (item.status === "running" ? { ...item, status: "failed" as const } : item));

const fetchAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取附件内容（${response.status}）`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read attachment"));
    reader.readAsDataURL(blob);
  });
};

const dataUrlWithinAgentLimit = (dataUrl?: string) =>
  dataUrl && dataUrl.length <= MAX_AGENT_ATTACHMENT_DATA_URL_CHARS ? dataUrl : undefined;

const agentImageTargetChars = (visualCount: number) => {
  if (visualCount >= 6) return AGENT_IMAGE_TARGET_CHARS_LARGE_BATCH;
  if (visualCount >= 3) return AGENT_IMAGE_TARGET_CHARS_SMALL_BATCH;
  return AGENT_IMAGE_TARGET_CHARS_SINGLE;
};

const agentImageMaxEdge = (visualCount: number) =>
  visualCount >= 3 ? AGENT_IMAGE_MAX_EDGE_BATCH : AGENT_IMAGE_MAX_EDGE_SINGLE;

const resizeImageDataUrlForAgent = async (dataUrl?: string, visualCount = 1) => {
  if (!dataUrl?.startsWith("data:image/")) return dataUrlWithinAgentLimit(dataUrl);
  if (typeof window === "undefined" || typeof document === "undefined") return dataUrlWithinAgentLimit(dataUrl);

  const targetChars = agentImageTargetChars(visualCount);
  const baseMaxEdge = agentImageMaxEdge(visualCount);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("无法读取图片内容"));
    nextImage.src = dataUrl;
  });
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return dataUrlWithinAgentLimit(dataUrl);
  if (Math.max(sourceWidth, sourceHeight) <= baseMaxEdge && dataUrl.length <= targetChars) {
    return dataUrlWithinAgentLimit(dataUrl);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return dataUrlWithinAgentLimit(dataUrl);

  const attempts = [
    { edge: baseMaxEdge, quality: 0.82 },
    { edge: Math.round(baseMaxEdge * 0.88), quality: 0.78 },
    { edge: Math.round(baseMaxEdge * 0.76), quality: 0.74 },
    { edge: Math.round(baseMaxEdge * 0.64), quality: 0.72 },
  ];
  let smallest = dataUrl;

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.edge / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", attempt.quality);
    if (compressed.length < smallest.length) smallest = compressed;
    if (compressed.length <= targetChars) return dataUrlWithinAgentLimit(compressed);
  }

  return dataUrlWithinAgentLimit(smallest);
};

const agentStatusTag = (type: AgentStreamStatusType) => {
  if (type === "planning") return "理解中";
  if (type === "retrieving_context") return "查找中";
  if (type === "analyzing_media") return "分析中";
  return "生成中";
};

const formatAgentFailureMessage = (error: unknown, attachments: Attachment[]) => {
  const message = error instanceof Error ? error.message.trim() : "";
  if (error instanceof AgentApiError && error.code === "PRO_QUOTA_EXCEEDED") {
    return message || "本月免费 AI 体验次数已用完，申请 Pro 内测后即可不限次使用。";
  }
  const hasVisualAttachments = attachments.some((attachment) => attachment.kind === "image" || attachment.kind === "video");
  if (/图片分析超时|AI 响应超时/.test(message)) return message;
  if (/timeout|timed out|超时/i.test(message)) {
    return hasVisualAttachments
      ? "图片分析超时了：我已尝试分批处理，但模型没有及时返回。请稍后重试；如果仍失败，可以先减少图片数量或分开发送。"
      : "AI 响应超时了：模型没有及时返回，请稍后重试。";
  }
  if (message) return `AI 服务暂时不可用：${message}`;
  return "AI 服务暂时不可用，请稍后再试。";
};

// persistRecord / applyStateResponse / persistAlbumItemOptimistic / showSystemWeakNotice /
// applyForProTrial / buildAgentPageContext 都在 App.tsx 调用点之后才就绪,经此迟绑定 ref 注入。
// 它们只在事件处理(submitComposerMessage / processSelectedMediaFiles / openMediaPicker)里于触发时读取,
// call-time 不需要,故迟绑定不改运行时语义(实际触发的永远是最新一次渲染的实现)。
export type ChatLateDeps = {
  persistRecord: PersistRecord;
  applyStateResponse: (response: { state: Partial<AppStateSnapshot> }) => void;
  persistAlbumItemOptimistic: (item: AlbumItem) => Promise<AppStateResponse>;
  showSystemWeakNotice: (message: string, tone?: "info" | "success" | "warning", durationMs?: number) => void;
  applyForProTrial: (source: string) => void;
  // buildAgentPageContext 深耦合 records/ledger/pending-effect 派生值,留在 App,提交时 call-time 调用。
  buildAgentPageContext: () => AgentPageContext;
  messageForStorage: (message: ChatMessage) => ChatMessage;
};

export type UseChatStateDeps = {
  canCaregive: boolean;
  hasAiQuota: boolean;
  canAttachVisuals: boolean;
  // canUseComposerInput 用(records state,留在 App)。
  recordsEntryDrawerIsAi: boolean;
  // STORE(早定义,按值传入)。
  messages: ChatMessage[];
  setMessages: (action: SetStateAction<ChatMessage[]>) => void;
  setAlbumItems: (action: SetStateAction<AlbumItem[]>) => void;
  setConversationSummary: (action: SetStateAction<ConversationSummary | null>) => void;
  profile: BabyProfile;
  careLogs: CareLog[];
  memories: MemoryItem[];
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  // 共享 ref(早定义,按值传入)。
  backendReadyRef: MutableRefObject<boolean>;
  compressionInFlightRef: MutableRefObject<boolean>;
  compressionResetTimerRef: MutableRefObject<number | null>;
  lateRef: MutableRefObject<ChatLateDeps>;
};

export function useChatState({
  canCaregive,
  hasAiQuota,
  canAttachVisuals,
  recordsEntryDrawerIsAi,
  messages,
  setMessages,
  setAlbumItems,
  setConversationSummary,
  profile,
  careLogs,
  memories,
  setStorageStatus,
  backendReadyRef,
  compressionInFlightRef,
  compressionResetTimerRef,
  lateRef,
}: UseChatStateDeps) {
  const [composerMode, setComposerMode] = useState<ComposerMode>("keyboard");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  // input 由独立 external store 持有(见 ./composerInput),打字不再重渲 App 本体。
  // 沿用 App 原本的 setInput / inputValueRef 写法(都走 store),逐字节一致。
  const setInput = composerInput.set;
  const inputValueRef = composerInputRef;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAttachmentTrayExpanded, setIsAttachmentTrayExpanded] = useState(false);
  const [mediaUploadItems, setMediaUploadItems] = useState<MediaUploadItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const asrControllerRef = useRef<AsrStreamController | null>(null);
  const voiceStandbyStreamRef = useRef<MediaStream | null>(null);
  const voiceStandbyPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const voicePreparingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const voiceBaseTextRef = useRef("");
  const voiceSampleBufferRef = useRef<number[]>([]);
  const voiceSessionRef = useRef(0);
  const voiceShouldStopRef = useRef(false);
  const voiceEndedRef = useRef(false);
  const voiceAsrReadyRef = useRef(false);
  const voiceAutoSubmitRef = useRef(false);
  const voicePressingRef = useRef(false);
  const voicePointerRef = useRef<{ pointerId: number; startY: number; canceling: boolean } | null>(null);
  const voicePointerCleanupRef = useRef<(() => void) | null>(null);
  const voiceAutoSubmitTimerRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const submitComposerMessageRef = useRef<((textOverride?: string, options?: { skipVoiceStop?: boolean }) => Promise<void>) | null>(null);

  // ---- 派生:聊天附件 / 上传托盘 ----
  const activeUploadStatuses: MediaUploadStatus[] = ["preparing", "uploading", "processing"];
  const chatUploadItems = mediaUploadItems.filter((item) => item.target === "chat");
  const activeChatUploadItems = chatUploadItems.filter((item) => activeUploadStatuses.includes(item.status));
  const isUploadingChatMedia = activeChatUploadItems.length > 0;
  const visibleChatAttachmentCount = Math.min(MAX_CHAT_ATTACHMENTS, attachments.length + activeChatUploadItems.length);
  const isChatAttachmentLimitReached = visibleChatAttachmentCount >= MAX_CHAT_ATTACHMENTS;
  const chatAttachmentCountLabel = `已添加 ${visibleChatAttachmentCount}/${MAX_CHAT_ATTACHMENTS} 个素材`;
  const chatAttachmentLimitLabel = isChatAttachmentLimitReached
    ? `${chatAttachmentCountLabel}，已达上限`
    : chatAttachmentCountLabel;
  const pendingImageCount = attachments.filter((item) => item.kind === "image").length + activeChatUploadItems.filter((item) => item.kind === "image").length;
  const pendingVideoCount = attachments.filter((item) => item.kind === "video").length + activeChatUploadItems.filter((item) => item.kind === "video").length;
  const pendingUploadCount = activeChatUploadItems.length;
  const attachmentTrayMetaLabel = [
    pendingUploadCount ? `${pendingUploadCount} 个上传中` : "",
    pendingImageCount ? `${pendingImageCount} 张照片` : "",
    pendingVideoCount ? `${pendingVideoCount} 个视频` : "",
  ].filter(Boolean).join(" · ");
  const canCollapseAttachmentTray = visibleChatAttachmentCount > 2 && pendingUploadCount === 0;
  const isAttachmentTrayOpen = !canCollapseAttachmentTray || isAttachmentTrayExpanded;
  const attachmentTrayPreviewItems = attachments.slice(0, 3);
  const attachmentTrayOverflowCount = Math.max(0, attachments.length - attachmentTrayPreviewItems.length);
  const visualToolTitle = isUploadingChatMedia
    ? "素材正在上传"
    : hasAiQuota ? "照片或视频" : "本月免费 AI 已用完，申请 Pro 内测后不限次";
  const visualToolGated = !hasAiQuota;
  const visualToolDisabled = !canCaregive || isSubmitting || isUploadingChatMedia;
  const visualToolClassName = visualToolGated ? "visual-tool-gated" : "";
  const canUseComposerInput = !isSubmitting || recordsEntryDrawerIsAi;

  // ---- 媒体上传管线 ----
  const updateMediaUploadItem = (id: string, patch: Partial<MediaUploadItem>) => {
    setMediaUploadItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeMediaUploadItem = (id: string) => {
    setMediaUploadItems((current) => current.filter((item) => item.id !== id));
  };

  const removeMediaUploadItemLater = (id: string, delay = 1800) => {
    window.setTimeout(() => {
      removeMediaUploadItem(id);
    }, delay);
  };

  const uploadMediaFile = async (
    id: string,
    file: File,
    kind: AttachmentKind,
    dimensions?: Pick<Attachment, "width" | "height">,
    thumbnailDataUrl?: string,
  ): Promise<Attachment> => {
    if (!canCaregive) throw new Error("当前身份仅可查看，不能上传附件。");
    updateMediaUploadItem(id, { status: "uploading", progress: 1, message: "上传中" });
    const uploaded = await uploadFileAttachment({
      id,
      name: file.name,
      kind,
      file,
      thumbnailDataUrl,
      onProgress: (progress) => updateMediaUploadItem(id, { status: "uploading", progress: Math.max(1, Math.min(99, progress)), message: `上传 ${progress}%` }),
    });
    updateMediaUploadItem(id, { status: "processing", progress: 100, message: "整理中" });
    const capturedAt = await resolveMediaCaptureDate(file, uploaded.createdAt);
    const attachment: Attachment = {
      id: uploaded.id,
      name: uploaded.name,
      kind: uploaded.kind,
      url: uploaded.url,
      publicUrl: uploaded.publicUrl,
      thumbnailUrl: uploaded.thumbnailUrl,
      thumbnailPath: uploaded.thumbnailPath,
      filePath: uploaded.filePath,
      mimeType: uploaded.mimeType,
      width: dimensions?.width,
      height: dimensions?.height,
      createdAt: uploaded.createdAt,
      capturedAt,
    };
    return attachment;
  };

  const readImageDimensionsFromFile = (file: File): Promise<Pick<Attachment, "width" | "height">> =>
    new Promise((resolve) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      image.onload = () => {
        cleanup();
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        cleanup();
        resolve({});
      };
      image.src = objectUrl;
    });

  const createVideoThumbnailDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);
      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute("src");
        video.load();
      };
      const finish = (value: string | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        cleanup();
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(undefined), VIDEO_THUMBNAIL_TIMEOUT_MS);
      video.muted = true;
      video.playsInline = true;
      // preload=metadata 在 Android WebView 上 seek 后经常不解码帧(onseeked 不触发/画出黑帧),
      // 导致封面静默缺失;auto 让浏览器预取首段数据,本地文件无流量代价。
      video.preload = "auto";
      video.onloadedmetadata = () => {
        const seekTime = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.4, video.duration / 8) : 0;
        try {
          video.currentTime = seekTime;
        } catch {
          finish(undefined);
        }
      };
      video.onseeked = () => {
        try {
          const width = video.videoWidth || 480;
          const height = video.videoHeight || 480;
          const scale = Math.min(1, 480 / Math.max(width, height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            finish(undefined);
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          finish(dataUrl);
        } catch {
          finish(undefined);
        }
      };
      video.onerror = () => {
        finish(undefined);
      };
      video.src = objectUrl;
    });

  const readAgentAttachmentDataUrl = async (attachment: Attachment, visualCount: number) => {
    if (!canAttachVisuals) return undefined;
    try {
      if (attachment.kind === "image") {
        const imageUrl = attachment.url ?? attachment.publicUrl;
        const dataUrl = attachment.dataUrl ?? (imageUrl ? await fetchAsDataUrl(imageUrl) : undefined);
        return resizeImageDataUrlForAgent(dataUrl, visualCount);
      }
      if (attachment.kind === "video") {
        const thumbnailUrl = attachment.thumbnailUrl;
        if (!thumbnailUrl) return undefined;
        const dataUrl = thumbnailUrl.startsWith("data:image/")
          ? thumbnailUrl
          : await fetchAsDataUrl(thumbnailUrl);
        return resizeImageDataUrlForAgent(dataUrl, visualCount);
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const queueMediaFiles = (files: File[], limit: number): QueuedMediaFile[] =>
    files
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, limit)
      .map((file) => ({
        id: makeId("attachment"),
        file,
        kind: file.type.startsWith("video/") ? "video" as AttachmentKind : "image" as AttachmentKind,
      }));

  const processSelectedMediaFiles = async (files: File[], target: MediaUploadTarget) => {
    const availableSlots = target === "chat" ? Math.max(0, MAX_CHAT_ATTACHMENTS - attachments.length) : MAX_ALBUM_PICKER_ATTACHMENTS;
    const queue = queueMediaFiles(files, availableSlots);
    const mediaFileCount = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")).length;
    const skippedByLimit = target === "chat" ? Math.max(0, mediaFileCount - availableSlots) : 0;
    if (queue.length) {
      setMediaUploadItems((current) => [
        ...current,
        ...queue.map(({ id, file, kind }) => ({
          id,
          name: file.name,
          kind,
          target,
          status: "preparing" as MediaUploadStatus,
          progress: 0,
          message: "准备中",
        })),
      ]);
    }

    const failures: string[] = [];
    for (const item of queue) {
      const maxUploadBytes = maxMediaUploadBytes(item.kind);
      if (item.file.size > maxUploadBytes) {
        const message = `超过 ${formatFileSize(maxUploadBytes)} 限制`;
        failures.push(`${item.file.name} ${message}`);
        updateMediaUploadItem(item.id, { status: "failed", progress: 0, message });
        removeMediaUploadItemLater(item.id, 6000);
        continue;
      }
      try {
        updateMediaUploadItem(item.id, { status: "preparing", progress: 0, message: item.kind === "video" ? "生成预览" : "读取信息" });
        const dimensions = item.kind === "image" ? await readImageDimensionsFromFile(item.file) : {};
        const thumbnailDataUrl = item.kind === "video" ? await createVideoThumbnailDataUrl(item.file) : undefined;
        if (item.kind === "video" && !thumbnailDataUrl) {
          // 封面抽帧静默失败曾导致线上视频无封面且无从排查——上报留痕(渲染端有抽帧兜底,不阻塞上传)。
          reportClientError({
            kind: "unknown",
            message: `video-thumbnail-failed: ${item.file.name} (${item.file.type || "?"}, ${Math.round(item.file.size / 1024)}KB)`,
            page: "album-upload",
          });
        }
        const attachment = await uploadMediaFile(item.id, item.file, item.kind, dimensions, thumbnailDataUrl);
        if (target === "chat") {
          removeMediaUploadItem(item.id);
          setAttachments((current) => [...current, attachment].slice(0, MAX_CHAT_ATTACHMENTS));
        } else {
          const albumItem = albumItemFromStandaloneAttachment(attachment);
          setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
          updateMediaUploadItem(item.id, { status: "done", progress: 100, message: "已加入相册" });
          removeMediaUploadItemLater(item.id, 1600);
          void lateRef.current.persistAlbumItemOptimistic(albumItem).catch(() => undefined);
          hapticSuccess();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        failures.push(`${item.file.name} ${message}`);
        updateMediaUploadItem(item.id, { status: "failed", progress: 0, message });
        removeMediaUploadItemLater(item.id, 6000);
      }
    }
    if (failures.length || (target === "chat" && (availableSlots === 0 || skippedByLimit > 0))) {
      const limitMessage = availableSlots === 0
        ? `最多同时添加 ${MAX_CHAT_ATTACHMENTS} 个素材，先处理当前内容后再继续添加。`
        : `最多同时添加 ${MAX_CHAT_ATTACHMENTS} 个素材，已先添加前 ${queue.length} 个。`;
      const message = failures.length
        ? `${target === "album" ? "相册" : "素材"}上传失败：${failures.slice(0, 2).join("；")}${failures.length > 2 ? " 等" : ""}${target === "chat" && skippedByLimit > 0 ? `；${limitMessage}` : ""}`
        : limitMessage;
      setMessages((current) => [
        ...current,
        {
          id: makeId("msg"),
          role: "ai",
          text: message,
          createdAt: new Date().toISOString(),
          tags: ["系统"],
        },
      ]);
    }
    if (target === "chat" && queue.length > 0 && queue.length >= availableSlots) {
      lateRef.current.showSystemWeakNotice(
        `这条消息最多识别 ${MAX_CHAT_ATTACHMENTS} 个素材，本次已添加 ${queue.length} 个；更多请发送后再继续。`,
        skippedByLimit > 0 ? "warning" : "info",
        3600,
      );
    }
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCaregive || !canAttachVisuals || isUploadingChatMedia) {
      event.target.value = "";
      return;
    }
    await processSelectedMediaFiles(Array.from(event.target.files ?? []), "chat");
    event.target.value = "";
  };

  const openMediaPicker = async () => {
    if (!canCaregive || isUploadingChatMedia) return;
    if (!hasAiQuota) {
      lateRef.current.showSystemWeakNotice("本月免费 AI 体验次数已用完，申请 Pro 内测后即可不限次使用图片/视频整理。", "info");
      lateRef.current.applyForProTrial("visual-quota-exhausted");
      return;
    }

    const availableSlots = Math.max(0, MAX_CHAT_ATTACHMENTS - attachments.length);
    if (availableSlots <= 0) {
      await processSelectedMediaFiles([], "chat");
      return;
    }

    if (isNativeMediaPickerAvailable()) {
      try {
        const files = await pickNativeMediaFiles({ limit: availableSlots });
        if (files.length) await processSelectedMediaFiles(files, "chat");
        return;
      } catch (error) {
        if (isNativeMediaPickerCancel(error)) return;
        console.warn("[native-media-picker] failed", error);
        const message = error instanceof Error ? error.message : "无法读取已选择的素材";
        lateRef.current.showSystemWeakNotice(`素材选择失败：${message}`, "warning", 3600);
        return;
      }
    }

    fileInputRef.current?.click();
  };

  // ---- 会话压缩 ----
  const scheduleCompressionStatusReset = (status: CompressionStatus, delayMs: number) => {
    if (compressionResetTimerRef.current !== null) window.clearTimeout(compressionResetTimerRef.current);
    compressionResetTimerRef.current = window.setTimeout(() => {
      setCompressionStatus((current) => (current === status ? "idle" : current));
      compressionResetTimerRef.current = null;
    }, delayMs);
  };

  const runConversationCompression = async () => {
    if (!backendReadyRef.current || compressionInFlightRef.current || !canCaregive) return;
    compressionInFlightRef.current = true;
    if (compressionResetTimerRef.current !== null) {
      window.clearTimeout(compressionResetTimerRef.current);
      compressionResetTimerRef.current = null;
    }
    setCompressionStatus("checking");
    const compressingTimer = window.setTimeout(() => {
      setCompressionStatus((current) => (current === "checking" ? "compressing" : current));
    }, 250);

    try {
      const response = await compressConversationSummary();
      window.clearTimeout(compressingTimer);
      if (response.conversationSummary !== undefined) {
        setConversationSummary(response.conversationSummary ?? null);
      }
      if (response.status === "compressed") {
        setCompressionStatus("done");
        scheduleCompressionStatusReset("done", 2400);
      } else {
        setCompressionStatus("idle");
      }
    } catch {
      window.clearTimeout(compressingTimer);
      setCompressionStatus("failed");
      scheduleCompressionStatusReset("failed", 3600);
    } finally {
      compressionInFlightRef.current = false;
    }
  };

  // ---- 语音自动提交 ----
  const clearVoiceAutoSubmitTimer = () => {
    if (voiceAutoSubmitTimerRef.current !== null) {
      window.clearTimeout(voiceAutoSubmitTimerRef.current);
      voiceAutoSubmitTimerRef.current = null;
    }
  };

  const runVoiceAutoSubmit = () => {
    if (!voiceAutoSubmitRef.current || isSubmittingRef.current) return;

    const text = inputValueRef.current.trim();
    if (!text) return;

    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    voiceSessionRef.current += 1;
    voiceShouldStopRef.current = true;
    asrControllerRef.current?.close();
    asrControllerRef.current = null;
    void submitComposerMessageRef.current?.(text, { skipVoiceStop: true });
  };

  const scheduleVoiceAutoSubmit = (delayMs = 0) => {
    if (!voiceAutoSubmitRef.current) return;
    clearVoiceAutoSubmitTimer();
    voiceAutoSubmitTimerRef.current = window.setTimeout(runVoiceAutoSubmit, delayMs);
  };

  // ---- 语音采集 ----
  const voiceMediaConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  const stopVoiceStandbyStream = () => {
    const stream = voiceStandbyStreamRef.current;
    voiceStandbyStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  };

  const requestVoiceInputStream = async () => {
    const microphoneAllowed = await ensureMicrophonePermission();
    if (!microphoneAllowed) {
      throw new Error("麦克风权限未开启，请在系统设置中允许录音");
    }
    return navigator.mediaDevices.getUserMedia(voiceMediaConstraints);
  };

  const ensureVoiceInputStream = async () => {
    const standby = voiceStandbyStreamRef.current;
    if (standby && standby.getTracks().some((track) => track.readyState === "live")) {
      voiceStandbyStreamRef.current = null;
      standby.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      return standby;
    }

    if (voiceStandbyPromiseRef.current) {
      const stream = await voiceStandbyPromiseRef.current;
      voiceStandbyPromiseRef.current = null;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      return stream;
    }

    stopVoiceStandbyStream();
    return requestVoiceInputStream();
  };

  const prepareVoiceStandby = async () => {
    if (!canCaregive || voicePreparingRef.current || voiceStandbyStreamRef.current || mediaStreamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext && !window.webkitAudioContext) return;

    voicePreparingRef.current = true;
    try {
      const promise = requestVoiceInputStream();
      voiceStandbyPromiseRef.current = promise;
      const stream = await promise;
      if (voiceStandbyPromiseRef.current === promise) {
        voiceStandbyPromiseRef.current = null;
      }
      if (voicePressingRef.current) return;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      voiceStandbyStreamRef.current = stream;
      if (!voicePressingRef.current) {
        setVoiceStatus((current) => (current === "connecting" ? "idle" : current));
        setVoiceTranscript((current) => current || "语音已就绪，按住说话");
      }
    } catch (error) {
      voiceStandbyPromiseRef.current = null;
      const message = error instanceof Error ? error.message : "麦克风暂时不可用";
      setVoiceStatus("error");
      setVoiceError(message);
    } finally {
      voicePreparingRef.current = false;
    }
  };

  const sendBufferedVoiceSamples = (flush = false) => {
    const samplesPerChunk = 1600;
    const controller = asrControllerRef.current;
    const buffer = voiceSampleBufferRef.current;
    if (!controller) {
      buffer.length = 0;
      return;
    }

    while (buffer.length >= samplesPerChunk || (flush && buffer.length > 0)) {
      const chunkLength = buffer.length >= samplesPerChunk ? samplesPerChunk : buffer.length;
      const chunk = new Float32Array(buffer.splice(0, chunkLength));
      controller.sendAudio(pcm16FromFloat32(chunk));
    }
  };

  const cleanupLocalVoiceCapture = (keepStandby = false) => {
    const processor = scriptProcessorRef.current;
    scriptProcessorRef.current = null;
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }

    const source = audioSourceRef.current;
    audioSourceRef.current = null;
    source?.disconnect();

    const gain = silentGainRef.current;
    silentGainRef.current = null;
    gain?.disconnect();

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      if (keepStandby) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        voiceStandbyStreamRef.current = stream;
      } else {
        stream.getTracks().forEach((track) => track.stop());
      }
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }

    setIsListening(false);
    setVoiceLevel(0);
  };

  const finishVoiceStream = () => {
    sendBufferedVoiceSamples(true);
    const controller = asrControllerRef.current;
    if (!controller || voiceEndedRef.current) return;
    voiceEndedRef.current = true;
    controller.end();
    setVoiceStatus("processing");
  };

  const clearVoicePointerTracking = () => {
    voicePointerCleanupRef.current?.();
    voicePointerCleanupRef.current = null;
    voicePointerRef.current = null;
    setVoiceCancelArmed(false);
  };

  const stopVoiceCapture = (autoSubmit = false, keepStandby = true) => {
    clearVoicePointerTracking();
    voicePressingRef.current = false;
    if (autoSubmit) {
      hapticSelection();
      voiceAutoSubmitRef.current = true;
      scheduleVoiceAutoSubmit(1200);
    }
    voiceShouldStopRef.current = true;
    cleanupLocalVoiceCapture(keepStandby);
    finishVoiceStream();
  };

  const cancelVoiceCapture = () => {
    clearVoicePointerTracking();
    voicePressingRef.current = false;
    voiceSessionRef.current += 1;
    voiceShouldStopRef.current = true;
    voiceEndedRef.current = true;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    const baseText = voiceBaseTextRef.current;
    inputValueRef.current = baseText;
    setInput(baseText);
    setVoiceTranscript("");
    setVoiceError("");
    cleanupLocalVoiceCapture(true);
    asrControllerRef.current?.close();
    asrControllerRef.current = null;
    setVoiceStatus("idle");
  };

  const startVoiceCapture = async () => {
    if (!canCaregive || isSubmitting || isListening) return;
    hapticMedium();

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境无法访问麦克风");
      hapticWarning();
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setVoiceStatus("unsupported");
      setVoiceError("当前环境不支持实时音频采集");
      hapticWarning();
      return;
    }

    setVoiceTranscript("");
    setVoiceError("");
    setVoiceLevel(0);
    setVoiceStatus("connecting");

    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    voiceShouldStopRef.current = false;
    voiceEndedRef.current = false;
    voiceAsrReadyRef.current = false;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    voiceBaseTextRef.current = inputValueRef.current.trim();
    voiceSampleBufferRef.current = [];

    const controller = runAsrStream({
      onReady: () => {
        if (voiceSessionRef.current !== sessionId) return;
        voiceAsrReadyRef.current = true;
        if (mediaStreamRef.current) {
          setVoiceStatus("listening");
        }
      },
      onPartial: (text) => {
        if (voiceSessionRef.current !== sessionId) return;
        const merged = mergeVoiceText(voiceBaseTextRef.current, text);
        setVoiceTranscript(text);
        inputValueRef.current = merged;
        setInput(merged);
      },
      onFinal: (text) => {
        if (voiceSessionRef.current !== sessionId) return;
        const merged = mergeVoiceText(voiceBaseTextRef.current, text);
        setVoiceTranscript(text);
        inputValueRef.current = merged;
        setInput(merged);
        if (voiceEndedRef.current) {
          setVoiceStatus("idle");
          asrControllerRef.current?.close();
          asrControllerRef.current = null;
          scheduleVoiceAutoSubmit(0);
        }
      },
      onError: (message) => {
        if (voiceSessionRef.current !== sessionId) return;
        voiceShouldStopRef.current = true;
        voiceAutoSubmitRef.current = false;
        clearVoiceAutoSubmitTimer();
        setVoiceError(message);
        setVoiceStatus("error");
        cleanupLocalVoiceCapture();
        asrControllerRef.current?.close();
        asrControllerRef.current = null;
        hapticWarning();
      },
      onClose: () => {
        if (voiceSessionRef.current !== sessionId) return;
        cleanupLocalVoiceCapture();
        asrControllerRef.current = null;
        setVoiceStatus((current) => (current === "error" || current === "unsupported" ? current : "idle"));
        scheduleVoiceAutoSubmit(0);
      },
    });
    asrControllerRef.current = controller;

    let capturedStream: MediaStream | null = null;
    try {
      capturedStream = await ensureVoiceInputStream();

      if (voiceSessionRef.current !== sessionId || voiceShouldStopRef.current) {
        capturedStream.getTracks().forEach((track) => track.stop());
        finishVoiceStream();
        return;
      }

      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      if (voiceSessionRef.current !== sessionId || voiceShouldStopRef.current) {
        capturedStream.getTracks().forEach((track) => track.stop());
        void audioContext.close().catch(() => undefined);
        finishVoiceStream();
        return;
      }

      const source = audioContext.createMediaStreamSource(capturedStream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      const gain = audioContext.createGain();
      gain.gain.value = 0;

      mediaStreamRef.current = capturedStream;
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      scriptProcessorRef.current = processor;
      silentGainRef.current = gain;

      processor.onaudioprocess = (event) => {
        if (voiceShouldStopRef.current || voiceSessionRef.current !== sessionId) return;
        const samples = event.inputBuffer.getChannelData(0);
        setVoiceLevel((current) => current * 0.55 + rmsLevel(samples) * 0.45);

        const downsampled = downsampleAudio(samples, audioContext.sampleRate, 16000);
        voiceSampleBufferRef.current.push(...downsampled);
        sendBufferedVoiceSamples(false);
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);
      setIsListening(true);
      setVoiceStatus(voiceAsrReadyRef.current ? "listening" : "connecting");
    } catch (error) {
      capturedStream?.getTracks().forEach((track) => track.stop());
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请在系统设置中允许录音"
          : error instanceof Error
            ? error.message
          : "无法启动麦克风，请稍后再试";
      setVoiceError(message);
      setVoiceStatus("error");
      cleanupLocalVoiceCapture();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
      hapticWarning();
    }
  };

  const finishVoicePress = () => {
    const pointer = voicePointerRef.current;
    if (!pointer) return;
    if (pointer.canceling) {
      cancelVoiceCapture();
      return;
    }
    stopVoiceCapture(true);
  };

  const cancelVoicePress = () => {
    if (!voicePointerRef.current && !voicePressingRef.current) return;
    cancelVoiceCapture();
  };

  const startVoicePress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canUseComposerInput || voicePointerRef.current) return;
    event.preventDefault();
    const button = event.currentTarget;
    const pointerId = event.pointerId;
    voiceBaseTextRef.current = inputValueRef.current.trim();
    voicePointerRef.current = { pointerId, startY: event.clientY, canceling: false };
    setVoiceCancelArmed(false);

    const finishFromWindow = (pointerEvent: PointerEvent) => {
      if (voicePointerRef.current?.pointerId !== pointerEvent.pointerId) return;
      pointerEvent.preventDefault();
      finishVoicePress();
    };
    const updateCancelFromWindow = (pointerEvent: PointerEvent) => {
      const pointer = voicePointerRef.current;
      if (!pointer || pointer.pointerId !== pointerEvent.pointerId) return;
      const canceling = pointerEvent.clientY <= pointer.startY - VOICE_CANCEL_DISTANCE_PX;
      if (pointer.canceling === canceling) return;
      voicePointerRef.current = { ...pointer, canceling };
      setVoiceCancelArmed(canceling);
      if (canceling) hapticSelection();
    };
    const cancelFromWindow = (pointerEvent: PointerEvent) => {
      if (voicePointerRef.current?.pointerId !== pointerEvent.pointerId) return;
      cancelVoicePress();
    };
    const cancelOnBlur = () => cancelVoicePress();

    window.addEventListener("pointerup", finishFromWindow, true);
    window.addEventListener("pointermove", updateCancelFromWindow, true);
    window.addEventListener("pointercancel", cancelFromWindow, true);
    window.addEventListener("blur", cancelOnBlur);
    voicePointerCleanupRef.current = () => {
      window.removeEventListener("pointerup", finishFromWindow, true);
      window.removeEventListener("pointermove", updateCancelFromWindow, true);
      window.removeEventListener("pointercancel", cancelFromWindow, true);
      window.removeEventListener("blur", cancelOnBlur);
    };

    try {
      button.setPointerCapture(pointerId);
    } catch {
      // Some WebViews reject pointer capture during long-press gestures; the window listeners keep the press stable.
    }
    voicePressingRef.current = true;
    void startVoiceCapture();
  };

  const releaseVoicePress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (voicePointerRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released when the native view cancels a gesture.
    }
    finishVoicePress();
  };

  const cancelVoicePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (voicePointerRef.current?.pointerId !== event.pointerId) return;
    cancelVoicePress();
  };

  useEffect(
    () => () => {
      voiceSessionRef.current += 1;
      voiceShouldStopRef.current = true;
      voiceAutoSubmitRef.current = false;
      voicePressingRef.current = false;
      clearVoicePointerTracking();
      clearVoiceAutoSubmitTimer();
      cleanupLocalVoiceCapture();
      stopVoiceStandbyStream();
      asrControllerRef.current?.close();
      asrControllerRef.current = null;
    },
    [],
  );

  // isSubmitting → isSubmittingRef 同步(供 runVoiceAutoSubmit / submitComposerMessage 读最新值)。
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (visibleChatAttachmentCount === 0 && isAttachmentTrayExpanded) {
      setIsAttachmentTrayExpanded(false);
    }
  }, [isAttachmentTrayExpanded, visibleChatAttachmentCount]);

  // canAttachVisuals 变 false(配额耗尽 / 仅查看)时清空待发素材与上传队列。
  useEffect(() => {
    if (canAttachVisuals) return;
    setAttachments([]);
    setMediaUploadItems([]);
  }, [canAttachVisuals]);

  const toggleComposerMode = () => {
    if (!canCaregive || !canUseComposerInput) return;
    if (composerMode === "voice") {
      stopVoiceCapture(false, false);
      stopVoiceStandbyStream();
      setComposerMode("keyboard");
      return;
    }

    setComposerMode("voice");
    setVoiceStatus("idle");
    setVoiceTranscript("");
    setVoiceError("");
    void prepareVoiceStandby();
  };

  // ---- 核心:提交消息 → Agent 流式 → 工具调用 → 落库 ----
  const submitComposerMessage = async (
    textOverride?: string,
    options: { skipVoiceStop?: boolean } = {},
  ) => {
    const text = (textOverride ?? inputValueRef.current).trim();
    if (!canCaregive) return;
    if ((!text && attachments.length === 0) || isSubmittingRef.current || isUploadingChatMedia) return;
    hapticLight();

    const submittedAttachments = attachments;
    const agentModel = resolveAgentModelForMessage(text, submittedAttachments);
    const agentThinkingEnabled = resolveThinkingForMessage(text, submittedAttachments);
    const agentLowLatencyEnabled = resolveLowLatencyForMessage(agentModel, submittedAttachments);
    const parentMessage: ChatMessage = {
      id: makeId("msg"),
      role: "parent",
      text: text || "上传了新的成长素材",
      createdAt: new Date().toISOString(),
      attachments: submittedAttachments,
    };
    const albumDecisions = submittedAttachments.map((attachment) => decideAlbumMedia(parentMessage, attachment));
    // 自动收藏：用户发到聊天的生活照/视频，发送瞬间就乐观进相册（不等 AI、不需手动点）。
    const autoSavedAttachmentIds = new Set<string>();
    albumDecisions
      .filter((decision) => decision.mode === "auto_save")
      .forEach((decision) => {
        const attachment = submittedAttachments.find((item) => item.id === decision.attachmentId);
        if (!attachment) return;
        const albumItem = albumItemFromDecision(decision, parentMessage, attachment);
        autoSavedAttachmentIds.add(decision.attachmentId);
        setAlbumItems((current) => dedupeAlbumItems([albumItem, ...current]));
        void lateRef.current.persistAlbumItemOptimistic(albumItem).catch(() => undefined);
      });
    // 只有"还不确定"的素材才保留确认卡片
    let albumPrompts = albumDecisions
      .filter((decision) => decision.mode === "ask")
      .map(albumPromptFromDecision);
    const ignoredScreenshotDecision = albumDecisions.find(
      (decision) => decision.mode === "ignore" && decision.tags.includes("截图"),
    );
    const pendingAiMessage: ChatMessage = {
      id: makeId("msg"),
      role: "ai",
      text: "思考中",
      createdAt: new Date().toISOString(),
      tags: [agentThinkingEnabled ? "深度思考" : "处理中"],
      reasoning: "",
      isStreaming: true,
      toolActivities: [],
    };

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    voiceAutoSubmitRef.current = false;
    clearVoiceAutoSubmitTimer();
    if (!options.skipVoiceStop) stopVoiceCapture();
    inputValueRef.current = "";
    setInput("");
    setVoiceTranscript("");
    setAttachments([]);
    setMessages((current) => [...current, parentMessage, pendingAiMessage]);

    let toolActivities: ToolActivity[] = [];
    try {
      const agentSourceAttachments = submittedAttachments;
      const visualAttachmentCount = agentSourceAttachments.filter(isVisualAttachment).length;
      const agentAttachments = await Promise.all(
        agentSourceAttachments.map(async (item) => ({
          id: item.id,
          name: item.kind === "video" ? `${item.name}（视频缩略图）` : item.name,
          kind: item.kind,
          dataUrl: await readAgentAttachmentDataUrl(item, visualAttachmentCount),
        })),
      );
      let reasoningText = "";
      let contentText = "";
      const agentResponse = await runAgentChatStream(
        {
          message: parentMessage.text,
          model: agentModel,
          babyProfile: babyProfileForAgent(profile),
          recentMessages: messages.slice(-12).map((message) => ({
            ...message,
            attachments: message.attachments?.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              kind: attachment.kind,
            })),
          })),
          careLogs: careLogs.slice(-10),
          memories: memories.slice(0, 10),
          pageContext: lateRef.current.buildAgentPageContext(),
          thinkingEnabled: agentThinkingEnabled,
          lowLatencyEnabled: agentLowLatencyEnabled,
          attachments: agentAttachments,
        },
        {
          onReasoning: (delta) => {
            reasoningText += delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? { ...message, reasoning: reasoningText, text: "思考中" }
                  : message,
              ),
            );
          },
          onContent: (delta) => {
            contentText += delta;
            const preview = extractAiTextPreview(contentText);
            if (!preview) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? { ...message, text: preview, tags: ["生成中"], reasoning: reasoningText }
                  : message,
              ),
            );
          },
          onTool: (activity) => {
            toolActivities = upsertToolActivity(toolActivities, activity);
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id
                  ? {
                      ...message,
                      toolActivities,
                      text: contentText ? message.text : activity.message,
                      tags: activity.status === "running" ? [isAgentProgressActivity(activity) ? "处理中" : "查询中"] : message.tags,
                    }
                  : message,
              ),
            );
          },
          onStatus: (status) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingAiMessage.id && !contentText
                  ? { ...message, text: status.message, tags: [agentStatusTag(status.type)] }
                  : message,
              ),
            );
          },
        },
      );
      const result = normalizeAgentResponse(
        suppressImageOnlyCareEffects(agentResponse, parentMessage.text, submittedAttachments, albumDecisions),
        parentMessage.text,
      );
      let aiText =
        ignoredScreenshotDecision && !/不会保存到.*相册|不.*保存.*相册/.test(result.aiText)
          ? `${result.aiText}\n\n这看起来是 App、网页或聊天截图，不会保存到成长相册。`
          : result.aiText;
      const serverAlbumDecisions = result.effectDecisions.filter((decision) => decision.type === "albumItem");
      const hasServerDecisions = serverAlbumDecisions.length > 0;
      let albumEffectMissingTarget = false;

      if (hasServerDecisions) {
        const albumEffectCandidates = [...messages, parentMessage];
        serverAlbumDecisions.forEach((decision) => {
          if (decision.mode === "ignore") return;
          const target = resolveAlbumEffectTarget(decision, albumEffectCandidates);
          if (!target) {
            albumEffectMissingTarget = true;
            return;
          }
          if (autoSavedAttachmentIds.has(target.attachment.id)) return; // 已自动进相册，不再弹确认卡
          const prompt = albumPromptFromEffectDecision(decision, target.message, target.attachment);
          if (!albumPrompts.some((item) => item.sourceMessageId === prompt.sourceMessageId && item.attachmentId === prompt.attachmentId)) {
            albumPrompts = [...albumPrompts, prompt];
          }
        });
      }

      if (albumEffectMissingTarget) {
        aiText = `${aiText}\n\n我没有找到要保存的照片或视频，可以重新发一下素材再告诉我保存到相册。`;
      } else if (albumPrompts.some((prompt) => prompt.status === "pending") && !/点.*保存到相册|确认.*保存到相册|保存到相册.*确认/.test(aiText)) {
        aiText = `${aiText}\n\n我会等你点「保存到相册」后再收藏这段素材。`;
      }
      if (autoSavedAttachmentIds.size > 0 && !/相册/.test(aiText)) {
        aiText = `${aiText}\n\n照片已经放进成长相册啦，不想留的可以在相册里删掉。`;
      }

      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: aiText,
        createdAt: new Date().toISOString(),
        tags: result.tags,
        reasoning: reasoningText,
        isStreaming: false,
        toolActivities,
        sources: result.sources,
        safetyAlerts: result.safetyAlerts,
        effectDecisions: result.effectDecisions,
        albumPrompts,
      };

      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      const persistenceTasks: Array<() => Promise<unknown>> = [
        () => lateRef.current.persistRecord("messages", parentMessage.id, lateRef.current.messageForStorage(parentMessage)),
        () => lateRef.current.persistRecord("messages", aiMessage.id, lateRef.current.messageForStorage(aiMessage)),
      ];
      try {
        for (const task of persistenceTasks) {
          await task();
        }
        const refreshedState = await readAppState();
        lateRef.current.applyStateResponse(refreshedState);
        void runConversationCompression();
      } catch {
        // Local state stays usable; the status chip tells the parent that the backend sync needs attention.
      }
    } catch (error) {
      if (error instanceof AgentApiError && error.code === "PRO_QUOTA_EXCEEDED") {
        lateRef.current.showSystemWeakNotice(error.message, "info", 3600);
        lateRef.current.applyForProTrial("ai-quota-exhausted");
      }
      const failedActivities = failedRunningActivities(toolActivities);
      const aiMessage: ChatMessage = {
        id: makeId("msg"),
        role: "ai",
        text: formatAgentFailureMessage(error, submittedAttachments),
        createdAt: new Date().toISOString(),
        tags: ["系统"],
        isStreaming: false,
        toolActivities: failedActivities,
      };
      setMessages((current) =>
        current.map((message) => (message.id === pendingAiMessage.id ? aiMessage : message)),
      );
      hapticWarning();
      try {
        await lateRef.current.persistRecord("messages", parentMessage.id, lateRef.current.messageForStorage(parentMessage));
        await lateRef.current.persistRecord("messages", aiMessage.id, lateRef.current.messageForStorage(aiMessage));
      } catch {
        // Keep the visible error message even if the backend is unreachable.
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };
  submitComposerMessageRef.current = submitComposerMessage;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitComposerMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  // ---- 派生:语音展示文案 ----
  const voiceHoldLabel =
    voiceCancelArmed
      ? "松开取消"
      : voiceStatus === "error"
      ? voiceError || "语音识别暂时不可用"
      : voiceStatus === "unsupported"
        ? voiceError || "当前环境不支持语音输入"
        : isListening
          ? voiceTranscript || (voiceStatus === "connecting" ? "正在连接语音识别..." : "正在听，松开结束")
          : voiceStatus === "processing"
            ? voiceTranscript || "正在整理文字..."
            : voiceTranscript || composerInput.get().trim() || "按住说话";
  const voiceButtonStyle = { "--voice-level": voiceLevel.toFixed(3) } as CSSProperties;
  // 松开后进入 processing(等 ASR 收尾)时不再显示蓝色蒙层/语音面板——松手即时收起。
  // 此时 interim 识别文字已经在 composer 里(onTranscript 的 setInput),onFinal 再精修并自动提交,
  // 所以收起蒙层不会丢字,反而消除了“松手后蒙层不走、文字延迟出现”的卡顿感。
  const voiceRecordingActive =
    composerMode === "voice" &&
    (isListening || voiceStatus === "connecting" || voiceCancelArmed);
  // voicePanelLabel 留在 App(只在 App 的 voice-recording-panel JSX 用,非 ChatScreen prop;仅依赖 voiceCancelArmed)。
  // 会话摘要压缩是纯后台优化(压缩较早聊天记录让后续回答更连贯),压缩逻辑照常在后台跑。
  // 但它异步跟在 AI 回答之后,若在聊天流里显示“正在整理…”,紧贴“已记录下来了”会让用户误以为
  // 是自己这条记录还没处理完,造成困扰。故不再向 UI 暴露任何压缩状态文案(compressionMessage 恒空)。
  const compressionMessage = "";

  return {
    composerMode,
    setComposerMode,
    voiceStatus,
    setVoiceStatus,
    voiceLevel,
    setVoiceLevel,
    voiceTranscript,
    setVoiceTranscript,
    voiceCancelArmed,
    setVoiceCancelArmed,
    voiceError,
    setVoiceError,
    attachments,
    setAttachments,
    isAttachmentTrayExpanded,
    setIsAttachmentTrayExpanded,
    mediaUploadItems,
    setMediaUploadItems,
    isListening,
    setIsListening,
    isSubmitting,
    setIsSubmitting,
    compressionStatus,
    setCompressionStatus,
    fileInputRef,
    isSubmittingRef,
    // 派生(附件/托盘/工具门禁)
    chatUploadItems,
    activeChatUploadItems,
    isUploadingChatMedia,
    visibleChatAttachmentCount,
    isChatAttachmentLimitReached,
    chatAttachmentCountLabel,
    chatAttachmentLimitLabel,
    pendingImageCount,
    pendingVideoCount,
    pendingUploadCount,
    attachmentTrayMetaLabel,
    canCollapseAttachmentTray,
    isAttachmentTrayOpen,
    attachmentTrayPreviewItems,
    attachmentTrayOverflowCount,
    visualToolTitle,
    visualToolGated,
    visualToolDisabled,
    visualToolClassName,
    canUseComposerInput,
    // 派生(语音/压缩展示)
    voiceHoldLabel,
    voiceButtonStyle,
    voiceRecordingActive,
    compressionMessage,
    // 处理函数
    processSelectedMediaFiles,
    handleFiles,
    openMediaPicker,
    runConversationCompression,
    toggleComposerMode,
    startVoicePress,
    releaseVoicePress,
    cancelVoicePointer,
    cancelVoiceCapture,
    submitComposerMessage,
    handleSubmit,
    handleComposerKeyDown,
  };
}
