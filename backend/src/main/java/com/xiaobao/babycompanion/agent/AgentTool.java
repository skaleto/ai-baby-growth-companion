package com.xiaobao.babycompanion.agent;

import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekTool;

public interface AgentTool {

    String id();

    String displayName();

    String runningMessage();

    DeepSeekTool definition();

    AgentToolResult execute(AgentToolCall call, AgentChatRequest request);
}
