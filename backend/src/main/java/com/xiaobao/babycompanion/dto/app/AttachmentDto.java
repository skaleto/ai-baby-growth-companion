package com.xiaobao.babycompanion.dto.app;

public record AttachmentDto(
        String id,
        String name,
        String kind,
        String mimeType,
        String filePath,
        String publicUrl,
        String url,
        String createdAt
) {
}
