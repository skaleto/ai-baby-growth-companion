package com.xiaobao.babycompanion.agent;

import java.util.List;

public record AgentPlan(
        String intent,
        List<String> topics,
        List<String> targetDates,
        List<String> contextNeeds,
        List<AgentToolRequest> toolRequests,
        List<String> riskHints,
        AgentMediaAction mediaAction
) {
}
