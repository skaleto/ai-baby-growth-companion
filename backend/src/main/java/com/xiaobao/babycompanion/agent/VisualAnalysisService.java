package com.xiaobao.babycompanion.agent;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Visual-analysis vertical extracted verbatim from {@link AgentRuntime} (P3 phase 2).
 *
 * <p>Owns the "analyze image/video attachments" concern: preparing visual attachment inputs
 * (including expense-evidence fallbacks from recent messages), batching them, calling the vision
 * model for per-batch OCR/visual summaries, and the small helpers that count/describe visual
 * attachments. All method bodies were moved byte-for-byte from {@code AgentRuntime} with no logic
 * change.
 *
 * <p>Model/REST/usage plumbing (model selection, RestClient, usage logging, service tier) comes
 * from the shared {@link AgentModelGateway}. The only local plumbing is the trivial SSE transport
 * helpers ({@code sendStatusEvent}/{@code sendEvent}) and the small utility helpers
 * ({@code inputType}/{@code rootCauseMessage}/{@code listOrEmpty}/{@code abbreviate}) that mirror
 * {@code AgentRuntime}'s own — these are not the model-gateway concern.
 */
@Component
public class VisualAnalysisService {

    private static final Logger LOGGER = LoggerFactory.getLogger(VisualAnalysisService.class);
    private static final int MAX_AGENT_VISUAL_ATTACHMENTS = 8;
    private static final int VISUAL_ANALYSIS_BATCH_SIZE = 4;

    private final AgentModelGateway modelGateway;
    private final ObjectMapper objectMapper;
    private final AttachmentStorageService attachmentStorageService;

    @Autowired
    public VisualAnalysisService(
            AgentModelGateway modelGateway,
            ObjectMapper objectMapper,
            AttachmentStorageService attachmentStorageService
    ) {
        this.modelGateway = modelGateway;
        this.objectMapper = objectMapper;
        this.attachmentStorageService = attachmentStorageService;
    }

    // ---------------------------------------------------------------------------------------------
    // Visual-attachment counting — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

    int potentialVisualAttachmentCount(AgentChatRequest request) {
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

    // ---------------------------------------------------------------------------------------------
    // Batched visual analysis — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

    List<VisualAnalysisResult> analyzeVisualInputsInBatches(
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
                DeepSeekChatResponse response = modelGateway.restClient(runtimeModel).post()
                        .uri(runtimeModel.chatPath())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .body(analysisRequest)
                        .retrieve()
                        .body(DeepSeekChatResponse.class);
                if (response == null || response.choices() == null || response.choices().isEmpty()) {
                    throw new DeepSeekApiException(runtimeModel.id() + " visual analysis returned an empty response");
                }
                modelGateway.recordUsage(runtimeModel, "agent_visual_analysis", inputType(request), familyId, userId, response.id(), response.usage(), true, null, false, true);
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
                modelGateway.recordUsage(runtimeModel, "agent_visual_analysis", inputType(request), familyId, userId, traceId + "-visual-" + batchNumber, null, false, rootCauseMessage(exception), false, true);
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
                modelGateway.serviceTier(runtimeModel)
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

    // ---------------------------------------------------------------------------------------------
    // Visual-input preparation — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

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

    // ---------------------------------------------------------------------------------------------
    // Media status message — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

    String analyzingMediaMessage(List<VisualAttachmentInput> visualInputs) {
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

    // ---------------------------------------------------------------------------------------------
    // Local SSE transport + small utility helpers — mirror AgentRuntime's (not the gateway concern).
    // ---------------------------------------------------------------------------------------------

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
