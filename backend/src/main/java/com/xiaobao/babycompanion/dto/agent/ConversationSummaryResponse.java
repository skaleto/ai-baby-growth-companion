package com.xiaobao.babycompanion.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConversationSummaryResponse(
        boolean needed,
        String status,
        JsonNode conversationSummary
) {
}
