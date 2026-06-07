package com.xiaobao.babycompanion.agent.action;

public record AgentActionCall(
        String callId,
        String toolName,
        String arguments
) {
}
