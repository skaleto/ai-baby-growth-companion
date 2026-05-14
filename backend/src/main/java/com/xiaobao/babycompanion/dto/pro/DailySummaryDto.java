package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record DailySummaryDto(
        String id,
        String date,
        String text,
        List<String> facts,
        List<String> observations,
        List<MissingItemDto> missingItems,
        List<MissingItemDto> accountMissingItems,
        String generatedAt,
        String generatedByUserId,
        String sourceFingerprint,
        boolean stale
) {
}
