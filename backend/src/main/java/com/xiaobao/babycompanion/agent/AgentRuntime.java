package com.xiaobao.babycompanion.agent;

import java.net.http.HttpClient;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
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
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekResponseFormat;
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
              "usedSkills": ["default-baby-companion"]
            }

            缺失的信息用 null 或空数组表示。不要臆造精确时间，用户只说“明天”时 dueText 保留“明天”。不要输出未在 schema 中声明的字段。
            """;

    private final DeepSeekProperties properties;
    private final ObjectMapper objectMapper;
    private final SkillRegistry skillRegistry;
    private final HttpClient httpClient;
    private final RestClient restClient;

    public AgentRuntime(DeepSeekProperties properties, ObjectMapper objectMapper, SkillRegistry skillRegistry) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.skillRegistry = skillRegistry;
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
    }

    public AgentChatResponse chat(AgentChatRequest request) {
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("DEEPSEEK_API_KEY is not configured");
        }

        String traceId = "agent-" + UUID.randomUUID();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        List<String> usedSkills = selectedSkills.stream().map(Skill::id).toList();

        DeepSeekChatRequest deepSeekRequest = buildDeepSeekRequest(request, selectedSkills, traceId, false);

        try {
            DeepSeekChatResponse response = restClient.post()
                    .uri(properties.getChatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(deepSeekRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException("DeepSeek returned an empty response");
            }

            String content = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::content)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException("DeepSeek response did not include message content"));

            return parseModelContent(content, traceId, response.model(), response.id(), usedSkills);
        } catch (RestClientException exception) {
            throw new DeepSeekApiException("Failed to call DeepSeek API", exception);
        }
    }

    public SseEmitter stream(AgentChatRequest request) {
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("DEEPSEEK_API_KEY is not configured");
        }

        String traceId = "agent-" + UUID.randomUUID();
        List<Skill> selectedSkills = skillRegistry.selectSkills(request);
        List<String> usedSkills = selectedSkills.stream().map(Skill::id).toList();
        SseEmitter emitter = new SseEmitter(properties.getReadTimeout().plusSeconds(45).toMillis());

        try {
            String body = objectMapper.writeValueAsString(buildDeepSeekRequest(request, selectedSkills, traceId, true));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getBaseUrl() + properties.getChatPath()))
                    .timeout(properties.getReadTimeout().plusSeconds(30))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            CompletableFuture.runAsync(() -> streamDeepSeekResponse(httpRequest, emitter, traceId, usedSkills));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build agent request", exception);
        }

        return emitter;
    }

    AgentChatResponse parseModelContent(
            String content,
            String traceId,
            String model,
            String requestId,
            List<String> usedSkills
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
            String traceId,
            boolean stream
    ) {
        return new DeepSeekChatRequest(
                properties.getModel(),
                List.of(
                        new DeepSeekMessage("system", AGENT_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildUserPrompt(request, selectedSkills, traceId))
                ),
                stream,
                properties.getAgentMaxTokens(),
                Math.min(properties.getTemperature(), 0.2),
                new DeepSeekResponseFormat("json_object")
        );
    }

    private void streamDeepSeekResponse(
            HttpRequest request,
            SseEmitter emitter,
            String traceId,
            List<String> usedSkills
    ) {
        StringBuilder content = new StringBuilder();
        AtomicReference<String> model = new AtomicReference<>(properties.getModel());
        AtomicReference<String> requestId = new AtomicReference<>("");

        try {
            HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            try (Stream<String> lines = response.body()) {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    String errorBody = String.join("\n", lines.toList());
                    sendEvent(emitter, "error", Map.of("message", "DeepSeek stream failed: " + errorBody));
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
                    usedSkills
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

    private String buildUserPrompt(AgentChatRequest request, List<Skill> selectedSkills, String traceId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        context.put("today", LocalDate.now().toString());
        context.put("selectedSkills", selectedSkills);
        context.put("babyProfile", request.babyProfile());
        context.put("recentMessages", tail(request.recentMessages(), 12));
        context.put("careLogs", tail(request.careLogs(), 10));
        context.put("memories", tail(request.memories(), 10));
        context.put("attachments", request.attachments() == null ? List.of() : request.attachments());
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
}
