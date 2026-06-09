package com.xiaobao.babycompanion.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅保留无鉴权的健康检查 /api/health（部署脚本与云端 e2e 探针在用）。
 * 旧的 /api/ai/chat（无鉴权直连 DeepSeek 的透传口）已移除——所有 AI 入口统一走
 * /api/agent/*，并经 ProTrialService.requireAiAccess 做 Pro/免费额度门禁。
 */
@RestController
@RequestMapping("/api")
public class AiChatController {

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("ok");
    }
}
