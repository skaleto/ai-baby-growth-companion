package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;

public record ExpenseRecognitionResult(
        String status,
        String aiTextDraft,
        String userFacingError,
        List<AgentEffectDecision> effectCandidates,
        List<String> clarifications,
        List<Map<String, Object>> evidence,
        List<VisualAnalysisResult> visualAnalysisResults,
        SkillTraceSummary traceSummary
) {
    public ExpenseRecognitionResult {
        effectCandidates = effectCandidates == null ? List.of() : List.copyOf(effectCandidates);
        clarifications = clarifications == null ? List.of() : List.copyOf(clarifications);
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
        visualAnalysisResults = visualAnalysisResults == null ? List.of() : List.copyOf(visualAnalysisResults);
    }
}
