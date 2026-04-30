package com.xiaobao.babycompanion.service.deepseek;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeepSeekChatRequest(
        String model,
        List<DeepSeekMessage> messages,
        Boolean stream,
        @JsonProperty("max_tokens")
        Integer maxTokens,
        Double temperature,
        @JsonProperty("response_format")
        DeepSeekResponseFormat responseFormat,
        Object thinking,
        List<DeepSeekTool> tools,
        @JsonProperty("tool_choice")
        Object toolChoice
) {
    public DeepSeekChatRequest(
            String model,
            List<DeepSeekMessage> messages,
            Boolean stream,
            Integer maxTokens,
            Double temperature,
            DeepSeekResponseFormat responseFormat
    ) {
        this(model, messages, stream, maxTokens, temperature, responseFormat, null, null, null);
    }
}
