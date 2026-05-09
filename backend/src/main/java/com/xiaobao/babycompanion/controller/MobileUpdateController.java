package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.dto.app.MobileUpdateCheckRequest;
import com.xiaobao.babycompanion.dto.app.MobileUpdateCheckResponse;
import com.xiaobao.babycompanion.service.MobileUpdateService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mobile-updates")
public class MobileUpdateController {

    private final MobileUpdateService mobileUpdateService;

    public MobileUpdateController(MobileUpdateService mobileUpdateService) {
        this.mobileUpdateService = mobileUpdateService;
    }

    @PostMapping("/check")
    public MobileUpdateCheckResponse check(
            @RequestBody(required = false) MobileUpdateCheckRequest request,
            HttpServletRequest servletRequest
    ) {
        MobileUpdateCheckRequest safeRequest = request == null
                ? new MobileUpdateCheckRequest(null, null, null, null, null)
                : request;
        return mobileUpdateService.checkForUpdate(safeRequest, servletRequest);
    }

    @GetMapping("/bundles/{fileName:.+}")
    public ResponseEntity<Resource> bundle(@PathVariable String fileName) {
        Resource resource = mobileUpdateService.bundleResource(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .cacheControl(CacheControl.noCache())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .body(resource);
    }
}
