package com.xiaobao.babycompanion.service;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class DefaultDailySummaryAiClient implements DailySummaryAiClient {

    private static final Duration HARD_TIMEOUT = Duration.ofSeconds(30);

    private final DeepSeekProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public DefaultDailySummaryAiClient(DeepSeekProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(HARD_TIMEOUT);
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public List<FindingDto> call(String contextJson) throws DailySummaryAiException {
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new DailySummaryAiException("DeepSeek API key not configured");
        }

        DeepSeekChatRequest request = new DeepSeekChatRequest(
                properties.getModel(),
                List.of(
                        new DeepSeekMessage("system", DailySummaryPrompts.SYSTEM_PROMPT),
                        new DeepSeekMessage("user", DailySummaryPrompts.userPrompt(contextJson))
                ),
                false,
                2048,
                0.3,
                null
        );

        try {
            DeepSeekChatResponse response = restClient.post()
                    .uri(properties.getChatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(request)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DailySummaryAiException("model returned empty response");
            }

            String reply = response.choices().get(0).message().contentAsText();
            if (!StringUtils.hasText(reply)) throw new DailySummaryAiException("model returned empty content");

            return parseFindings(reply);
        } catch (DailySummaryAiException e) {
            throw e;
        } catch (Exception e) {
            throw new DailySummaryAiException("model call failed: " + e.getMessage(), e);
        }
    }

    private List<FindingDto> parseFindings(String reply) throws DailySummaryAiException {
        try {
            String cleaned = stripMarkdownFences(reply);
            JsonNode root = objectMapper.readTree(cleaned);
            JsonNode findingsNode = root.path("findings");
            if (!findingsNode.isArray()) return List.of();

            List<FindingDto> result = new java.util.ArrayList<>();
            for (JsonNode node : findingsNode) {
                FindingDto dto = parseFinding(node);
                if (dto != null) result.add(dto);
            }
            return result;
        } catch (Exception e) {
            throw new DailySummaryAiException("failed to parse model JSON: " + e.getMessage(), e);
        }
    }

    private FindingDto parseFinding(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String type = node.path("type").asText("");
        String text = node.path("text").asText("");
        if (type.isBlank() || text.isBlank()) return null;

        JsonNode relNode = node.path("related");
        FindingRelated related = relNode.isObject() ? parseRelated(relNode) : FindingRelated.empty();

        FindingAction action = null;
        JsonNode actNode = node.path("action");
        if (actNode.isObject()) {
            String label = actNode.path("label").asText("");
            String target = actNode.path("target").asText("");
            if (!label.isBlank() && !target.isBlank()) {
                action = new FindingAction(label, target);
            }
        }
        return new FindingDto(type, text, related, action);
    }

    private FindingRelated parseRelated(JsonNode node) {
        return new FindingRelated(
                stringList(node.path("careLogEventIds")),
                stringList(node.path("growthEventIds")),
                stringList(node.path("albumItemIds")),
                stringList(node.path("expenseIds")),
                stringList(node.path("reminderIds")),
                stringList(node.path("memberIds")),
                stringList(node.path("memoryIds")),
                stringList(node.path("comparedTo"))
        );
    }

    private List<String> stringList(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> list = new java.util.ArrayList<>();
        node.forEach(item -> { if (item.isTextual()) list.add(item.asText()); });
        return list;
    }

    private String stripMarkdownFences(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) trimmed = trimmed.substring(firstNewline + 1);
            if (trimmed.endsWith("```")) trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed.trim();
    }
}
