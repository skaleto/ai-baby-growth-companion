package com.xiaobao.babycompanion.dto.app;

import jakarta.validation.constraints.NotBlank;

public record UploadRequest(
        String id,
        String name,
        String kind,
        @NotBlank(message = "dataUrl is required")
        String dataUrl
) {
}
