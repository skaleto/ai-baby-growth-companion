package com.xiaobao.babycompanion.agent;

public record AgentToolCall(
        String id,
        String toolId,
        String arguments
) {
}
