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
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.imageio.ImageIO;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.SetBucketCORSRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AppStorageProperties;
import com.xiaobao.babycompanion.dto.app.AttachmentDto;
import com.xiaobao.babycompanion.dto.app.UploadCompleteRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignResponse;
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
    private static final long DIRECT_UPLOAD_TTL_SECONDS = 15L * 60L;

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
            if (record == null || !StringUtils.hasText(record.getFilePath()) || isRemoteUrl(record.getFilePath())) {
                skipped++;
                continue;
            }
            try {
                String nextFilePath = record.getFilePath();
                if (!ossObjectAvailable(record.getFilePath())) {
                    nextFilePath = migrateLocalPathToOss(record.getFilePath(), record.getMimeType());
                    migrated++;
                } else {
                    nextFilePath = canonicalOssPath(record.getFilePath());
                    skipped++;
                }
                String nextThumbnailPath = record.getThumbnailPath();
                if (StringUtils.hasText(record.getThumbnailPath()) && !isRemoteUrl(record.getThumbnailPath())
                        && !ossObjectAvailable(record.getThumbnailPath())) {
                    try {
                        nextThumbnailPath = migrateLocalPathToOss(record.getThumbnailPath(), MediaType.IMAGE_JPEG_VALUE);
                        migrated++;
                    } catch (Exception exception) {
                        nextThumbnailPath = null;
                    }
                } else if (StringUtils.hasText(record.getThumbnailPath()) && !isRemoteUrl(record.getThumbnailPath())) {
                    nextThumbnailPath = canonicalOssPath(record.getThumbnailPath());
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
            } catch (Exception exception) {
                skipped++;
                LOGGER.warn("Failed to migrate attachment {} to OSS: {}", record.getId(), exception.getMessage());
            }
        }
        LOGGER.info("OSS local attachment migration finished: migrated={}, skipped={}", migrated, skipped);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureOssCorsOnStartup() {
        if (!isOssMode()) return;
        String bucket = properties.getOss().getBucket().trim();
        try {
            List<SetBucketCORSRequest.CORSRule> rules = new ArrayList<>();
            try {
                List<SetBucketCORSRequest.CORSRule> existingRules = ossClient.getBucketCORSRules(bucket);
                if (existingRules != null) rules.addAll(existingRules);
            } catch (RuntimeException exception) {
                LOGGER.info("OSS CORS rules could not be read, will try to set direct upload CORS: {}", exception.getMessage());
            }
            if (rules.stream().anyMatch(this::corsRuleAllowsDirectUpload)) {
                return;
            }
            SetBucketCORSRequest request = new SetBucketCORSRequest(bucket);
            if (!rules.isEmpty()) {
                request.setCorsRules(rules);
            }
            request.addCorsRule(directUploadCorsRule());
            request.setResponseVary(true);
            ossClient.setBucketCORS(request);
            LOGGER.info("OSS direct upload CORS rule ensured for bucket {}", bucket);
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to ensure OSS CORS for direct uploads: {}", exception.getMessage());
        }
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
        return saveMultipart(file, id, kind, null);
    }

    public AttachmentDto saveMultipart(MultipartFile file, String id, String kind, String thumbnailDataUrl) {
        currentUser.requireCaregiver();
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        String mimeType = StringUtils.hasText(file.getContentType()) ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        AuthPrincipal principal = currentUser.requirePrincipal();
        DataUrlPayload thumbnailPayload = parseOptionalImageDataUrl(thumbnailDataUrl);
        try {
            return saveBytes(
                    normalizedId(id),
                    StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "attachment",
                    normalizedKind(kind, mimeType),
                    mimeType,
                    file.getBytes(),
                    thumbnailPayload,
                    null,
                    null,
                    principal.familyId(),
                    principal.userId()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read uploaded file", exception);
        }
    }

    public UploadPresignResponse createDirectUpload(UploadPresignRequest request) {
        currentUser.requireCaregiver();
        if (!isOssMode()) {
            throw new IllegalArgumentException("Direct upload requires OSS storage mode");
        }
        if (request == null) {
            throw new IllegalArgumentException("Upload request is required");
        }
        String id = normalizedId(request.id());
        String mimeType = normalizedMimeType(request.mimeType());
        validateMetadata(mimeType, request.sizeBytes());
        Path relativeDir = Path.of("uploads", LocalDate.now().toString());
        String objectKey = storedPath(relativeDir.resolve(id + "." + extension(mimeType)));
        Date expiration = new Date(System.currentTimeMillis() + DIRECT_UPLOAD_TTL_SECONDS * 1000L);
        GeneratePresignedUrlRequest presignRequest = new GeneratePresignedUrlRequest(
                properties.getOss().getBucket().trim(),
                objectKey,
                HttpMethod.PUT
        );
        presignRequest.setExpiration(expiration);
        presignRequest.setContentType(mimeType);
        Map<String, String> headers = Map.of("Content-Type", mimeType);
        return new UploadPresignResponse(
                id,
                "PUT",
                ossClient.generatePresignedUrl(presignRequest).toString(),
                objectKey,
                "/api/uploads/" + id,
                expiration.toInstant().toString(),
                headers,
                properties.getMaxUploadBytes()
        );
    }

    public AttachmentDto completeDirectUpload(UploadCompleteRequest request) {
        currentUser.requireCaregiver();
        if (!isOssMode()) {
            throw new IllegalArgumentException("Direct upload requires OSS storage mode");
        }
        if (request == null) {
            throw new IllegalArgumentException("Upload request is required");
        }
        AuthPrincipal principal = currentUser.requirePrincipal();
        String id = normalizedId(request.id());
        String mimeType = normalizedMimeType(request.mimeType());
        validateMetadata(mimeType, request.sizeBytes());
        String kind = normalizedKind(request.kind(), mimeType);
        String objectKey = validatedDirectObjectKey(id, mimeType, request.objectKey());
        if (!ossObjectExists(objectKey)) {
            throw new IllegalArgumentException("Uploaded object is not available");
        }
        try {
            AttachmentRecord record = new AttachmentRecord();
            record.setId(id);
            record.setName(safeName(StringUtils.hasText(request.name()) ? request.name() : id + "." + extension(mimeType)));
            record.setKind(kind);
            record.setMimeType(mimeType);
            record.setFilePath(objectKey);
            record.setPublicUrl("/api/uploads/" + id);
            DataUrlPayload thumbnailPayload = parseOptionalImageDataUrl(request.thumbnailDataUrl());
            ThumbnailPaths thumbnail = thumbnailPayload == null ? null : createThumbnail(id, thumbnailPayload.mimeType(), thumbnailPayload.bytes(), parentPath(objectKey));
            if (thumbnail == null && mimeType.startsWith("image/")) {
                thumbnail = createThumbnail(id, mimeType, readStoredObject(objectKey), parentPath(objectKey));
            }
            if (thumbnail != null) {
                record.setThumbnailPath(thumbnail.path());
                record.setThumbnailUrl(thumbnail.url());
            }
            record.setFamilyId(principal.familyId());
            record.setOwnerUserId(principal.userId());
            record.setCreatedByUserId(principal.userId());
            record.setCreatedAt(Instant.now().toString());
            record.setPayloadJson(toJson(attachmentPayload(record)));
            attachmentService.saveOrUpdate(record);
            return toDto(record);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to finalize uploaded attachment", exception);
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

    public boolean deleteAttachment(String id, String familyId) {
        if (!StringUtils.hasText(id) || !StringUtils.hasText(familyId)) return false;
        AttachmentRecord record = attachmentService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        if (record == null) return false;

        deleteStoredObject(record.getFilePath());
        deleteStoredObject(record.getThumbnailPath());
        attachmentService.remove(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId));
        return true;
    }

    public StoredAttachment load(String id) {
        String familyId = currentUser.requireFamilyId();
        AttachmentRecord record = attachmentService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        if (record == null) {
            throw new IllegalArgumentException("Attachment not found: " + id);
        }
        return loadStoredAttachment(id, record.getName(), record.getMimeType(), record.getFilePath());
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
        return loadStoredAttachment(id, thumbnailName(record), MediaType.IMAGE_JPEG_VALUE, record.getThumbnailPath());
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
        if (Files.exists(path)) {
            return path;
        }
        Path compatiblePath = resolveLocalPathWithoutOssPrefix(filePath);
        if (compatiblePath != null && Files.exists(compatiblePath)) {
            return compatiblePath;
        }
        return path;
    }

    private Path resolveLocalPathWithoutOssPrefix(String filePath) {
        if (!StringUtils.hasText(filePath)) return null;
        String prefix = normalizedOssPrefix();
        if (!StringUtils.hasText(prefix)) return null;
        String normalized = filePath.replace('\\', '/');
        if (!normalized.startsWith(prefix + "/")) return null;
        Path path = dataDir.resolve(normalized.substring(prefix.length() + 1)).normalize();
        if (!path.startsWith(dataDir)) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        return path;
    }

    private void ensureThumbnail(AttachmentRecord record) {
        boolean hadThumbnail = StringUtils.hasText(record.getThumbnailPath());
        if (hadThumbnail && storedObjectExists(record.getThumbnailPath())) return;
        boolean changed = false;
        if (hadThumbnail) {
            record.setThumbnailPath(null);
            record.setThumbnailUrl(null);
            changed = true;
        }
        if (!StringUtils.hasText(record.getMimeType()) || !record.getMimeType().startsWith("image/")) {
            if (changed) {
                persistAttachmentPayload(record);
            }
            return;
        }
        try {
            byte[] bytes = readStoredObject(record.getFilePath());
            ThumbnailPaths thumbnail = createThumbnail(record.getId(), record.getMimeType(), bytes, parentPath(record.getFilePath()));
            if (thumbnail == null) {
                if (changed) {
                    persistAttachmentPayload(record);
                }
                return;
            }
            record.setThumbnailPath(thumbnail.path());
            record.setThumbnailUrl(thumbnail.url());
            persistAttachmentPayload(record);
        } catch (IOException exception) {
            if (changed) {
                persistAttachmentPayload(record);
            }
            LOGGER.warn("Skipping thumbnail generation for attachment {}: {}", record.getId(), exception.getMessage());
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
        String value = stripOssPrefix(storedPath);
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

    private void deleteStoredObject(String storedPath) {
        if (!StringUtils.hasText(storedPath) || isRemoteUrl(storedPath)) return;
        for (Path localPath : localStoredPathCandidates(storedPath)) {
            try {
                Files.deleteIfExists(localPath);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to delete local attachment object: " + storedPath, exception);
            }
        }
        if (!isOssMode()) return;
        for (String objectKey : ossObjectKeyCandidates(storedPath)) {
            try {
                ossClient.deleteObject(properties.getOss().getBucket().trim(), objectKey);
            } catch (RuntimeException exception) {
                throw new IllegalStateException("Failed to delete OSS attachment object: " + objectKey, exception);
            }
        }
    }

    private List<Path> localStoredPathCandidates(String storedPath) {
        Set<Path> paths = new LinkedHashSet<>();
        String normalized = storedPath.trim().replace('\\', '/').replaceAll("^/+", "");
        if (!StringUtils.hasText(normalized) || normalized.startsWith("../") || normalized.contains("/../")) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        addLocalStoredPathCandidate(paths, normalized);
        String withoutPrefix = stripOssPrefix(normalized);
        if (!normalized.equals(withoutPrefix)) {
            addLocalStoredPathCandidate(paths, withoutPrefix);
        }
        return new ArrayList<>(paths);
    }

    private void addLocalStoredPathCandidate(Set<Path> paths, String storedPath) {
        if (!StringUtils.hasText(storedPath)) return;
        Path path = dataDir.resolve(storedPath).normalize();
        if (!path.startsWith(dataDir)) {
            throw new IllegalArgumentException("Invalid attachment path");
        }
        paths.add(path);
    }

    private boolean storedObjectExists(String storedPath) {
        if (!StringUtils.hasText(storedPath)) return false;
        if (isRemoteUrl(storedPath)) return true;
        Set<String> attemptedObjectKeys = new LinkedHashSet<>();
        if (shouldPreferOss(storedPath)) {
            for (String objectKey : ossObjectKeyCandidates(storedPath)) {
                if (attemptedObjectKeys.add(objectKey) && ossObjectExists(objectKey)) return true;
            }
        }
        try {
            Path file = resolveStoredPath(storedPath);
            if (Files.exists(file) && Files.isReadable(file)) return true;
        } catch (IOException exception) {
            return false;
        }
        if (isOssMode()) {
            for (String objectKey : ossObjectKeyCandidates(storedPath)) {
                if (attemptedObjectKeys.add(objectKey) && ossObjectExists(objectKey)) return true;
            }
        }
        return false;
    }

    private StoredAttachment loadStoredAttachment(String id, String name, String mimeType, String storedPath) {
        if (!StringUtils.hasText(storedPath)) {
            throw new IllegalArgumentException("Attachment file path is empty: " + id);
        }
        if (isRemoteUrl(storedPath)) {
            return StoredAttachment.redirect(name, mimeType, storedPath);
        }
        Set<String> attemptedObjectKeys = new LinkedHashSet<>();
        if (shouldPreferOss(storedPath)) {
            StoredAttachment ossAttachment = loadOssAttachmentIfPresent(name, mimeType, storedPath, attemptedObjectKeys);
            if (ossAttachment != null) return ossAttachment;
        }

        try {
            Path file = resolveStoredPath(storedPath);
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return StoredAttachment.resource(name, mimeType, resource);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load attachment: " + id, exception);
        }

        StoredAttachment ossAttachment = loadOssAttachmentIfPresent(name, mimeType, storedPath, attemptedObjectKeys);
        if (ossAttachment != null) return ossAttachment;
        throw new IllegalArgumentException("Attachment file is not readable: " + id);
    }

    private StoredAttachment loadOssAttachmentIfPresent(String name, String mimeType, String storedPath, Set<String> attemptedObjectKeys) {
        if (!isOssMode()) return null;
        for (String objectKey : ossObjectKeyCandidates(storedPath)) {
            if (!attemptedObjectKeys.add(objectKey)) continue;
            if (ossObjectExists(objectKey)) {
                return StoredAttachment.redirect(name, mimeType, signedObjectUrl(objectKey));
            }
        }
        return null;
    }

    private byte[] readStoredObject(String storedPath) throws IOException {
        Set<String> attemptedObjectKeys = new LinkedHashSet<>();
        if (shouldPreferOss(storedPath)) {
            byte[] bytes = readOssObjectIfPresent(storedPath, attemptedObjectKeys);
            if (bytes != null) return bytes;
        }

        Path localFile = resolveStoredPath(storedPath);
        if (Files.exists(localFile) && Files.isReadable(localFile)) {
            return Files.readAllBytes(localFile);
        }

        byte[] bytes = readOssObjectIfPresent(storedPath, attemptedObjectKeys);
        if (bytes != null) return bytes;
        return Files.readAllBytes(localFile);
    }

    private byte[] readOssObjectIfPresent(String storedPath, Set<String> attemptedObjectKeys) throws IOException {
        if (!isOssMode()) return null;
        for (String objectKey : ossObjectKeyCandidates(storedPath)) {
            if (!attemptedObjectKeys.add(objectKey) || !ossObjectExists(objectKey)) continue;
            try (var object = ossClient.getObject(properties.getOss().getBucket().trim(), objectKey);
                 var input = object.getObjectContent()) {
                return input.readAllBytes();
            }
        }
        return null;
    }

    private String migrateLocalPathToOss(String localStoredPath, String mimeType) throws IOException {
        Path localFile = resolveStoredPath(localStoredPath);
        if (!Files.exists(localFile) || !Files.isReadable(localFile)) {
            throw new IllegalArgumentException("Local attachment file is not readable: " + localStoredPath);
        }
        byte[] bytes = Files.readAllBytes(localFile);
        String objectKey = canonicalOssPath(localStoredPath);
        writeStoredObject(objectKey, bytes, StringUtils.hasText(mimeType) ? mimeType : MediaType.APPLICATION_OCTET_STREAM_VALUE);
        return objectKey;
    }

    private boolean isOssMode() {
        return "oss".equalsIgnoreCase(properties.getMode());
    }

    private boolean corsRuleAllowsDirectUpload(SetBucketCORSRequest.CORSRule rule) {
        if (rule == null) return false;
        List<String> origins = rule.getAllowedOrigins() == null ? List.of() : rule.getAllowedOrigins();
        List<String> methods = rule.getAllowedMethods() == null ? List.of() : rule.getAllowedMethods();
        List<String> headers = rule.getAllowedHeaders() == null ? List.of() : rule.getAllowedHeaders();
        boolean originAllowed = origins.contains("*") || origins.contains("capacitor://localhost") || origins.contains("http://localhost");
        boolean methodAllowed = methods.stream().anyMatch((method) -> "PUT".equalsIgnoreCase(method));
        boolean headerAllowed = headers.contains("*") || headers.stream().anyMatch((header) -> "Content-Type".equalsIgnoreCase(header));
        return originAllowed && methodAllowed && headerAllowed;
    }

    private SetBucketCORSRequest.CORSRule directUploadCorsRule() {
        SetBucketCORSRequest.CORSRule rule = new SetBucketCORSRequest.CORSRule();
        rule.addAllowdOrigin("*");
        rule.addAllowedMethod("PUT");
        rule.addAllowedMethod("POST");
        rule.addAllowedMethod("GET");
        rule.addAllowedMethod("HEAD");
        rule.addAllowedHeader("*");
        rule.addExposeHeader("ETag");
        rule.addExposeHeader("x-oss-request-id");
        rule.setMaxAgeSeconds(3600);
        return rule;
    }

    private boolean isOssObjectKey(String storedPath) {
        if (!isOssMode() || !StringUtils.hasText(storedPath)
                || storedPath.startsWith("/")
                || isRemoteUrl(storedPath)) {
            return false;
        }
        String prefix = normalizedOssPrefix();
        return !StringUtils.hasText(prefix) || storedPath.startsWith(prefix + "/");
    }

    private boolean shouldPreferOss(String storedPath) {
        return isOssMode() && isOssObjectKey(storedPath);
    }

    private List<String> ossObjectKeyCandidates(String storedPath) {
        List<String> candidates = new ArrayList<>();
        if (!isOssMode() || !StringUtils.hasText(storedPath)
                || storedPath.startsWith("/")
                || isRemoteUrl(storedPath)) {
            return candidates;
        }
        String normalized = storedPath.trim().replace('\\', '/').replaceAll("^/+", "");
        if (!StringUtils.hasText(normalized) || normalized.startsWith("../") || normalized.contains("/../")) {
            return candidates;
        }
        String prefix = normalizedOssPrefix();
        if (!StringUtils.hasText(prefix)) {
            candidates.add(normalized);
            return candidates;
        }
        if (normalized.startsWith(prefix + "/")) {
            candidates.add(normalized);
            candidates.add(normalized.substring(prefix.length() + 1));
        } else {
            candidates.add(prefix + "/" + normalized);
            candidates.add(normalized);
        }
        return candidates;
    }

    private boolean ossObjectExists(String objectKey) {
        if (!isOssMode() || !StringUtils.hasText(objectKey)) return false;
        try {
            return ossClient.doesObjectExist(properties.getOss().getBucket().trim(), objectKey);
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to check OSS object {}: {}", objectKey, exception.getMessage());
            return false;
        }
    }

    private boolean ossObjectAvailable(String storedPath) {
        if (!isOssMode()) return false;
        for (String objectKey : ossObjectKeyCandidates(storedPath)) {
            if (ossObjectExists(objectKey)) return true;
        }
        return false;
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

    private String stripOssPrefix(String storedPath) {
        if (!StringUtils.hasText(storedPath)) return "";
        String normalized = storedPath.trim().replace('\\', '/');
        String prefix = normalizedOssPrefix();
        if (StringUtils.hasText(prefix) && normalized.startsWith(prefix + "/")) {
            return normalized.substring(prefix.length() + 1);
        }
        return normalized;
    }

    private String canonicalOssPath(String storedPath) {
        return storedPath(Path.of(stripOssPrefix(storedPath)));
    }

    private boolean isRemoteUrl(String value) {
        return StringUtils.hasText(value) && (value.startsWith("http://") || value.startsWith("https://"));
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

    private void validateMetadata(String mimeType, Long sizeBytes) {
        if (!isAllowed(mimeType)) {
            throw new IllegalArgumentException("Unsupported attachment type: " + mimeType);
        }
        long size = sizeBytes == null ? 0L : sizeBytes;
        if (size <= 0) {
            throw new IllegalArgumentException("Attachment is empty");
        }
        if (size > properties.getMaxUploadBytes()) {
            throw new IllegalArgumentException("Attachment exceeds size limit");
        }
    }

    private String validatedDirectObjectKey(String id, String mimeType, String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            throw new IllegalArgumentException("Uploaded object key is required");
        }
        String normalized = objectKey.trim().replace('\\', '/').replaceAll("^/+", "");
        if (!StringUtils.hasText(normalized) || normalized.startsWith("../") || normalized.contains("/../")) {
            throw new IllegalArgumentException("Invalid uploaded object key");
        }
        String prefix = normalizedOssPrefix();
        String expectedPrefix = StringUtils.hasText(prefix) ? prefix + "/uploads/" : "uploads/";
        String expectedSuffix = "/" + id + "." + extension(mimeType);
        if (!normalized.startsWith(expectedPrefix) || !normalized.endsWith(expectedSuffix)) {
            throw new IllegalArgumentException("Uploaded object key does not match the attachment");
        }
        return normalized;
    }

    private String normalizedMimeType(String mimeType) {
        if (!StringUtils.hasText(mimeType)) return "";
        return mimeType.split(";", 2)[0].trim().toLowerCase();
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

    private void persistAttachmentPayload(AttachmentRecord record) {
        record.setPayloadJson(toJson(attachmentPayload(record)));
        attachmentService.update(new UpdateWrapper<AttachmentRecord>()
                .eq("id", record.getId())
                .set("thumbnail_path", record.getThumbnailPath())
                .set("thumbnail_url", record.getThumbnailUrl())
                .set("payload_json", record.getPayloadJson()));
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
