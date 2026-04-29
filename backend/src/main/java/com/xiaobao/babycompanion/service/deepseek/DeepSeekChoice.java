package com.xiaobao.babycompanion.service.deepseek;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DeepSeekChoice(
        Integer index,
        DeepSeekMessage message,
        @JsonProperty("finish_reason")
        String finishReason
) {
}
