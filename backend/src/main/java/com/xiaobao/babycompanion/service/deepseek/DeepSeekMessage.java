package com.xiaobao.babycompanion.service.deepseek;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeepSeekMessage(
        String role,
        Object content,
        @JsonProperty("tool_calls")
        List<DeepSeekToolCall> toolCalls,
        @JsonProperty("tool_call_id")
        String toolCallId
) {
    public DeepSeekMessage(String role, String content) {
        this(role, content, null, null);
    }

    public static DeepSeekMessage tool(String toolCallId, String content) {
        return new DeepSeekMessage("tool", content, null, toolCallId);
    }

    public String contentAsText() {
        return content instanceof String text ? text : "";
    }
}
