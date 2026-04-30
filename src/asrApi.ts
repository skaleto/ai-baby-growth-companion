const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8080");

export type AsrStreamMessage =
  | { type: "ready"; traceId: string }
  | { type: "partial"; text: string; final: false }
  | { type: "final"; text: string; final: true }
  | { type: "error"; code?: string; message: string };

export type AsrStreamHandlers = {
  onReady?: (traceId: string) => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string, code?: string) => void;
  onClose?: () => void;
};

export type AsrStreamController = {
  sendAudio: (chunk: Uint8Array) => void;
  end: () => void;
  close: () => void;
};

const asWebSocketUrl = (url: string) => {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/api/asr/stream";
  parsed.search = "";
  return parsed.toString();
};

export function runAsrStream(handlers: AsrStreamHandlers = {}): AsrStreamController {
  const socket = new WebSocket(asWebSocketUrl(apiBaseUrl));
  const traceId = `asr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let ready = false;
  let ended = false;
  const queuedChunks: Uint8Array[] = [];

  const sendEnd = () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "end" }));
    }
  };

  socket.binaryType = "arraybuffer";
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "start", sampleRate: 16000, format: "pcm_s16le", traceId }));
  };
  socket.onmessage = (event) => {
    const payload = JSON.parse(String(event.data)) as AsrStreamMessage;
    if (payload.type === "ready") {
      ready = true;
      handlers.onReady?.(payload.traceId);
      while (queuedChunks.length && socket.readyState === WebSocket.OPEN) {
        socket.send(queuedChunks.shift()!);
      }
      if (ended) {
        sendEnd();
      }
      return;
    }
    if (payload.type === "partial") {
      handlers.onPartial?.(payload.text);
      return;
    }
    if (payload.type === "final") {
      handlers.onFinal?.(payload.text);
      return;
    }
    if (payload.type === "error") {
      handlers.onError?.(payload.message, payload.code);
    }
  };
  socket.onerror = () => {
    handlers.onError?.("语音识别连接失败", "ASR_SOCKET_ERROR");
  };
  socket.onclose = () => {
    handlers.onClose?.();
  };

  return {
    sendAudio: (chunk) => {
      if (ended || !chunk.length || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
      if (!ready || socket.readyState !== WebSocket.OPEN) {
        queuedChunks.push(chunk);
        return;
      }
      socket.send(chunk);
    },
    end: () => {
      if (ended) {
        return;
      }
      ended = true;
      if (ready) {
        sendEnd();
      }
    },
    close: () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
}
