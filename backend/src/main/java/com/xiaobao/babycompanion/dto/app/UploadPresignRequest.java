package com.xiaobao.babycompanion.dto.app;

public record UploadPresignRequest(
        String id,
        String name,
        String kind,
        String mimeType,
        Long sizeBytes
) {
}
