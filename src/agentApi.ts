import { AgentChatRequest, AgentChatResponse, ToolActivity } from "./types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8080");

type ApiErrorResponse = {
  code?: string;
  message?: string;
};

export async function runAgentChat(request: AgentChatRequest): Promise<AgentChatResponse> {
  const response = await fetch(`${apiBaseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = `AI 服务请求失败（${response.status}）`;
    try {
      const error = (await response.json()) as ApiErrorResponse;
      if (error.message) message = error.message;
      if (error.code) message = `${error.code}: ${message}`;
    } catch {
      // Keep the status-based message when the backend did not return JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as AgentChatResponse;
}

type StreamHandlers = {
  onReasoning?: (delta: string) => void;
  onContent?: (delta: string) => void;
  onTool?: (activity: ToolActivity) => void;
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
  const response = await fetch(`${apiBaseUrl}/api/agent/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    let message = `AI 服务请求失败（${response.status}）`;
    try {
      const error = (await response.json()) as ApiErrorResponse;
      if (error.message) message = error.message;
      if (error.code) message = `${error.code}: ${message}`;
    } catch {
      // Keep the status-based message when the backend did not return JSON.
    }
    throw new Error(message);
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
