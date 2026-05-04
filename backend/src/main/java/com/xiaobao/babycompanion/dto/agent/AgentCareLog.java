package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

public record AgentCareLog(
        @Size(max = 80, message = "care log id must be at most 80 characters")
        String id,

        @Size(max = 30, message = "date must be at most 30 characters")
        String date,

        Integer milkMl,
        Integer milkTimes,
        Double sleepHours,
        Integer wakes,

        @Size(max = 20, message = "soothing must be at most 20 characters")
        String soothing,

        @Size(max = 20, message = "solids must include at most 20 items")
        List<@Size(max = 80, message = "solid must be at most 80 characters") String> solids,

        @Size(max = 160, message = "poop must be at most 160 characters")
        String poop,

        Double temperature,

        @Size(max = 10, message = "notes must include at most 10 items")
        List<@Size(max = 400, message = "note must be at most 400 characters") String> notes,

        @Size(max = 24, message = "events must include at most 24 items")
        List<@Valid AgentCareLogEvent> events
) {
}
