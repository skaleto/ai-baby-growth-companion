package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Size;

public record AgentReminder(
        @Size(max = 80, message = "reminder id must be at most 80 characters")
        String id,

        @Size(max = 120, message = "title must be at most 120 characters")
        String title,

        @Size(max = 20, message = "reminderKind must be at most 20 characters")
        String reminderKind,

        @Size(max = 120, message = "dueText must be at most 120 characters")
        String dueText,

        @Size(max = 40, message = "dueAt must be at most 40 characters")
        String dueAt,

        @Size(max = 120, message = "timeSourceText must be at most 120 characters")
        String timeSourceText,

        @Size(max = 60, message = "timezone must be at most 60 characters")
        String timezone,

        Integer notificationId,

        @Size(max = 40, message = "notificationStatus must be at most 40 characters")
        String notificationStatus,

        @Size(max = 160, message = "notificationError must be at most 160 characters")
        String notificationError,

        @Size(max = 40, message = "category must be at most 40 characters")
        String category,

        @Size(max = 40, message = "recurrence must be at most 40 characters")
        String recurrence,

        JsonNode repeatRule,

        @Size(max = 30, message = "soundId must be at most 30 characters")
        String soundId,

        @Size(max = 80, message = "lastAnchorEventId must be at most 80 characters")
        String lastAnchorEventId,

        @Size(max = 40, message = "lastAnchorAt must be at most 40 characters")
        String lastAnchorAt,

        @Size(max = 20, message = "status must be at most 20 characters")
        String status,

        @Size(max = 40, message = "createdAt must be at most 40 characters")
        String createdAt,

        @Size(max = 10, message = "history must include at most 10 items")
        List<@Size(max = 200, message = "history item must be at most 200 characters") String> history
) {
}
