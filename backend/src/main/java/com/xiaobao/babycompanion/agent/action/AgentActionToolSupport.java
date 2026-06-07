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
import org.springframework.util.StringUtils;

abstract class AgentActionToolSupport implements AgentActionTool {

    protected final ObjectMapper objectMapper;
    protected final AgentMutationService mutationService;

    AgentActionToolSupport(ObjectMapper objectMapper, AgentMutationService mutationService) {
        this.objectMapper = objectMapper;
        this.mutationService = mutationService;
    }

    @Override
    public DeepSeekTool definition() {
        return new DeepSeekTool(
                "function",
                new DeepSeekToolFunction(id(), description(), parameters(), true)
        );
    }

    abstract String description();

    abstract Map<String, Object> parameters();

    protected ObjectNode parseArguments(String raw) {
        if (!StringUtils.hasText(raw)) return objectMapper.createObjectNode();
        try {
            JsonNode node = objectMapper.readTree(raw);
            return node instanceof ObjectNode object ? object : objectMapper.createObjectNode();
        } catch (JsonProcessingException exception) {
            return objectMapper.createObjectNode();
        }
    }

    protected String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    protected double number(JsonNode node, String field, double fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isNumber() ? value.asDouble() : fallback;
    }

    protected void putIfText(ObjectNode node, String field, String value) {
        if (StringUtils.hasText(value)) node.put(field, value);
    }

    protected Map<String, Object> stringProperty(String description) {
        return Map.of("type", "string", "description", description);
    }

    protected Map<String, Object> numberProperty(String description) {
        return Map.of("type", "number", "description", description);
    }

    protected Map<String, Object> objectSchema(Map<String, Object> properties, List<String> required) {
        return Map.of(
                "type", "object",
                "properties", properties,
                "required", required,
                "additionalProperties", false
        );
    }
}
