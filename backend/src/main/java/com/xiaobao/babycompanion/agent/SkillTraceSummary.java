package com.xiaobao.babycompanion.agent;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;

public record SkillTraceSummary(
        String skillId,
        SkillMode mode,
        String status,
        String modelProfile,
        String model,
        int batchCount,
        List<String> attachmentIds,
        Map<String, Object> inputSummary,
        Map<String, Object> resultSummary,
        List<AgentEffectDecision> effectCandidates,
        String userFacingError,
        String errorCode,
        long latencyMs,
        Instant startedAt,
        Instant completedAt
) {
    public SkillTraceSummary {
        attachmentIds = attachmentIds == null ? List.of() : List.copyOf(attachmentIds);
        inputSummary = inputSummary == null ? Map.of() : Map.copyOf(inputSummary);
        resultSummary = resultSummary == null ? Map.of() : Map.copyOf(resultSummary);
        effectCandidates = effectCandidates == null ? List.of() : List.copyOf(effectCandidates);
    }
}
