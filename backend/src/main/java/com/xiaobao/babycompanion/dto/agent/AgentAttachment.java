package com.xiaobao.babycompanion.dto.agent;

import jakarta.validation.constraints.Size;

public record AgentAttachment(
        @Size(max = 80, message = "attachment id must be at most 80 characters")
        String id,

        @Size(max = 160, message = "attachment name must be at most 160 characters")
        String name,

        @Size(max = 20, message = "attachment kind must be at most 20 characters")
        String kind,

        @Size(max = 200, message = "attachment url must be at most 200 characters")
        String url
) {
}
