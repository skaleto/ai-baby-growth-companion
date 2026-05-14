package com.xiaobao.babycompanion.dto.app;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public record AppStateDto(
        JsonNode profile,
        List<JsonNode> messages,
        List<JsonNode> growthEvents,
        List<JsonNode> careLogs,
        List<JsonNode> reminders,
        List<JsonNode> memories,
        List<JsonNode> pendingEffects,
        List<JsonNode> albumItems,
        List<JsonNode> expenses,
        JsonNode conversationSummary,
        Boolean thinkingEnabled,
        String selectedModel,
        JsonNode proTrial,
        JsonNode dailySummary,
        JsonNode dailySummarySettings
) {
    public AppStateDto(
            JsonNode profile,
            List<JsonNode> messages,
            List<JsonNode> growthEvents,
            List<JsonNode> careLogs,
            List<JsonNode> reminders,
            List<JsonNode> memories,
            List<JsonNode> pendingEffects,
            List<JsonNode> albumItems,
            List<JsonNode> expenses,
            JsonNode conversationSummary,
            Boolean thinkingEnabled,
            String selectedModel
    ) {
        this(
                profile,
                messages,
                growthEvents,
                careLogs,
                reminders,
                memories,
                pendingEffects,
                albumItems,
                expenses,
                conversationSummary,
                thinkingEnabled,
                selectedModel,
                null,
                null,
                null
        );
    }
}
