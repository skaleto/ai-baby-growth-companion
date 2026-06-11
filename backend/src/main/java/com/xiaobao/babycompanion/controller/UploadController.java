package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.app.AttachmentDto;
import com.xiaobao.babycompanion.dto.app.UploadCompleteRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignResponse;
import com.xiaobao.babycompanion.dto.app.UploadRequest;
import com.xiaobao.babycompanion.dto.app.VideoPosterRequest;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import jakarta.validation.Valid;
import java.util.concurrent.TimeUnit;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final AttachmentStorageService attachmentStorageService;
    private final CurrentUser currentUser;

    public UploadController(AttachmentStorageService attachmentStorageService, CurrentUser currentUser) {
        this.attachmentStorageService = attachmentStorageService;
        this.currentUser = currentUser;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public AttachmentDto uploadDataUrl(@Valid @RequestBody UploadRequest request) {
        currentUser.requireCaregiver();
        return attachmentStorageService.saveDataUrl(request);
    }

    @PostMapping(path = "/presign", consumes = MediaType.APPLICATION_JSON_VALUE)
    public UploadPresignResponse presignUpload(@RequestBody UploadPresignRequest request) {
        currentUser.requireCaregiver();
        return attachmentStorageService.createDirectUpload(request);
    }

    @PostMapping(path = "/complete", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AttachmentDto completeUpload(@RequestBody UploadCompleteRequest request) {
        currentUser.requireCaregiver();
        return attachmentStorageService.completeDirectUpload(request);
    }

    // 视频封面自愈:客户端播放无封面视频时抽帧回传,补成服务端缩略图(幂等,绝不覆盖已有封面)。
    @PostMapping(path = "/{id}/poster", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AttachmentDto attachVideoPoster(@PathVariable String id, @RequestBody VideoPosterRequest request) {
        return attachmentStorageService.attachVideoPosterIfMissing(id, request == null ? null : request.thumbnailDataUrl());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> read(@PathVariable String id) {
        currentUser.requirePrincipal();
        AttachmentStorageService.StoredAttachment attachment = attachmentStorageService.load(id);
        if (attachment.redirectUri() != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(attachment.redirectUri())
                    .build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePrivate().immutable())
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.name())
                        .build()
                .toString())
                .body(attachment.resource());
    }

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> readThumbnail(@PathVariable String id) {
        currentUser.requirePrincipal();
        AttachmentStorageService.StoredAttachment attachment = attachmentStorageService.loadThumbnail(id);
        if (attachment.redirectUri() != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(attachment.redirectUri())
                    .build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePrivate().immutable())
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.name())
                        .build()
                        .toString())
                .body(attachment.resource());
    }
}
