package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.constraints.Size;

public record AgentReminder(
        @Size(max = 80, message = "reminder id must be at most 80 characters")
        String id,

        @Size(max = 120, message = "title must be at most 120 characters")
        String title,

        @Size(max = 120, message = "dueText must be at most 120 characters")
        String dueText,

        @Size(max = 40, message = "category must be at most 40 characters")
        String category,

        @Size(max = 40, message = "recurrence must be at most 40 characters")
        String recurrence,

        @Size(max = 20, message = "status must be at most 20 characters")
        String status,

        @Size(max = 40, message = "createdAt must be at most 40 characters")
        String createdAt,

        @Size(max = 10, message = "history must include at most 10 items")
        List<@Size(max = 200, message = "history item must be at most 200 characters") String> history
) {
}
