package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekTool;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekToolFunction;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RecordFeedingEventTool implements AgentActionTool {

    private final ObjectMapper objectMapper;
    private final AgentMutationService mutationService;

    public RecordFeedingEventTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        this.objectMapper = objectMapper;
        this.mutationService = mutationService;
    }

    @Override
    public String id() {
        return "record_feeding_event";
    }

    @Override
    public String displayName() {
        return "记录喂养";
    }

    @Override
    public String runningMessage() {
        return "正在记录喂养";
    }

    @Override
    public DeepSeekTool definition() {
        return new DeepSeekTool(
                "function",
                new DeepSeekToolFunction(
                        id(),
                        "记录一次已经发生的喂养。仅当用户表达宝宝已经喝完/喝了奶并提供奶量时使用；混合喂养或奶类不明确时应传缺失字段，让工具追问。",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "date", Map.of("type", "string", "description", "发生日期，YYYY-MM-DD"),
                                        "time", Map.of("type", "string", "description", "发生时间，HH:mm；用户未给具体时间可为空字符串"),
                                        "amountMl", Map.of("type", "number", "description", "本次奶量，毫升"),
                                        "feedingType", Map.of("type", "string", "enum", List.of("breast", "formula", "mixed", "unknown"), "description", "母乳、配方奶、混合或未知"),
                                        "note", Map.of("type", "string", "description", "用户原话里的补充说明"),
                                        "idempotencyKey", Map.of("type", "string", "description", "由 user message、date、time、amount 和奶类组成的稳定去重键")
                                ),
                                "required", List.of("date", "amountMl", "idempotencyKey"),
                                "additionalProperties", false
                        ),
                        true
                )
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String date = text(args, "date", "");
        double amount = number(args, "amountMl", -1);
        String idempotencyKey = text(args, "idempotencyKey", call.callId());
        String feedingType = normalizeFeedingType(text(args, "feedingType", ""));
        if (!StringUtils.hasText(date)) {
            return AgentActionResult.needsInput(id(), "care_log", "这次喂养是哪一天发生的？", List.of("date"));
        }
        if (amount <= 0) {
            return AgentActionResult.needsInput(id(), "care_log", "这次大概喝了多少毫升？", List.of("amountMl"));
        }
        if (!StringUtils.hasText(feedingType) || "unknown".equals(feedingType)) {
            return AgentActionResult.needsInput(id(), "care_log", "这次喝的是母乳还是配方奶？", List.of("feedingType"));
        }
        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("date", date);
        patch.put("milkMl", Math.round(amount));
        patch.put("milkTimes", 1);
        ObjectNode event = patch.putArray("events").addObject();
        event.put("type", "milk");
        event.put("date", date);
        putIfText(event, "time", text(args, "time", ""));
        event.put("title", "喝奶");
        event.put("amountMl", Math.round(amount));
        event.put("note", feedingLabel(feedingType));
        event.putArray("tags").add("喂养").add(feedingLabel(feedingType));
        String note = text(args, "note", "");
        if (StringUtils.hasText(note)) patch.putArray("notes").add(note);
        return mutationService.applyCareLogPatch(context, id(), idempotencyKey, patch);
    }

    private ObjectNode parseArguments(String raw) {
        if (!StringUtils.hasText(raw)) return objectMapper.createObjectNode();
        try {
            JsonNode node = objectMapper.readTree(raw);
            return node instanceof ObjectNode object ? object : objectMapper.createObjectNode();
        } catch (JsonProcessingException exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String normalizeFeedingType(String value) {
        if (!StringUtils.hasText(value)) return "";
        String normalized = value.trim().toLowerCase();
        if (List.of("breast", "breastmilk", "母乳", "亲喂").contains(normalized)) return "breast";
        if (List.of("formula", "奶粉", "配方奶").contains(normalized)) return "formula";
        if (List.of("mixed", "混合", "混合喂养").contains(normalized)) return "mixed";
        if ("unknown".equals(normalized)) return "unknown";
        return normalized;
    }

    private String feedingLabel(String feedingType) {
        return switch (feedingType) {
            case "breast" -> "母乳";
            case "formula" -> "配方奶";
            case "mixed" -> "混合喂养";
            default -> "喂养";
        };
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private double number(JsonNode node, String field, double fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isNumber() ? value.asDouble() : fallback;
    }

    private void putIfText(ObjectNode node, String field, String value) {
        if (StringUtils.hasText(value)) node.put(field, value);
    }
}
