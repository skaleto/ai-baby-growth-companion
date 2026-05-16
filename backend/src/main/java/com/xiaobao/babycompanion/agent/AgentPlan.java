package com.xiaobao.babycompanion.agent;

import java.util.List;

public record AgentPlan(
        String intent,
        List<String> topics,
        List<String> targetDates,
        List<String> contextNeeds,
        List<AgentToolRequest> toolRequests,
        List<String> riskHints,
        AgentMediaAction mediaAction,
        List<SkillPlanEntry> skillRequests
) {
    public AgentPlan(
            String intent,
            List<String> topics,
            List<String> targetDates,
            List<String> contextNeeds,
            List<AgentToolRequest> toolRequests,
            List<String> riskHints,
            AgentMediaAction mediaAction
    ) {
        this(intent, topics, targetDates, contextNeeds, toolRequests, riskHints, mediaAction, List.of());
    }

    public AgentPlan {
        topics = topics == null ? List.of() : List.copyOf(topics);
        targetDates = targetDates == null ? List.of() : List.copyOf(targetDates);
        contextNeeds = contextNeeds == null ? List.of() : List.copyOf(contextNeeds);
        toolRequests = toolRequests == null ? List.of() : List.copyOf(toolRequests);
        riskHints = riskHints == null ? List.of() : List.copyOf(riskHints);
        skillRequests = skillRequests == null ? List.of() : List.copyOf(skillRequests);
    }
}
