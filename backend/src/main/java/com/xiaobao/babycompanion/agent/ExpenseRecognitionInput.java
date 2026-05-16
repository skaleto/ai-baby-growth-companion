package com.xiaobao.babycompanion.agent;

import java.util.List;

import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;

public record ExpenseRecognitionInput(
        AgentChatRequest request,
        RecordSignals signals,
        String traceId,
        RuntimeModel runtimeModel,
        AgentRuntimeProperties.ModelProfile profile,
        List<VisualAttachmentInput> visualInputs
) {
    public ExpenseRecognitionInput {
        visualInputs = visualInputs == null ? List.of() : List.copyOf(visualInputs);
        profile = profile == null ? new AgentRuntimeProperties.ModelProfile() : profile;
    }
}
