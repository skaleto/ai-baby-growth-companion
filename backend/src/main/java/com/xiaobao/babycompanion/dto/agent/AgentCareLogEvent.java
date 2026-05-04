package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.constraints.Size;

public record AgentCareLogEvent(
        @Size(max = 80, message = "care event id must be at most 80 characters")
        String id,

        @Size(max = 20, message = "care event type must be at most 20 characters")
        String type,

        @Size(max = 30, message = "care event date must be at most 30 characters")
        String date,

        @Size(max = 20, message = "care event time must be at most 20 characters")
        String time,

        @Size(max = 80, message = "care event title must be at most 80 characters")
        String title,

        Integer amountMl,
        Double durationHours,
        Double temperature,

        @Size(max = 240, message = "care event note must be at most 240 characters")
        String note,

        @Size(max = 8, message = "care event tags must include at most 8 items")
        List<@Size(max = 30, message = "care event tag must be at most 30 characters") String> tags
) {
}
