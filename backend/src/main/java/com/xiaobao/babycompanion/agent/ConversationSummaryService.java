package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.agent.ConversationSummaryResponse;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;

/**
 * Chat-compression vertical extracted verbatim from {@link AgentRuntime} (P3 phase 1).
 *
 * <p>The public entry ({@link #compressConversationSummary()}) and its private helpers
 * ({@code runSummaryModel}, {@code buildSummaryPrompt}, {@code summaryMessage},
 * {@code coveredMessageIndex}, {@code messageTextLength}, {@code sourceMessageCount}) are moved
 * here byte-for-byte to keep {@code /api/agent/conversation-summary/compress} behaviour identical.
 *
 * <p>All model/REST/usage plumbing (model resolution, api-key selection, RestClient selection,
 * response-format, usage logging, JSON-object extraction) comes from the shared
 * {@link AgentModelGateway} — there is no duplicated copy of that logic here.
 */
@Service
public class ConversationSummaryService {

    private static final int SUMMARY_RECENT_MESSAGE_KEEP = 12;
    private static final int SUMMARY_MIN_NEW_MESSAGES = 24;
    private static final int SUMMARY_MIN_NEW_CHARS = 12_000;

    private final AgentModelGateway modelGateway;
    private final ObjectMapper objectMapper;
    private final AppStateService appStateService;
    private final CurrentUser currentUser;
    private final Clock clock;

