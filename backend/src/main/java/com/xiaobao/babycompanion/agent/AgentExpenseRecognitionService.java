package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.persistence.entity.AgentRunRecord;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Expense-recognition orchestration vertical extracted verbatim from {@link AgentRuntime}
 * (P3 phase 3).
 *
 * <p>Orchestrates the {@link ExpenseRecognitionSkill}: runs the skill (batched vision/text model
 * calls via {@link AgentModelGateway}), streams progress events, records the skill-run trace, and
 * turns recognized expenses into a pending-effect draft / needs-input / failure
 * {@link AgentActionResult}. All method bodies were moved byte-for-byte from {@code AgentRuntime}
 * with no logic change.
 *
 * <p>Named {@code AgentExpenseRecognitionService} to distinguish it from the
 * {@link ExpenseRecognitionSkill} it orchestrates. Model/REST/usage plumbing comes from the shared
 * {@link AgentModelGateway}; the only local plumbing is the trivial SSE transport helpers
 * ({@code sendProgressEvent}/{@code sendStatusEvent}/{@code sendEvent}) and the small utility
 * helpers ({@code inputType}/{@code rootCauseMessage}/{@code listOrEmpty}/{@code nodeText}/
 * {@code abbreviate}) that mirror {@code AgentRuntime}'s own — these are not the gateway concern.
 */
@Component
public class AgentExpenseRecognitionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AgentExpenseRecognitionService.class);

    private final AgentModelGateway modelGateway;
    private final ExpenseRecognitionSkill expenseRecognitionSkill;
    private final ObjectMapper objectMapper;
    private final AppStateService appStateService;
    private final AgentRuntimeProperties agentRuntimeProperties;
    private final AgentTraceService agentTraceService;
    private final Executor agentStreamExecutor;
    private final Clock clock;

    @Autowired
    public AgentExpenseRecognitionService(
            AgentModelGateway modelGateway,
            ExpenseRecognitionSkill expenseRecognitionSkill,
            ObjectMapper objectMapper,
            AppStateService appStateService,
            AgentRuntimeProperties agentRuntimeProperties,
            AgentTraceService agentTraceService,
            @Qualifier("agentStreamExecutor") Executor agentStreamExecutor,
            Clock clock
    ) {
        this.modelGateway = modelGateway;
        this.expenseRecognitionSkill = expenseRecognitionSkill;
        this.objectMapper = objectMapper;
        this.appStateService = appStateService;
        this.agentRuntimeProperties = agentRuntimeProperties == null ? new AgentRuntimeProperties() : agentRuntimeProperties;
        this.agentTraceService = agentTraceService;
        this.agentStreamExecutor = agentStreamExecutor;
        this.clock = clock;
    }

    // ---------------------------------------------------------------------------------------------
    // Expense-recognition orchestration — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

    ExpenseRecognitionResult executeExpenseRecognition(
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

    private void recordSkillRunTrace(AgentRunRecord agentRun, String traceId, ExpenseRecognitionResult result) {
        if (agentTraceService == null || result == null || result.traceSummary() == null) return;
        try {
            agentTraceService.recordSkillRun(agentRun == null ? null : agentRun.getId(), traceId, result.traceSummary());
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to record skill trace. traceId={}, cause={}", traceId, rootCauseMessage(exception));
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Local SSE transport + small utility helpers — mirror AgentRuntime's (not the gateway concern).
    // ---------------------------------------------------------------------------------------------

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

    private void sendStatusEvent(SseEmitter emitter, String name, String message) {
        if (emitter == null) return;
        Map<String, String> event = Map.of("message", message);
        sendEvent(emitter, name, event);
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

    private String inputType(AgentChatRequest request) {
        if (request == null || request.attachments() == null || request.attachments().isEmpty()) return "text";
        boolean hasVideo = request.attachments().stream().anyMatch((attachment) -> "video".equals(attachment.kind()));
        if (hasVideo) return "video";
        boolean hasImage = request.attachments().stream().anyMatch((attachment) -> "image".equals(attachment.kind()));
        if (hasImage) return "image";
        boolean hasAudio = request.attachments().stream().anyMatch((attachment) -> "audio".equals(attachment.kind()));
        return hasAudio ? "audio" : "text";
    }

    private String nodeText(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private <T> List<T> listOrEmpty(List<T> items) {
        return items == null ? List.of() : items;
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
