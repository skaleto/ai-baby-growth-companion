package com.xiaobao.babycompanion.service.deepseek;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeepSeekToolFunction(
        String name,
        String description,
        Map<String, Object> parameters,
        Boolean strict
) {
}
