package com.xiaobao.babycompanion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequest(
        @NotBlank(message = "message is required")
        @Size(max = 4000, message = "message must be at most 4000 characters")
        String message,

        @Size(max = 50, message = "babyNickname must be at most 50 characters")
        String babyNickname,

        @Size(max = 2000, message = "context must be at most 2000 characters")
        String context
) {
}
