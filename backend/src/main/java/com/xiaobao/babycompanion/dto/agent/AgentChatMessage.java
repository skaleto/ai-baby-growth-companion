package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

public record AgentChatMessage(
        @Size(max = 80, message = "message id must be at most 80 characters")
        String id,

        @Size(max = 20, message = "role must be at most 20 characters")
        String role,

        @Size(max = 4000, message = "text must be at most 4000 characters")
        String text,

        @Size(max = 40, message = "createdAt must be at most 40 characters")
        String createdAt,

        @Size(max = 8, message = "attachments must include at most 8 items")
        List<@Valid AgentAttachment> attachments,

        @Size(max = 16, message = "tags must include at most 16 items")
        List<@Size(max = 40, message = "tag must be at most 40 characters") String> tags
) {
}
