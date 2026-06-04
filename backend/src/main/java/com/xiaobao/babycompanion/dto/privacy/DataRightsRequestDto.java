package com.xiaobao.babycompanion.dto.privacy;

public record DataRightsRequestDto(
        String requestId,
        String type,
        String status,
        String reason,
        String createdAt,
        String resolvedAt,
        String resolutionNote
) {
}
