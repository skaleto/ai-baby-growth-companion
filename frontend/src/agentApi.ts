import { AgentChatRequest, AgentChatResponse, ConversationSummary, ToolActivity } from "./types";
import { apiBaseUrl, apiFetch, authHeaders } from "./authApi";

type ApiErrorResponse = {
  code?: string;
  message?: string;
};

/** 携带后端 error code 的 AI 接口错误，便于上层区分配额用尽（PRO_QUOTA_EXCEEDED）等情况。 */
export class AgentApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AgentApiError";
    this.status = status;
    this.code = code;
  }
}

async function toAgentError(response: Response, fallback: string): Promise<AgentApiError> {
  let message = `${fallback}（${response.status}）`;
  let code: string | undefined;
  try {
    const error = (await response.json()) as ApiErrorResponse;
    if (error.message) message = error.message;
    if (error.code) code = error.code;
  } catch {
    // Keep the status-based message when the backend did not return JSON.
  }
  return new AgentApiError(message, response.status, code);
}

export type AgentStreamStatusType = "planning" | "retrieving_context" | "analyzing_media" | "generating";

const AGENT_STATUS_EVENTS = new Set<AgentStreamStatusType>([
  "planning",
  "retrieving_context",
  "analyzing_media",
  "generating",
]);

export async function runAgentChat(request: AgentChatRequest): Promise<AgentChatResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw await toAgentError(response, "AI 服务请求失败");
  }

  return (await response.json()) as AgentChatResponse;
}

type StreamHandlers = {
  onReasoning?: (delta: string) => void;
  onContent?: (delta: string) => void;
  onTool?: (activity: ToolActivity) => void;
  onStatus?: (status: { type: AgentStreamStatusType; message: string }) => void;
};

type StreamEnvelope = {
  delta?: string;
  message?: string;
  id?: string;
  toolId?: string;
  name?: string;
  status?: ToolActivity["status"];
  query?: string;
};

export async function runAgentChatStream(
  request: AgentChatRequest,
  handlers: StreamHandlers = {},
): Promise<AgentChatResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/agent/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    throw await toAgentError(response, "AI 服务请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: AgentChatResponse | undefined;

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() ?? "message";
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");
    if (!data) return;

    if (event === "final") {
      finalResponse = JSON.parse(data) as AgentChatResponse;
      return;
    }

    const envelope = JSON.parse(data) as StreamEnvelope;
    if (event === "reasoning" && envelope.delta) {
      handlers.onReasoning?.(envelope.delta);
    }
    if (event === "content" && envelope.delta) {
      handlers.onContent?.(envelope.delta);
    }
    if (event === "tool" && envelope.id && envelope.toolId && envelope.name && envelope.status && envelope.message) {
      handlers.onTool?.({
        id: envelope.id,
        toolId: envelope.toolId,
        name: envelope.name,
        status: envelope.status,
        message: envelope.message,
        query: envelope.query,
      });
    }
    const statusType = event as AgentStreamStatusType;
    if (AGENT_STATUS_EVENTS.has(statusType) && envelope.message) {
      handlers.onStatus?.({ type: statusType, message: envelope.message });
    }
    if (event === "error") {
      throw new Error(envelope.message ?? "AI 流式响应失败");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let separatorMatch = buffer.match(/\r?\n\r?\n/);
    while (separatorMatch?.index !== undefined) {
      const separatorIndex = separatorMatch.index;
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + separatorMatch[0].length);
      processBlock(block);
      separatorMatch = buffer.match(/\r?\n\r?\n/);
    }

    if (done) break;
  }

  if (buffer.trim()) processBlock(buffer);
  if (!finalResponse) throw new Error("AI 流式响应缺少最终结果");
  return finalResponse;
}

export type ConversationSummaryResponse = {
  needed: boolean;
  status: "skipped" | "compressed";
  conversationSummary?: ConversationSummary | null;
};

export async function compressConversationSummary(): Promise<ConversationSummaryResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/agent/conversation-summary/compress`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await toAgentError(response, "聊天记录整理失败");
  }

  return (await response.json()) as ConversationSummaryResponse;
}
