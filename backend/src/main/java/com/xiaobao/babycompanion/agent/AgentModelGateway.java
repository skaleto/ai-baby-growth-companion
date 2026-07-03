package com.xiaobao.babycompanion.agent;

import java.net.http.HttpClient;
import java.util.List;

import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekResponseFormat;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekUsage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * Single owner of the agent model/REST/usage plumbing (P3 phase 1 gateway).
 *
 * <p>Model resolution, provider API-key selection, the shared HttpClient/RestClient pair, the
 * outbound endpoint/service-tier/response-format decisions, final-composer tuning, AI usage logging
 * and the JSON-object extraction helper all live here ONCE. Both {@link AgentRuntime} (chat/stream/
 * visual/expense paths) and {@link ConversationSummaryService} (chat-compression path) depend on
 * this component so there is exactly one copy of this logic.
 *
 * <p>All method bodies were moved verbatim from {@code AgentRuntime} with no logic change.
 */
@Component
public class AgentModelGateway {

    private final DeepSeekProperties properties;
    private final DoubaoProperties doubaoProperties;
    private final AgentRuntimeProperties agentRuntimeProperties;
    private final AiUsageLogService aiUsageLogService;
    private final HttpClient httpClient;
    private final RestClient restClient;
    private final RestClient doubaoRestClient;

    @Autowired
    public AgentModelGateway(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            AgentRuntimeProperties agentRuntimeProperties,
            AiUsageLogService aiUsageLogService
    ) {
        this.properties = properties;
        this.doubaoProperties = doubaoProperties;
        this.agentRuntimeProperties = agentRuntimeProperties == null ? new AgentRuntimeProperties() : agentRuntimeProperties;
        this.aiUsageLogService = aiUsageLogService;
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

    // Test-friendly constructor: no usage logging.
    public AgentModelGateway(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            AgentRuntimeProperties agentRuntimeProperties
    ) {
        this(properties, doubaoProperties, agentRuntimeProperties, null);
    }

    /** Shared JDK HttpClient used for streaming reads by {@link AgentRuntime}. */
    HttpClient httpClient() {
        return httpClient;
    }

    RuntimeModel resolveModel(String requestedModel) {
        return resolveModel(requestedModel, false);
    }

    RuntimeModel resolveModel(String requestedModel, boolean lowLatencyEnabled) {
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

    RuntimeModel resolvePlannerModel() {
        String configured = agentRuntimeProperties.getModels().getPlanner().getModel();
        return resolveModel(StringUtils.hasText(configured) ? configured : properties.getPlannerModel());
    }

    RuntimeModel resolveExpenseRecognitionModel(RuntimeModel fallback) {
        String configured = agentRuntimeProperties.getModels().getExpenseRecognition().getModel();
        if (StringUtils.hasText(configured)) {
            return resolveModel(configured.trim(), false);
        }
        if (fallback != null && fallback.supportsImageInput()) {
            return fallback;
        }
        return resolveModel("doubao-seed-2.0-pro", false);
    }

    RuntimeModel resolveFinalComposerModel(
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

    int finalComposerMaxTokens() {
        Integer configured = agentRuntimeProperties.getModels().getFinalComposer().getMaxTokens();
        return configured == null || configured <= 0 ? properties.getAgentMaxTokens() : configured;
    }

    double finalComposerTemperature() {
        Double configured = agentRuntimeProperties.getModels().getFinalComposer().getTemperature();
        if (configured == null || configured < 0) return Math.min(properties.getTemperature(), 0.2);
        return Math.max(0.0, Math.min(1.0, configured));
    }

    String resolvedApiKey(RuntimeModel runtimeModel) {
        return switch (runtimeModel.provider()) {
            case DEEPSEEK -> properties.getResolvedApiKey();
            case DOUBAO -> doubaoProperties.getResolvedApiKey();
        };
    }

    RestClient restClient(RuntimeModel runtimeModel) {
        return switch (runtimeModel.provider()) {
            case DEEPSEEK -> restClient;
            case DOUBAO -> doubaoRestClient;
        };
    }

    String endpointUrl(RuntimeModel runtimeModel) {
        return runtimeModel.baseUrl().replaceAll("/+$", "") + runtimeModel.chatPath();
    }

    String serviceTier(RuntimeModel runtimeModel) {
        if (runtimeModel.provider() != Provider.DOUBAO || !runtimeModel.lowLatencyEnabled()) return null;
        return StringUtils.hasText(doubaoProperties.getLowLatencyServiceTier())
                ? doubaoProperties.getLowLatencyServiceTier()
                : "fast";
    }

    DeepSeekResponseFormat responseFormat(RuntimeModel runtimeModel) {
        return runtimeModel.provider() == Provider.DEEPSEEK ? new DeepSeekResponseFormat("json_object") : null;
    }

    void recordUsage(
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

    String extractJsonObject(String content) {
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
}
