package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.constraints.Size;

public record AgentGrowthEvent(
        @Size(max = 80, message = "growth event id must be at most 80 characters")
        String id,

        @Size(max = 80, message = "type must be at most 80 characters")
        String type,

        @Size(max = 120, message = "title must be at most 120 characters")
        String title,

        @Size(max = 30, message = "date must be at most 30 characters")
        String date,

        @Size(max = 600, message = "summary must be at most 600 characters")
        String summary,

        Boolean firstTime,

        @Size(max = 20, message = "mediaKind must be at most 20 characters")
        String mediaKind,

        @Size(max = 16, message = "tags must include at most 16 items")
        List<@Size(max = 40, message = "tag must be at most 40 characters") String> tags
) {
}
