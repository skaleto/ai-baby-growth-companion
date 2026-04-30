package com.xiaobao.babycompanion.dto.agent;

import jakarta.validation.constraints.Size;

public record AgentMemory(
        @Size(max = 80, message = "memory id must be at most 80 characters")
        String id,

        @Size(max = 600, message = "memory text must be at most 600 characters")
        String text,

        @Size(max = 40, message = "category must be at most 40 characters")
        String category,

        Double confidence,

        @Size(max = 40, message = "updatedAt must be at most 40 characters")
        String updatedAt
) {
}
