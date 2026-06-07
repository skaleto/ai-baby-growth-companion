package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

public record AgentActionResult(
        String status,
        String toolName,
        String mutationType,
        List<String> recordIds,
        String pendingEffectId,
        Map<String, Object> facts,
        String userMessage,
        List<String> missingFields,
        List<String> warnings
) {
    public AgentActionResult {
        recordIds = recordIds == null ? List.of() : List.copyOf(recordIds);
        facts = facts == null ? Map.of() : Map.copyOf(facts);
        missingFields = missingFields == null ? List.of() : List.copyOf(missingFields);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }

    public static AgentActionResult needsInput(String toolName, String mutationType, String userMessage, List<String> missingFields) {
        return new AgentActionResult(
                "needs_input",
                toolName,
                mutationType,
                List.of(),
                null,
                Map.of(),
                userMessage,
                missingFields,
                List.of()
        );
    }

    public static AgentActionResult unsupported(String toolName, String userMessage) {
        return new AgentActionResult(
                "unsupported",
                toolName,
                "none",
                List.of(),
                null,
                Map.of(),
                userMessage,
                List.of(),
                List.of()
        );
    }

    public static AgentActionResult failed(String toolName, String mutationType, String userMessage, String warning) {
        return new AgentActionResult(
                "failed",
                toolName,
                mutationType,
                List.of(),
                null,
                Map.of(),
                userMessage,
                List.of(),
                warning == null || warning.isBlank() ? List.of() : List.of(warning)
        );
    }
}
