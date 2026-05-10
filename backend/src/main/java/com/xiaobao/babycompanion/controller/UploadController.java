package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.dto.app.AttachmentDto;
import com.xiaobao.babycompanion.dto.app.UploadCompleteRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignRequest;
import com.xiaobao.babycompanion.dto.app.UploadPresignResponse;
import com.xiaobao.babycompanion.dto.app.UploadRequest;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
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

    public UploadController(AttachmentStorageService attachmentStorageService) {
        this.attachmentStorageService = attachmentStorageService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public AttachmentDto uploadDataUrl(@Valid @RequestBody UploadRequest request) {
        return attachmentStorageService.saveDataUrl(request);
    }

    @PostMapping(path = "/presign", consumes = MediaType.APPLICATION_JSON_VALUE)
    public UploadPresignResponse presignUpload(@RequestBody UploadPresignRequest request) {
        return attachmentStorageService.createDirectUpload(request);
    }

    @PostMapping(path = "/complete", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AttachmentDto completeUpload(@RequestBody UploadCompleteRequest request) {
        return attachmentStorageService.completeDirectUpload(request);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> read(@PathVariable String id) {
        AttachmentStorageService.StoredAttachment attachment = attachmentStorageService.load(id);
        if (attachment.redirectUri() != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(attachment.redirectUri())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.name())
                        .build()
                .toString())
                .body(attachment.resource());
    }

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> readThumbnail(@PathVariable String id) {
        AttachmentStorageService.StoredAttachment attachment = attachmentStorageService.loadThumbnail(id);
        if (attachment.redirectUri() != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(attachment.redirectUri())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(attachment.name())
                        .build()
                        .toString())
                .body(attachment.resource());
    }
}
