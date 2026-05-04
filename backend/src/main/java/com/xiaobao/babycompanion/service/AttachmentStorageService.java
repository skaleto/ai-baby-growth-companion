package com.xiaobao.babycompanion.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AppStorageProperties;
import com.xiaobao.babycompanion.dto.app.AttachmentDto;
import com.xiaobao.babycompanion.dto.app.UploadRequest;
import com.xiaobao.babycompanion.persistence.entity.AttachmentRecord;
import com.xiaobao.babycompanion.persistence.service.AttachmentRecordService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AttachmentStorageService {

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

    private final Path dataDir;
    private final AppStorageProperties properties;
    private final AttachmentRecordService attachmentService;
    private final ObjectMapper objectMapper;
    private final CurrentUser currentUser;

    public AttachmentStorageService(
            Path appDataDir,
            AppStorageProperties properties,
            AttachmentRecordService attachmentService,
            ObjectMapper objectMapper,
            CurrentUser currentUser
    ) throws IOException {
        this.dataDir = appDataDir;
        this.properties = properties;
        this.attachmentService = attachmentService;
        this.objectMapper = objectMapper;
        this.currentUser = currentUser;
        Files.createDirectories(uploadRoot());
    }

    public AttachmentDto saveDataUrl(UploadRequest request) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        DataUrlPayload payload = parseDataUrl(request.dataUrl());
        String id = normalizedId(request.id());
        String kind = normalizedKind(request.kind(), payload.mimeType());
        String name = StringUtils.hasText(request.name()) ? request.name().trim() : id + "." + extension(payload.mimeType());
        return saveBytes(id, name, kind, payload.mimeType(), payload.bytes(), null, null, principal.familyId(), principal.userId());
    }

    public AttachmentDto saveMultipart(MultipartFile file, String id, String kind) {
        currentUser.requireCaregiver();
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        String mimeType = StringUtils.hasText(file.getContentType()) ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        AuthPrincipal principal = currentUser.requirePrincipal();
        try {
            return saveBytes(
                    normalizedId(id),
                    StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "attachment",
                    normalizedKind(kind, mimeType),
                    mimeType,
                    file.getBytes(),
                    null,
                    null,
                    principal.familyId(),
                    principal.userId()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read uploaded file", exception);
        }
    }

    public AttachmentDto saveDataUrlAttachment(String id, String name, String kind, String dataUrl, String ownerType, String ownerId, String familyId, String ownerUserId) {
        DataUrlPayload payload = parseDataUrl(dataUrl);
        return saveBytes(
                normalizedId(id),
                StringUtils.hasText(name) ? name : normalizedId(id) + "." + extension(payload.mimeType()),
                normalizedKind(kind, payload.mimeType()),
                payload.mimeType(),
                payload.bytes(),
                ownerType,
                ownerId,
                familyId,
                ownerUserId
        );
    }

    public StoredAttachment load(String id) {
        String familyId = currentUser.requireFamilyId();
        AttachmentRecord record = attachmentService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        if (record == null) {
            throw new IllegalArgumentException("Attachment not found: " + id);
        }
        try {
            Path file = resolveStoredPath(record.getFilePath());
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Attachment file is not readable: " + id);
            }
            return new StoredAttachment(record.getName(), record.getMimeType(), resource);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load attachment: " + id, exception);
        }
    }

    private AttachmentDto saveBytes(
            String id,
            String name,
            String kind,
            String mimeType,
            byte[] bytes,
            String ownerType,
            String ownerId,
            String familyId,
            String ownerUserId
    ) {
        validate(mimeType, bytes);
        try {
            String extension = extension(mimeType);
            Path relativeDir = Path.of("uploads", LocalDate.now().toString());
            Path directory = dataDir.resolve(relativeDir).normalize();
            Files.createDirectories(directory);
            Path file = directory.resolve(id + "." + extension).normalize();
            if (!file.startsWith(dataDir)) {
                throw new IllegalArgumentException("Invalid attachment path");
            }
            Files.write(file, bytes);

            String relativePath = dataDir.relativize(file).toString().replace('\\', '/');
            String publicUrl = "/api/uploads/" + id;
            AttachmentRecord record = new AttachmentRecord();
            record.setId(id);
            record.setName(safeName(name));
            record.setKind(kind);
            record.setMimeType(mimeType);
            record.setFilePath(relativePath);
            record.setPublicUrl(publicUrl);
            record.setOwnerType(ownerType);
            record.setOwnerId(ownerId);
            record.setOwnerUserId(ownerUserId);
            record.setFamilyId(familyId);
            record.setCreatedByUserId(ownerUserId);
            record.setCreatedAt(Instant.now().toString());
            record.setPayloadJson(toJson(Map.of("id", id, "name", record.getName(), "kind", kind, "url", publicUrl)));
            attachmentService.saveOrUpdate(record);
            return toDto(record);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to save attachment", exception);
        }
    }

    private Path uploadRoot() {
        return dataDir.resolve("uploads").normalize();
    }

    private Path resolveStoredPath(String filePath) throws IOException {
        Path path = dataDir.resolve(filePath).normalize();
        if (!path.startsWith(dataDir)) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        return path;
    }

    private void validate(String mimeType, byte[] bytes) {
        if (!isAllowed(mimeType)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        if (bytes.length <= 0) {
            throw new IllegalArgumentException("Attachment is empty");
        }
        if (bytes.length > properties.getMaxUploadBytes()) {
            throw new IllegalArgumentException("Attachment exceeds size limit");
        }
    }

    private DataUrlPayload parseDataUrl(String dataUrl) {
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

    private boolean isAllowed(String mimeType) {
        return StringUtils.hasText(mimeType)
                && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/"))
                && EXTENSIONS.containsKey(mimeType);
    }

    private String extension(String mimeType) {
        String extension = EXTENSIONS.get(mimeType);
        if (!StringUtils.hasText(extension)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        return extension;
    }

    private String normalizedKind(String kind, String mimeType) {
        if ("image".equals(kind) || "video".equals(kind) || "audio".equals(kind)) return kind;
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("video/")) return "video";
        if (mimeType.startsWith("audio/")) return "audio";
        return "image";
    }

    private String normalizedId(String id) {
        String value = StringUtils.hasText(id) ? id.trim() : "attachment-" + UUID.randomUUID();
        return value.replaceAll("[^a-zA-Z0-9._-]", "-");
    }

    private String safeName(String name) {
        return StringUtils.hasText(name) ? Path.of(name).getFileName().toString() : "attachment";
    }

    public AttachmentDto toDto(AttachmentRecord record) {
        return new AttachmentDto(
                record.getId(),
                record.getName(),
                record.getKind(),
                record.getMimeType(),
                record.getFilePath(),
                record.getPublicUrl(),
                record.getPublicUrl(),
                record.getCreatedAt()
        );
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private record DataUrlPayload(String mimeType, byte[] bytes) {
    }

    public record StoredAttachment(String name, String mimeType, Resource resource) {
    }
}
