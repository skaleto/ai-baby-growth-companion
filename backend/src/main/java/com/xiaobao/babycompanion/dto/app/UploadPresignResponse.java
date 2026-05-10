package com.xiaobao.babycompanion.dto.app;

import java.util.Map;

public record UploadPresignResponse(
        String id,
        String method,
        String uploadUrl,
        String objectKey,
        String publicUrl,
        String expiresAt,
        Map<String, String> headers,
        long maxUploadBytes
) {
}
