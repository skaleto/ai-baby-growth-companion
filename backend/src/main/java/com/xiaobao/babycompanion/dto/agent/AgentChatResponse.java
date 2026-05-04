package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

public record AgentChatResponse(
        String aiText,
        List<String> tags,
        AgentGrowthEvent growthEvent,
        AgentCareLog careLogPatch,
        List<AgentReminder> reminders,
        List<AgentMemory> memories,
        List<AgentSource> sources,
        List<AgentSafetyAlert> safetyAlerts,
        List<AgentEffectDecision> effectDecisions,
        List<String> usedSkills,
        String traceId,
        String model,
        String requestId
) {
}
