import type { AiUsageBreakdown } from "../types";

const AI_USAGE_FEATURE_LABELS: Record<string, string> = {
  agent_chat: "聊天回复",
  agent_planner: "理解规划",
  agent_stream: "流式回复",
  agent_visual_analysis: "图片分批分析",
  conversation_summary: "上下文压缩",
  daily_summary: "今日小结",
};

const AI_USAGE_PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  doubao: "豆包",
  rules: "规则",
};

const tokenFormatter = new Intl.NumberFormat("zh-CN");

export const formatTokenCount = (tokens: number | undefined | null) =>
  tokenFormatter.format(Math.max(0, tokens ?? 0));

export const aiUsageFeatureLabel = (feature?: string | null) =>
  feature ? AI_USAGE_FEATURE_LABELS[feature] ?? feature : "未分类";

export const aiUsageProviderLabel = (provider?: string | null) =>
  provider ? AI_USAGE_PROVIDER_LABELS[provider] ?? provider : "未知模型";

export const aiUsageModelLabel = (item: AiUsageBreakdown) => {
  const provider = aiUsageProviderLabel(item.provider);
  if (!item.model || item.model === "unknown") return provider;
  return `${provider} · ${item.model}`;
};
