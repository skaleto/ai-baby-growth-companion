package com.xiaobao.babycompanion.service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import javax.imageio.ImageIO;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.ObjectMetadata;
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
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AttachmentStorageService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AttachmentStorageService.class);
    private static final int THUMBNAIL_MAX_EDGE = 480;

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
    private final OSS ossClient;
    private final String ossAccessKeyId;
    private final String ossAccessKeySecret;

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
        this.ossAccessKeyId = readSecret(properties.getOss().getAccessKeyId(), properties.getOss().getAccessKeyIdFile());
        this.ossAccessKeySecret = readSecret(properties.getOss().getAccessKeySecret(), properties.getOss().getAccessKeySecretFile());
        if (isOssMode()) {
            validateOssConfig();
            this.ossClient = new OSSClientBuilder().build(
                    properties.getOss().getEndpoint().trim(),
                    ossAccessKeyId,
                    ossAccessKeySecret
            );
        } else {
            this.ossClient = null;
            Files.createDirectories(uploadRoot());
        }
    }

    @PreDestroy
    public void destroy() {
        if (ossClient != null) {
            ossClient.shutdown();
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrateLocalObjectsOnStartup() {
        if (!isOssMode() || !properties.getOss().isMigrateLocalOnStartup()) return;
        int migrated = 0;
        int skipped = 0;
        for (AttachmentRecord record : attachmentService.list()) {
            if (record == null || !StringUtils.hasText(record.getFilePath()) || isOssObjectKey(record.getFilePath())) {
                skipped++;
                continue;
            }
            try {
                String nextFilePath = migrateLocalPathToOss(record.getFilePath(), record.getMimeType());
                String nextThumbnailPath = record.getThumbnailPath();
                if (StringUtils.hasText(record.getThumbnailPath()) && !isOssObjectKey(record.getThumbnailPath())) {
                    nextThumbnailPath = migrateLocalPathToOss(record.getThumbnailPath(), MediaType.IMAGE_JPEG_VALUE);
                }
                record.setFilePath(nextFilePath);
                record.setThumbnailPath(nextThumbnailPath);
                if (StringUtils.hasText(nextThumbnailPath)) {
                    record.setThumbnailUrl("/api/uploads/" + record.getId() + "/thumbnail");
                }
                if (!StringUtils.hasText(record.getPublicUrl())) {
                    record.setPublicUrl("/api/uploads/" + record.getId());
                }
                record.setPayloadJson(toJson(attachmentPayload(record)));
                attachmentService.saveOrUpdate(record);
                if ("image".equals(record.getKind()) && !StringUtils.hasText(record.getThumbnailPath())) {
                    ensureThumbnail(record);
                }
                migrated++;
            } catch (Exception exception) {
                skipped++;
                LOGGER.warn("Failed to migrate attachment {} to OSS: {}", record.getId(), exception.getMessage());
            }
        }
        LOGGER.info("OSS local attachment migration finished: migrated={}, skipped={}", migrated, skipped);
    }

    public AttachmentDto saveDataUrl(UploadRequest request) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        DataUrlPayload payload = parseDataUrl(request.dataUrl());
        DataUrlPayload thumbnailPayload = parseOptionalImageDataUrl(request.thumbnailDataUrl());
        String id = normalizedId(request.id());
        String kind = normalizedKind(request.kind(), payload.mimeType());
        String name = StringUtils.hasText(request.name()) ? request.name().trim() : id + "." + extension(payload.mimeType());
        return saveBytes(id, name, kind, payload.mimeType(), payload.bytes(), thumbnailPayload, null, null, principal.familyId(), principal.userId());
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
                null,
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
        if (isOssMode() && isOssObjectKey(record.getFilePath())) {
            return StoredAttachment.redirect(record.getName(), record.getMimeType(), signedObjectUrl(record.getFilePath()));
        }
        try {
            Path file = resolveStoredPath(record.getFilePath());
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Attachment file is not readable: " + id);
            }
            return StoredAttachment.resource(record.getName(), record.getMimeType(), resource);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load attachment: " + id, exception);
        }
    }

    public StoredAttachment loadThumbnail(String id) {
        String familyId = currentUser.requireFamilyId();
        AttachmentRecord record = attachmentService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        if (record == null) {
            throw new IllegalArgumentException("Attachment not found: " + id);
        }
        ensureThumbnail(record);
        if (!StringUtils.hasText(record.getThumbnailPath())) {
            throw new IllegalArgumentException("Thumbnail not available: " + id);
        }
        if (isOssMode() && isOssObjectKey(record.getThumbnailPath())) {
            return StoredAttachment.redirect(thumbnailName(record), MediaType.IMAGE_JPEG_VALUE, signedObjectUrl(record.getThumbnailPath()));
        }
        try {
            Path file = resolveStoredPath(record.getThumbnailPath());
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Thumbnail file is not readable: " + id);
            }
            return StoredAttachment.resource(thumbnailName(record), MediaType.IMAGE_JPEG_VALUE, resource);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load thumbnail: " + id, exception);
        }
    }

    public AttachmentDto metadata(String id, String familyId) {
        if (!StringUtils.hasText(id) || !StringUtils.hasText(familyId)) return null;
        AttachmentRecord record = attachmentService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        if (record == null) return null;
        ensureThumbnail(record);
        return toDto(record);
    }

    private AttachmentDto saveBytes(
            String id,
            String name,
            String kind,
            String mimeType,
            byte[] bytes,
            DataUrlPayload thumbnailPayload,
            String ownerType,
            String ownerId,
            String familyId,
            String ownerUserId
    ) {
        validate(mimeType, bytes);
        try {
            String extension = extension(mimeType);
            Path relativeDir = Path.of("uploads", LocalDate.now().toString());
            String relativePath = storedPath(relativeDir.resolve(id + "." + extension));
            String publicUrl = "/api/uploads/" + id;
            AttachmentRecord record = new AttachmentRecord();
            record.setId(id);
            record.setName(safeName(name));
            record.setKind(kind);
            record.setMimeType(mimeType);
            record.setFilePath(relativePath);
            record.setPublicUrl(publicUrl);
            writeStoredObject(relativePath, bytes, mimeType);
            ThumbnailPaths thumbnail = thumbnailPayload == null ? null : createThumbnail(id, thumbnailPayload.mimeType(), thumbnailPayload.bytes(), relativeDir);
            if (thumbnail == null) thumbnail = createThumbnail(id, mimeType, bytes, relativeDir);
            if (thumbnail != null) {
                record.setThumbnailPath(thumbnail.path());
                record.setThumbnailUrl(thumbnail.url());
            }
            record.setOwnerType(ownerType);
            record.setOwnerId(ownerId);
            record.setOwnerUserId(ownerUserId);
            record.setFamilyId(familyId);
            record.setCreatedByUserId(ownerUserId);
            record.setCreatedAt(Instant.now().toString());
            record.setPayloadJson(toJson(attachmentPayload(record)));
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

    private void ensureThumbnail(AttachmentRecord record) {
        if (StringUtils.hasText(record.getThumbnailPath())) return;
        if (!StringUtils.hasText(record.getMimeType()) || !record.getMimeType().startsWith("image/")) return;
        try {
            byte[] bytes = readStoredObject(record.getFilePath());
            ThumbnailPaths thumbnail = createThumbnail(record.getId(), record.getMimeType(), bytes, parentPath(record.getFilePath()));
            if (thumbnail == null) return;
            record.setThumbnailPath(thumbnail.path());
            record.setThumbnailUrl(thumbnail.url());
            record.setPayloadJson(toJson(attachmentPayload(record)));
            attachmentService.saveOrUpdate(record);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create thumbnail", exception);
        }
    }

    private ThumbnailPaths createThumbnail(String id, String mimeType, byte[] bytes, Path relativeDir) throws IOException {
        if (!StringUtils.hasText(mimeType) || !mimeType.startsWith("image/")) return null;
        BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
        if (source == null || source.getWidth() <= 0 || source.getHeight() <= 0) return null;
        double scale = Math.min(1.0, THUMBNAIL_MAX_EDGE / (double) Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));

        BufferedImage thumbnail = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = thumbnail.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(thumbnail, "jpg", output);
        String relativePath = storedPath(relativeDir.resolve("thumbs").resolve(id + "-thumb.jpg"));
        writeStoredObject(relativePath, output.toByteArray(), MediaType.IMAGE_JPEG_VALUE);
        return new ThumbnailPaths(relativePath, "/api/uploads/" + id + "/thumbnail");
    }

    private String storedPath(Path relativePath) {
        String normalized = relativePath.normalize().toString().replace('\\', '/');
        if (normalized.startsWith("../") || normalized.contains("/../")) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        if (!isOssMode()) return normalized;
        String prefix = normalizedOssPrefix();
        return StringUtils.hasText(prefix) ? prefix + "/" + normalized : normalized;
    }

    private Path parentPath(String storedPath) {
        String value = storedPath;
        if (isOssMode()) {
            String prefix = normalizedOssPrefix();
            if (StringUtils.hasText(prefix) && value.startsWith(prefix + "/")) {
                value = value.substring(prefix.length() + 1);
            }
        }
        Path path = Path.of(value).normalize().getParent();
        return path == null ? Path.of("uploads", LocalDate.now().toString()) : path;
    }

    private void writeStoredObject(String storedPath, byte[] bytes, String mimeType) throws IOException {
        if (isOssMode()) {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(bytes.length);
            metadata.setContentType(mimeType);
            ossClient.putObject(properties.getOss().getBucket().trim(), storedPath, new ByteArrayInputStream(bytes), metadata);
            return;
        }
        Path file = dataDir.resolve(storedPath).normalize();
        if (!file.startsWith(dataDir)) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        Files.createDirectories(file.getParent());
        Files.write(file, bytes);
    }

    private byte[] readStoredObject(String storedPath) throws IOException {
        if (isOssMode() && isOssObjectKey(storedPath)) {
            try (var object = ossClient.getObject(properties.getOss().getBucket().trim(), storedPath);
                 var input = object.getObjectContent()) {
                return input.readAllBytes();
            }
        }
        return Files.readAllBytes(resolveStoredPath(storedPath));
    }

    private String migrateLocalPathToOss(String localStoredPath, String mimeType) throws IOException {
        Path localFile = resolveStoredPath(localStoredPath);
        if (!Files.exists(localFile) || !Files.isReadable(localFile)) {
            throw new IllegalArgumentException("Local attachment file is not readable: " + localStoredPath);
        }
        byte[] bytes = Files.readAllBytes(localFile);
        String objectKey = storedPath(Path.of(localStoredPath));
        writeStoredObject(objectKey, bytes, StringUtils.hasText(mimeType) ? mimeType : MediaType.APPLICATION_OCTET_STREAM_VALUE);
        return objectKey;
    }

    private boolean isOssMode() {
        return "oss".equalsIgnoreCase(properties.getMode());
    }

    private boolean isOssObjectKey(String storedPath) {
        if (!isOssMode() || !StringUtils.hasText(storedPath)
                || storedPath.startsWith("/")
                || storedPath.startsWith("http://")
                || storedPath.startsWith("https://")) {
            return false;
        }
        String prefix = normalizedOssPrefix();
        return !StringUtils.hasText(prefix) || storedPath.startsWith(prefix + "/");
    }

    private void validateOssConfig() {
        if (!StringUtils.hasText(properties.getOss().getEndpoint())
                || !StringUtils.hasText(properties.getOss().getBucket())
                || !StringUtils.hasText(ossAccessKeyId)
                || !StringUtils.hasText(ossAccessKeySecret)) {
            throw new IllegalStateException("OSS storage is enabled but endpoint, bucket, access key id or access key secret is missing");
        }
    }

    private String signedObjectUrl(String objectKey) {
        if (!isOssMode() || !StringUtils.hasText(objectKey)) return "";
        long ttlMillis = Math.max(60L, properties.getOss().getSignedUrlTtlSeconds()) * 1000L;
        Date expiration = new Date(System.currentTimeMillis() + ttlMillis);
        return ossClient.generatePresignedUrl(properties.getOss().getBucket().trim(), objectKey, expiration).toString();
    }

    private String displayUrl(AttachmentRecord record) {
        if (isOssMode() && isOssObjectKey(record.getFilePath())) {
            return signedObjectUrl(record.getFilePath());
        }
        return record.getPublicUrl();
    }

    private String displayThumbnailUrl(AttachmentRecord record) {
        if (!StringUtils.hasText(record.getThumbnailPath())) return "";
        if (isOssMode() && isOssObjectKey(record.getThumbnailPath())) {
            return signedObjectUrl(record.getThumbnailPath());
        }
        return StringUtils.hasText(record.getThumbnailUrl()) ? record.getThumbnailUrl() : "/api/uploads/" + record.getId() + "/thumbnail";
    }

    private String normalizedOssPrefix() {
        String prefix = properties.getOss().getObjectPrefix();
        return StringUtils.hasText(prefix) ? prefix.trim().replaceAll("^/+", "").replaceAll("/+$", "") : "";
    }

    private String readSecret(String inlineValue, String filePath) {
        if (StringUtils.hasText(inlineValue)) return inlineValue.trim();
        if (!StringUtils.hasText(filePath)) return "";
        try {
            return Files.readString(Path.of(filePath).toAbsolutePath().normalize()).trim();
        } catch (IOException exception) {
            return "";
        }
    }

    private String thumbnailName(AttachmentRecord record) {
        String baseName = StringUtils.hasText(record.getName()) ? record.getName() : record.getId();
        return baseName.replaceAll("\\.[^.]+$", "") + "-thumb.jpg";
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

    private DataUrlPayload parseOptionalImageDataUrl(String dataUrl) {
        if (!StringUtils.hasText(dataUrl)) return null;
        DataUrlPayload payload = parseDataUrl(dataUrl);
        return payload.mimeType().startsWith("image/") ? payload : null;
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
                record.getThumbnailPath(),
                displayThumbnailUrl(record),
                displayUrl(record),
                record.getCreatedAt()
        );
    }

    private Map<String, Object> attachmentPayload(AttachmentRecord record) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", record.getId());
        payload.put("name", record.getName());
        payload.put("kind", record.getKind());
        payload.put("url", record.getPublicUrl());
        if (StringUtils.hasText(record.getThumbnailUrl())) payload.put("thumbnailUrl", record.getThumbnailUrl());
        return payload;
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

    private record ThumbnailPaths(String path, String url) {
    }

    public record StoredAttachment(String name, String mimeType, Resource resource, URI redirectUri) {
        static StoredAttachment resource(String name, String mimeType, Resource resource) {
            return new StoredAttachment(name, mimeType, resource, null);
        }

        static StoredAttachment redirect(String name, String mimeType, String redirectUrl) {
            return new StoredAttachment(name, mimeType, null, URI.create(redirectUrl));
        }
    }
}
