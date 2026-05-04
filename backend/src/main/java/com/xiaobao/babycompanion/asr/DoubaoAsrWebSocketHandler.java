package com.xiaobao.babycompanion.asr;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.AuthService;
import com.xiaobao.babycompanion.config.DoubaoAsrProperties;
import com.xiaobao.babycompanion.exception.AuthException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

@Component
public class DoubaoAsrWebSocketHandler extends AbstractWebSocketHandler {

    private final DoubaoAsrProperties properties;
    private final ObjectMapper objectMapper;
    private final AuthService authService;
    private final HttpClient httpClient;
    private final Map<String, AsrSessionState> sessions = new ConcurrentHashMap<>();

    public DoubaoAsrWebSocketHandler(DoubaoAsrProperties properties, ObjectMapper objectMapper, AuthService authService) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.authService = authService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.getConnectTimeout())
                .build();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), new AsrSessionState(session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        AsrSessionState state = sessions.computeIfAbsent(session.getId(), ignored -> new AsrSessionState(session));
        JsonNode root = objectMapper.readTree(message.getPayload());
        String type = root.path("type").asText("");
        if ("start".equals(type)) {
            startDoubaoSession(state, root);
            return;
        }
        if ("end".equals(type)) {
            state.end();
            return;
        }
        sendError(session, "ASR_BAD_MESSAGE", "Unsupported ASR message type: " + type);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        AsrSessionState state = sessions.computeIfAbsent(session.getId(), ignored -> new AsrSessionState(session));
        ByteBuffer payload = message.getPayload();
        byte[] bytes = new byte[payload.remaining()];
        payload.get(bytes);
        state.sendAudio(bytes);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        AsrSessionState state = sessions.remove(session.getId());
        if (state != null) {
            state.close();
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        AsrSessionState state = sessions.remove(session.getId());
        if (state != null) {
            state.close();
        }
    }

    private void startDoubaoSession(AsrSessionState state, JsonNode root) {
        if (state.started.getAndSet(true)) {
            sendError(state.frontend, "ASR_ALREADY_STARTED", "ASR session has already started");
            return;
        }

        String traceId = root.path("traceId").asText("asr-" + UUID.randomUUID());
        String token = root.path("token").asText("");
        try {
            AuthPrincipal principal = authService.authenticateToken(token);
            if (!principal.caregiver()) {
                sendError(state.frontend, "FORBIDDEN", "当前身份仅可查看，不能记录或修改。");
                return;
            }
        } catch (AuthException exception) {
            sendError(state.frontend, "AUTH_REQUIRED", "请先登录后再使用语音输入。");
            return;
        }
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            sendError(state.frontend, "ASR_CONFIG_MISSING", "DOUBAO_ASR_API_KEY or /Users/.doubao_asr_key is not configured");
            return;
        }
        String requestId = UUID.randomUUID().toString();
        int sampleRate = root.path("sampleRate").asInt(16000);
        String format = root.path("format").asText("pcm_s16le");
        if (sampleRate != 16000 || !"pcm_s16le".equals(format)) {
            sendError(state.frontend, "ASR_UNSUPPORTED_AUDIO", "Only 16kHz mono pcm_s16le audio is supported");
            return;
        }

        WebSocket.Listener listener = new DoubaoListener(state);
        httpClient.newWebSocketBuilder()
                .header("X-Api-Key", apiKey)
                .header("X-Api-Resource-Id", properties.getResourceId())
                .header("X-Api-Request-Id", requestId)
                .header("X-Api-Sequence", "-1")
                .buildAsync(URI.create(properties.getEndpoint()), listener)
                .orTimeout(properties.getConnectTimeout().toMillis(), TimeUnit.MILLISECONDS)
                .whenComplete((socket, exception) -> {
                    if (exception != null) {
                        sendError(state.frontend, "ASR_CONNECT_FAILED", asrConnectErrorMessage(exception));
                        return;
                    }
                    state.socket = socket;
                    sendFullClientRequest(state, traceId);
                    sendJson(state.frontend, Map.of("type", "ready", "traceId", traceId));
                });
    }

    private String asrConnectErrorMessage(Throwable exception) {
        Throwable root = exception instanceof java.util.concurrent.CompletionException completionException
                ? completionException.getCause()
                : exception;
        if (root instanceof WebSocketHandshakeException handshakeException) {
            int status = handshakeException.getResponse().statusCode();
            String logId = handshakeException.getResponse().headers().firstValue("x-tt-logid").orElse("");
            return StringUtils.hasText(logId)
                    ? "Failed to connect Doubao ASR: HTTP " + status + ", logid=" + logId
                    : "Failed to connect Doubao ASR: HTTP " + status;
        }
        return root == null || !StringUtils.hasText(root.getMessage())
                ? "Failed to connect Doubao ASR"
                : "Failed to connect Doubao ASR: " + root.getMessage();
    }

    private void sendFullClientRequest(AsrSessionState state, String traceId) {
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "user", Map.of("uid", traceId),
                    "audio", Map.of(
                            "format", "pcm",
                            "rate", 16000,
                            "bits", 16,
                            "channel", 1
                    ),
                    "request", Map.of(
                            "model_name", "bigmodel",
                            "enable_itn", true,
                            "enable_punc", true,
                            "enable_ddc", false,
                            "show_utterances", true,
                            "result_type", "full"
                    )
            ));
            state.sendToDoubao(DoubaoAsrProtocol.fullClientRequest(body));
        } catch (Exception exception) {
            sendError(state.frontend, "ASR_START_FAILED", "Failed to start Doubao ASR");
        }
    }

    private void handleDoubaoFrame(AsrSessionState state, byte[] bytes) {
        try {
            DoubaoAsrProtocol.ParsedFrame frame = DoubaoAsrProtocol.parse(bytes);
            if (frame.error()) {
                sendError(state.frontend, "ASR_PROVIDER_ERROR", extractErrorMessage(frame.payload()));
                return;
            }
            if (!frame.isTextResponse() || !StringUtils.hasText(frame.payload())) {
                return;
            }

            JsonNode root = objectMapper.readTree(frame.payload());
            String text = extractText(root);
            if (!StringUtils.hasText(text)) {
                return;
            }

            boolean isFinal = (frame.sequence() != null && frame.sequence() < 0) || hasDefiniteUtterance(root);
            sendJson(state.frontend, Map.of(
                    "type", isFinal ? "final" : "partial",
                    "text", text,
                    "final", isFinal
            ));
        } catch (Exception exception) {
            sendError(state.frontend, "ASR_PARSE_FAILED", "Failed to parse Doubao ASR response");
        }
    }

    private String extractText(JsonNode root) {
        JsonNode result = root.path("result");
        if (result.isArray() && !result.isEmpty()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode item : result) {
                String text = item.path("text").asText("");
                if (StringUtils.hasText(text)) {
                    builder.append(text);
                }
            }
            return builder.toString();
        }
        return result.path("text").asText("");
    }

    private boolean hasDefiniteUtterance(JsonNode root) {
        JsonNode utterances = root.path("result").path("utterances");
        if (!utterances.isArray()) {
            return false;
        }
        for (JsonNode item : utterances) {
            if (item.path("definite").asBoolean(false)) {
                return true;
            }
        }
        return false;
    }

    private String extractErrorMessage(String payload) {
        if (!StringUtils.hasText(payload)) {
            return "Doubao ASR returned an error";
        }
        try {
            JsonNode root = objectMapper.readTree(payload);
            String message = root.path("message").asText("");
            return StringUtils.hasText(message) ? message : payload;
        } catch (Exception exception) {
            return payload;
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        sendJson(session, Map.of(
                "type", "error",
                "code", code,
                "message", message,
                "timestamp", Instant.now().toString()
        ));
    }

    private void sendJson(WebSocketSession session, Map<String, ?> payload) {
        try {
            if (!session.isOpen()) {
                return;
            }
            String body = objectMapper.writeValueAsString(payload);
            synchronized (session) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(body));
                }
            }
        } catch (Exception ignored) {
            // The browser may close the voice session while ASR is still returning chunks.
        }
    }

    private final class DoubaoListener implements WebSocket.Listener {
        private final AsrSessionState state;
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

        private DoubaoListener(AsrSessionState state) {
            this.state = state;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onBinary(WebSocket webSocket, ByteBuffer data, boolean last) {
            byte[] bytes = new byte[data.remaining()];
            data.get(bytes);
            synchronized (buffer) {
                buffer.writeBytes(bytes);
                if (last) {
                    handleDoubaoFrame(state, buffer.toByteArray());
                    buffer.reset();
                }
            }
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            sendError(state.frontend, "ASR_PROVIDER_ERROR", data.toString());
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            sendError(state.frontend, "ASR_PROVIDER_ERROR", "Doubao ASR stream failed");
        }
    }

    private final class AsrSessionState {
        private final WebSocketSession frontend;
        private final AtomicInteger sequence = new AtomicInteger(1);
        private final AtomicBoolean started = new AtomicBoolean(false);
        private volatile WebSocket socket;
        private volatile boolean ended;

        private AsrSessionState(WebSocketSession frontend) {
            this.frontend = frontend;
        }

        private void sendAudio(byte[] bytes) {
            if (ended || socket == null || bytes.length == 0) {
                return;
            }
            sendToDoubao(DoubaoAsrProtocol.audioRequest(bytes, sequence.getAndIncrement(), false));
        }

        private void end() {
            if (ended) {
                return;
            }
            ended = true;
            if (socket == null) {
                return;
            }
            sendToDoubao(DoubaoAsrProtocol.audioRequest(new byte[0], sequence.getAndIncrement(), true));
            CompletableFuture.delayedExecutor(8, TimeUnit.SECONDS).execute(this::close);
        }

        private synchronized void sendToDoubao(byte[] bytes) {
            if (socket == null) {
                return;
            }
            socket.sendBinary(ByteBuffer.wrap(bytes), true);
        }

        private void close() {
            WebSocket current = socket;
            socket = null;
            if (current != null) {
                current.sendClose(WebSocket.NORMAL_CLOSURE, "closed");
            }
        }
    }
}
