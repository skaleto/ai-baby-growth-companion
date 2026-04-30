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
        DeepSeekResponseFormat responseFormat
) {
}
