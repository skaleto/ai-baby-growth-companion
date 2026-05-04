package com.xiaobao.babycompanion.agent;

public record AgentToolRequest(
        String toolId,
        String query,
        String reason
) {
}
