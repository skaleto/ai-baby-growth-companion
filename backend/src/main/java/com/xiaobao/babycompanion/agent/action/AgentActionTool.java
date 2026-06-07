package com.xiaobao.babycompanion.agent.action;

import com.xiaobao.babycompanion.agent.AgentTool;
import com.xiaobao.babycompanion.agent.AgentToolCall;
import com.xiaobao.babycompanion.agent.AgentToolResult;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;

public interface AgentActionTool extends AgentTool {

    AgentActionResult executeAction(AgentActionCall call, AgentActionContext context);

    @Override
    default AgentToolResult execute(AgentToolCall call, AgentChatRequest request) {
        throw new UnsupportedOperationException("Agent action tools require AgentActionContext");
    }
}
