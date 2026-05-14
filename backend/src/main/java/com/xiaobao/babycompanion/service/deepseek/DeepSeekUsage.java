package com.xiaobao.babycompanion.service.deepseek;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DeepSeekUsage(
        @JsonProperty("prompt_tokens")
        Integer promptTokens,
        @JsonProperty("completion_tokens")
        Integer completionTokens,
        @JsonProperty("total_tokens")
        Integer totalTokens
) {
}
