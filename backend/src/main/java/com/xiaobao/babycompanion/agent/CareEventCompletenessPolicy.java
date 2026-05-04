package com.xiaobao.babycompanion.agent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CareEventCompletenessPolicy {

    private final ObjectMapper objectMapper;

    public CareEventCompletenessPolicy(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<AgentEffectDecision> boundaryDecisions(RecordSignals signals) {
        List<AgentEffectDecision> decisions = new ArrayList<>();
        if (signals.unsupportedMutationRequest()) {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("topic", "capability");
            payload.put("question", AgentCapabilityContract.unsupportedMutationMessage());
            decisions.add(decision("ignore", "careLog", payload, 0.99, "当前动作不在系统可执行能力内。", "rule"));
        }
        for (CareRecordClarification clarification : signals.clarifications()) {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("topic", clarification.topic());
            ArrayNode missingFields = objectMapper.createArrayNode();
            clarification.missingFields().forEach(missingFields::add);
            payload.set("missingFields", missingFields);
            payload.put("question", clarification.question());
            decisions.add(decision("ask", "careLog", payload, 0.9, "照护记录字段不足，需要先补充信息。", "rule"));
        }
        return decisions;
    }

    public JsonNode normalizeCarePayload(JsonNode payload) {
        if (!(payload instanceof ObjectNode object)) return payload;
        ObjectNode normalized = object.deepCopy();
        if (normalized.get("events") instanceof ArrayNode events) {
            ArrayNode completeEvents = objectMapper.createArrayNode();
            for (JsonNode event : events) {
                JsonNode normalizedEvent = normalizeCareEvent(event);
                if (completeEvent(normalizedEvent)) completeEvents.add(normalizedEvent);
            }
            normalized.set("events", completeEvents);
        }
        if (number(normalized, "milkMl") <= 0) {
            normalized.remove("milkMl");
            normalized.remove("milkTimes");
        }
        if (number(normalized, "sleepHours") <= 0) {
            normalized.remove("sleepHours");
        }
        return normalized;
    }

    public boolean hasCompleteCareContent(JsonNode payload) {
        if (!(payload instanceof ObjectNode object)) return false;
        return number(object, "milkMl") > 0 ||
                number(object, "sleepHours") > 0 ||
                number(object, "wakes") > 0 ||
                StringUtils.hasText(text(object, "soothing")) ||
                StringUtils.hasText(text(object, "poop")) ||
                number(object, "temperature") > 0 ||
                hasArrayItems(object.get("solids")) ||
                hasCompleteEvents(object.get("events"));
    }

    public boolean hasAutoRecordableCare(JsonNode payload) {
        if (!(payload instanceof ObjectNode object)) return false;
        if (number(object, "milkMl") > 0 || number(object, "sleepHours") > 0 || number(object, "wakes") > 0) {
            return true;
        }
        JsonNode events = object.get("events");
        if (events instanceof ArrayNode array) {
            for (JsonNode event : array) {
                if (completeEvent(event)) return true;
            }
        }
        return StringUtils.hasText(text(object, "poop")) ||
                number(object, "temperature") > 0 ||
                hasArrayItems(object.get("solids")) ||
                StringUtils.hasText(text(object, "soothing"));
    }

    public String firstQuestion(RecordSignals signals) {
        if (signals.unsupportedMutationRequest()) return AgentCapabilityContract.unsupportedMutationMessage();
        if (!signals.clarifications().isEmpty()) return signals.clarifications().get(0).question();
        return "";
    }

    JsonNode normalizeCareEvent(JsonNode event) {
        if (!(event instanceof ObjectNode object)) return event;
        ObjectNode normalized = object.deepCopy();
        String type = text(normalized, "type");
        String title = switch (type) {
            case "milk" -> "喝奶";
            case "sleep" -> "睡觉";
            case "wake" -> "醒来";
            case "poop" -> "便便";
            case "solid" -> "辅食";
            case "temperature" -> "体温";
            case "soothing" -> "哄睡";
            default -> text(normalized, "title");
        };
        if (StringUtils.hasText(title)) {
            normalized.put("title", title);
            ArrayNode tags = objectMapper.createArrayNode();
            tags.add(type.equals("sleep") || type.equals("wake") || type.equals("soothing") ? "睡眠" : title);
            normalized.set("tags", tags);
        }
        return normalized;
    }

    private boolean completeEvent(JsonNode event) {
        String type = text(event, "type");
        return switch (type) {
            case "milk" -> StringUtils.hasText(text(event, "time")) && number(event, "amountMl") > 0;
            case "sleep" -> number(event, "durationHours") > 0;
            case "wake" -> StringUtils.hasText(text(event, "time"));
            case "poop", "solid", "soothing" -> true;
            case "temperature" -> number(event, "temperature") > 0;
            default -> false;
        };
    }

    private boolean hasCompleteEvents(JsonNode events) {
        if (!(events instanceof ArrayNode array)) return false;
        for (JsonNode event : array) {
            if (completeEvent(event)) return true;
        }
        return false;
    }

    private AgentEffectDecision decision(String mode, String type, JsonNode payload, double confidence, String reason, String source) {
        return new AgentEffectDecision("decision-" + UUID.randomUUID(), mode, type, payload, confidence, reason, source);
    }

    private boolean hasArrayItems(JsonNode node) {
        return node instanceof ArrayNode array && !array.isEmpty();
    }

    private double number(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isNumber() ? value.asDouble() : 0;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.asText() : "";
    }
}
