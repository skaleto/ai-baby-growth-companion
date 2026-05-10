package com.xiaobao.babycompanion.dto.app;

public record UploadCompleteRequest(
        String id,
        String name,
        String kind,
        String mimeType,
        String objectKey,
        Long sizeBytes,
        String thumbnailDataUrl
) {
}
