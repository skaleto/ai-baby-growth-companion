package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record AiUsageSummaryDto(
        int days,
        String since,
        String generatedAt,
        long requestCount,
        long successfulRequestCount,
        long meteredRequestCount,
        long unmeteredRequestCount,
        long inputTokens,
        long outputTokens,
        long totalTokens,
        List<AiUsageBreakdownDto> byFeature,
        List<AiUsageBreakdownDto> byModel
) {
}
