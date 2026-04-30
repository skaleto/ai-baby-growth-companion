package com.xiaobao.babycompanion.agent;

import java.util.List;

import com.xiaobao.babycompanion.dto.agent.AgentSource;

public record AgentToolResult(
        String callId,
        String toolId,
        String displayName,
        String query,
        String content,
        List<AgentSource> sources
) {
}
