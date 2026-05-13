package com.xiaobao.babycompanion.dto.agent;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AgentSafetyAlert(
        String level,
        String category,
        String message,
        String recommendedAction
) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public AgentSafetyAlert(String message) {
        this("info", "general", message, null);
    }
}
