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
        List<FindingDto> findings,
        String generatedAt,
        String generatedByUserId,
        String sourceFingerprint,
        boolean stale
) {
    public DailySummaryDto {
        if (findings == null) findings = List.of();
    }
}
