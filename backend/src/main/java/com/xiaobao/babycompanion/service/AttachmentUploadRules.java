package com.xiaobao.babycompanion.service;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import com.xiaobao.babycompanion.config.AppStorageProperties;
import org.springframework.util.StringUtils;

final class AttachmentUploadRules {

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif",
            "video/mp4", "mp4",
            "video/webm", "webm",
            "video/quicktime", "mov",
            "audio/mpeg", "mp3",
            "audio/mp4", "m4a",
            "audio/wav", "wav"
    );

    private final AppStorageProperties properties;

    AttachmentUploadRules(AppStorageProperties properties) {
        this.properties = properties;
    }

    void validate(String mimeType, byte[] bytes) {
        if (!isAllowed(mimeType)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        if (bytes.length <= 0) {
            throw new IllegalArgumentException("Attachment is empty");
        }
        if (bytes.length > maxUploadBytesFor(mimeType)) {
            throw new IllegalArgumentException("Attachment exceeds size limit");
        }
    }

    void validateMetadata(String mimeType, Long sizeBytes) {
        if (!isAllowed(mimeType)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        long size = sizeBytes == null ? 0L : sizeBytes;
        if (size <= 0) {
            throw new IllegalArgumentException("Attachment is empty");
        }
        if (size > maxUploadBytesFor(mimeType)) {
            throw new IllegalArgumentException("Attachment exceeds size limit");
        }
    }

    long maxUploadBytesFor(String mimeType) {
        return mimeType != null && mimeType.startsWith("video/")
                ? properties.getMaxVideoUploadBytes()
                : properties.getMaxUploadBytes();
    }

    String normalizedMimeType(String mimeType) {
        if (!StringUtils.hasText(mimeType)) return "";
        return mimeType.split(";", 2)[0].trim().toLowerCase();
    }

    DataUrlPayload parseDataUrl(String dataUrl) {
        if (!StringUtils.hasText(dataUrl) || !dataUrl.startsWith("data:")) {
            throw new IllegalArgumentException("Invalid dataUrl");
        }
        int comma = dataUrl.indexOf(',');
        int semicolon = dataUrl.indexOf(';');
        if (comma < 0 || semicolon < 0 || semicolon > comma || !dataUrl.substring(semicolon, comma).contains("base64")) {
            throw new IllegalArgumentException("Only base64 dataUrl attachments are supported");
        }
        String mimeType = dataUrl.substring("data:".length(), semicolon).toLowerCase();
        byte[] bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1).getBytes(StandardCharsets.UTF_8));
        return new DataUrlPayload(mimeType, bytes);
    }

    DataUrlPayload parseOptionalImageDataUrl(String dataUrl) {
        if (!StringUtils.hasText(dataUrl)) return null;
        DataUrlPayload payload = parseDataUrl(dataUrl);
        return payload.mimeType().startsWith("image/") ? payload : null;
    }

    String extension(String mimeType) {
        String extension = EXTENSIONS.get(mimeType);
        if (!StringUtils.hasText(extension)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        return extension;
    }

    String normalizedKind(String kind, String mimeType) {
        if ("image".equals(kind) || "video".equals(kind) || "audio".equals(kind)) return kind;
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("video/")) return "video";
        if (mimeType.startsWith("audio/")) return "audio";
        return "image";
    }

    private boolean isAllowed(String mimeType) {
        return StringUtils.hasText(mimeType)
                && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/"))
                && EXTENSIONS.containsKey(mimeType);
    }

    record DataUrlPayload(String mimeType, byte[] bytes) {
    }
}
