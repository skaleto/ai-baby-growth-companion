// FE/BE 契约防护(评审 P6,呼应 appStateContract 的 D10 防线)。
//
// 背景:AgentChatResponse 的数组字段类型都是 `X[] | null`,后端「无内容时返回 null / 省略字段」是合法的。
// 前端下游(useChatState 的 suppressImageOnlyCareEffects 早退分支 → `result.effectDecisions.filter(...)`)
// 并不总带 `?? []` 兜底,一旦后端某次回 null,文本消息链路会在深处 `null.filter` 白屏,mock 测试永远发现不了。
// 本模块在 agentApi 拿到响应后统一把「下游会 .map/.filter 的数组字段」归一为数组、aiText 归一为字符串;
// 对象/标量字段(growthEvent / careLogPatch / traceId 等)保持原值不臆造(空对象可能误触发空副作用)。
//
// 纯模块红线(同 appStateContract):会被 esbuild 逻辑测试在 Node 打包,不得 import React / window /
// import.meta.env / 资产文件。
import type { AgentChatResponse } from "./types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

// AgentChatResponse 里下游按数组消费的字段(缺失/为 null → 归一为 [])。
const AGENT_ARRAY_FIELDS = [
  "tags",
  "reminders",
  "memories",
  "expenses",
  "sources",
  "safetyAlerts",
  "effectDecisions",
  "usedSkills",
] as const;

/**
 * 归一化 AI 聊天响应:保证所有数组字段恒为数组、aiText 恒为字符串,其余字段透传。
 * 只做「安全降级」,不改变正常响应的语义(正常响应各数组已是数组 → 原样返回)。
 */
export const normalizeAgentChatResponse = (raw: unknown): AgentChatResponse => {
  const value = asRecord(raw);
  const normalized: UnknownRecord = { ...value, aiText: asText(value.aiText) };
  for (const field of AGENT_ARRAY_FIELDS) {
    normalized[field] = asArray(value[field]);
  }
  return normalized as unknown as AgentChatResponse;
};
