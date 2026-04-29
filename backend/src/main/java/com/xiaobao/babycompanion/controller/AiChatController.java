package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.dto.ChatRequest;
import com.xiaobao.babycompanion.dto.ChatResponse;
import com.xiaobao.babycompanion.service.DeepSeekChatService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AiChatController {

    private final DeepSeekChatService chatService;

    public AiChatController(DeepSeekChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/ai/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return chatService.chat(request);
    }
}
