package com.xiaobao.babycompanion.dto.agent;

public record AgentSafetyAlert(
        String level,
        String category,
        String message,
        String recommendedAction
) {
}