    @Autowired
    public ConversationSummaryService(
            AgentModelGateway modelGateway,
            ObjectMapper objectMapper,
            AppStateService appStateService,
            CurrentUser currentUser,
            Clock clock
    ) {
        this.modelGateway = modelGateway;
        this.objectMapper = objectMapper;
        this.appStateService = appStateService;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    // Test-friendly constructor mirroring the single-arg-lite path AgentRuntime exposes.
    public ConversationSummaryService(
            AgentModelGateway modelGateway,
            ObjectMapper objectMapper,
            AppStateService appStateService,
            CurrentUser currentUser
    ) {
        this(
                modelGateway,
                objectMapper,
                appStateService,
                currentUser,
                Clock.system(ZoneId.of("Asia/Shanghai"))
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Chat-compression vertical — moved verbatim from AgentRuntime (lines ~499-635 pre-refactor).
    // ---------------------------------------------------------------------------------------------

    public ConversationSummaryResponse compressConversationSummary() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        AppStateDto state = appStateService.readForUser(principal.familyId(), principal.userId()).state();
        List<JsonNode> messages = state.messages() == null ? List.of() : state.messages();
        JsonNode currentSummary = state.conversationSummary();

        int coveredIndex = coveredMessageIndex(messages, currentSummary);
        int compressEndExclusive = Math.max(coveredIndex + 1, messages.size() - SUMMARY_RECENT_MESSAGE_KEEP);
        if (compressEndExclusive <= coveredIndex + 1) {
            return new ConversationSummaryResponse(false, "skipped", currentSummary);
        }

        List<JsonNode> newMessages = messages.subList(coveredIndex + 1, messages.size());
        int newMessageChars = newMessages.stream().mapToInt(this::messageTextLength).sum();
        if (newMessages.size() < SUMMARY_MIN_NEW_MESSAGES && newMessageChars < SUMMARY_MIN_NEW_CHARS) {
            return new ConversationSummaryResponse(false, "skipped", currentSummary);
        }

        List<JsonNode> candidates = messages.subList(coveredIndex + 1, compressEndExclusive);

        RuntimeModel summaryModel = modelGateway.resolvePlannerModel();
        String apiKey = modelGateway.resolvedApiKey(summaryModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(summaryModel.apiKeyHelp() + " is not configured for conversation compression");
        }

        JsonNode summary = runSummaryModel(summaryModel, apiKey, currentSummary, candidates, principal.familyId(), principal.userId());
        JsonNode saved = appStateService
                .upsertRecord("conversationSummary", "conversation-summary", summary, "replace")
                .state()
                .conversationSummary();
        return new ConversationSummaryResponse(true, "compressed", saved == null ? summary : saved);
    }

    private JsonNode runSummaryModel(RuntimeModel runtimeModel, String apiKey, JsonNode currentSummary, List<JsonNode> messages, String familyId, String userId) {
        try {
            DeepSeekChatRequest request = new DeepSeekChatRequest(
                    runtimeModel.apiModel(),
                    List.of(
                            new DeepSeekMessage("system", AgentPrompts.SUMMARY_SYSTEM_PROMPT),
                            new DeepSeekMessage("user", buildSummaryPrompt(currentSummary, messages))
                    ),
                    false,
                    1200,
                    0.0,
                    modelGateway.responseFormat(runtimeModel),
                    Map.of("type", "disabled"),
                    null,
                    null,
                    null
            );
            DeepSeekChatResponse response = modelGateway.restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(request)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response != null) {
                modelGateway.recordUsage(runtimeModel, "conversation_summary", "text", familyId, userId, response.id(), response.usage(), true, null, false, true);
            }
            String content = Optional.ofNullable(response)
                    .map(DeepSeekChatResponse::choices)
                    .filter((choices) -> !choices.isEmpty())
                    .map((choices) -> choices.get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .orElseThrow(() -> new DeepSeekApiException("Summary model returned an empty response"));
            String text = objectMapper.readTree(modelGateway.extractJsonObject(content)).path("text").asText("");
            if (!StringUtils.hasText(text)) {
                throw new DeepSeekApiException("Summary model did not include text");
            }

            JsonNode last = messages.get(messages.size() - 1);
            ObjectNode summary = objectMapper.createObjectNode();
            summary.put("id", "conversation-summary");
            summary.put("text", text.trim());
            summary.put("coveredThroughMessageId", nodeText(last, "id", ""));
            summary.put("coveredThroughCreatedAt", nodeText(last, "createdAt", ""));
            summary.put("sourceMessageCount", sourceMessageCount(currentSummary) + messages.size());
            summary.put("updatedAt", Instant.now().toString());
            return summary;
        } catch (RestClientException | JsonProcessingException exception) {
            modelGateway.recordUsage(runtimeModel, "conversation_summary", "text", familyId, userId, "conversation-summary-" + UUID.randomUUID(), null, false, rootCauseMessage(exception), false, true);
            throw new DeepSeekApiException("Failed to compress conversation summary", exception);
        }
    }

    private String buildSummaryPrompt(JsonNode currentSummary, List<JsonNode> messages) throws JsonProcessingException {
        Map<String, Object> context = new LinkedHashMap<>();
        putCurrentTime(context);
        context.put("existingSummary", currentSummary);
        context.put("messagesToCompress", messages.stream().map(this::summaryMessage).toList());
        return "请压缩下面较早聊天，合并到 existingSummary，输出 JSON。\n上下文:\n%s"
                .formatted(objectMapper.writeValueAsString(context));
    }

    private Map<String, Object> summaryMessage(JsonNode message) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", nodeText(message, "id", ""));
        item.put("role", nodeText(message, "role", ""));
        item.put("createdAt", nodeText(message, "createdAt", ""));
        item.put("text", nodeText(message, "text", ""));
        JsonNode tags = message == null ? null : message.get("tags");
        if (tags != null && tags.isArray()) item.put("tags", tags);
        return item;
    }

    private int coveredMessageIndex(List<JsonNode> messages, JsonNode summary) {
        if (summary == null || summary.isNull()) return -1;
        String coveredId = nodeText(summary, "coveredThroughMessageId", "");
        if (StringUtils.hasText(coveredId)) {
            for (int index = messages.size() - 1; index >= 0; index -= 1) {
                if (coveredId.equals(nodeText(messages.get(index), "id", ""))) return index;
            }
        }
        String coveredAt = nodeText(summary, "coveredThroughCreatedAt", "");
        if (StringUtils.hasText(coveredAt)) {
            int matched = -1;
            for (int index = 0; index < messages.size(); index += 1) {
                String createdAt = nodeText(messages.get(index), "createdAt", "");
                if (StringUtils.hasText(createdAt) && createdAt.compareTo(coveredAt) <= 0) {
                    matched = index;
                }
            }
            return matched;
        }
        return -1;
    }

    private int messageTextLength(JsonNode message) {
        return nodeText(message, "text", "").length();
    }

    private int sourceMessageCount(JsonNode summary) {
        JsonNode value = summary == null ? null : summary.get("sourceMessageCount");
        return value != null && value.canConvertToInt() ? value.asInt() : 0;
    }

    // ---------------------------------------------------------------------------------------------
    // Summary-local helpers (trivial, not part of the shared model-gateway concern).
    // ---------------------------------------------------------------------------------------------

    private void putCurrentTime(Map<String, Object> context) {
        LocalDateTime now = LocalDateTime.now(clock);
        context.put("today", now.toLocalDate().toString());
        context.put("currentDateTime", now.truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("currentTime", now.toLocalTime().truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("timeZone", clock.getZone().getId());
    }

    private String nodeText(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private String rootCauseMessage(Throwable throwable) {
        Throwable cursor = throwable;
        while (cursor != null && cursor.getCause() != null) {
            cursor = cursor.getCause();
        }
        String message = cursor == null ? "" : cursor.getMessage();
        return StringUtils.hasText(message) ? abbreviate(message, 500) : cursor == null ? "unknown" : cursor.getClass().getSimpleName();
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.length() <= maxLength) return trimmed;
        return trimmed.substring(0, Math.max(0, maxLength - 1)) + "…";
    }
}
