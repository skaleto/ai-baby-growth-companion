package com.xiaobao.babycompanion.agent;

import java.net.http.HttpClient;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekFunctionCall;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekResponseFormat;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekToolCall;
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

    private static final String AGENT_SYSTEM_PROMPT = """
            你是“小宝成长伙伴”的 agent runtime。你的性格温柔、克制、可靠，帮助孕期到宝宝 1 岁家庭整理日常聊天。
            你需要从用户输入中识别成长事件、喂养和睡眠照护日志、提醒事项、值得长期记住的信息，并生成简洁可执行的中文回复。
            健康、疫苗、用药相关内容只提供记录和低风险常识建议，必须提醒用户以医生或社区医院安排为准。
            不要做医疗诊断，不要替用户决定用药。

            你必须只返回一个合法 JSON 对象，不要返回 Markdown、代码块、解释文字或多余前后缀。
            JSON schema:
            {
              "aiText": "string",
              "tags": ["string"],
              "growthEvent": null | {
                "id": null,
                "type": "string",
                "title": "string",
                "date": "YYYY-MM-DD",
                "summary": "string",
                "firstTime": true,
                "mediaKind": null | "image" | "video" | "audio",
                "tags": ["string"]
              },
              "careLogPatch": null | {
                "id": null,
                "date": "YYYY-MM-DD",
                "milkMl": 600,
                "milkTimes": 5,
                "sleepHours": 2.5,
                "wakes": 3,
                "soothing": "easy|normal|hard",
                "solids": ["string"],
                "poop": "string",
                "temperature": 37.2,
                "notes": ["string"]
              },
              "reminders": [
                {
                  "id": null,
                  "title": "string",
                  "dueText": "string",
                  "category": "vaccine|routine|care|custom",
                  "recurrence": null,
                  "status": "open",
                  "createdAt": null,
                  "history": ["string"]
                }
              ],
              "memories": [
                {
                  "id": null,
                  "text": "string",
                  "category": "routine|preference|health|caregiver|concern",
                  "confidence": 0.75,
                  "updatedAt": null
                }
              ],
              "sources": [
                {
                  "title": "string",
                  "url": "string",
                  "snippet": "string"
                }
              ],
              "usedSkills": ["default-baby-companion"]
            }

            如果上下文包含 toolResults，必须基于工具结果回答；不要把未查询到的内容说成已确认事实。
            缺失的信息用 null 或空数组表示。不要臆造精确时间，用户只说“明天”时 dueText 保留“明天”。不要输出未在 schema 中声明的字段。
            """;

    private static final String TOOL_ROUTER_SYSTEM_PROMPT = """
            你是“小宝成长伙伴”的工具路由器。你只判断是否需要调用工具，不负责生成最终用户回复。
            当用户询问最新信息、地点政策、官方通知、当前状态、价格、天气、办事流程或任何需要外部资料验证的问题时，调用合适工具。
            当用户只是记录成长、喂养、睡眠、提醒、记忆，或询问不需要实时资料的低风险常识时，不调用工具。
            工具返回结果后，最终回答会由主 agent 生成。不要编造工具结果。
            """;

    private final DeepSeekProperties properties;
    private final DoubaoProperties doubaoProperties;
    private final ObjectMapper objectMapper;
    private final SkillRegistry skillRegistry;
    private final ToolRegistry toolRegistry;
    private final HttpClient httpClient;
    private final RestClient restClient;
    private final RestClient doubaoRestClient;

    public AgentRuntime(
            DeepSeekProperties properties,
            DoubaoProperties doubaoProperties,
            ObjectMapper objectMapper,
            SkillRegistry skillRegistry,
            ToolRegistry toolRegistry
    ) {
        this.properties = properties;
        this.doubaoProperties = doubaoProperties;
        this.objectMapper = objectMapper;
        this.skillRegistry = skillRegistry;
        this.toolRegistry = toolRegistry;
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
        RuntimeModel runtimeModel = resolveModel(request.model());
        String apiKey = resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }

        String traceId = "agent-" + UUID.randomUUID();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        List<AgentToolResult> toolResults = runModelSelectedTools(request, selectedSkills, traceId, runtimeModel, apiKey, null);
        List<String> usedSkills = usedSkillIds(selectedSkills, toolResults);

        DeepSeekChatRequest chatRequest = buildDeepSeekRequest(request, selectedSkills, toolResults, runtimeModel, traceId, false);

        try {
            DeepSeekChatResponse response = restClient(runtimeModel).post()
                    .uri(runtimeModel.chatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(chatRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException("DeepSeek returned an empty response");
            }

            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::contentAsText)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException("DeepSeek response did not include message content"));

            return parseModelContent(content, traceId, response.model(), response.id(), usedSkills, collectSources(toolResults));
        } catch (RestClientException exception) {
            throw new DeepSeekApiException("Failed to call DeepSeek API", exception);
        }
    }

    public SseEmitter stream(AgentChatRequest request) {
        RuntimeModel runtimeModel = resolveModel(request.model());
        String apiKey = resolvedApiKey(runtimeModel);
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException(runtimeModel.apiKeyHelp() + " is not configured");
        }

        String traceId = "agent-" + UUID.randomUUID();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        SseEmitter emitter = new SseEmitter(runtimeModel.readTimeout().plusSeconds(45).toMillis());

        CompletableFuture.runAsync(() -> streamAgentResponse(request, emitter, traceId, selectedSkills, runtimeModel, apiKey));
        return emitter;
    }

    private void streamAgentResponse(
            AgentChatRequest request,
            SseEmitter emitter,
            String traceId,
            List<Skill> selectedSkills,
            RuntimeModel runtimeModel,
            String apiKey
    ) {
        try {
            List<AgentToolResult> toolResults = runModelSelectedTools(
                    request,
                    selectedSkills,
                    traceId,
                    runtimeModel,
                    apiKey,
                    (event) -> sendEvent(emitter, "tool", event)
            );
            List<String> usedSkills = usedSkillIds(selectedSkills, toolResults);
            List<AgentSource> sources = collectSources(toolResults);

            String body = objectMapper.writeValueAsString(buildDeepSeekRequest(request, selectedSkills, toolResults, runtimeModel, traceId, true));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl(runtimeModel)))
                    .timeout(runtimeModel.readTimeout().plusSeconds(30))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            streamDeepSeekResponse(httpRequest, emitter, traceId, runtimeModel, usedSkills, sources);
        } catch (Exception exception) {
            sendEvent(emitter, "error", Map.of("message", exception.getMessage()));
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
                    sources.isEmpty() ? listOrEmpty(parsed.sources()) : sources,
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
            boolean stream
    ) {
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", AGENT_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildUserContent(request, selectedSkills, toolResults, runtimeModel, traceId), null, null)
                ),
                stream,
                properties.getAgentMaxTokens(),
                Math.min(properties.getTemperature(), 0.2),
                responseFormat(runtimeModel),
                thinkingConfig(request),
                null,
                null
        );
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
                        new DeepSeekMessage("system", TOOL_ROUTER_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildToolRouterPrompt(request, selectedSkills, traceId))
                ),
                false,
                600,
                0.0,
                null,
                Map.of("type", "disabled"),
                tools.stream().map(AgentTool::definition).toList(),
                likelyNeedsExternalLookup(request.message()) ? "required" : "auto"
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
        return message.matches(".*(查|查询|搜|搜索|联网|最新|政策|规定|官方|通知|价格|天气|哪里|地址|电话|办理|流程).*")
                || message.matches(".*(现在|当前|今天).*(天气|政策|规定|价格|新闻|通知).*");
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
            List<AgentSource> sources
    ) {
        StringBuilder content = new StringBuilder();
        AtomicReference<String> model = new AtomicReference<>(runtimeModel.apiModel());
        AtomicReference<String> requestId = new AtomicReference<>("");

        try {
            HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            try (Stream<String> lines = response.body()) {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    String errorBody = String.join("\n", lines.toList());
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
            sendEvent(emitter, "final", parsed);
            emitter.complete();
        } catch (Exception exception) {
            sendEvent(emitter, "error", Map.of("message", exception.getMessage()));
            emitter.complete();
        }
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
            sendEvent(emitter, "error", Map.of("message", "Failed to parse DeepSeek stream chunk"));
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

    private void sendEvent(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (Exception exception) {
            emitter.completeWithError(exception);
        }
    }

    private RuntimeModel resolveModel(String requestedModel) {
        String model = StringUtils.hasText(requestedModel) ? requestedModel.trim() : properties.getModel();
        return switch (model) {
            case "deepseek-v4-flash" -> new RuntimeModel(
                    "deepseek-v4-flash",
                    Provider.DEEPSEEK,
                    "deepseek-v4-flash",
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
                    properties.getBaseUrl(),
                    properties.getChatPath(),
                    properties.getReadTimeout(),
                    "DEEPSEEK_API_KEY"
            );
            case "doubao-seed-2.0-lite", "doubao-seed-2-0-lite-260215" -> new RuntimeModel(
                    "doubao-seed-2.0-lite",
                    Provider.DOUBAO,
                    doubaoProperties.getSeed20LiteModel(),
                    true,
                    doubaoProperties.getBaseUrl(),
                    doubaoProperties.getChatPath(),
                    doubaoProperties.getReadTimeout(),
                    "DOUBAO_API_KEY or ARK_API_KEY"
            );
            case "doubao-seed-2.0-pro", "doubao-seed-2-0-pro-260215" -> new RuntimeModel(
                    "doubao-seed-2.0-pro",
                    Provider.DOUBAO,
                    doubaoProperties.getSeed20ProModel(),
                    true,
                    doubaoProperties.getBaseUrl(),
                    doubaoProperties.getChatPath(),
                    doubaoProperties.getReadTimeout(),
                    "DOUBAO_API_KEY or ARK_API_KEY"
            );
            default -> throw new IllegalArgumentException("Unsupported agent model: " + model);
        };
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

    private String buildToolRouterPrompt(AgentChatRequest request, List<Skill> selectedSkills, String traceId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        context.put("today", LocalDate.now().toString());
        context.put("selectedSkills", selectedSkills);
        context.put("babyProfile", request.babyProfile());
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
            String traceId
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        context.put("today", LocalDate.now().toString());
        context.put("selectedSkills", selectedSkills);
        context.put("toolResults", toolResults);
        context.put("babyProfile", request.babyProfile());
        context.put("recentMessages", tail(request.recentMessages(), 12));
        context.put("careLogs", tail(request.careLogs(), 10));
        context.put("memories", tail(request.memories(), 10));
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
            String traceId
    ) {
        String prompt = buildUserPrompt(request, selectedSkills, toolResults, traceId);
        List<String> imageDataUrls = imageDataUrls(request.attachments(), runtimeModel);
        if (imageDataUrls.isEmpty()) return prompt;

        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt));
        imageDataUrls.forEach((dataUrl) -> content.add(Map.of(
                "type", "image_url",
                "image_url", Map.of("url", dataUrl)
        )));
        return content;
    }

    private List<Map<String, String>> attachmentSummaries(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .map((attachment) -> {
                    Map<String, String> summary = new LinkedHashMap<>();
                    if (StringUtils.hasText(attachment.id())) summary.put("id", attachment.id());
                    if (StringUtils.hasText(attachment.name())) summary.put("name", attachment.name());
                    if (StringUtils.hasText(attachment.kind())) summary.put("kind", attachment.kind());
                    if (StringUtils.hasText(attachment.dataUrl())) summary.put("contentStatus", "image-bytes-attached");
                    return summary;
                })
                .toList();
    }

    private List<String> imageDataUrls(List<AgentAttachment> attachments, RuntimeModel runtimeModel) {
        if (!runtimeModel.supportsImageInput() || attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .filter((attachment) -> "image".equals(attachment.kind()))
                .map(AgentAttachment::dataUrl)
                .filter((dataUrl) -> StringUtils.hasText(dataUrl) && dataUrl.startsWith("data:image/"))
                .limit(4)
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
                        selectedSkills.stream().map(Skill::id),
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
            String baseUrl,
            String chatPath,
            Duration readTimeout,
            String apiKeyHelp
    ) {
    }
}
