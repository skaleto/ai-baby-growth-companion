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
        if (!matchesMagicBytes(mimeType, bytes)) {
            throw new IllegalArgumentException("Attachment content does not match declared type: " + mimeType);
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

    private boolean matchesMagicBytes(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "image/jpeg" -> startsWith(bytes, 0xFF, 0xD8, 0xFF);
            case "image/png" -> startsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
            case "image/gif" -> startsWith(bytes, 0x47, 0x49, 0x46, 0x38);
            case "image/webp" -> hasRiffContainer(bytes, "WEBP");
            case "video/mp4", "video/quicktime", "audio/mp4" -> hasFtypBox(bytes);
            case "video/webm" -> startsWith(bytes, 0x1A, 0x45, 0xDF, 0xA3);
            case "audio/mpeg" -> startsWith(bytes, 0x49, 0x44, 0x33)
                    || (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFF && ((bytes[1] & 0xE0) == 0xE0));
            case "audio/wav" -> hasRiffContainer(bytes, "WAVE");
            default -> false;
        };
    }

    private boolean startsWith(byte[] bytes, int... signature) {
        if (bytes.length < signature.length) return false;
        for (int index = 0; index < signature.length; index += 1) {
            if ((bytes[index] & 0xFF) != (signature[index] & 0xFF)) return false;
        }
        return true;
    }

    private boolean hasRiffContainer(byte[] bytes, String fourCc) {
        if (bytes.length < 12) return false;
        if (!startsWith(bytes, 0x52, 0x49, 0x46, 0x46)) return false;
        return bytes[8] == (byte) fourCc.charAt(0)
                && bytes[9] == (byte) fourCc.charAt(1)
                && bytes[10] == (byte) fourCc.charAt(2)
                && bytes[11] == (byte) fourCc.charAt(3);
    }

    private boolean hasFtypBox(byte[] bytes) {
        return bytes.length >= 8
                && bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p';
    }

    record DataUrlPayload(String mimeType, byte[] bytes) {
    }
}
