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
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.agent.action.AgentActionContext;
import com.xiaobao.babycompanion.agent.action.AgentActionExecutor;
import com.xiaobao.babycompanion.agent.action.AgentActionResponseGuard;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import com.xiaobao.babycompanion.agent.action.AgentActionTool;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentBabyProfile;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.persistence.entity.AgentRunRecord;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekFunctionCall;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekToolCall;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class AgentRuntime {

    private static final Logger LOGGER = LoggerFactory.getLogger(AgentRuntime.class);
    private static final int MAX_AGENT_VISUAL_ATTACHMENTS = 8;
    private static final int VISUAL_ANALYSIS_BATCH_SIZE = 4;

    private final DoubaoProperties doubaoProperties;
    private final AgentRuntimeProperties agentRuntimeProperties;
    private final ObjectMapper objectMapper;
    private final AgentPlanner agentPlanner;
    private final AgentContextService agentContextService;
    private final AppStateService appStateService;
    private final AgentModelGateway modelGateway;
    private final VisualAnalysisService visualAnalysisService;
    private final CurrentUser currentUser;
    private final SkillRegistry skillRegistry;
    private final SkillDisclosureService skillDisclosureService;
    private final SkillRouter skillRouter;
    private final ExpenseRecognitionSkill expenseRecognitionSkill;
    private final AgentTraceService agentTraceService;
    private final ToolRegistry toolRegistry;
    private final AgentActionExecutor agentActionExecutor;
    private final AgentActionResponseGuard agentActionResponseGuard;
    private final SafetyGuard safetyGuard;
    private final Executor agentStreamExecutor;
    private final Clock clock;
    private final HttpClient httpClient;

    public AgentRuntime(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            ObjectMapper objectMapper,
            AgentPlanner agentPlanner,
            AgentContextService agentContextService,
            AppStateService appStateService,
            AttachmentStorageService attachmentStorageService,
            CurrentUser currentUser,
            SkillRegistry skillRegistry,
            SkillDisclosureService skillDisclosureService,
            ToolRegistry toolRegistry,
            SafetyGuard safetyGuard
    ) {
        this(
                doubaoProperties,
                objectMapper,
                agentPlanner,
                agentContextService,
                appStateService,
                currentUser,
                skillRegistry,
                skillDisclosureService,
                new AgentRuntimeProperties(),
                new SkillRouter(skillDisclosureService),
                new ExpenseRecognitionSkill(objectMapper),
                null,
                toolRegistry,
                safetyGuard,
                liteModelGateway(properties, doubaoProperties),
                new VisualAnalysisService(liteModelGateway(properties, doubaoProperties), objectMapper, attachmentStorageService),
                Runnable::run,
                Clock.system(ZoneId.of("Asia/Shanghai"))
        );
    }

    private static AgentModelGateway liteModelGateway(DeepSeekProperties properties, DoubaoProperties doubaoProperties) {
        return new AgentModelGateway(properties, doubaoProperties, new AgentRuntimeProperties(), null);
    }

    @Autowired
    public AgentRuntime(
            DoubaoProperties doubaoProperties,
            ObjectMapper objectMapper,
            AgentPlanner agentPlanner,
            AgentContextService agentContextService,
            AppStateService appStateService,
            CurrentUser currentUser,
            SkillRegistry skillRegistry,
            SkillDisclosureService skillDisclosureService,
            AgentRuntimeProperties agentRuntimeProperties,
            SkillRouter skillRouter,
            ExpenseRecognitionSkill expenseRecognitionSkill,
            AgentTraceService agentTraceService,
            ToolRegistry toolRegistry,
            SafetyGuard safetyGuard,
            AgentModelGateway modelGateway,
            VisualAnalysisService visualAnalysisService,
            @Qualifier("agentStreamExecutor") Executor agentStreamExecutor,
            Clock clock
    ) {
        this.doubaoProperties = doubaoProperties;
        this.agentRuntimeProperties = agentRuntimeProperties == null ? new AgentRuntimeProperties() : agentRuntimeProperties;
        this.objectMapper = objectMapper;
        this.agentPlanner = agentPlanner;
        this.agentContextService = agentContextService;
        this.appStateService = appStateService;
        this.modelGateway = modelGateway;
        this.visualAnalysisService = visualAnalysisService;
        this.currentUser = currentUser;
        this.skillRegistry = skillRegistry;
        this.skillDisclosureService = skillDisclosureService;
        this.skillRouter = skillRouter;
        this.expenseRecognitionSkill = expenseRecognitionSkill;
        this.agentTraceService = agentTraceService;
        this.toolRegistry = toolRegistry;
        this.agentActionExecutor = new AgentActionExecutor(objectMapper);
        this.agentActionResponseGuard = new AgentActionResponseGuard();
        this.safetyGuard = safetyGuard;
        this.agentStreamExecutor = agentStreamExecutor;
        this.clock = clock;
        this.httpClient = modelGateway.httpClient();
    }

    public AgentChatResponse chat(AgentChatRequest request) {
        RuntimeModel runtimeModel = modelGateway.resolveModel(request.model(), Boolean.TRUE.equals(request.lowLatencyEnabled()));
        RuntimeModel plannerRuntimeModel = modelGateway.resolvePlannerModel();
        String apiKey = modelGateway.resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }
        String plannerApiKey = modelGateway.resolvedApiKey(plannerRuntimeModel);
        if (!StringUtils.hasText(plannerApiKey)) {
            throw new IllegalStateException(plannerRuntimeModel.apiKeyHelp() + " is not configured for agent planning");
        }

        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String traceId = "agent-" + UUID.randomUUID();
        AgentRunRecord agentRun = startAgentRunTrace(traceId, familyId, principal.userId(), request, plannerRuntimeModel, runtimeModel);
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        RecordSignals signals = RecordSignals.empty();
        AgentPlan plan = runPlanner(request, selectedSkills, signals, plannerRuntimeModel, plannerApiKey, familyId, principal.userId());
        AgentContextSnapshot contextSnapshot = agentContextService.build(familyId, principal.userId(), request, plan, signals);
        SkillPlan skillPlan = skillRouter == null ? SkillPlan.empty() : skillRouter.plan(request, plan, signals);
        recordAgentPlanTrace(agentRun, plan, skillPlan);
        RuntimeModel expenseRuntimeModel = modelGateway.resolveExpenseRecognitionModel(runtimeModel);
        List<VisualAttachmentInput> visualInputs = visualAnalysisService.visualInputsForSkillExecution(
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
        AgentActionContext actionContext = new AgentActionContext(traceId, familyId, principal.userId(), clock, contextSnapshot.babyProfile());
        List<AgentToolResult> toolResults = runModelSelectedTools(request, selectedSkills, traceId, runtimeModel, apiKey, actionContext, null);
        if (toolResults.isEmpty()) {
            toolResults = executePlannedTools(plan, request, null);
        }
        List<AgentActionResult> actionResults = agentActionExecutor.actionResults(toolResults);
        List<String> usedSkills = mergeSkillIds(usedSkillIds(selectedSkills, toolResults, plan, signals, request.message()), skillPlan);
        List<VisualAnalysisResult> visualAnalysisResults = expenseRecognitionResult == null
                ? visualAnalysisService.analyzeVisualInputsInBatches(
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
        boolean expensePendingIntent = shouldCreateExpensePending(request.message(), plan, skillPlan);
        List<AgentActionResult> expenseActionResults = expenseRecognitionActionResults(
                expenseRecognitionResult,
                expensePendingIntent,
                traceId,
                familyId,
                principal.userId()
        );
        actionResults = mergeActionResults(actionResults, expenseActionResults);

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
                actionResults
        );

        try {
            DeepSeekChatResponse response = modelGateway.restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(chatRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException(runtimeModel.id() + " returned an empty response");
            }
            modelGateway.recordUsage(runtimeModel, "agent_chat", inputType(request), familyId, principal.userId(), response.id(), response.usage(), true, null, false, true);

            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException(runtimeModel.id() + " response did not include message content"));

            AgentChatResponse finalResponse = withSafetyAlertsAndActionResults(
                    parseModelContent(content, traceId, response.model(), response.id(), usedSkills, collectSources(toolResults)),
                    request.message(),
                    actionResults
            );
            completeAgentRunTrace(agentRun, finalResponse.effectDecisions());
            return finalResponse;
        } catch (RestClientException exception) {
            modelGateway.recordUsage(runtimeModel, "agent_chat", inputType(request), familyId, principal.userId(), traceId, null, false, rootCauseMessage(exception), false, true);
            AgentChatResponse fallbackResponse = actionResultFallbackResponse(
                    request.message(),
                    actionResults,
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
            AgentChatResponse fallbackResponse = actionResultFallbackResponse(
                    request.message(),
                    actionResults,
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
        RuntimeModel runtimeModel = modelGateway.resolveModel(request.model(), Boolean.TRUE.equals(request.lowLatencyEnabled()));
        RuntimeModel plannerRuntimeModel = modelGateway.resolvePlannerModel();
        String apiKey = modelGateway.resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }
        String plannerApiKey = modelGateway.resolvedApiKey(plannerRuntimeModel);
        if (!StringUtils.hasText(plannerApiKey)) {
            throw new IllegalStateException(plannerRuntimeModel.apiKeyHelp() + " is not configured for agent planning");
        }

        String traceId = "agent-" + UUID.randomUUID();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        AgentRunRecord agentRun = startAgentRunTrace(traceId, familyId, principal.userId(), request, plannerRuntimeModel, runtimeModel);
        RuntimeModel expenseRuntimeModel = modelGateway.resolveExpenseRecognitionModel(runtimeModel);
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
        int visualCount = visualAnalysisService.potentialVisualAttachmentCount(request);
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
            RecordSignals signals = RecordSignals.empty();
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
            RuntimeModel expenseRuntimeModel = modelGateway.resolveExpenseRecognitionModel(runtimeModel);
            List<VisualAttachmentInput> visualInputs = visualAnalysisService.visualInputsForSkillExecution(
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
            AgentActionContext actionContext = new AgentActionContext(traceId, familyId, principal.userId(), clock, contextSnapshot.babyProfile());
            List<AgentToolResult> toolResults = runModelSelectedTools(
                    request,
                    selectedSkills,
                    traceId,
                    runtimeModel,
                    apiKey,
                    actionContext,
                    (event) -> sendEvent(emitter, "tool", event)
            );
            if (toolResults.isEmpty()) {
                toolResults = executePlannedTools(plan, request, (event) -> sendEvent(emitter, "tool", event));
            }
            List<AgentActionResult> actionResults = agentActionExecutor.actionResults(toolResults);
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "tools")) return;
            List<String> usedSkills = mergeSkillIds(usedSkillIds(selectedSkills, toolResults, plan, signals, request.message()), skillPlan);
            List<AgentSource> sources = collectSources(toolResults);
            List<VisualAnalysisResult> visualAnalysisResults = expenseRecognitionResult == null
                    ? visualAnalysisService.analyzeVisualInputsInBatches(
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
            boolean expensePendingIntent = shouldCreateExpensePending(request.message(), plan, skillPlan);
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "before_expense_pending")) return;
            if (expenseRecognitionResult != null && expensePendingIntent && !expenseRecognitionResult.effectCandidates().isEmpty()) {
                sendProgressEvent(emitter, "expense-pending", "running", "整理账本待确认草稿");
                sendStatusEvent(emitter, "generating", "正在整理账本草稿");
            }
            List<AgentActionResult> expenseActionResults = expenseRecognitionActionResults(
                    expenseRecognitionResult,
                    expensePendingIntent,
                    traceId,
                    familyId,
                    principal.userId()
            );
            actionResults = mergeActionResults(actionResults, expenseActionResults);
            if (expenseActionResults.stream().anyMatch((result) -> "pending_created".equals(result.status()))) {
                sendProgressEvent(emitter, "expense-pending", "completed", "账本待确认草稿已整理");
            } else if (expenseRecognitionResult != null && expensePendingIntent && !expenseRecognitionResult.effectCandidates().isEmpty()) {
                sendProgressEvent(emitter, "expense-pending", "completed", "账本草稿已由后续确认处理");
            }
            if (stopStreamIfCancelled(cancelled, agentRun, traceId, "after_expense_pending")) return;
            sendModelWorkStatus(emitter, finalVisualInputs, visualAnalysisResults);
            sendProgressEvent(emitter, "final-composer", "running", "生成最终回复");

            RuntimeModel finalRuntimeModel = modelGateway.resolveFinalComposerModel(plan, visualInputs, toolResults, runtimeModel);
            String finalApiKey = modelGateway.resolvedApiKey(finalRuntimeModel);
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
                    actionResults
            ));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(modelGateway.endpointUrl(finalRuntimeModel)))
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
                    familyId,
                    principal.userId(),
                    inputType(request),
                    actionResults,
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
            AgentChatResponse parsed = objectMapper.readValue(modelGateway.extractJsonObject(content), AgentChatResponse.class);
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
            List<AgentActionResult> actionResults
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
                                actionResults
                        ), null, null)
                ),
                stream,
                modelGateway.finalComposerMaxTokens(),
                modelGateway.finalComposerTemperature(),
                modelGateway.responseFormat(runtimeModel),
                thinkingConfig(request),
                null,
                null,
                modelGateway.serviceTier(runtimeModel)
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
            DeepSeekChatResponse response = modelGateway.restClient(plannerRuntimeModel).post()
                    .uri(plannerRuntimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(plannerRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response != null) {
                modelGateway.recordUsage(plannerRuntimeModel, "agent_planner", inputType(request), familyId, userId, response.id(), response.usage(), true, null, false, true);
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
            modelGateway.recordUsage(plannerRuntimeModel, "agent_planner", inputType(request), familyId, userId, "planner-" + UUID.randomUUID(), null, false, rootCauseMessage(exception), false, true);
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
        String expenseApiKey = modelGateway.resolvedApiKey(expenseRuntimeModel);
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
            DeepSeekChatResponse response = modelGateway.restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(modelRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);
            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException(runtimeModel.id() + " expense recognition returned an empty response");
            }
            modelGateway.recordUsage(runtimeModel, "agent_expense_recognition", inputType(originalRequest), familyId, userId, response.id(), response.usage(), true, null, false, true);
            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException(runtimeModel.id() + " expense recognition did not include message content"));
            return new ExpenseRecognitionModelResponse(response.id(), response.model(), content, response.usage());
        } catch (RuntimeException exception) {
            modelGateway.recordUsage(runtimeModel, "agent_expense_recognition", inputType(originalRequest), familyId, userId, traceId + "-expense-" + batchNumber, null, false, rootCauseMessage(exception), false, true);
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
            AgentActionContext actionContext,
            ToolEventSink eventSink
    ) {
        List<AgentTool> tools = toolRegistry.availableTools();
        if (tools.isEmpty()) return List.of();

        DeepSeekChatRequest toolRoutingRequest = buildToolRoutingRequest(request, selectedSkills, tools, runtimeModel, traceId);
        try {
            DeepSeekChatResponse response = modelGateway.restClient(runtimeModel).post()
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
            return executeToolCalls(toolCalls, request, actionContext, eventSink);
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
                likelyNeedsExternalLookup(request.message()) || likelyNeedsAgentAction(request.message()) ? "required" : "auto",
                modelGateway.serviceTier(runtimeModel)
        );
    }

    private boolean likelyNeedsAgentAction(String message) {
        if (!StringUtils.hasText(message)) return false;
        String text = message.trim();
        return text.matches(".*(喝了|喝完|奶量|睡了|睡醒|便便|拉了|尿了|换尿布|体温|发烧|身高|体重|头围|里程碑|第一次).*")
                || text.matches(".*(买|花了|支出|记账|账本).*(\\d+|[一二三四五六七八九十百]+).*")
                || text.matches(".*(\\d+(\\.\\d+)?\\s*(ml|毫升|cm|厘米|kg|公斤|斤|元|块)).*");
    }

    private List<AgentToolResult> executeToolCalls(
            List<DeepSeekToolCall> toolCalls,
            AgentChatRequest request,
            AgentActionContext actionContext,
            ToolEventSink eventSink
    ) {
        return toolCalls.stream()
                .limit(3)
                .map((toolCall) -> executeToolCall(toolCall, request, actionContext, eventSink))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<AgentToolResult> executeToolCall(
            DeepSeekToolCall toolCall,
            AgentChatRequest request,
            AgentActionContext actionContext,
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
                        AgentToolResult result = tool instanceof AgentActionTool actionTool
                                ? agentActionExecutor.execute(actionTool, call, actionContext)
                                : tool.execute(call, request);
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

    private void streamDeepSeekResponse(
            HttpRequest request,
            SseEmitter emitter,
            String traceId,
            RuntimeModel runtimeModel,
            List<String> usedSkills,
            List<AgentSource> sources,
            String userMessage,
            String familyId,
            String userId,
            String inputType,
            List<AgentActionResult> actionResults,
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
                    modelGateway.recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, traceId, null, false, "HTTP_" + response.statusCode(), false, true);
                    AgentChatResponse fallbackResponse = actionResultFallbackResponse(
                            userMessage,
                            actionResults,
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
            modelGateway.recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, requestId.get(), null, true, null, false, true);
            AgentChatResponse finalResponse = withSafetyAlertsAndActionResults(parsed, userMessage, actionResults);
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
            modelGateway.recordUsage(runtimeModel, "agent_stream", inputType, familyId, userId, traceId, null, false, rootCauseMessage(exception), false, true);
            AgentChatResponse fallbackResponse = actionResultFallbackResponse(
                    userMessage,
                    actionResults,
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

    AgentChatResponse actionResultFallbackResponse(
            String userMessage,
            List<AgentActionResult> actionResults,
            List<String> usedSkills,
            String traceId,
            String model,
            String requestId,
            List<AgentSource> sources
    ) {
        List<AgentActionResult> results = listOrEmpty(actionResults);
        if (results.isEmpty()) return null;
        String text = results.stream()
                .map(AgentActionResult::userMessage)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("这次操作已经处理，但最终回复生成失败，可以稍后查看记录。");
        AgentChatResponse base = new AgentChatResponse(
                text,
                List.of("已处理"),
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
        return withSafetyAlertsAndActionResults(base, userMessage, results);
    }

    AgentChatResponse withSafetyAlertsAndActionResults(
            AgentChatResponse response,
            String userMessage,
            List<AgentActionResult> actionResults
    ) {
        var alerts = safetyGuard.assess(userMessage, response.aiText());
        String groundedText = agentActionResponseGuard.groundFinalText(response.aiText(), actionResults);
        return new AgentChatResponse(
                groundedText,
                response.tags(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                response.sources(),
                alerts.isEmpty() ? response.safetyAlerts() : alerts,
                List.of(),
                response.usedSkills(),
                response.traceId(),
                response.model(),
                response.requestId()
        );
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
        sendStatusEvent(emitter, "analyzing_media", visualAnalysisService.analyzingMediaMessage(visualInputs));
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

    private String inputType(AgentChatRequest request) {
        if (request == null || request.attachments() == null || request.attachments().isEmpty()) return "text";
        boolean hasVideo = request.attachments().stream().anyMatch((attachment) -> "video".equals(attachment.kind()));
        if (hasVideo) return "video";
        boolean hasImage = request.attachments().stream().anyMatch((attachment) -> "image".equals(attachment.kind()));
        if (hasImage) return "image";
        boolean hasAudio = request.attachments().stream().anyMatch((attachment) -> "audio".equals(attachment.kind()));
        return hasAudio ? "audio" : "text";
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
            List<AgentActionResult> actionResults
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
        context.put("actionResults", listOrEmpty(actionResults));
        context.put(
                "actionResultUsageRule",
                "actionResults 是本轮已执行工具/受控写入的事实来源。只有 status=applied 才能说已记录/已保存；只有 status=pending_created 才能说已整理成待确认草稿；status=needs_input 时要追问 missingFields。"
        );
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
            List<AgentActionResult> actionResults
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
                actionResults
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

    boolean shouldCreateExpensePending(String message, AgentPlan plan, SkillPlan skillPlan) {
        if (hasExpenseRecordingIntent(message)) return true;
        if (plan == null || skillPlan == null || !skillPlan.executes(SkillRouter.EXPENSE_RECOGNITION_SKILL_ID)) return false;
        boolean plannerRecordIntent = "record".equalsIgnoreCase(plan.intent());
        boolean plannerExpenseTopic = listOrEmpty(plan.topics()).stream().anyMatch((topic) -> "expense".equalsIgnoreCase(topic));
        return plannerRecordIntent && plannerExpenseTopic;
    }

    List<AgentActionResult> expenseRecognitionActionResults(
            ExpenseRecognitionResult result,
            boolean shouldCreatePending,
            String traceId,
            String familyId,
            String userId
    ) {
        if (result == null || !shouldCreatePending) return List.of();
        if (result.effectCandidates().isEmpty()) {
            if (!result.clarifications().isEmpty()) {
                return List.of(AgentActionResult.needsInput(
                        "expense_recognition",
                        "pending_effect",
                        result.clarifications().get(0),
                        List.of("amount", "date", "purpose")
                ));
            }
            if (StringUtils.hasText(result.userFacingError())) {
                return List.of(AgentActionResult.failed(
                        "expense_recognition",
                        "pending_effect",
                        result.userFacingError(),
                        result.status()
                ));
            }
            return List.of();
        }
        if (appStateService == null) {
            return List.of(AgentActionResult.failed(
                    "expense_recognition",
                    "pending_effect",
                    "账本草稿暂时没有保存成功，可以稍后再试。",
                    "missing_app_state_service"
            ));
        }
        ArrayNode expenses = objectMapper.createArrayNode();
        result.effectCandidates().stream()
                .map(AgentEffectDecision::payload)
                .filter((payload) -> payload != null && payload.isObject())
                .map((payload) -> (ObjectNode) payload.deepCopy())
                .forEach((expense) -> {
                    if (!StringUtils.hasText(nodeText(expense, "id", ""))) {
                        expense.put("id", "expense-" + stableExpenseSignature(expense));
                    }
                    expense.put("source", "agent");
                    expenses.add(expense);
                });
        if (expenses.isEmpty()) return List.of();
        String pendingId = "pending-effect:expense-recognition:%s:%s".formatted(familyId, stableExpenseSignature(expenses));
        ObjectNode pending = objectMapper.createObjectNode();
        pending.put("id", pendingId);
        pending.put("domain", "ledger");
        pending.put("status", "pending");
        pending.put("createdAt", Instant.now(clock).toString());
        pending.putArray("tags").add("账本");
        pending.set("expenses", expenses);
        ObjectNode source = pending.putObject("source");
        source.put("kind", "agent_action");
        source.put("traceId", traceId);
        source.put("toolCallId", "expense-recognition:" + stableExpenseSignature(expenses));
        source.put("toolName", "expense_recognition");
        source.put("idempotencyKey", stableExpenseSignature(expenses));
        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("expenses", expenses.deepCopy());
        pending.set("payload", payload);
        appStateService.upsertAgentPendingEffect(familyId, userId, pending);
        return List.of(new AgentActionResult(
                "pending_created",
                "expense_recognition",
                "pending_effect",
                List.of(),
                pendingId,
                Map.of("expenseCount", expenses.size()),
                "已整理成待确认账本草稿。",
                List.of(),
                List.of()
        ));
    }

    private List<AgentActionResult> mergeActionResults(
            List<AgentActionResult> left,
            List<AgentActionResult> right
    ) {
        return Stream.concat(listOrEmpty(left).stream(), listOrEmpty(right).stream()).toList();
    }

    private String stableExpenseSignature(JsonNode node) {
        if (node == null || node.isNull()) return "empty";
        String raw;
        if (node instanceof ArrayNode array) {
            List<String> parts = new ArrayList<>();
            array.forEach((item) -> parts.add(stableExpenseSignature(item)));
            raw = String.join("|", parts);
        } else {
            raw = String.join(
                    "|",
                    nodeText(node, "dedupeKey", ""),
                    nodeText(node, "sourceExpenseKey", ""),
                    nodeText(node, "date", ""),
                    nodeText(node, "title", ""),
                    node.path("amount").asText(""),
                    nodeText(node, "merchant", "")
            );
            if (!StringUtils.hasText(raw.replace("|", ""))) raw = node.toString();
        }
        return Integer.toHexString(raw.hashCode());
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
