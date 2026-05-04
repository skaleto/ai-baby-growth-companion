package com.xiaobao.babycompanion.dto.agent;

import com.fasterxml.jackson.databind.JsonNode;

public record AgentEffectDecision(
        String id,
        String mode,
        String type,
        JsonNode payload,
        Double confidence,
        String reason,
        String source
) {
}
