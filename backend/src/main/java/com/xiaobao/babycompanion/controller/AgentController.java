package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.agent.AgentRequestGuard;
import com.xiaobao.babycompanion.agent.AgentRuntime;
import com.xiaobao.babycompanion.agent.AgentModelContextHarness;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.ConversationSummaryResponse;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private final AgentRuntime agentRuntime;
    private final CurrentUser currentUser;
    private final AgentRequestGuard requestGuard;

    public AgentController(AgentRuntime agentRuntime, CurrentUser currentUser, AgentRequestGuard requestGuard) {
        this.agentRuntime = agentRuntime;
        this.currentUser = currentUser;
        this.requestGuard = requestGuard;
    }

    @PostMapping("/chat")
    public AgentChatResponse chat(@Valid @RequestBody AgentChatRequest request) {
        currentUser.requireCaregiver();
        requestGuard.checkAllowed(currentUser.requireFamilyId());
        return agentRuntime.chat(request);
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody AgentChatRequest request) {
        currentUser.requireCaregiver();
        requestGuard.checkAllowed(currentUser.requireFamilyId());
        return agentRuntime.stream(request);
    }

    @GetMapping("/harness")
    public Map<String, Object> harnessInfo() {
        currentUser.requireCaregiver();
        requestGuard.checkAllowed(currentUser.requireFamilyId());
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("resource", AgentModelContextHarness.resourcePath());
        info.put("version", AgentModelContextHarness.version());
        info.put("sha256", AgentModelContextHarness.sha256());
        info.put("length", AgentModelContextHarness.length());
        return info;
    }

    @PostMapping("/conversation-summary/compress")
    public ConversationSummaryResponse compressConversationSummary() {
        currentUser.requireCaregiver();
        requestGuard.checkAllowed(currentUser.requireFamilyId());
        return agentRuntime.compressConversationSummary();
    }
}
