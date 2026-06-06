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
import java.util.function.BooleanSupplier;
import java.util.stream.Stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentBabyProfile;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import com.xiaobao.babycompanion.dto.agent.ConversationSummaryResponse;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.persistence.entity.AgentRunRecord;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import com.xiaobao.babycompanion.service.ExpensePersistenceResult;
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
    private static final int VISUAL_ANALYSIS_BATCH_SIZE = 4;

    private static final int SUMMARY_MIN_NEW_MESSAGES = 24;
    private static final int SUMMARY_MIN_NEW_CHARS = 12_000;
    private static final int SUMMARY_RECENT_MESSAGE_KEEP = 12;

    private final DeepSeekProperties properties;
    private final DoubaoProperties doubaoProperties;
    private final AgentRuntimeProperties agentRuntimeProperties;
    private final ObjectMapper objectMapper;
    private final AgentPlanner agentPlanner;
    private final AgentContextService agentContextService;
    private final AppStateService appStateService;
    private final AttachmentStorageService attachmentStorageService;
    private final AiUsageLogService aiUsageLogService;
    private final RecordSignalExtractor recordSignalExtractor;
    private final EffectPolicy effectPolicy;
    private final CurrentUser currentUser;
    private final SkillRegistry skillRegistry;
    private final SkillDisclosureService skillDisclosureService;
    private final SkillRouter skillRouter;
    private final ExpenseRecognitionSkill expenseRecognitionSkill;
    private final AgentTraceService agentTraceService;
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
            AttachmentStorageService attachmentStorageService,
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
                attachmentStorageService,
                recordSignalExtractor,
                effectPolicy,
                currentUser,
                skillRegistry,
                skillDisclosureService,
                new AgentRuntimeProperties(),
                new SkillRouter(skillDisclosureService),
                new ExpenseRecognitionSkill(objectMapper),
                null,
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
            AttachmentStorageService attachmentStorageService,
            RecordSignalExtractor recordSignalExtractor,
            EffectPolicy effectPolicy,
            CurrentUser currentUser,
            SkillRegistry skillRegistry,
            SkillDisclosureService skillDisclosureService,
            AgentRuntimeProperties agentRuntimeProperties,
            SkillRouter skillRouter,
            ExpenseRecognitionSkill expenseRecognitionSkill,
            AgentTraceService agentTraceService,
            ToolRegistry toolRegistry,
            SafetyGuard safetyGuard,
            AiUsageLogService aiUsageLogService,
            @Qualifier("agentStreamExecutor") Executor agentStreamExecutor,
            Clock clock
    ) {
        this.properties = properties;
        this.doubaoProperties = doubaoProperties;
        this.agentRuntimeProperties = agentRuntimeProperties == null ? new AgentRuntimeProperties() : agentRuntimeProperties;
        this.objectMapper = objectMapper;
        this.agentPlanner = agentPlanner;
        this.agentContextService = agentContextService;
        this.appStateService = appStateService;
        this.attachmentStorageService = attachmentStorageService;
        this.aiUsageLogService = aiUsageLogService;
        this.recordSignalExtractor = recordSignalExtractor;
        this.effectPolicy = effectPolicy;
        this.currentUser = currentUser;
        this.skillRegistry = skillRegistry;
        this.skillDisclosureService = skillDisclosureService;
        this.skillRouter = skillRouter;
        this.expenseRecognitionSkill = expenseRecognitionSkill;
        this.agentTraceService = agentTraceService;
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
        AgentRunRecord agentRun = startAgentRunTrace(traceId, familyId, principal.userId(), request, plannerRuntimeModel, runtimeModel);
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        RecordSignals signals = recordSignalExtractor.extract(request.message(), request.recentMessages());
        AgentChatResponse immediate = immediateBoundaryResponse(signals, traceId, runtimeModel, selectedSkills);
        if (immediate != null) {
            completeAgentRunTrace(agentRun, immediate.effectDecisions());
            return immediate;
        }
        AgentPlan plan = runPlanner(request, selectedSkills, signals, plannerRuntimeModel, plannerApiKey, familyId, principal.userId());
        AgentContextSnapshot contextSnapshot = agentContextService.build(familyId, principal.userId(), request, plan, signals);
        SkillPlan skillPlan = skillRouter == null ? SkillPlan.empty() : skillRouter.plan(request, plan, signals);
        recordAgentPlanTrace(agentRun, plan, skillPlan);
        AgentChatResponse profileBoundary = immediateBoundaryResponse(
                signals,
                traceId,
                runtimeModel,
                selectedSkills,
                contextSnapshot.babyProfile(),
                request.message()
        );
        if (profileBoundary != null) {
            completeAgentRunTrace(agentRun, profileBoundary.effectDecisions());
            return profileBoundary;
        }
        RuntimeModel expenseRuntimeModel = resolveExpenseRecognitionModel(runtimeModel);
        List<VisualAttachmentInput> visualInputs = visualInputsForSkillExecution(
                request,
                skillPlan,
                familyId,
                skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID) ? expenseRuntimeModel : runtimeModel
        );
        ExpenseRecognitionResult expenseRecognitionResult = executeExpenseRecognition(
                request,
                signals,
                traceId,
                familyId,
                principal.userId(),
                agentRun,
                skillPlan,
                expenseRuntimeModel,
                visualInputs,
                null
        );
        List<AgentToolResult> toolResults = executePlannedTools(plan, request, null);
        List<String> usedSkills = mergeSkillIds(usedSkillIds(selectedSkills, toolResults, plan, signals, request.message()), skillPlan);
        List<VisualAnalysisResult> visualAnalysisResults = expenseRecognitionResult == null
                ? analyzeVisualInputsInBatches(
                        request,
                        runtimeModel,
                        apiKey,
                        traceId,
                        familyId,
                        principal.userId(),
                        visualInputs,
                        null
                )
                : expenseRecognitionResult.visualAnalysisResults();
        List<VisualAttachmentInput> finalVisualInputs = expenseRecognitionResult != null
                ? List.of()
                : visualAnalysisResults.isEmpty() ? visualInputs : List.of();
        boolean expenseRecordingIntent = shouldPersistExpenseRecognition(request.message(), plan, skillPlan);
        ExpensePersistenceResult expensePersistenceResult = persistExpenseRecognitionResult(
                expenseRecognitionResult,
                expenseRecordingIntent,
                familyId,
                principal.userId()
        );

        DeepSeekChatRequest chatRequest = buildDeepSeekRequest(
                request,
                selectedSkills,
                toolResults,
                runtimeModel,
                traceId,
                false,
                plan,
                contextSnapshot,
                signals,
                principal,
                finalVisualInputs,
                visualAnalysisResults,
                skillPlan,
                expenseRecognitionResult,
                expensePersistenceResult
        );

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

            AgentChatResponse finalResponse = withSafetyAlertsAndDecisions(
                    parseModelContent(content, traceId, response.model(), response.id(), usedSkills, collectSources(toolResults)),
                    request.message(),
                    signals,
                    plan,
                    contextSnapshot.babyProfile(),
                    skillEffectCandidates(expenseRecognitionResult, expensePersistenceResult, expenseRecordingIntent),
                    expensePersistenceResult,
                    contextSnapshot.growthMeasurements()
            );
            completeAgentRunTrace(agentRun, finalResponse.effectDecisions());
            return finalResponse;
        } catch (RestClientException exception) {
            recordUsage(runtimeModel, "agent_chat", inputType(request), familyId, principal.userId(), traceId, null, false, rootCauseMessage(exception), false, true);
            AgentChatResponse fallbackResponse = expensePersistenceFallbackResponse(
                    request.message(),
                    signals,
                    plan,
                    contextSnapshot.babyProfile(),
                    skillEffectCandidates(expenseRecognitionResult, expensePersistenceResult, expenseRecordingIntent),
                    expensePersistenceResult,
                    usedSkills,
                    traceId,
                    runtimeModel.apiModel(),
                    traceId,
                    collectSources(toolResults)
            );
            if (fallbackResponse != null) {
                completeAgentRunTrace(agentRun, fallbackResponse.effectDecisions());
                return fallbackResponse;
            }
            failAgentRunTrace(agentRun, rootCauseMessage(exception));
            throw new DeepSeekApiException("Failed to call " + runtimeModel.id() + " API", exception);
        } catch (RuntimeException exception) {
            AgentChatResponse fallbackResponse = expensePersistenceFallbackResponse(
                    request.message(),
                    signals,
                    plan,
                    contextSnapshot.babyProfile(),
                    skillEffectCandidates(expenseRecognitionResult, expensePersistenceResult, expenseRecordingIntent),
                    expensePersistenceResult,
                    usedSkills,
                    traceId,
                    runtimeModel.apiModel(),
                    traceId,
                    collectSources(toolResults)
            );
            if (fallbackResponse != null) {
                completeAgentRunTrace(agentRun, fallbackResponse.effectDecisions());
                return fallbackResponse;
            }
            failAgentRunTrace(agentRun, rootCauseMessage(exception));
            throw exception;
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
        AgentRunRecord agentRun = startAgentRunTrace(traceId, familyId, principal.userId(), request, plannerRuntimeModel, runtimeModel);
        RuntimeModel expenseRuntimeModel = resolveExpenseRecognitionModel(runtimeModel);
        SseEmitter emitter = new SseEmitter(streamTimeoutBudget(request, runtimeModel, plannerRuntimeModel, expenseRuntimeModel).toMillis());

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
        Runnable failAndCancelStreamTask = () -> {
            failAgentRunTrace(agentRun, "stream_cancelled");
            cancelStreamTask.run();
        };
        emitter.onCompletion(cancelStreamTask);
        emitter.onTimeout(failAndCancelStreamTask);
        emitter.onError((error) -> failAndCancelStreamTask.run());
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
                            plannerApiKey,
                            agentRun,
                            cancelled::get
                    );
                } finally {
                    if (StringUtils.hasText(requestId)) MDC.remove("requestId");
                }
            }, agentStreamExecutor);
            streamTask.set(task);
        } catch (RejectedExecutionException exception) {
            LOGGER.warn("Agent stream executor is saturated; rejecting traceId={}", traceId);
            failAgentRunTrace(agentRun, "stream_executor_saturated");
            emitter.completeWithError(new IllegalStateException("AI 服务繁忙，请稍后再试。", exception));
        }
        return emitter;
    }

    Duration streamTimeoutBudget(
            AgentChatRequest request,
            RuntimeModel runtimeModel,
            RuntimeModel plannerRuntimeModel,
            RuntimeModel expenseRuntimeModel
    ) {
        Duration legacyTimeout = maxDuration(runtimeModel.readTimeout(), doubaoProperties.getReadTimeout()).plusSeconds(45);
        int visualCount = potentialVisualAttachmentCount(request);
        if (visualCount <= 0) return legacyTimeout;
        int batchSize = configuredExpenseBatchSize();
        int batchCount = Math.max(1, (int) Math.ceil((double) visualCount / batchSize));
        Duration plannerBudget = plannerRuntimeModel.readTimeout().plusSeconds(15);
        Duration expenseBudget = expenseRuntimeModel.readTimeout().multipliedBy(batchCount).plusSeconds(45);
        Duration finalBudget = runtimeModel.readTimeout().plusSeconds(45);
        Duration visualBudget = plannerBudget.plus(expenseBudget).plus(finalBudget).plusSeconds(30);
        return minDuration(maxDuration(legacyTimeout, visualBudget), Duration.ofMinutes(12));
    }

    private Duration maxDuration(Duration left, Duration right) {
        if (left == null) return right == null ? Duration.ZERO : right;
        if (right == null) return left;
        return left.compareTo(right) >= 0 ? left : right;
    }

    private Duration minDuration(Duration left, Duration right) {
        if (left == null) return right == null ? Duration.ZERO : right;
        if (right == null) return left;
        return left.compareTo(right) <= 0 ? left : right;
    }

    private int configuredExpenseBatchSize() {
        Integer configured = Optional.ofNullable(agentRuntimeProperties.getModels())
                .map(AgentRuntimeProperties.ModelProfiles::getExpenseRecognition)
                .map(AgentRuntimeProperties.ModelProfile::getBatchSize)
                .orElse(null);
        if (configured == null || configured <= 0) return VISUAL_ANALYSIS_BATCH_SIZE;
        return Math.max(1, Math.min(MAX_AGENT_VISUAL_ATTACHMENTS, configured));
    }

    private int potentialVisualAttachmentCount(AgentChatRequest request) {
        if (request == null) return 0;
        int directCount = visualAttachmentMetadataCount(request.attachments());
        if (directCount > 0) return directCount;
        List<AgentChatMessage> messages = listOrEmpty(request.recentMessages());
        for (int index = messages.size() - 1; index >= 0; index -= 1) {
            int count = visualAttachmentMetadataCount(messages.get(index).attachments());
            if (count > 0) return count;
        }
        return 0;
    }

    private int visualAttachmentMetadataCount(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return 0;
        int count = 0;
        for (AgentAttachment attachment : attachments) {
            if (attachment == null) continue;
            if ("image".equals(attachment.kind()) || "video".equals(attachment.kind())) {
                count += 1;
            }
            if (count >= MAX_AGENT_VISUAL_ATTACHMENTS) return MAX_AGENT_VISUAL_ATTACHMENTS;
        }
        return count;
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
            String plannerApiKey,
            AgentRunRecord agentRun,
            BooleanSupplier cancelled
    ) {
        try {
            RecordSignals signals = recordSignalExtractor.extract(request.message(), request.recentMessages());
            AgentChatResponse immediate = immediateBoundaryResponse(signals, traceId, runtimeModel, selectedSkills);
            if (immediate != null) {
                completeAfterFinalSent(emitter, agentRun, immediate);
                emitter.complete();
                return;
            }
            sendProgressEvent(emitter, "planning", "running", "理解请求并选择处理能力");
            sendStatusEvent(emitter, "planning", "理解请求并选择处理能力");
            AgentPlan plan = runPlanner(request, selectedSkills, signals, plannerRuntimeModel, plannerApiKey, familyId, principal.userId());
            sendProgressEvent(emitter, "planning", "completed", "已确定处理计划");
            sendProgressEvent(emitter, "context", "running", "整理宝宝档案、历史消息和账本上下文");
            sendStatusEvent(emitter, "retrieving_context", "整理宝宝档案、历史消息和账本上下文");
            AgentContextSnapshot contextSnapshot = agentContextService.build(familyId, principal.userId(), request, plan, signals);
            SkillPlan skillPlan = skillRouter == null ? SkillPlan.empty() : skillRouter.plan(request, plan, signals);
            recordAgentPlanTrace(agentRun, plan, skillPlan);
            sendProgressEvent(emitter, "context", "completed", "上下文已准备好");
            AgentChatResponse profileBoundary = immediateBoundaryResponse(
                    signals,
                    traceId,
                    runtimeModel,
                    selectedSkills,
                    contextSnapshot.babyProfile(),
                    request.message()
            );
            if (profileBoundary != null) {
                completeAfterFinalSent(emitter, agentRun, profileBoundary);
                emitter.complete();
                return;
            }
            RuntimeModel expenseRuntimeModel = resolveExpenseRecognitionModel(runtimeModel);
            List<VisualAttachmentInput> visualInputs = visualInputsForSkillExecution(
                    request,
                    skillPlan,
                    familyId,
                    skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID) ? expenseRuntimeModel : runtimeModel
            );
            if (!visualInputs.isEmpty()) {
                sendProgressEvent(
                        emitter,
                        "media-preparation",
                        "completed",
                        "已准备 " + visualInputs.size() + " 个图片/视频素材"
                );
            }
            ExpenseRecognitionResult expenseRecognitionResult = executeExpenseRecognition(
                    request,
                    signals,
                    traceId,
                    familyId,
                    principal.userId(),
                    agentRun,
                    skillPlan,
                    expenseRuntimeModel,
                    visualInputs,
                    emitter
            );
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "expense_recognition")) return;
            List<AgentToolResult> toolResults = executePlannedTools(plan, request, (event) -> sendEvent(emitter, "tool", event));
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "tools")) return;
            List<String> usedSkills = mergeSkillIds(usedSkillIds(selectedSkills, toolResults, plan, signals, request.message()), skillPlan);
            List<AgentSource> sources = collectSources(toolResults);
            List<VisualAnalysisResult> visualAnalysisResults = expenseRecognitionResult == null
                    ? analyzeVisualInputsInBatches(
                            request,
                            runtimeModel,
                            apiKey,
                            traceId,
                            familyId,
                            principal.userId(),
                            visualInputs,
                            emitter
                    )
                    : expenseRecognitionResult.visualAnalysisResults();
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "visual_analysis")) return;
            List<VisualAttachmentInput> finalVisualInputs = expenseRecognitionResult != null
                    ? List.of()
                    : visualAnalysisResults.isEmpty() ? visualInputs : List.of();
            boolean expenseRecordingIntent = shouldPersistExpenseRecognition(request.message(), plan, skillPlan);
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "before_expense_persistence")) return;
            if (expenseRecognitionResult != null && expenseRecordingIntent && !expenseRecognitionResult.effectCandidates().isEmpty()) {
                sendProgressEvent(emitter, "expense-persistence", "running", "把识别出的支出写入账本");
                sendStatusEvent(emitter, "generating", "正在保存账本记录");
            }
            ExpensePersistenceResult expensePersistenceResult = persistExpenseRecognitionResult(
                    expenseRecognitionResult,
                    expenseRecordingIntent,
                    familyId,
                    principal.userId()
            );
            if (!expensePersistenceResult.saved().isEmpty()) {
                sendProgressEvent(emitter, "expense-persistence", "completed", "已保存 " + expensePersistenceResult.saved().size() + " 条账本记录");
            } else if (expenseRecognitionResult != null && expenseRecordingIntent && !expenseRecognitionResult.effectCandidates().isEmpty()) {
                sendProgressEvent(emitter, "expense-persistence", "completed", "账本记录已由后续确认处理");
            }
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "after_expense_persistence")) return;
            sendModelWorkStatus(emitter, finalVisualInputs, visualAnalysisResults);
            sendProgressEvent(emitter, "final-composer", "running", "生成最终回复");

            RuntimeModel finalRuntimeModel = resolveFinalComposerModel(plan, visualInputs, toolResults, runtimeModel);
            String finalApiKey = resolvedApiKey(finalRuntimeModel);
            // 让 agent_run.final_model 记录分流后实际使用的模型（lite/pro），保证耗时埋点可按档位查询
            if (agentRun != null) {
                agentRun.setFinalModel(finalRuntimeModel.id());
            }
            String body = objectMapper.writeValueAsString(buildDeepSeekRequest(
                    request,
                    selectedSkills,
                    toolResults,
                    finalRuntimeModel,
                    traceId,
                    true,
                    plan,
                    contextSnapshot,
                    signals,
                    principal,
                    finalVisualInputs,
                    visualAnalysisResults,
                    skillPlan,
                    expenseRecognitionResult,
                    expensePersistenceResult
            ));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl(finalRuntimeModel)))
                    .timeout(finalRuntimeModel.readTimeout().plusSeconds(30))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + finalApiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            streamDeepSeekResponse(
                    httpRequest,
                    emitter,
                    traceId,
                    finalRuntimeModel,
                    usedSkills,
                    sources,
                    request.message(),
                    signals,
                    plan,
                    contextSnapshot.babyProfile(),
                    contextSnapshot.growthMeasurements(),
                    familyId,
                    principal.userId(),
                    inputType(request),
                    skillEffectCandidates(expenseRecognitionResult, expensePersistenceResult, expenseRecordingIntent),
                    expensePersistenceResult,
                    agentRun,
                    cancelled
            );
        } catch (Exception exception) {
            LOGGER.warn(
                    "Agent stream failed before model stream. traceId={}, provider={}, model={}, cause={}",
                    traceId,
                    runtimeModel.provider(),
                    runtimeModel.id(),
                    rootCauseMessage(exception),
                    exception
            );
            failAgentRunTrace(agentRun, rootCauseMessage(exception));
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
            AuthPrincipal principal,
            List<VisualAttachmentInput> visualInputs,
            List<VisualAnalysisResult> visualAnalysisResults,
            SkillPlan skillPlan,
            ExpenseRecognitionResult expenseRecognitionResult,
            ExpensePersistenceResult expensePersistenceResult
    ) {
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", AgentPrompts.AGENT_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildUserContent(
                                request,
                                selectedSkills,
                                toolResults,
                                traceId,
                                plan,
                                contextSnapshot,
                                signals,
                                principal,
                                visualInputs,
                                visualAnalysisResults,
                                skillPlan,
                                expenseRecognitionResult,
                                expensePersistenceResult
                        ), null, null)
                ),
                stream,
                finalComposerMaxTokens(),
                finalComposerTemperature(),
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

    private ExpenseRecognitionResult executeExpenseRecognition(
            AgentChatRequest request,
            RecordSignals signals,
            String traceId,
            String familyId,
            String userId,
            AgentRunRecord agentRun,
            SkillPlan skillPlan,
            RuntimeModel expenseRuntimeModel,
            List<VisualAttachmentInput> visualInputs,
            SseEmitter emitter
    ) {
        if (expenseRecognitionSkill == null || skillPlan == null || !skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID)) {
            return null;
        }
        ExpenseRecognitionInput input = new ExpenseRecognitionInput(
                request,
                signals,
                traceId,
                expenseRuntimeModel,
                agentRuntimeProperties.getModels().getExpenseRecognition(),
                visualInputs
        );
        String expenseApiKey = resolvedApiKey(expenseRuntimeModel);
        ExpenseRecognitionResult result = expenseRecognitionSkill.execute(
                input,
                (modelRequest, batchNumber, batchCount) -> {
                    String batchId = "expense-recognition-batch-" + batchNumber;
                    String batchMessage = batchCount > 1
                            ? "识别第 " + batchNumber + "/" + batchCount + " 批支出图片"
                            : "识别支出图片";
                    sendProgressEvent(emitter, batchId, "running", batchMessage);
                    try {
                        ExpenseRecognitionModelResponse response = callExpenseRecognitionModel(
                                expenseRuntimeModel,
                                expenseApiKey,
                                modelRequest,
                                batchNumber,
                                batchCount,
                                request,
                                familyId,
                                userId,
                                traceId
                        );
                        sendProgressEvent(emitter, batchId, "completed", batchMessage + "完成");
                        return response;
                    } catch (RuntimeException exception) {
                        sendProgressEvent(emitter, batchId, "failed", batchMessage + "失败");
                        throw exception;
                    }
                },
                (message) -> {
                    sendStatusEvent(emitter, "analyzing_media", message);
                    sendProgressEvent(emitter, "expense-recognition", "running", message);
                },
                agentStreamExecutor
        );
        if ("complete".equals(result.status())) {
            sendProgressEvent(emitter, "expense-recognition", "completed", "已整理出 " + result.effectCandidates().size() + " 条支出草稿");
        } else if ("failed".equals(result.status())) {
            sendProgressEvent(emitter, "expense-recognition", "failed", StringUtils.hasText(result.userFacingError()) ? result.userFacingError() : "支出图片识别失败");
        } else {
            sendProgressEvent(emitter, "expense-recognition", "completed", result.aiTextDraft());
        }
        recordSkillRunTrace(agentRun, traceId, result);
        return result;
    }

    private ExpenseRecognitionModelResponse callExpenseRecognitionModel(
            RuntimeModel runtimeModel,
            String apiKey,
            DeepSeekChatRequest modelRequest,
            int batchNumber,
            int batchCount,
            AgentChatRequest originalRequest,
            String familyId,
            String userId,
            String traceId
    ) {
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured for expense recognition");
        }
        try {
            DeepSeekChatResponse response = restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(modelRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException(runtimeModel.id() + " expense recognition returned an empty response");
            }
            recordUsage(runtimeModel, "agent_expense_recognition", inputType(originalRequest), familyId, userId, response.id(), response.usage(), true, null, false, true);
            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException(runtimeModel.id() + " expense recognition did not include message content"));
            return new ExpenseRecognitionModelResponse(response.id(), response.model(), content, response.usage());
        } catch (RuntimeException exception) {
            recordUsage(runtimeModel, "agent_expense_recognition", inputType(originalRequest), familyId, userId, traceId + "-expense-" + batchNumber, null, false, rootCauseMessage(exception), false, true);
            LOGGER.warn(
                    "Expense recognition skill model call failed. traceId={}, provider={}, model={}, batch={}/{}, cause={}",
                    traceId,
                    runtimeModel.provider(),
                    runtimeModel.id(),
                    batchNumber,
                    batchCount,
                    rootCauseMessage(exception),
                    exception
            );
            throw exception;
        }
    }

    private List<VisualAnalysisResult> analyzeVisualInputsInBatches(
            AgentChatRequest request,
            RuntimeModel runtimeModel,
            String apiKey,
            String traceId,
            String familyId,
            String userId,
            List<VisualAttachmentInput> visualInputs,
            SseEmitter emitter
    ) {
        List<List<VisualAttachmentInput>> batches = visualAnalysisBatches(visualInputs);
        if (batches.size() <= 1) return List.of();

        sendStatusEvent(emitter, "analyzing_media", "正在分批分析 " + visualInputs.size() + " 张图片");
        List<VisualAnalysisResult> results = new ArrayList<>();
        for (int index = 0; index < batches.size(); index += 1) {
            List<VisualAttachmentInput> batch = batches.get(index);
            int batchNumber = index + 1;
            sendStatusEvent(
                    emitter,
                    "analyzing_media",
                    "正在分析第 " + batchNumber + "/" + batches.size() + " 批图片"
            );
            DeepSeekChatRequest analysisRequest = buildVisualAnalysisRequest(request, runtimeModel, traceId, batch, batchNumber, batches.size());
            try {
                DeepSeekChatResponse response = restClient(runtimeModel).post()
                        .uri(runtimeModel.chatPath())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .body(analysisRequest)
                        .retrieve()
                        .body(DeepSeekChatResponse.class);
                if (response == null || response.choices() == null || response.choices().isEmpty()) {
                    throw new DeepSeekApiException(runtimeModel.id() + " visual analysis returned an empty response");
                }
                recordUsage(runtimeModel, "agent_visual_analysis", inputType(request), familyId, userId, response.id(), response.usage(), true, null, false, true);
                String summary = Optional.ofNullable(response.choices().get(0).message())
                        .map(DeepSeekMessage::contentAsText)
                        .filter(StringUtils::hasText)
                        .orElseThrow(() -> new DeepSeekApiException(runtimeModel.id() + " visual analysis did not include message content"));
                results.add(new VisualAnalysisResult(
                        batchNumber,
                        batches.size(),
                        batch.size(),
                        batch.stream().map(VisualAttachmentInput::metadata).toList(),
                        summary
                ));
            } catch (RuntimeException exception) {
                LOGGER.warn(
                        "Agent visual batch analysis failed. traceId={}, provider={}, model={}, batch={}/{}, cause={}",
                        traceId,
                        runtimeModel.provider(),
                        runtimeModel.id(),
                        batchNumber,
                        batches.size(),
                        rootCauseMessage(exception),
                        exception
                );
                recordUsage(runtimeModel, "agent_visual_analysis", inputType(request), familyId, userId, traceId + "-visual-" + batchNumber, null, false, rootCauseMessage(exception), false, true);
                throw exception;
            }
        }
        return results;
    }

    List<List<VisualAttachmentInput>> visualAnalysisBatches(List<VisualAttachmentInput> visualInputs) {
        if (visualInputs == null || visualInputs.size() <= VISUAL_ANALYSIS_BATCH_SIZE) return List.of();
        List<List<VisualAttachmentInput>> batches = new ArrayList<>();
        for (int index = 0; index < visualInputs.size(); index += VISUAL_ANALYSIS_BATCH_SIZE) {
            batches.add(visualInputs.subList(index, Math.min(index + VISUAL_ANALYSIS_BATCH_SIZE, visualInputs.size())));
        }
        return batches;
    }

    private DeepSeekChatRequest buildVisualAnalysisRequest(
            AgentChatRequest request,
            RuntimeModel runtimeModel,
            String traceId,
            List<VisualAttachmentInput> batch,
            int batchNumber,
            int totalBatches
    ) {
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", """
                                你是图片 OCR 和视觉理解助手。只能根据本次图片内容输出事实，不要联网，不要查询价格，不要编造看不清的字段。
                                如果用户目标是记账或识别花费，重点提取商家、订单/支付状态、日期、金额、币种、商品、规格、数量、单价、优惠、运费和可能重复的截图线索。
                                输出简洁中文，按素材逐条列出可见事实和不确定字段，最后给出本批结论。
                                """),
                        new DeepSeekMessage("user", buildVisualAnalysisContent(request, traceId, batch, batchNumber, totalBatches), null, null)
                ),
                false,
                1200,
                0.0,
                null,
                Map.of("type", "disabled"),
                null,
                null,
                serviceTier(runtimeModel)
        );
    }

    private Object buildVisualAnalysisContent(
            AgentChatRequest request,
            String traceId,
            List<VisualAttachmentInput> batch,
            int batchNumber,
            int totalBatches
    ) {
        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", visualAnalysisPrompt(request, traceId, batch, batchNumber, totalBatches)));
        batch.forEach((input) -> {
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

    private String visualAnalysisPrompt(
            AgentChatRequest request,
            String traceId,
            List<VisualAttachmentInput> batch,
            int batchNumber,
            int totalBatches
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        context.put("batch", batchNumber + "/" + totalBatches);
        context.put("userMessage", request.message());
        context.put("attachmentOrder", batch.stream().map(VisualAttachmentInput::metadata).toList());
        try {
            return """
                    请分析本批图片，不要输出最终聊天回复，也不要决定是否记账；只做视觉事实摘要。
                    每个素材必须保留 attachment id，方便后续最终回复把金额和原图关联。
                    上下文:
                    %s
                    """.formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build visual analysis prompt", exception);
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
            List<JsonNode> existingGrowthMeasurements,
            String familyId,
            String userId,
            String inputType,
            List<AgentEffectDecision> skillCandidates,
            ExpensePersistenceResult expensePersistenceResult,
            AgentRunRecord agentRun,
            BooleanSupplier cancelled
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
                    AgentChatResponse fallbackResponse = expensePersistenceFallbackResponse(
                            userMessage,
                            signals,
                            plan,
                            babyProfile,
                            skillCandidates,
                            expensePersistenceResult,
                            usedSkills,
                            traceId,
                            runtimeModel.apiModel(),
                            traceId,
                            sources
                    );
                    if (fallbackResponse != null) {
                        completeAfterFinalSent(emitter, agentRun, fallbackResponse);
                        emitter.complete();
                        return;
                    }
                    failAgentRunTrace(agentRun, "HTTP_" + response.statusCode());
                    sendProgressEvent(emitter, "final-composer", "failed", "最终回复生成失败");
                    sendEvent(emitter, "error", Map.of("message", runtimeModel.id() + " stream failed: " + errorBody));
                    emitter.complete();
                    return;
                }

                lines.forEach((line) -> handleStreamLine(line, emitter, content, model, requestId));
            }
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "before_final_delivery")) return;

            AgentChatResponse parsed = parseModelContent(
                    content.toString(),
                    traceId,
                    model.get(),
                    requestId.get(),
                    usedSkills,
                    sources
            );
            recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, requestId.get(), null, true, null, false, true);
            AgentChatResponse finalResponse = withSafetyAlertsAndDecisions(parsed, userMessage, signals, plan, babyProfile, skillCandidates, expensePersistenceResult, existingGrowthMeasurements);
            completeAfterFinalSent(emitter, agentRun, finalResponse);
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
            AgentChatResponse fallbackResponse = expensePersistenceFallbackResponse(
                    userMessage,
                    signals,
                    plan,
                    babyProfile,
                    skillCandidates,
                    expensePersistenceResult,
                    usedSkills,
                    traceId,
                    runtimeModel.apiModel(),
                    traceId,
                    sources
            );
            if (fallbackResponse != null) {
                completeAfterFinalSent(emitter, agentRun, fallbackResponse);
                emitter.complete();
                return;
            }
            failAgentRunTrace(agentRun, rootCauseMessage(exception));
            sendProgressEvent(emitter, "final-composer", "failed", "最终回复生成失败");
            sendEvent(emitter, "error", Map.of("message", userFacingModelErrorMessage(exception, inputType)));
            emitter.complete();
        }
    }

    AgentChatResponse expensePersistenceFallbackResponse(
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile,
            List<AgentEffectDecision> skillCandidates,
            ExpensePersistenceResult expensePersistenceResult,
            List<String> usedSkills,
            String traceId,
            String model,
            String requestId,
            List<AgentSource> sources
    ) {
        if (expensePersistenceResult == null || !expensePersistenceResult.hasFacts()) return null;
        AgentChatResponse base = new AgentChatResponse(
                "",
                List.of("记账"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                listOrEmpty(sources),
                List.of(),
                List.of(),
                listOrEmpty(usedSkills),
                traceId,
                model,
                requestId
        );
        return withSafetyAlertsAndDecisions(
                base,
                userMessage,
                signals,
                plan,
                babyProfile,
                listOrEmpty(skillCandidates),
                expensePersistenceResult
        );
    }

    AgentChatResponse withSafetyAlertsAndDecisions(
            AgentChatResponse response,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile
    ) {
        return withSafetyAlertsAndDecisions(response, userMessage, signals, plan, babyProfile, List.of(), ExpensePersistenceResult.empty());
    }

    AgentChatResponse withSafetyAlertsAndDecisions(
            AgentChatResponse response,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile,
            List<AgentEffectDecision> skillCandidates
    ) {
        return withSafetyAlertsAndDecisions(response, userMessage, signals, plan, babyProfile, skillCandidates, ExpensePersistenceResult.empty());
    }

    AgentChatResponse withSafetyAlertsAndDecisions(
            AgentChatResponse response,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile,
            List<AgentEffectDecision> skillCandidates,
            ExpensePersistenceResult expensePersistenceResult
    ) {
        return withSafetyAlertsAndDecisions(response, userMessage, signals, plan, babyProfile, skillCandidates, expensePersistenceResult, List.of());
    }

    AgentChatResponse withSafetyAlertsAndDecisions(
            AgentChatResponse response,
            String userMessage,
            RecordSignals signals,
            AgentPlan plan,
            JsonNode babyProfile,
            List<AgentEffectDecision> skillCandidates,
            ExpensePersistenceResult expensePersistenceResult,
            List<JsonNode> existingGrowthMeasurements
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
                : new ArrayList<>(effectPolicy.decide(withSafety, signals, babyProfile, userMessage, skillCandidates, existingGrowthMeasurements));
        if (isExpenseReadOnlyResult(expensePersistenceResult)) {
            decisions.removeIf((decision) -> "expenseItem".equals(decision.type()));
        }
        decisions.addAll(mediaDecisions);
        String aiText = albumSaveOnly && !mediaDecisions.isEmpty()
                ? albumSaveAiText(plan)
                : adjustedAiText(withSafety.aiText(), signals, decisions, expensePersistenceResult);
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

    private boolean isExpenseReadOnlyResult(ExpensePersistenceResult result) {
        return result != null
                && !result.readOnly().isEmpty()
                && result.saved().isEmpty()
                && result.duplicates().isEmpty()
                && result.needsInput().isEmpty();
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
        String aiText = adjustedAiText("", signals, decisions, ExpensePersistenceResult.empty());
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

    private String adjustedAiText(String aiText, RecordSignals signals, List<AgentEffectDecision> decisions, ExpensePersistenceResult expensePersistenceResult) {
        if (signals.privateStateShareRequest()) {
            return AgentCapabilityContract.privateStateShareMessage();
        }
        if (signals.unsupportedMutationRequest()) {
            return containsBoundaryExplanation(aiText) ? aiText : AgentCapabilityContract.unsupportedMutationMessage();
        }
        String expenseSummary = expensePersistenceSummary(expensePersistenceResult);
        if (StringUtils.hasText(expenseSummary)) {
            String normalized = aiText == null ? "" : aiText.trim();
            if (!StringUtils.hasText(normalized) || looksLikeExpenseConfirmation(normalized)) return expenseSummary;
            if (normalized.contains("已记录") || normalized.contains("没有重复记录") || normalized.contains("没有入账")) return normalized;
            return normalized + "\n\n" + expenseSummary;
        }
        String askQuestion = decisions.stream()
                .filter((decision) -> "ask".equals(decision.mode()))
                .map(AgentEffectDecision::payload)
                .map((payload) -> payload == null ? "" : payload.path("question").asText(""))
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");
        if (StringUtils.hasText(askQuestion) && hasDuplicateGrowthMeasurementAsk(decisions)) {
            return askQuestion;
        }
        if (StringUtils.hasText(askQuestion)) return mergeFollowUpQuestion(aiText, askQuestion);

        boolean hasPendingExpense = decisions.stream().anyMatch((decision) ->
                "expenseItem".equals(decision.type()) && "pending".equals(decision.mode())
        );
        if (hasPendingExpense && looksLikeAmountClarification(aiText)) {
            return "我已识别出这笔支出，并整理成待确认的账本草稿。请确认后我再记到账本里。";
        }
        boolean hasPendingCareLog = decisions.stream().anyMatch((decision) ->
                "careLog".equals(decision.type()) && "pending".equals(decision.mode())
        );
        if (hasPendingCareLog && (!StringUtils.hasText(aiText) || looksLikeCareLogRecorded(aiText))) {
            return "我已整理出一条待确认照护记录。确认后会写入今天记录；需要调整的话，可以先编辑。";
        }
        return aiText;
    }

    private boolean hasDuplicateGrowthMeasurementAsk(List<AgentEffectDecision> decisions) {
        return decisions.stream().anyMatch((decision) -> {
            if (!"growthMeasurement".equals(decision.type()) || !"ask".equals(decision.mode())) return false;
            JsonNode missingFields = decision.payload() == null ? null : decision.payload().path("missingFields");
            if (missingFields == null || !missingFields.isArray()) return false;
            for (JsonNode missingField : missingFields) {
                if ("duplicate".equals(missingField.asText())) return true;
            }
            return false;
        });
    }

    private boolean looksLikeExpenseConfirmation(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(确认后|待确认|再帮你记|补充后).*账本.*")
                || text.matches(".*(实际花了多少钱|实际支付金额|金额是多少).*");
    }

    private String expensePersistenceSummary(ExpensePersistenceResult result) {
        if (result == null || !result.hasFacts()) return "";
        List<String> parts = new ArrayList<>();
        if (!result.saved().isEmpty()) {
            parts.add("已记录 " + result.saved().size() + " 笔支出到账本" + expenseTotalText(result.saved()) + "。");
        }
        if (!result.duplicates().isEmpty()) {
            parts.add(result.duplicates().size() + " 笔之前已经在账本里，没有重复记录。");
        }
        if (!result.readOnly().isEmpty() && result.saved().isEmpty() && result.duplicates().isEmpty()) {
            parts.add("我已识别出 " + result.readOnly().size() + " 笔支出，本轮只是识别，没有写入账本。");
        }
        if (!result.needsInput().isEmpty()) {
            parts.add("还有 " + result.needsInput().size() + " 笔信息不完整，需要补充金额、日期或用途后再记录。");
        }
        return String.join("\n", parts);
    }

    private String expenseTotalText(List<JsonNode> expenses) {
        double total = expenses.stream().mapToDouble((expense) -> expense.path("amount").asDouble(0)).sum();
        if (total <= 0) return "";
        return "，共 ¥" + String.format(java.util.Locale.ROOT, "%.2f", Math.round(total * 100.0) / 100.0);
    }

    private boolean containsBoundaryExplanation(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(不能|暂不支持|不支持|无法).*(撤销|删除|修改|回滚|改历史|历史记录).*")
                || text.matches(".*(记录页|成长页|重新记录|重新添加).*");
    }

    private String mergeFollowUpQuestion(String aiText, String question) {
        String normalizedQuestion = question == null ? "" : question.trim();
        if (!StringUtils.hasText(normalizedQuestion)) return aiText;
        if (!StringUtils.hasText(aiText)) return normalizedQuestion;
        String normalizedText = aiText.trim();
        if (normalizedText.contains(normalizedQuestion)) return normalizedText;
        if (looksLikeAmountClarification(normalizedQuestion) && looksLikeAmountClarification(normalizedText)) {
            return normalizedText;
        }
        return normalizedText + "\n\n" + normalizedQuestion;
    }

    private boolean looksLikeAmountClarification(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(实际花了多少钱|实际支付金额|实际金额|确认金额|金额是多少|告诉我.*金额|补充.*金额).*");
    }

    private boolean looksLikeCareLogRecorded(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(已经|已|帮你).*(记到|记录|保存|写入).*(今天|照护|喂养|记录|日志).*")
                || text.matches(".*(今天|照护|喂养).*(记录|日志).*(已经|已).*(记好|记录|保存|写入).*");
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

    private boolean sendEvent(SseEmitter emitter, String name, Object data) {
        if (emitter == null) return false;
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
            return true;
        } catch (Exception exception) {
            emitter.completeWithError(exception);
            return false;
        }
    }

    private void sendModelWorkStatus(
            SseEmitter emitter,
            List<VisualAttachmentInput> visualInputs,
            List<VisualAnalysisResult> visualAnalysisResults
    ) {
        if (visualAnalysisResults != null && !visualAnalysisResults.isEmpty()) {
            sendStatusEvent(emitter, "generating", "正在整理图片分析结果");
            return;
        }
        if (visualInputs == null || visualInputs.isEmpty()) {
            sendStatusEvent(emitter, "generating", "正在生成回复");
            return;
        }
        sendStatusEvent(emitter, "analyzing_media", analyzingMediaMessage(visualInputs));
    }

    private void sendStatusEvent(SseEmitter emitter, String name, String message) {
        if (emitter == null) return;
        Map<String, String> event = Map.of("message", message);
        sendEvent(emitter, name, event);
    }

    private void sendProgressEvent(SseEmitter emitter, String id, String status, String message) {
        if (emitter == null || !StringUtils.hasText(id) || !StringUtils.hasText(message)) return;
        sendEvent(emitter, "tool", Map.of(
                "id", "progress-" + id,
                "toolId", "agent-progress",
                "name", "处理进度",
                "status", status,
                "message", message
        ));
    }

    private void completeAfterFinalSent(SseEmitter emitter, AgentRunRecord agentRun, AgentChatResponse response) {
        sendProgressEvent(emitter, "final-composer", "completed", "最终回复已生成");
        if (sendEvent(emitter, "final", response)) {
            completeAgentRunTrace(agentRun, response.effectDecisions());
        } else {
            failAgentRunTrace(agentRun, "final_delivery_failed");
        }
    }

    private boolean stopStreamIfCancelled(BooleanSupplier cancelled, AgentRunRecord agentRun, String traceId, String stage) {
        if (cancelled == null || !cancelled.getAsBoolean()) return false;
        LOGGER.warn("Agent stream was cancelled before completing stage. traceId={}, stage={}", traceId, stage);
        failAgentRunTrace(agentRun, "stream_cancelled_" + stage);
        return true;
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
            return "图片分析超时了：我已尝试分批处理，但模型没有及时返回。请稍后重试；如果仍失败，可以先减少图片数量或分开发送。";
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
        String configuredFinalModel = agentRuntimeProperties.getModels().getFinalComposer().getModel();
        String model = StringUtils.hasText(requestedModel)
                ? requestedModel.trim()
                : StringUtils.hasText(configuredFinalModel) ? configuredFinalModel.trim() : properties.getModel();
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
        String configured = agentRuntimeProperties.getModels().getPlanner().getModel();
        return resolveModel(StringUtils.hasText(configured) ? configured : properties.getPlannerModel());
    }

    private RuntimeModel resolveExpenseRecognitionModel(RuntimeModel fallback) {
        String configured = agentRuntimeProperties.getModels().getExpenseRecognition().getModel();
        if (StringUtils.hasText(configured)) {
            return resolveModel(configured.trim(), false);
        }
        if (fallback != null && fallback.supportsImageInput()) {
            return fallback;
        }
        return resolveModel("doubao-seed-2.0-pro", false);
    }

    private RuntimeModel resolveFinalComposerModel(
            AgentPlan plan,
            List<VisualAttachmentInput> visualInputs,
            List<AgentToolResult> toolResults,
            RuntimeModel fallback
    ) {
        // 仅对 doubao 链路分流；用户显式选了别的 provider（如 deepseek）则保持原样
        if (fallback == null || fallback.provider() != Provider.DOUBAO) {
            return fallback;
        }
        boolean hasVisual = visualInputs != null && !visualInputs.isEmpty();
        boolean hasTools = toolResults != null && !toolResults.isEmpty();
        boolean recordIntent = plan != null && "record".equalsIgnoreCase(plan.intent());
        // 简单记录（纯文本记录、无图、无联网工具）用更快更省的 lite；复杂问答用 pro。两者都走 fast 服务档提速。
        boolean simpleRecord = recordIntent && !hasVisual && !hasTools;
        String modelId = simpleRecord ? "doubao-seed-2.0-lite" : "doubao-seed-2.0-pro";
        return resolveModel(modelId, true);
    }

    private int finalComposerMaxTokens() {
        Integer configured = agentRuntimeProperties.getModels().getFinalComposer().getMaxTokens();
        return configured == null || configured <= 0 ? properties.getAgentMaxTokens() : configured;
    }

    private double finalComposerTemperature() {
        Double configured = agentRuntimeProperties.getModels().getFinalComposer().getTemperature();
        if (configured == null || configured < 0) return Math.min(properties.getTemperature(), 0.2);
        return Math.max(0.0, Math.min(1.0, configured));
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
        values.put("gender", profile.gender());
        values.put("expectedDate", profile.expectedDate());
        values.put("birthDate", profile.birthDate());
        values.put("region", profile.region());
        values.put("feeding", profile.feeding());
        values.put("birthWeight", profile.birthWeight());
        values.put("birthHeight", profile.birthHeight());
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
        putModelContextHarness(context);
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
            AuthPrincipal principal,
            List<VisualAnalysisResult> visualAnalysisResults,
            boolean visualInputsAttachedToFinalRequest,
            SkillPlan skillPlan,
            ExpenseRecognitionResult expenseRecognitionResult,
            ExpensePersistenceResult expensePersistenceResult
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        putCurrentTime(context);
        putModelContextHarness(context);
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
        context.put("skillPlan", skillPlan == null ? SkillPlan.empty() : skillPlan);
        context.put("recordSignals", signals);
        context.put("toolResults", toolResults);
        context.put("babyProfile", contextSnapshot.babyProfile());
        context.put("retrievedContext", contextSnapshot);
        context.put("conversationSummary", contextSnapshot.conversationSummary());
        context.put("recordContext", contextSnapshot.recordContext());
        context.put("attachments", attachmentSummaries(request.attachments()));
        context.put("visualInputsAttachedToFinalRequest", visualInputsAttachedToFinalRequest);
        if (visualAnalysisResults != null && !visualAnalysisResults.isEmpty()) {
            context.put("visualAnalysisResults", visualAnalysisResults);
            context.put(
                    "visualAnalysisUsageRule",
                    "图片较多时已由前置模型分批完成 OCR/视觉摘要；最终回复应优先使用 visualAnalysisResults，不要重新要求用户确认已经识别到的金额。若多张图属于同一订单或支付链路，注意去重并保留相关 attachment id。"
            );
        }
        if (expenseRecognitionResult != null) {
            Map<String, Object> skillResult = new LinkedHashMap<>();
            skillResult.put("skillId", SkillRouter.EXPENSE_RECOGNITION_SKILL_ID);
            skillResult.put("status", expenseRecognitionResult.status());
            skillResult.put("aiTextDraft", expenseRecognitionResult.aiTextDraft());
            skillResult.put("userFacingError", expenseRecognitionResult.userFacingError());
            skillResult.put("clarifications", expenseRecognitionResult.clarifications());
            skillResult.put("evidence", expenseRecognitionResult.evidence());
            skillResult.put("effectCandidateCount", expenseRecognitionResult.effectCandidates().size());
            skillResult.put("effectCandidates", expenseRecognitionResult.effectCandidates());
            context.put("executedSkillResults", List.of(skillResult));
            context.put(
                    "skillResultUsageRule",
                    "expense-recognition 是已执行的能力模块；最终回复必须尊重该 skill 的 status、证据和 effectCandidates。若 effectCandidates 已包含实际支付金额，不要再追问实际花了多少钱。若 skill 失败，应说明真实失败阶段。"
            );
        }
        if (expensePersistenceResult != null && expensePersistenceResult.hasFacts()) {
            context.put("expensePersistenceResult", expensePersistenceContext(expensePersistenceResult));
            context.put(
                    "expensePersistenceUsageRule",
                    "这是账本写入的事实结果，优先级高于模型草稿：saved 表示已新增到账本，duplicates 表示已存在且没有重复记录，needsInput 表示仍需补充，readOnly 表示本轮只是识别没有入账。最终回复要自然表达这些事实，不要再让用户确认已经保存或已跳过的记录。"
            );
        }
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
            String traceId,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal,
            List<VisualAttachmentInput> visualInputs,
            List<VisualAnalysisResult> visualAnalysisResults,
            SkillPlan skillPlan,
            ExpenseRecognitionResult expenseRecognitionResult,
            ExpensePersistenceResult expensePersistenceResult
    ) {
        String prompt = buildUserPrompt(
                request,
                selectedSkills,
                toolResults,
                traceId,
                plan,
                contextSnapshot,
                signals,
                principal,
                visualAnalysisResults,
                visualInputs != null && !visualInputs.isEmpty(),
                skillPlan,
                expenseRecognitionResult,
                expensePersistenceResult
        );
        if (visualInputs == null || visualInputs.isEmpty()) return prompt;

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
        context.put("timeZone", clock.getZone().getId());
    }

    private void putModelContextHarness(Map<String, Object> context) {
        context.put("modelContextHarness", AgentModelContextHarness.promptBlock());
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
                .map((attachment) -> new VisualAttachmentInput(attachment.id(), attachment.name(), attachment.kind(), attachment.dataUrl()))
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

    List<VisualAttachmentInput> visualInputsForSkillExecution(
            AgentChatRequest request,
            SkillPlan skillPlan,
            String familyId,
            RuntimeModel runtimeModel
    ) {
        List<VisualAttachmentInput> current = visualAttachmentInputs(request.attachments(), runtimeModel);
        if (!current.isEmpty()) return current;
        if (skillPlan == null || !skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID)) return List.of();
        List<AgentAttachment> referenced = referencedRecentVisualAttachments(request, familyId);
        return visualAttachmentInputs(referenced, runtimeModel);
    }

    private List<AgentAttachment> referencedRecentVisualAttachments(AgentChatRequest request, String familyId) {
        if (attachmentStorageService == null || request == null || request.recentMessages() == null) return List.of();
        List<AgentAttachment> fallback = List.of();
        for (int messageIndex = request.recentMessages().size() - 1; messageIndex >= 0; messageIndex -= 1) {
            var message = request.recentMessages().get(messageIndex);
            if (message == null || !"parent".equals(message.role()) || message.attachments() == null || message.attachments().isEmpty()) {
                continue;
            }
            List<AgentAttachment> visual = message.attachments().stream()
                    .filter((attachment) -> attachment != null && List.of("image", "video").contains(attachment.kind()))
                    .limit(MAX_AGENT_VISUAL_ATTACHMENTS)
                    .map((attachment) -> attachmentStorageService.loadAgentAttachmentDataUrl(attachment.id(), familyId))
                    .filter((attachment) -> attachment != null)
                    .toList();
            if (visual.isEmpty()) continue;
            if (fallback.isEmpty()) fallback = visual;
            if (looksLikeExpenseEvidence(message.text())) return visual;
        }
        return fallback;
    }

    private boolean looksLikeExpenseEvidence(String text) {
        if (!StringUtils.hasText(text)) return false;
        return text.matches(".*(花费|支出|账本|记账|费用|订单|小票|收据|发票|付款|支付|金额).*");
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

    private List<String> mergeSkillIds(List<String> usedSkills, SkillPlan skillPlan) {
        Stream<String> planned = skillPlan == null ? Stream.empty() : skillPlan.usedSkillIds().stream();
        return Stream.concat(listOrEmpty(usedSkills).stream(), planned)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
    }

    private boolean hasExpenseRecordingIntent(String message) {
        if (!StringUtils.hasText(message)) return false;
        String text = message.trim();
        boolean expenseContext = text.matches(".*(花费|支出|账本|记账|费用|订单|小票|收据|发票|付款|支付).*");
        boolean recordIntent = text.matches(".*(记下来|记下|记录|再记录|重新记录|记到账本|记入账本|存到账本|写到账本|记一遍|入账).*");
        return expenseContext && recordIntent;
    }

    boolean shouldPersistExpenseRecognition(String message, AgentPlan plan, SkillPlan skillPlan) {
        if (hasExpenseRecordingIntent(message)) return true;
        if (plan == null || skillPlan == null || !skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID)) return false;
        boolean plannerRecordIntent = "record".equalsIgnoreCase(plan.intent());
        boolean plannerExpenseTopic = listOrEmpty(plan.topics()).stream().anyMatch((topic) -> "expense".equalsIgnoreCase(topic));
        return plannerRecordIntent && plannerExpenseTopic;
    }

    ExpensePersistenceResult persistExpenseRecognitionResult(
            ExpenseRecognitionResult result,
            boolean shouldSave,
            String familyId,
            String userId
    ) {
        if (result == null || result.effectCandidates().isEmpty() || appStateService == null) {
            return ExpensePersistenceResult.empty();
        }
        return appStateService.persistAgentExpenseCandidates(
                result.effectCandidates().stream()
                        .map(AgentEffectDecision::payload)
                        .filter((payload) -> payload != null && payload.isObject())
                        .toList(),
                shouldSave,
                familyId,
                userId
        );
    }

    private List<AgentEffectDecision> skillEffectCandidates(
            ExpenseRecognitionResult result,
            ExpensePersistenceResult persistenceResult,
            boolean expenseRecordingIntent
    ) {
        if (result == null) return List.of();
        if (!expenseRecordingIntent) return List.of();
        if (persistenceResult == null || !persistenceResult.hasFacts()) {
            if (!result.effectCandidates().isEmpty()) return result.effectCandidates();
            if (!result.clarifications().isEmpty()) {
                return List.of(expenseSkillClarificationDecision(result.clarifications().get(0)));
            }
            if (StringUtils.hasText(result.userFacingError())) {
                return List.of(expenseSkillClarificationDecision(result.userFacingError()));
            }
            return List.of();
        }
        List<AgentEffectDecision> decisions = new ArrayList<>();
        persistenceResult.saved().forEach((payload) -> decisions.add(expensePersistenceDecision("auto", payload, "支出已自动保存到账本。", "saved")));
        persistenceResult.duplicates().forEach((payload) -> decisions.add(expensePersistenceDecision("ignore", payload, "支出已存在，未重复保存。", "duplicate")));
        persistenceResult.needsInput().forEach((payload) -> decisions.add(needsInputExpenseDecision(payload)));
        return decisions;
    }

    private AgentEffectDecision expensePersistenceDecision(String mode, JsonNode payload, String reason, String status) {
        ObjectNode next = payload != null && payload.isObject()
                ? (ObjectNode) payload.deepCopy()
                : objectMapper.createObjectNode();
        next.put("persistenceStatus", status);
        return new AgentEffectDecision(
                "decision-" + UUID.randomUUID(),
                mode,
                "expenseItem",
                next,
                "auto".equals(mode) ? 0.96 : 0.9,
                reason,
                SkillRouter.EXPENSE_RECOGNITION_SKILL_ID
        );
    }

    private AgentEffectDecision expenseSkillClarificationDecision(String question) {
        ObjectNode ask = objectMapper.createObjectNode();
        ask.put("topic", "expense");
        ask.put("question", StringUtils.hasText(question)
                ? question.trim()
                : "这次没有拿到足够稳定的支出识别结果，可以补充更清晰的图片或金额后再记录。");
        ask.set("missingFields", objectMapper.createArrayNode().add("支出图片证据"));
        return new AgentEffectDecision(
                "decision-" + UUID.randomUUID(),
                "ask",
                "expenseItem",
                ask,
                0.82,
                "支出识别 skill 没有产生完整可保存候选。",
                SkillRouter.EXPENSE_RECOGNITION_SKILL_ID
        );
    }

    private AgentEffectDecision needsInputExpenseDecision(JsonNode payload) {
        ObjectNode ask = objectMapper.createObjectNode();
        ask.put("topic", "expense");
        ask.put("question", "这笔账还缺少金额、日期或用途，补充后我再帮你记到账本里。");
        ask.set("missingFields", objectMapper.createArrayNode().add("金额、日期或用途"));
        if (payload != null && payload.isObject()) ask.set("draftExpense", payload);
        return new AgentEffectDecision(
                "decision-" + UUID.randomUUID(),
                "ask",
                "expenseItem",
                ask,
                0.78,
                "支出信息不完整，需要补充核心字段。",
                SkillRouter.EXPENSE_RECOGNITION_SKILL_ID
        );
    }

    private Map<String, Object> expensePersistenceContext(ExpensePersistenceResult result) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("saved", result.saved());
        values.put("duplicates", result.duplicates());
        values.put("needsInput", result.needsInput());
        values.put("readOnly", result.readOnly());
        values.put("savedCount", result.saved().size());
        values.put("duplicateCount", result.duplicates().size());
        values.put("needsInputCount", result.needsInput().size());
        values.put("readOnlyCount", result.readOnly().size());
        return values;
    }

    private List<AgentSource> collectSources(List<AgentToolResult> toolResults) {
        return toolResults.stream()
                .flatMap((result) -> listOrEmpty(result.sources()).stream())
                .toList();
    }

    private AgentRunRecord startAgentRunTrace(
            String traceId,
            String familyId,
            String userId,
            AgentChatRequest request,
            RuntimeModel plannerRuntimeModel,
            RuntimeModel runtimeModel
    ) {
        if (agentTraceService == null) return null;
        try {
            return agentTraceService.startAgentRun(
                    traceId,
                    familyId,
                    userId,
                    "",
                    inputType(request),
                    plannerRuntimeModel == null ? "" : plannerRuntimeModel.id(),
                    runtimeModel == null ? "" : runtimeModel.id()
            );
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to start agent trace. traceId={}, cause={}", traceId, rootCauseMessage(exception));
            return null;
        }
    }

    private void recordAgentPlanTrace(AgentRunRecord agentRun, AgentPlan plan, SkillPlan skillPlan) {
        if (agentTraceService == null || agentRun == null) return;
        try {
            agentTraceService.recordPlan(agentRun, plan, skillPlan);
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to update agent trace plan. traceId={}, cause={}", agentRun.getTraceId(), rootCauseMessage(exception));
        }
    }

    private void recordSkillRunTrace(AgentRunRecord agentRun, String traceId, ExpenseRecognitionResult result) {
        if (agentTraceService == null || result == null || result.traceSummary() == null) return;
        try {
            agentTraceService.recordSkillRun(agentRun == null ? null : agentRun.getId(), traceId, result.traceSummary());
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to record skill trace. traceId={}, cause={}", traceId, rootCauseMessage(exception));
        }
    }

    private void completeAgentRunTrace(AgentRunRecord agentRun, List<AgentEffectDecision> decisions) {
        if (agentTraceService == null || agentRun == null) return;
        try {
            agentTraceService.completeAgentRun(agentRun, decisions);
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to complete agent trace. traceId={}, cause={}", agentRun.getTraceId(), rootCauseMessage(exception));
        }
    }

    private void failAgentRunTrace(AgentRunRecord agentRun, String errorCode) {
        if (agentTraceService == null || agentRun == null) return;
        try {
            agentTraceService.failAgentRun(agentRun, errorCode);
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to fail agent trace. traceId={}, cause={}", agentRun.getTraceId(), rootCauseMessage(exception));
        }
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

}
