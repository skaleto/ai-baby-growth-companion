// 领域拆分 P7:从 appStateDomain 抽出的「聊天消息/记忆/会话摘要/Pro 试用/待生效副作用」归一化——聚合层。
// 纯模块红线:不 import 宿主 API;normalizePendingEffect 汇聚 care/growth/reminder/expense 归一化,是依赖图的单向汇点(下游不得反向 import 本模块)。
import type {
  ChatMessage,
  ConversationSummary,
  MemoryItem,
  PendingEffect,
  ProTrialStatus,
} from "../types";
import { numberValue, stringList, textValue } from "./coerce";
import { normalizeAlbumPrompt, normalizeAttachment } from "./media";
import { normalizeCareLog } from "./care";
import { normalizeGrowthEvent, normalizeGrowthMeasurement } from "./growth";
import { normalizeReminder } from "./reminder";
import { normalizeExpenseItem } from "./expense";

export const normalizeChatMessage = (value: Partial<ChatMessage> | null | undefined, index: number): ChatMessage => ({
  id: textValue(value?.id, `message-${index}`),
  role: value?.role === "parent" ? "parent" : "ai",
  text: textValue(value?.text),
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
  attachments: Array.isArray(value?.attachments)
    ? value.attachments.map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
    : undefined,
  tags: stringList(value?.tags),
  reasoning: textValue(value?.reasoning) || undefined,
  isStreaming: Boolean(value?.isStreaming),
  toolActivities: Array.isArray(value?.toolActivities) ? value.toolActivities : [],
  sources: Array.isArray(value?.sources) ? value.sources : [],
  safetyAlerts: Array.isArray(value?.safetyAlerts) ? value.safetyAlerts : [],
  effectDecisions: Array.isArray(value?.effectDecisions) ? value.effectDecisions : [],
  albumPrompts: Array.isArray(value?.albumPrompts) ? value.albumPrompts.map(normalizeAlbumPrompt) : [],
});

export const normalizeMemoryItem = (value: Partial<MemoryItem> | null | undefined, index: number): MemoryItem => ({
  id: textValue(value?.id, `memory-${index}`),
  text: textValue(value?.text),
  category: normalizeMemoryCategory(value?.category),
  confidence: numberValue(value?.confidence) ?? 0.7,
  updatedAt: textValue(value?.updatedAt, new Date().toISOString()),
});

export const normalizeConversationSummary = (
  value: Partial<ConversationSummary> | null | undefined,
): ConversationSummary | null => {
  const text = textValue(value?.text).trim();
  if (!text) return null;
  return {
    id: textValue(value?.id, "conversation-summary"),
    text,
    coveredThroughMessageId: textValue(value?.coveredThroughMessageId),
    coveredThroughCreatedAt: textValue(value?.coveredThroughCreatedAt),
    sourceMessageCount: numberValue(value?.sourceMessageCount) ?? 0,
    updatedAt: textValue(value?.updatedAt, new Date().toISOString()),
  };
};

export const normalizeProTrialStatus = (value: Partial<ProTrialStatus> | null | undefined): ProTrialStatus => ({
  enabled: Boolean(value?.enabled),
  entitlement: value?.entitlement
    ? {
        enabled: Boolean(value.entitlement.enabled),
        planCode: textValue(value.entitlement.planCode) || undefined,
        startsAt: textValue(value.entitlement.startsAt) || undefined,
        expiresAt: textValue(value.entitlement.expiresAt) || undefined,
      }
    : null,
  application: value?.application
    ? {
        id: textValue(value.application.id),
        status: textValue(value.application.status, "pending"),
        source: textValue(value.application.source) || undefined,
        createdAt: textValue(value.application.createdAt) || undefined,
        updatedAt: textValue(value.application.updatedAt) || undefined,
      }
    : null,
  message: textValue(value?.message) || undefined,
  freeMonthlyQuota: typeof value?.freeMonthlyQuota === "number" ? value.freeMonthlyQuota : undefined,
  // 后端 Pro 家庭返回 null（不限次）；缺省也按 null 处理，避免在状态未知时硬拦截（服务端仍是唯一权威）。
  freeCallsRemaining: typeof value?.freeCallsRemaining === "number" ? value.freeCallsRemaining : null,
});

export const normalizePendingEffect = (value: Partial<PendingEffect> | null | undefined, index: number): PendingEffect => ({
  id: textValue(value?.id, `pending-${index}`),
  messageId: textValue(value?.messageId),
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
  status: value?.status === "applied" || value?.status === "dismissed" ? value.status : "pending",
  domain: textValue(value?.domain) || undefined,
  source: value?.source && typeof value.source === "object"
    ? {
        kind: textValue(value.source.kind) || undefined,
        traceId: textValue(value.source.traceId) || undefined,
        toolCallId: textValue(value.source.toolCallId) || undefined,
        toolName: textValue(value.source.toolName) || undefined,
        idempotencyKey: textValue(value.source.idempotencyKey) || undefined,
      }
    : undefined,
  payload: value?.payload,
  tags: stringList(value?.tags),
  growthEvent: value?.growthEvent ? normalizeGrowthEvent(value.growthEvent, index) : undefined,
  growthMeasurements: Array.isArray(value?.growthMeasurements) ? value.growthMeasurements.map(normalizeGrowthMeasurement) : [],
  careLogPatch: value?.careLogPatch ? normalizeCareLog(value.careLogPatch, index) : undefined,
  reminders: Array.isArray(value?.reminders) ? value.reminders.map(normalizeReminder) : [],
  memories: Array.isArray(value?.memories) ? value.memories.map(normalizeMemoryItem) : [],
  expenses: Array.isArray(value?.expenses) ? value.expenses.map(normalizeExpenseItem) : [],
  safetyAlerts: Array.isArray(value?.safetyAlerts) ? value.safetyAlerts : [],
});

export function normalizeMemoryCategory(category: string | undefined): MemoryItem["category"] {
  if (
    category === "routine" ||
    category === "preference" ||
    category === "health" ||
    category === "caregiver" ||
    category === "concern"
  ) {
    return category;
  }
  return "routine";
}
