package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.agent.AgentToolCall;
import com.xiaobao.babycompanion.agent.AgentToolResult;
import org.springframework.stereotype.Component;

@Component
public class AgentActionExecutor {

    private final ObjectMapper objectMapper;

    public AgentActionExecutor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AgentToolResult execute(AgentActionTool tool, AgentToolCall call, AgentActionContext context) {
        AgentActionResult result;
        try {
            result = tool.executeAction(new AgentActionCall(call.id(), tool.id(), call.arguments()), context);
        } catch (RuntimeException exception) {
            result = AgentActionResult.failed(tool.id(), "unknown", "这个操作暂时没有处理成功，可以稍后再试一次。", exception.getMessage());
        }
        return new AgentToolResult(
                call.id(),
                tool.id(),
                tool.displayName(),
                "",
                serializeResult(result),
                List.of()
        );
    }

    public List<AgentActionResult> actionResults(List<AgentToolResult> toolResults) {
        if (toolResults == null || toolResults.isEmpty()) return List.of();
        return toolResults.stream()
                .map(this::parseResult)
                .flatMap(java.util.Optional::stream)
                .toList();
    }

    private String serializeResult(AgentActionResult result) {
        try {
            return objectMapper.writeValueAsString(Map.of("actionResult", result));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize agent action result", exception);
        }
    }

    private java.util.Optional<AgentActionResult> parseResult(AgentToolResult result) {
        if (result == null || result.content() == null || result.content().isBlank()) return java.util.Optional.empty();
        try {
            var node = objectMapper.readTree(result.content()).path("actionResult");
            if (node.isMissingNode() || node.isNull()) return java.util.Optional.empty();
            return java.util.Optional.of(objectMapper.treeToValue(node, AgentActionResult.class));
        } catch (JsonProcessingException exception) {
            return java.util.Optional.empty();
        }
    }
}
