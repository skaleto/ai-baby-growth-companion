package com.xiaobao.babycompanion.agent;

public record AgentMediaAction(
        String intent,
        String targetScope,
        String targetKind,
        String refHint,
        String category,
        Double confidence,
        String reason
) {
}
