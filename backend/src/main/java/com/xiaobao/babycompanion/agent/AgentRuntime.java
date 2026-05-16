package com.xiaobao.babycompanion.agent;

import java.net.http.HttpClient;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentBabyProfile;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import com.xiaobao.babycompanion.dto.agent.ConversationSummaryResponse;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekFunctionCall;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekResponseFormat;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekToolCall;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekUsage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class AgentRuntime {

    private static final Logger LOGGER = LoggerFactory.getLogger(AgentRuntime.class);
    private static final int MAX_AGENT_VISUAL_ATTACHMENTS = 8;

    private static final int SUMMARY_MIN_NEW_MESSAGES = 24;
    private static final int SUMMARY_MIN_NEW_CHARS = 12_000;
    private static final int SUMMARY_RECENT_MESSAGE_KEEP = 12;

    private final DeepSeekProperties properties;
    private final DoubaoProperties doubaoProperties;
    private final ObjectMapper objectMapper;
    private final AgentPlanner agentPlanner;
    private final AgentContextService agentContextService;
    private final AppStateService appStateService;
    private final AiUsageLogService aiUsageLogService;
    private final RecordSignalExtractor recordSignalExtractor;
    private final EffectPolicy effectPolicy;
    private final CurrentUser currentUser;
    private final SkillRegistry skillRegistry;
    private final SkillDisclosureService skillDisclosureService;
    private final ToolRegistry toolRegistry;
    private final SafetyGuard safetyGuard;
    private final Executor agentStreamExecutor;
    private final Clock clock;
    private final HttpClient httpClient;
    private final RestClient restClient;
    private final RestClient doubaoRestClient;

    public AgentRuntime(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            ObjectMapper objectMapper,
            AgentPlanner agentPlanner,
            AgentContextService agentContextService,
            AppStateService appStateService,
            RecordSignalExtractor recordSignalExtractor,
            EffectPolicy effectPolicy,
            CurrentUser currentUser,
            SkillRegistry skillRegistry,
            SkillDisclosureService skillDisclosureService,
            ToolRegistry toolRegistry,
            SafetyGuard safetyGuard
    ) {
        this(
                properties,
                doubaoProperties,
                objectMapper,
                agentPlanner,
                agentContextService,
                appStateService,
                recordSignalExtractor,
                effectPolicy,
                currentUser,
                skillRegistry,
                skillDisclosureService,
                toolRegistry,
                safetyGuard,
                null,
                Runnable::run,
                Clock.system(ZoneId.of("Asia/Shanghai"))
        );
    }

    @Autowired
    public AgentRuntime(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            ObjectMapper objectMapper,
            AgentPlanner agentPlanner,
            AgentContextService agentContextService,
            AppStateService appStateService,
            RecordSignalExtractor recordSignalExtractor,
            EffectPolicy effectPolicy,
            CurrentUser currentUser,
            SkillRegistry skillRegistry,
            SkillDisclosureService skillDisclosureService,
            ToolRegistry toolRegistry,
            SafetyGuard safetyGuard,
            AiUsageLogService aiUsageLogService,
            @Qualifier("agentStreamExecutor") Executor agentStreamExecutor,
            Clock clock
    ) {
        this.properties = properties;
        this.doubaoProperties = doubaoProperties;
        this.objectMapper = objectMapper;
        this.agentPlanner = agentPlanner;
        this.agentContextService = agentContextService;
        this.appStateService = appStateService;
        this.aiUsageLogService = aiUsageLogService;
        this.recordSignalExtractor = recordSignalExtractor;
        this.effectPolicy = effectPolicy;
        this.currentUser = currentUser;
        this.skillRegistry = skillRegistry;
        this.skillDisclosureService = skillDisclosureService;
        this.toolRegistry = toolRegistry;
        this.safetyGuard = safetyGuard;
        this.agentStreamExecutor = agentStreamExecutor;
        this.clock = clock;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.getConnectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(this.httpClient);
        requestFactory.setReadTimeout(properties.getReadTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        JdkClientHttpRequestFactory doubaoRequestFactory = new JdkClientHttpRequestFactory(this.httpClient);
        doubaoRequestFactory.setReadTimeout(doubaoProperties.getReadTimeout());
        this.doubaoRestClient = RestClient.builder()
                .baseUrl(doubaoProperties.getBaseUrl())
                .requestFactory(doubaoRequestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public AgentChatResponse chat(AgentChatRequest request) {
        RuntimeModel runtimeModel = resolveModel(request.model(), Boolean.TRUE.equals(request.lowLatencyEnabled()));
        RuntimeModel plannerRuntimeModel = resolvePlannerModel();
        String apiKey = resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }
        String plannerApiKey = resolvedApiKey(plannerRuntimeModel);
        if (!StringUtils.hasText(plannerApiKey)) {
            throw new IllegalStateException(plannerRuntimeModel.apiKeyHelp() + " is not configured for agent planning");
        }

        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String traceId = "agent-" + UUID.randomUUID();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        RecordSignals signals = recordSignalExtractor.extract(request.message());
        AgentChatResponse immediate = immediateBoundaryResponse(signals, traceId, runtimeModel, selectedSkills);
        if (immediate != null) return immediate;
        AgentPlan plan = runPlanner(request, selectedSkills, signals, plannerRuntimeModel, plannerApiKey, familyId, principal.userId());
        AgentContextSnapshot contextSnapshot = agentContextService.build(familyId, principal.userId(), request, plan, signals);
        AgentChatResponse profileBoundary = immediateBoundaryResponse(
                signals,
                traceId,
                runtimeModel,
                selectedSkills,
                contextSnapshot.babyProfile(),
                request.message()
        );
        if (profileBoundary != null) return profileBoundary;
        List<AgentToolResult> toolResults = executePlannedTools(plan, request, null);
        List<String> usedSkills = usedSkillIds(selectedSkills, toolResults, plan, signals, request.message());

        DeepSeekChatRequest chatRequest = buildDeepSeekRequest(request, selectedSkills, toolResults, runtimeModel, traceId, false, plan, contextSnapshot, signals, principal);

        try {
            DeepSeekChatResponse response = restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(chatRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException(runtimeModel.id() + " returned an empty response");
            }
            recordUsage(runtimeModel, "agent_chat", inputType(request), familyId, principal.userId(), response.id(), response.usage(), true, null, false, true);

            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException(runtimeModel.id() + " response did not include message content"));

            return withSafetyAlertsAndDecisions(
                    parseModelContent(content, traceId, response.model(), response.id(), usedSkills, collectSources(toolResults)),
                    request.message(),
                    signals,
                    plan,
                    contextSnapshot.babyProfile()
            );
        } catch (RestClientException exception) {
            recordUsage(runtimeModel, "agent_chat", inputType(request), familyId, principal.userId(), traceId, null, false, rootCauseMessage(exception), false, true);
            throw new DeepSeekApiException("Failed to call " + runtimeModel.id() + " API", exception);
        }
    }

    public SseEmitter stream(AgentChatRequest request) {
        RuntimeModel runtimeModel = resolveModel(request.model(), Boolean.TRUE.equals(request.lowLatencyEnabled()));
        RuntimeModel plannerRuntimeModel = resolvePlannerModel();
        String apiKey = resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }
        String plannerApiKey = resolvedApiKey(plannerRuntimeModel);
        if (!StringUtils.hasText(plannerApiKey)) {
            throw new IllegalStateException(plannerRuntimeModel.apiKeyHelp() + " is not configured for agent planning");
        }

        String traceId = "agent-" + UUID.randomUUID();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        SseEmitter emitter = new SseEmitter(runtimeModel.readTimeout().plusSeconds(45).toMillis());

        String requestId = MDC.get("requestId");
        AtomicBoolean cancelled = new AtomicBoolean(false);
        AtomicReference<CompletableFuture<Void>> streamTask = new AtomicReference<>();
        Runnable cancelStreamTask = () -> {
            cancelled.set(true);
            CompletableFuture<Void> task = streamTask.get();
            if (task != null) {
                task.cancel(true);
            }
        };
        emitter.onCompletion(() -> cancelled.set(true));
        emitter.onTimeout(cancelStreamTask);
        emitter.onError((error) -> cancelStreamTask.run());
        try {
            CompletableFuture<Void> task = CompletableFuture.runAsync(() -> {
                if (cancelled.get()) return;
                if (StringUtils.hasText(requestId)) MDC.put("requestId", requestId);
                try {
                    streamAgentResponse(
                            request,
                            emitter,
                            traceId,
                            familyId,
                            principal,
                            selectedSkills,
                            runtimeModel,
                            apiKey,
                            plannerRuntimeModel,
                            plannerApiKey
                    );
                } finally {
                    if (StringUtils.hasText(requestId)) MDC.remove("requestId");
                }
            }, agentStreamExecutor);
            streamTask.set(task);
        } catch (RejectedExecutionException exception) {
            LOGGER.warn("Agent stream executor is saturated; rejecting traceId={}", traceId);
            emitter.completeWithError(new IllegalStateException("AI 服务繁忙，请稍后再试。", exception));
        }
        return emitter;
    }

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

        RuntimeModel summaryModel = resolvePlannerModel();
        String apiKey = resolvedApiKey(summaryModel);
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
                    responseFormat(runtimeModel),
                    Map.of("type", "disabled"),
                    null,
                    null,
                    null
            );
            DeepSeekChatResponse response = restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(request)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response != null) {
                recordUsage(runtimeModel, "conversation_summary", "text", familyId, userId, response.id(), response.usage(), true, null, false, true);
            }
            String content = Optional.ofNullable(response)
                    .map(DeepSeekChatResponse::choices)
                    .filter((choices) -> !choices.isEmpty())
                    .map((choices) -> choices.get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .orElseThrow(() -> new DeepSeekApiException("Summary model returned an empty response"));
            String text = objectMapper.readTree(extractJsonObject(content)).path("text").asText("");
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
            recordUsage(runtimeModel, "conversation_summary", "text", familyId, userId, "conversation-summary-" + UUID.randomUUID(), null, false, rootCauseMessage(exception), false, true);
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

    private void streamAgentResponse(
            AgentChatRequest request,
            SseEmitter emitter,
            String traceId,
            String familyId,
            AuthPrincipal principal,
            List<Skill> selectedSkills,
            RuntimeModel runtimeModel,
            String apiKey,
            RuntimeModel plannerRuntimeModel,
            String plannerApiKey
    ) {
        try {
            RecordSignals signals = recordSignalExtractor.extract(request.message());
            AgentChatResponse immediate = immediateBoundaryResponse(signals, traceId, runtimeModel, selectedSkills);
            if (immediate != null) {
                sendEvent(emitter, "final", immediate);
                emitter.complete();
                return;
            }
            sendEvent(emitter, "planning", Map.of("message", "理解记录中"));
            AgentPlan plan = runPlanner(request, selectedSkills, signals, plannerRuntimeModel, plannerApiKey, familyId, principal.userId());
            sendEvent(emitter, "retrieving_context", Map.of("message", "查找相关记录"));
            AgentContextSnapshot contextSnapshot = agentContextService.build(familyId, principal.userId(), request, plan, signals);
            AgentChatResponse profileBoundary = immediateBoundaryResponse(
                    signals,
                    traceId,
                    runtimeModel,
                    selectedSkills,
                    contextSnapshot.babyProfile(),
                    request.message()
            );
            if (profileBoundary != null) {
                sendEvent(emitter, "final", profileBoundary);
                emitter.complete();
                return;
            }
            List<AgentToolResult> toolResults = executePlannedTools(plan, request, (event) -> sendEvent(emitter, "tool", event));
            List<String> usedSkills = usedSkillIds(selectedSkills, toolResults, plan, signals, request.message());
            List<AgentSource> sources = collectSources(toolResults);
            List<VisualAttachmentInput> visualInputs = visualAttachmentInputs(request.attachments(), runtimeModel);
            sendModelWorkStatus(emitter, visualInputs);

            String body = objectMapper.writeValueAsString(buildDeepSeekRequest(request, selectedSkills, toolResults, runtimeModel, traceId, true, plan, contextSnapshot, signals, principal));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl(runtimeModel)))
                    .timeout(runtimeModel.readTimeout().plusSeconds(30))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            streamDeepSeekResponse(httpRequest, emitter, traceId, runtimeModel, usedSkills, sources, request.message(), signals, plan, contextSnapshot.babyProfile(), familyId, principal.userId(), inputType(request));
        } catch (Exception exception) {
            LOGGER.warn(
                    "Agent stream failed before model stream. traceId={}, provider={}, model={}, cause={}",
                    traceId,
                    runtimeModel.provider(),
                    runtimeModel.id(),
                    rootCauseMessage(exception),
                    exception
            );
            sendEvent(emitter, "error", Map.of("message", userFacingModelErrorMessage(exception, inputType(request))));
            emitter.complete();
        }
    }

    AgentChatResponse parseModelContent(
            String content,
            String traceId,
            String model,
            String requestId,
            List<String> usedSkills,
            List<AgentSource> sources
    ) {
        try {
            AgentChatResponse parsed = objectMapper.readValue(extractJsonObject(content), AgentChatResponse.class);
            if (!StringUtils.hasText(parsed.aiText())) {
                throw new AgentResponseParseException("Agent response did not include aiText");
            }
            return new AgentChatResponse(
                    parsed.aiText(),
                    listOrEmpty(parsed.tags()),
                    parsed.growthEvent(),
                    parsed.careLogPatch(),
                    listOrEmpty(parsed.reminders()),
                    listOrEmpty(parsed.memories()),
                    listOrEmpty(parsed.expenses()),
                    sources.isEmpty() ? listOrEmpty(parsed.sources()) : sources,
                    listOrEmpty(parsed.safetyAlerts()),
                    listOrEmpty(parsed.effectDecisions()),
                    listOrEmpty(usedSkills),
                    traceId,
                    model,
                    requestId
            );
        } catch (JsonProcessingException exception) {
            throw new AgentResponseParseException("Agent response was not valid JSON", exception);
        }
    }

    private DeepSeekChatRequest buildDeepSeekRequest(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            RuntimeModel runtimeModel,
            String traceId,
            boolean stream,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal
    ) {
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", AgentPrompts.AGENT_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildUserContent(request, selectedSkills, toolResults, runtimeModel, traceId, plan, contextSnapshot, signals, principal), null, null)
                ),
                stream,
                properties.getAgentMaxTokens(),
                Math.min(properties.getTemperature(), 0.2),
                responseFormat(runtimeModel),
                thinkingConfig(request),
                null,
                null,
                serviceTier(runtimeModel)
        );
    }

    private AgentPlan runPlanner(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            RecordSignals signals,
            RuntimeModel plannerRuntimeModel,
            String apiKey,
            String familyId,
            String userId
    ) {
        DeepSeekChatRequest plannerRequest = agentPlanner.buildRequest(
                plannerRuntimeModel.apiModel(),
                request,
                selectedSkills,
                signals,
                plannerRuntimeModel.provider() == Provider.DEEPSEEK
        );
        try {
            DeepSeekChatResponse response = restClient(plannerRuntimeModel).post()
                    .uri(plannerRuntimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(plannerRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response != null) {
                recordUsage(plannerRuntimeModel, "agent_planner", inputType(request), familyId, userId, response.id(), response.usage(), true, null, false, true);
            }

            String content = Optional.ofNullable(response)
                    .map(DeepSeekChatResponse::choices)
                    .filter((choices) -> !choices.isEmpty())
                    .map((choices) -> choices.get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .orElse("");
            return agentPlanner.parse(content, request, signals);
        } catch (RestClientException exception) {
            LOGGER.warn(
                    "Agent planner model call failed. provider={}, model={}, apiModel={}, path={}, cause={}",
                    plannerRuntimeModel.provider(),
                    plannerRuntimeModel.id(),
                    plannerRuntimeModel.apiModel(),
                    plannerRuntimeModel.chatPath(),
                    rootCauseMessage(exception),
                    exception
            );
            recordUsage(plannerRuntimeModel, "agent_planner", inputType(request), familyId, userId, "planner-" + UUID.randomUUID(), null, false, rootCauseMessage(exception), false, true);
            throw new DeepSeekApiException("Failed to call model API for agent planning", exception);
        }
    }

    private List<AgentToolResult> executePlannedTools(AgentPlan plan, AgentChatRequest request, ToolEventSink eventSink) {
        if (plan.toolRequests() == null || plan.toolRequests().isEmpty()) return List.of();
        return plan.toolRequests().stream()
                .limit(3)
                .map((toolRequest) -> executePlannedTool(toolRequest, request, eventSink))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<AgentToolResult> executePlannedTool(
            AgentToolRequest toolRequest,
            AgentChatRequest request,
            ToolEventSink eventSink
    ) {
        if (toolRequest == null || !StringUtils.hasText(toolRequest.toolId())) return Optional.empty();
        return toolRegistry.find(toolRequest.toolId())
                .map((tool) -> {
                    String callId = "tool-" + UUID.randomUUID();
                    sendToolEvent(eventSink, callId, tool, "running", tool.runningMessage(), toolRequest.query());
                    try {
                        String arguments = objectMapper.writeValueAsString(Map.of(
                                "query", StringUtils.hasText(toolRequest.query()) ? toolRequest.query() : request.message(),
                                "purpose", StringUtils.hasText(toolRequest.reason()) ? toolRequest.reason() : "agent planner requested this tool"
                        ));
                        AgentToolResult result = tool.execute(new AgentToolCall(callId, tool.id(), arguments), request);
                        sendToolEvent(eventSink, callId, tool, "completed", tool.displayName() + "完成", result.query());
                        return result;
                    } catch (Exception exception) {
                        sendToolEvent(eventSink, callId, tool, "failed", tool.displayName() + "失败", toolRequest.query());
                        return new AgentToolResult(
                                callId,
                                tool.id(),
                                tool.displayName(),
                                StringUtils.hasText(toolRequest.query()) ? toolRequest.query() : "",
                                tool.displayName() + "失败：" + exception.getMessage(),
                                List.of()
                        );
                    }
                });
    }

    private List<AgentToolResult> runModelSelectedTools(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            String traceId,
            RuntimeModel runtimeModel,
            String apiKey,
            ToolEventSink eventSink
    ) {
        List<AgentTool> tools = toolRegistry.availableTools();
        if (tools.isEmpty()) return List.of();

        DeepSeekChatRequest toolRoutingRequest = buildToolRoutingRequest(request, selectedSkills, tools, runtimeModel, traceId);
        try {
            DeepSeekChatResponse response = restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(toolRoutingRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            List<DeepSeekToolCall> toolCalls = Optional.ofNullable(response)
                    .map(DeepSeekChatResponse::choices)
                    .filter((choices) -> !choices.isEmpty())
                    .map((choices) -> choices.get(0).message())
                    .map(DeepSeekMessage::toolCalls)
                    .orElse(List.of());

            if (toolCalls.isEmpty()) return List.of();
            return executeToolCalls(toolCalls, request, eventSink);
        } catch (RestClientException exception) {
            throw new DeepSeekApiException("Failed to call DeepSeek API for tool routing", exception);
        }
    }

    private DeepSeekChatRequest buildToolRoutingRequest(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentTool> tools,
            RuntimeModel runtimeModel,
            String traceId
    ) {
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", AgentPrompts.TOOL_ROUTER_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildToolRouterPrompt(request, selectedSkills, traceId))
                ),
                false,
                600,
                0.0,
                null,
                Map.of("type", "disabled"),
                tools.stream().map(AgentTool::definition).toList(),
                likelyNeedsExternalLookup(request.message()) ? "required" : "auto",
                serviceTier(runtimeModel)
        );
    }

    private List<AgentToolResult> executeToolCalls(
            List<DeepSeekToolCall> toolCalls,
            AgentChatRequest request,
            ToolEventSink eventSink
    ) {
        return toolCalls.stream()
                .limit(3)
                .map((toolCall) -> executeToolCall(toolCall, request, eventSink))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<AgentToolResult> executeToolCall(
            DeepSeekToolCall toolCall,
            AgentChatRequest request,
            ToolEventSink eventSink
    ) {
        DeepSeekFunctionCall function = toolCall.function();
        if (function == null || !StringUtils.hasText(function.name())) return Optional.empty();

        return toolRegistry.find(function.name())
                .map((tool) -> {
                    String callId = StringUtils.hasText(toolCall.id()) ? toolCall.id() : "tool-" + UUID.randomUUID();
                    sendToolEvent(eventSink, callId, tool, "running", tool.runningMessage(), null);
                    AgentToolCall call = new AgentToolCall(callId, tool.id(), function.arguments());

                    try {
                        AgentToolResult result = tool.execute(call, request);
                        sendToolEvent(eventSink, callId, tool, "completed", tool.displayName() + "完成", result.query());
                        return result;
                    } catch (Exception exception) {
                        sendToolEvent(eventSink, callId, tool, "failed", tool.displayName() + "失败", null);
                        return new AgentToolResult(
                                callId,
                                tool.id(),
                                tool.displayName(),
                                "",
                                tool.displayName() + "失败：" + exception.getMessage(),
                                List.of()
                        );
                    }
                });
    }

    private void sendToolEvent(
            ToolEventSink eventSink,
            String callId,
            AgentTool tool,
            String status,
            String message,
            String query
    ) {
        if (eventSink == null) return;

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", callId);
        event.put("toolId", tool.id());
        event.put("name", tool.displayName());
        event.put("status", status);
        event.put("message", message);
        if (StringUtils.hasText(query)) event.put("query", query);
        eventSink.send(event);
    }

    private boolean likelyNeedsExternalLookup(String message) {
        if (!StringUtils.hasText(message)) return false;
        if (looksLikeExpenseExtraction(message)) return false;
        return message.matches(".*(查|查询|搜|搜索|联网|最新|政策|规定|官方|通知|价格|多少钱|天气|哪里|地址|电话|办理|流程).*")
                || message.matches(".*(现在|当前|今天).*(天气|政策|规定|价格|新闻|通知).*");
    }

    private boolean looksLikeExpenseExtraction(String message) {
        if (!StringUtils.hasText(message)) return false;
        return message.matches(".*(识别|看一下|帮我|整理|记录|记账).*(花费|支出|账本|订单|小票|收据|发票|支付|付款).*")
                || message.matches(".*(订单|小票|收据|发票|支付截图|付款截图).*(记账|账本|花费|支出|金额).*");
    }

    private Map<String, String> thinkingConfig(AgentChatRequest request) {
        return Map.of("type", Boolean.TRUE.equals(request.thinkingEnabled()) ? "enabled" : "disabled");
    }

    private DeepSeekResponseFormat responseFormat(RuntimeModel runtimeModel) {
        return runtimeModel.provider() == Provider.DEEPSEEK ? new DeepSeekResponseFormat("json_object") : null;
    }

    private void streamDeepSeekResponse(
            HttpRequest request,
            SseEmitter emitter,
            String traceId,
            RuntimeModel runtimeModel,
            List<String> usedSkills,
            List<AgentSource> sources,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile,
            String familyId,
            String userId,
            String inputType
    ) {
        StringBuilder content = new StringBuilder();
        AtomicReference<String> model = new AtomicReference<>(runtimeModel.apiModel());
        AtomicReference<String> requestId = new AtomicReference<>("");

        try {
            HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            try (Stream<String> lines = response.body()) {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    String errorBody = String.join("\n", lines.toList());
                    LOGGER.warn(
                            "Agent model stream returned non-2xx. traceId={}, provider={}, model={}, status={}, body={}",
                            traceId,
                            runtimeModel.provider(),
                            runtimeModel.id(),
                            response.statusCode(),
                            abbreviate(errorBody, 1200)
                    );
                    recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, traceId, null, false, "HTTP_" + response.statusCode(), false, true);
                    sendEvent(emitter, "error", Map.of("message", runtimeModel.id() + " stream failed: " + errorBody));
                    emitter.complete();
                    return;
                }

                lines.forEach((line) -> handleStreamLine(line, emitter, content, model, requestId));
            }

            AgentChatResponse parsed = parseModelContent(
                    content.toString(),
                    traceId,
                    model.get(),
                    requestId.get(),
                    usedSkills,
                    sources
            );
            recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, requestId.get(), null, true, null, false, true);
            sendEvent(emitter, "final", withSafetyAlertsAndDecisions(parsed, userMessage, signals, plan, babyProfile));
            emitter.complete();
        } catch (Exception exception) {
            LOGGER.warn(
                    "Agent model stream failed. traceId={}, provider={}, model={}, cause={}",
                    traceId,
                    runtimeModel.provider(),
                    runtimeModel.id(),
                    rootCauseMessage(exception),
                    exception
            );
            recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, traceId, null, false, rootCauseMessage(exception), false, true);
            sendEvent(emitter, "error", Map.of("message", userFacingModelErrorMessage(exception, inputType)));
            emitter.complete();
        }
    }

    AgentChatResponse withSafetyAlertsAndDecisions(
            AgentChatResponse response,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile
    ) {
        var alerts = safetyGuard.assess(userMessage, response.aiText());
        AgentChatResponse withSafety = new AgentChatResponse(
                response.aiText(),
                response.tags(),
                response.growthEvent(),
                response.careLogPatch(),
                response.reminders(),
                response.memories(),
                response.expenses(),
                response.sources(),
                alerts.isEmpty() ? response.safetyAlerts() : alerts,
                response.effectDecisions(),
                response.usedSkills(),
                response.traceId(),
                response.model(),
                response.requestId()
        );
        List<AgentEffectDecision> mediaDecisions = mediaDecisions(plan);
        boolean albumSaveOnly = isAlbumSaveOnly(plan, userMessage);
        List<AgentEffectDecision> decisions = albumSaveOnly
                ? new ArrayList<>()
                : new ArrayList<>(effectPolicy.decide(withSafety, signals, babyProfile, userMessage));
        decisions.addAll(mediaDecisions);
        String aiText = albumSaveOnly && !mediaDecisions.isEmpty()
                ? albumSaveAiText(plan)
                : adjustedAiText(withSafety.aiText(), signals, decisions);
        return new AgentChatResponse(
                aiText,
                withSafety.tags(),
                albumSaveOnly ? null : withSafety.growthEvent(),
                albumSaveOnly ? null : withSafety.careLogPatch(),
                albumSaveOnly ? List.of() : withSafety.reminders(),
                albumSaveOnly ? List.of() : withSafety.memories(),
                albumSaveOnly ? List.of() : withSafety.expenses(),
                withSafety.sources(),
                withSafety.safetyAlerts(),
                decisions,
                withSafety.usedSkills(),
                withSafety.traceId(),
                withSafety.model(),
                withSafety.requestId()
        );
    }

    private boolean isAlbumSaveOnly(AgentPlan plan, String userMessage) {
        AgentMediaAction action = plan == null ? null : plan.mediaAction();
        if (action == null || !"save_to_album".equals(action.intent())) return false;
        String message = userMessage == null ? "" : userMessage.trim();
        boolean saveIntent = message.matches(".*(保存到相册|存到相册|加入相册|放进相册|收藏|留念|记录到相册).*");
        boolean mediaReference = message.matches(".*(刚才|这个|这张|这段|上个|上一条|视频|照片|图片|素材|相册).*");
        boolean explicitOtherRecord = message.matches(".*(喝了|喝奶|奶量|睡了|睡眠|拉屎|便便|体温|提醒我|闹钟|疫苗|体检|第一次|里程碑).*")
                && !message.matches(".*(视频|照片|图片).*");
        return saveIntent && mediaReference && !explicitOtherRecord;
    }

    private String albumSaveAiText(AgentPlan plan) {
        AgentMediaAction action = plan == null ? null : plan.mediaAction();
        String label = "素材";
        if (action != null && "video".equals(action.targetKind())) {
            label = "视频";
        } else if (action != null && "image".equals(action.targetKind())) {
            label = "照片";
        }
        return "已把刚才的%s整理到相册里。".formatted(label);
    }

    private List<AgentEffectDecision> mediaDecisions(AgentPlan plan) {
        AgentMediaAction action = plan == null ? null : plan.mediaAction();
        if (action == null || !"save_to_album".equals(action.intent())) return List.of();
        if (action.confidence() != null && action.confidence() < 0.55) return List.of();

        ObjectNode payload = objectMapper.createObjectNode();
        putIfText(payload, "intent", action.intent());
        putIfText(payload, "targetScope", action.targetScope());
        putIfText(payload, "targetKind", action.targetKind());
        putIfText(payload, "refHint", action.refHint());
        putIfText(payload, "category", action.category());
        putIfText(payload, "reason", action.reason());
        payload.putArray("tags").add(albumCategoryLabel(action.category()));

        return List.of(new AgentEffectDecision(
                "decision-" + UUID.randomUUID(),
                "auto",
                "albumItem",
                payload,
                action.confidence() == null ? 0.72 : action.confidence(),
                StringUtils.hasText(action.reason()) ? action.reason() : "用户表达了保存媒体到相册的意图",
                "model"
        ));
    }

    private void putIfText(ObjectNode payload, String field, String value) {
        if (StringUtils.hasText(value)) payload.put(field, value);
    }

    private String albumCategoryLabel(String category) {
        return switch (category == null ? "" : category) {
            case "growth" -> "成长";
            case "feeding" -> "喂养";
            case "sleep" -> "睡眠";
            case "health" -> "健康";
            case "reminder" -> "提醒";
            default -> "日常";
        };
    }

    private AgentChatResponse immediateBoundaryResponse(
            RecordSignals signals,
            String traceId,
            RuntimeModel runtimeModel,
            List<Skill> selectedSkills
    ) {
        return immediateBoundaryResponse(signals, traceId, runtimeModel, selectedSkills, null, "");
    }

    private AgentChatResponse immediateBoundaryResponse(
            RecordSignals signals,
            String traceId,
            RuntimeModel runtimeModel,
            List<Skill> selectedSkills,
            JsonNode babyProfile,
            String userMessage
    ) {
        AgentChatResponse empty = new AgentChatResponse(
                "",
                List.of(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                usedSkillIds(selectedSkills, List.of()),
                traceId,
                runtimeModel.apiModel(),
                ""
        );
        List<AgentEffectDecision> decisions = effectPolicy.decide(empty, signals, babyProfile, userMessage);
        if (!shouldUseImmediateBoundaryResponse(signals, decisions)) return null;
        String aiText = adjustedAiText("", signals, decisions);
        return new AgentChatResponse(
                StringUtils.hasText(aiText) ? aiText : "这条记录还缺一点信息，补充后我再帮你整理。",
                signals.unsupportedMutationRequest() ? List.of("能力边界") : List.of("需要补充"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                decisions,
                usedSkillIds(selectedSkills, List.of()),
                traceId,
                runtimeModel.apiModel(),
                ""
        );
    }

    private boolean shouldUseImmediateBoundaryResponse(RecordSignals signals, List<AgentEffectDecision> decisions) {
        if (signals.unsupportedMutationRequest()) return true;
        boolean hasAsk = decisions.stream().anyMatch((decision) -> "ask".equals(decision.mode()));
        if (!hasAsk) return false;
        return signals.topics().stream().allMatch((topic) -> List.of("feeding", "sleep").contains(topic));
    }

    private String adjustedAiText(String aiText, RecordSignals signals, List<AgentEffectDecision> decisions) {
        if (signals.unsupportedMutationRequest()) {
            return AgentCapabilityContract.unsupportedMutationMessage();
        }
        String askQuestion = decisions.stream()
                .filter((decision) -> "ask".equals(decision.mode()))
                .map(AgentEffectDecision::payload)
                .map((payload) -> payload == null ? "" : payload.path("question").asText(""))
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");
        if (StringUtils.hasText(askQuestion)) return askQuestion;

        boolean hasPendingExpense = decisions.stream().anyMatch((decision) ->
                "expenseItem".equals(decision.type()) && "pending".equals(decision.mode())
        );
        if (hasPendingExpense && looksLikeAmountClarification(aiText)) {
            return "我已识别出这笔支出，并整理成待确认的账本草稿。请确认后我再记到账本里。";
        }
        return aiText;
    }

    private boolean looksLikeAmountClarification(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(实际花了多少钱|实际支付金额|确认金额|告诉我.*金额|补充.*金额).*");
    }

    private void handleStreamLine(
            String line,
            SseEmitter emitter,
            StringBuilder content,
            AtomicReference<String> model,
            AtomicReference<String> requestId
    ) {
        if (!StringUtils.hasText(line) || !line.startsWith("data:")) return;

        String payload = line.substring("data:".length()).trim();
        if ("[DONE]".equals(payload)) return;

        try {
            JsonNode root = objectMapper.readTree(payload);
            updateIfText(root.path("id"), requestId);
            updateIfText(root.path("model"), model);

            JsonNode delta = root.path("choices").path(0).path("delta");
            String reasoningDelta = textOrEmpty(delta.path("reasoning_content"));
            String contentDelta = textOrEmpty(delta.path("content"));

            if (!reasoningDelta.isEmpty()) {
                sendEvent(emitter, "reasoning", Map.of("delta", reasoningDelta));
            }
            if (!contentDelta.isEmpty()) {
                content.append(contentDelta);
                sendEvent(emitter, "content", Map.of("delta", contentDelta));
            }
        } catch (JsonProcessingException exception) {
                sendEvent(emitter, "error", Map.of("message", "Failed to parse model stream chunk"));
        }
    }

    private void updateIfText(JsonNode node, AtomicReference<String> target) {
        if (node != null && node.isTextual() && StringUtils.hasText(node.asText())) {
            target.set(node.asText());
        }
    }

    private String textOrEmpty(JsonNode node) {
        return node != null && node.isTextual() ? node.asText() : "";
    }

    private String nodeText(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private void sendEvent(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (Exception exception) {
            emitter.completeWithError(exception);
        }
    }

    private void sendModelWorkStatus(SseEmitter emitter, List<VisualAttachmentInput> visualInputs) {
        if (visualInputs == null || visualInputs.isEmpty()) {
            Map<String, String> event = Map.of("message", "正在生成回复");
            sendEvent(emitter, "retrieving_context", event);
            sendEvent(emitter, "generating", event);
            return;
        }
        Map<String, String> event = Map.of("message", analyzingMediaMessage(visualInputs));
        sendEvent(emitter, "retrieving_context", event);
        sendEvent(emitter, "analyzing_media", event);
    }

    private String analyzingMediaMessage(List<VisualAttachmentInput> visualInputs) {
        if (visualInputs == null || visualInputs.isEmpty()) return "正在分析素材";
        long imageCount = visualInputs.stream()
                .filter((input) -> "image".equals(input.kind()))
                .count();
        long videoCount = visualInputs.stream()
                .filter((input) -> "video".equals(input.kind()) && input.dataUrl().startsWith("data:video/"))
                .count();
        long videoThumbnailCount = visualInputs.stream()
                .filter((input) -> "video".equals(input.kind()) && input.dataUrl().startsWith("data:image/"))
                .count();

        List<String> parts = new ArrayList<>();
        if (imageCount > 0) parts.add(imageCount + " 张图片");
        if (videoCount > 0) parts.add(videoCount + " 段视频");
        if (videoThumbnailCount > 0) parts.add(videoThumbnailCount + " 个视频封面");
        if (parts.isEmpty()) return "正在分析素材";
        return "正在分析 " + String.join("和", parts);
    }

    String userFacingModelErrorMessage(Exception exception, String inputType) {
        String message = rootCauseMessage(exception);
        boolean timedOut = message != null && message.matches("(?is).*(timeout|timed out|超时).*");
        if (timedOut && ("image".equals(inputType) || "video".equals(inputType))) {
            return "图片分析超时了：这次素材较多，模型没有及时返回。请稍后重试；如果仍失败，可以先分批发送图片。";
        }
        if (timedOut) {
            return "AI 响应超时了：模型没有及时返回，请稍后重试。";
        }
        return StringUtils.hasText(message) ? message : "AI 服务暂时不可用，请稍后再试。";
    }

    private RuntimeModel resolveModel(String requestedModel) {
        return resolveModel(requestedModel, false);
    }

    private RuntimeModel resolveModel(String requestedModel, boolean lowLatencyEnabled) {
        String model = StringUtils.hasText(requestedModel) ? requestedModel.trim() : properties.getModel();
        return switch (model) {
            case "deepseek-v4-flash" -> new RuntimeModel(
                    "deepseek-v4-flash",
                    Provider.DEEPSEEK,
                    "deepseek-v4-flash",
                    false,
                    false,
                    false,
                    properties.getBaseUrl(),
                    properties.getChatPath(),
                    properties.getReadTimeout(),
                    "DEEPSEEK_API_KEY"
            );
            case "deepseek-v4-pro" -> new RuntimeModel(
                    "deepseek-v4-pro",
                    Provider.DEEPSEEK,
                    "deepseek-v4-pro",
                    false,
                    false,
                    false,
                    properties.getBaseUrl(),
                    properties.getChatPath(),
                    properties.getReadTimeout(),
                    "DEEPSEEK_API_KEY"
            );
            case "doubao-seed-2.0-lite", "doubao-seed-2-0-lite-260215" -> doubaoRuntimeModel(
                    "doubao-seed-2.0-lite",
                    doubaoProperties.getSeed20LiteModel(),
                    lowLatencyEnabled
            );
            case "doubao-seed-2.0-pro", "doubao-seed-2-0-pro-260215" -> doubaoRuntimeModel(
                    "doubao-seed-2.0-pro",
                    doubaoProperties.getSeed20ProModel(),
                    lowLatencyEnabled
            );
            default -> throw new IllegalArgumentException("Unsupported agent model: " + model);
        };
    }

    private RuntimeModel doubaoRuntimeModel(
            String modelId,
            String standardModel,
            boolean lowLatencyEnabled
    ) {
        return new RuntimeModel(
                modelId,
                Provider.DOUBAO,
                standardModel,
                true,
                true,
                lowLatencyEnabled,
                doubaoProperties.getBaseUrl(),
                doubaoProperties.getChatPath(),
                doubaoProperties.getReadTimeout(),
                "DOUBAO_API_KEY or ARK_API_KEY"
        );
    }

    private RuntimeModel resolvePlannerModel() {
        return resolveModel(properties.getPlannerModel());
    }

    private String resolvedApiKey(RuntimeModel runtimeModel) {
        return switch (runtimeModel.provider()) {
            case DEEPSEEK -> properties.getResolvedApiKey();
            case DOUBAO -> doubaoProperties.getResolvedApiKey();
        };
    }

    private RestClient restClient(RuntimeModel runtimeModel) {
        return switch (runtimeModel.provider()) {
            case DEEPSEEK -> restClient;
            case DOUBAO -> doubaoRestClient;
        };
    }

    private String endpointUrl(RuntimeModel runtimeModel) {
        return runtimeModel.baseUrl().replaceAll("/+$", "") + runtimeModel.chatPath();
    }

    private String serviceTier(RuntimeModel runtimeModel) {
        if (runtimeModel.provider() != Provider.DOUBAO || !runtimeModel.lowLatencyEnabled()) return null;
        return StringUtils.hasText(doubaoProperties.getLowLatencyServiceTier())
                ? doubaoProperties.getLowLatencyServiceTier()
                : "fast";
    }

    private String inputType(AgentChatRequest request) {
        if (request == null || request.attachments() == null || request.attachments().isEmpty()) return "text";
        boolean hasVideo = request.attachments().stream().anyMatch((attachment) -> "video".equals(attachment.kind()));
        if (hasVideo) return "video";
        boolean hasImage = request.attachments().stream().anyMatch((attachment) -> "image".equals(attachment.kind()));
        if (hasImage) return "image";
        boolean hasAudio = request.attachments().stream().anyMatch((attachment) -> "audio".equals(attachment.kind()));
        return hasAudio ? "audio" : "text";
    }

    private void recordUsage(
            RuntimeModel runtimeModel,
            String feature,
            String inputType,
            String familyId,
            String userId,
            String requestId,
            DeepSeekUsage usage,
            boolean success,
            String errorCode,
            boolean proRequired,
            boolean quotaCounted
    ) {
        if (aiUsageLogService == null || runtimeModel == null) return;
        aiUsageLogService.record(new AiUsageLogService.UsageEvent(
                familyId,
                userId,
                requestId,
                runtimeModel.provider().name().toLowerCase(),
                runtimeModel.id(),
                feature,
                inputType,
                usage == null ? null : usage.promptTokens(),
                usage == null ? null : usage.completionTokens(),
                usage == null ? null : usage.totalTokens(),
                success,
                errorCode,
                proRequired,
                quotaCounted
        ));
    }

    private Map<String, Object> requesterContext(AuthPrincipal principal) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (principal == null) return values;
        values.put("roleName", principal.roleName());
        values.put("caregiver", principal.caregiver());
        values.put("familyName", principal.familyName());
        return values;
    }

    private Map<String, Object> baseContext(
            AgentChatRequest request,
            AuthPrincipal principal,
            AgentContextSnapshot contextSnapshot
    ) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("requester", requesterContext(principal));
        values.put("babyProfile", enrichedBabyProfile(request.babyProfile()));
        values.put("storedBabyProfile", contextSnapshot.babyProfile());
        values.put("conversationSummary", contextSnapshot.conversationSummary());
        values.put("recordContext", contextSnapshot.recordContext());
        return values;
    }

    private Map<String, Object> enrichedBabyProfile(AgentBabyProfile profile) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (profile == null) {
            return values;
        }

        values.put("nickname", profile.nickname());
        values.put("stage", profile.stage());
        values.put("expectedDate", profile.expectedDate());
        values.put("birthDate", profile.birthDate());
        values.put("region", profile.region());
        values.put("feeding", profile.feeding());
        values.put("allergies", profile.allergies());
        values.put("caregivers", profile.caregivers());

        Integer ageDays = profile.ageDays();
        Integer ageWeeks = profile.ageWeeks();
        Integer ageMonths = profile.ageMonths();
        String ageLabel = profile.ageLabel();
        Boolean fullMonth = profile.fullMonth();
        Integer daysUntilFullMonth = profile.daysUntilFullMonth();

        if ("born".equals(profile.stage()) && StringUtils.hasText(profile.birthDate())) {
            try {
                LocalDate birthDate = LocalDate.parse(profile.birthDate().trim());
                long days = ChronoUnit.DAYS.between(birthDate, LocalDate.now(clock));
                if (days >= 0 && days <= 3660) {
                    ageDays = Math.toIntExact(days);
                    ageWeeks = ageDays / 7;
                    ageMonths = ageDays / 30;
                    fullMonth = ageDays >= 30;
                    daysUntilFullMonth = Math.max(0, 30 - ageDays);
                    ageLabel = fullMonth
                            ? "出生%s天，约%s个月%s天".formatted(ageDays, ageMonths, ageDays % 30)
                            : "出生%s天，未满月，还差%s天满30天".formatted(ageDays, daysUntilFullMonth);
                }
            } catch (RuntimeException ignored) {
                // Keep client-provided derived fields when birthDate is not parseable.
            }
        } else if ("pregnancy".equals(profile.stage()) && !StringUtils.hasText(ageLabel)) {
            ageLabel = StringUtils.hasText(profile.expectedDate())
                    ? "孕期，预产期 " + profile.expectedDate()
                    : "孕期，预产期待设置";
        }

        values.put("ageDays", ageDays);
        values.put("ageWeeks", ageWeeks);
        values.put("ageMonths", ageMonths);
        values.put("ageLabel", ageLabel);
        values.put("fullMonth", fullMonth);
        values.put("daysUntilFullMonth", daysUntilFullMonth);
        return values;
    }

    private String buildToolRouterPrompt(AgentChatRequest request, List<Skill> selectedSkills, String traceId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        putCurrentTime(context);
        context.put("capabilities", AgentCapabilityContract.promptContext());
        context.put("imageBoundaryPolicy", AgentCapabilityContract.imageBoundaryPolicy());
        context.put("selectedSkills", selectedSkills);
        context.put("babyProfile", enrichedBabyProfile(request.babyProfile()));
        context.put("recentMessages", tail(request.recentMessages(), 6));
        context.put("userMessage", request.message());

        try {
            return """
                    请判断是否需要调用工具。若需要，使用 tools 参数中的函数；若不需要，直接返回一句 no tool 即可。
                    上下文:
                    %s
                    """.formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build tool router context", exception);
        }
    }

    private String buildUserPrompt(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            String traceId,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        putCurrentTime(context);
        context.put("capabilities", AgentCapabilityContract.promptContext());
        context.put("imageBoundaryPolicy", AgentCapabilityContract.imageBoundaryPolicy());
        context.put("selectedSkills", selectedSkills);
        SkillDisclosureResult skillDisclosure = skillDisclosureService.disclose(plan, signals, request.message());
        if (!skillDisclosure.contexts().isEmpty()) {
            context.put("disclosedSkillContexts", skillDisclosure.contexts());
        }
        context.put("requester", requesterContext(principal));
        context.put("baseContext", baseContext(request, principal, contextSnapshot));
        context.put("agentPlan", plan);
        context.put("recordSignals", signals);
        context.put("toolResults", toolResults);
        context.put("babyProfile", contextSnapshot.babyProfile());
        context.put("retrievedContext", contextSnapshot);
        context.put("conversationSummary", contextSnapshot.conversationSummary());
        context.put("recordContext", contextSnapshot.recordContext());
        context.put("attachments", attachmentSummaries(request.attachments()));
        context.put("userMessage", request.message());

        try {
            return """
                    请根据下面的上下文生成一次 agent 输出。输出必须是 system prompt 中规定的 JSON 对象。
                    上下文:
                    %s
                    """.formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build agent context", exception);
        }
    }

    private Object buildUserContent(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            RuntimeModel runtimeModel,
            String traceId,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal
    ) {
        String prompt = buildUserPrompt(request, selectedSkills, toolResults, traceId, plan, contextSnapshot, signals, principal);
        List<VisualAttachmentInput> visualInputs = visualAttachmentInputs(request.attachments(), runtimeModel);
        if (visualInputs.isEmpty()) return prompt;

        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt));
        visualInputs.forEach((input) -> {
            if ("video".equals(input.kind()) && input.dataUrl().startsWith("data:video/")) {
                content.add(Map.of(
                        "type", "video_url",
                        "video_url", Map.of("url", input.dataUrl())
                ));
            } else {
                content.add(Map.of(
                        "type", "image_url",
                        "image_url", Map.of("url", input.dataUrl())
                ));
            }
        });
        return content;
    }

    private void putCurrentTime(Map<String, Object> context) {
        LocalDateTime now = LocalDateTime.now(clock);
        context.put("today", now.toLocalDate().toString());
        context.put("currentDateTime", now.truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("currentTime", now.toLocalTime().truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("timeInferenceRule", "用户没有说上午/下午时，按 currentTime 判断今天最近已经发生过的 12 小时制候选时间。");
    }

    private List<Map<String, String>> attachmentSummaries(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .map((attachment) -> {
                    Map<String, String> summary = new LinkedHashMap<>();
                    if (StringUtils.hasText(attachment.id())) summary.put("id", attachment.id());
                    if (StringUtils.hasText(attachment.name())) summary.put("name", attachment.name());
                    if (StringUtils.hasText(attachment.kind())) summary.put("kind", attachment.kind());
                    if (StringUtils.hasText(attachment.dataUrl())) {
                        summary.put("contentStatus", "video".equals(attachment.kind()) && attachment.dataUrl().startsWith("data:image/")
                                ? "video-thumbnail-attached"
                                : "visual-bytes-attached");
                    }
                    return summary;
                })
                .toList();
    }

    private List<VisualAttachmentInput> visualAttachmentInputs(List<AgentAttachment> attachments, RuntimeModel runtimeModel) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .map((attachment) -> new VisualAttachmentInput(attachment.kind(), attachment.dataUrl()))
                .filter((input) ->
                        StringUtils.hasText(input.dataUrl())
                                && (
                                        ("image".equals(input.kind()) && input.dataUrl().startsWith("data:image/") && runtimeModel.supportsImageInput())
                                                || ("video".equals(input.kind()) && input.dataUrl().startsWith("data:video/") && runtimeModel.supportsVideoInput())
                                                || ("video".equals(input.kind()) && input.dataUrl().startsWith("data:image/") && runtimeModel.supportsImageInput())
                                )
                )
                .limit(MAX_AGENT_VISUAL_ATTACHMENTS)
                .toList();
    }

    private String extractJsonObject(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        }

        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new AgentResponseParseException("Agent response did not contain a JSON object");
        }
        return trimmed.substring(start, end + 1);
    }

    private <T> List<T> tail(List<T> items, int limit) {
        if (items == null || items.isEmpty()) return List.of();
        int start = Math.max(0, items.size() - limit);
        return items.subList(start, items.size());
    }

    private <T> List<T> listOrEmpty(List<T> items) {
        return items == null ? List.of() : items;
    }

    private List<String> usedSkillIds(List<Skill> selectedSkills, List<AgentToolResult> toolResults) {
        return Stream.concat(
                        selectedSkills.stream()
                                .map(Skill::id)
                                .filter((skillId) -> skillDisclosureService.shouldCountAsUsed(skillId, List.of())),
                        toolResults.stream().map(AgentToolResult::toolId)
                )
                .distinct()
                .toList();
    }

    private List<String> usedSkillIds(
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            AgentPlan plan,
            RecordSignals signals,
            String userMessage
    ) {
        List<String> disclosedSkillIds = skillDisclosureService.disclosedSkillIds(plan, signals, userMessage);
        return Stream.concat(
                        selectedSkills.stream()
                                .map(Skill::id)
                                .filter((skillId) -> skillDisclosureService.shouldCountAsUsed(skillId, disclosedSkillIds)),
                        toolResults.stream().map(AgentToolResult::toolId)
                )
                .distinct()
                .toList();
    }

    private List<AgentSource> collectSources(List<AgentToolResult> toolResults) {
        return toolResults.stream()
                .flatMap((result) -> listOrEmpty(result.sources()).stream())
                .toList();
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

    @FunctionalInterface
    private interface ToolEventSink {
        void send(Map<String, Object> event);
    }

    private enum Provider {
        DEEPSEEK,
        DOUBAO
    }

    private record RuntimeModel(
            String id,
            Provider provider,
            String apiModel,
            boolean supportsImageInput,
            boolean supportsVideoInput,
            boolean lowLatencyEnabled,
            String baseUrl,
            String chatPath,
            Duration readTimeout,
            String apiKeyHelp
    ) {
    }

    private record VisualAttachmentInput(
            String kind,
            String dataUrl
    ) {
    }
}
