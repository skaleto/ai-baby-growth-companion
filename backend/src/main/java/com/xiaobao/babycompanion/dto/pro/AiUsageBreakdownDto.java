package com.xiaobao.babycompanion.dto.pro;

public record AiUsageBreakdownDto(
        String key,
        String label,
        String provider,
        String model,
        String feature,
        String inputType,
        long requestCount,
        long successfulRequestCount,
        long meteredRequestCount,
        long unmeteredRequestCount,
        long inputTokens,
        long outputTokens,
        long totalTokens
) {
}
