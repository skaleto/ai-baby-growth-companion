package com.xiaobao.babycompanion.service.deepseek;

public record DeepSeekToolCall(
        String id,
        String type,
        DeepSeekFunctionCall function
) {
}
