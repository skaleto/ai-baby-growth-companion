package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

public record AgentContextSnapshot(
        JsonNode babyProfile,
        List<JsonNode> recentMessages,
        List<JsonNode> careLogs,
        List<JsonNode> growthEvents,
        List<JsonNode> growthMeasurements,
        List<JsonNode> reminders,
        List<JsonNode> memories,
        JsonNode conversationSummary,
        Map<String, Object> recordContext,
        Map<String, Object> trends
) {
}
