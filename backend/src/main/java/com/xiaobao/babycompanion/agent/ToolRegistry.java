package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

@Component
public class ToolRegistry {

    private final List<AgentTool> tools;

    public ToolRegistry(List<AgentTool> tools) {
        this.tools = tools;
    }

    public List<AgentTool> availableTools() {
        return tools;
    }

    public Optional<AgentTool> find(String id) {
        return tools.stream()
                .filter((tool) -> tool.id().equals(id))
                .findFirst();
    }
}
