package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AgentChatRequest(
        @NotBlank(message = "message is required")
        @Size(max = 4000, message = "message must be at most 4000 characters")
        String message,

        @Size(max = 80, message = "model must be at most 80 characters")
        String model,

        @Valid
        AgentBabyProfile babyProfile,

        @Size(max = 32, message = "recentMessages must include at most 32 items")
        List<@Valid AgentChatMessage> recentMessages,

        @Size(max = 32, message = "careLogs must include at most 32 items")
        List<@Valid AgentCareLog> careLogs,

        @Size(max = 32, message = "memories must include at most 32 items")
        List<@Valid AgentMemory> memories,

        @Size(max = 8, message = "attachments must include at most 8 items")
        List<@Valid AgentAttachment> attachments,

        JsonNode pageContext,

        Boolean thinkingEnabled
) {
}
