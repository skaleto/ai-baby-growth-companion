package com.xiaobao.babycompanion.agent.action;

import java.time.Clock;

import com.fasterxml.jackson.databind.JsonNode;

public record AgentActionContext(
        String traceId,
        String familyId,
        String userId,
        Clock clock,
        JsonNode babyProfile
) {
}
