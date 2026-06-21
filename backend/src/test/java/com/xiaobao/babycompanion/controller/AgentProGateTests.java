package com.xiaobao.babycompanion.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.persistence.entity.AiUsageLogRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialEntitlementRecord;
import com.xiaobao.babycompanion.persistence.service.AiUsageLogRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialEntitlementRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * T1：统一边界下「凡走 AI 助手即 Pro」的服务端门禁。
 * 边界口径 = Pro 家庭不限次；Free 家庭每月 {@code app.pro.free-monthly-ai-quota}（默认 10）次免费体验，
 * 超出即 403 / PRO_QUOTA_EXCEEDED 引导申请内测。
 *
 * 判别原理：本测试 profile 未配置任何模型 key，故"过了门禁"的请求会在 AgentRuntime 处得到 503；
 * 因此 503 == 门禁放行，403 == 门禁拦截。每个用例使用独立家庭，避免跨用例的用量污染。
 */
@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/agent-pro-gate",
        "auth.jwt.secret-file=target/test-data/agent-pro-gate/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/agent-pro-gate/auth/invite_codes",
        "app.pro.free-monthly-ai-quota=10",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class AgentProGateTests {

    private static final String CHAT_BODY = """
            {
              "message": "今天小宝喝奶 5 次，每次 120ml",
              "recentMessages": [],
              "careLogs": [],
              "memories": [],
              "attachments": []
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AiUsageLogRecordService aiUsageLogRecordService;

    @Autowired
    private ProTrialEntitlementRecordService entitlementService;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/agent-pro-gate/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void freeFamilyUnderMonthlyQuotaReachesRuntime() throws Exception {
        LoginResult caregiver = login();
        seedTopLevelAiCalls(caregiver, 9);

        // 未超额 → 门禁放行 → 无 key 的 runtime 返回 503（而非 403）
        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAT_BODY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }

    @Test
    void freeFamilyOverMonthlyQuotaIsBlockedWithProQuotaCode() throws Exception {
        LoginResult caregiver = login();
        seedTopLevelAiCalls(caregiver, 10);

        // 达到 10 次免费额度 → 门禁拦截 → 403 + PRO_QUOTA_EXCEEDED
        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAT_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PRO_QUOTA_EXCEEDED"));
    }

    @Test
    void streamOverMonthlyQuotaStillReturnsJsonProQuotaErrorForSseAccept() throws Exception {
        LoginResult caregiver = login();
        seedTopLevelAiCalls(caregiver, 10);

        mockMvc.perform(post("/api/agent/chat/stream")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAT_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PRO_QUOTA_EXCEEDED"));
    }

    @Test
    void proFamilyBypassesMonthlyQuota() throws Exception {
        LoginResult caregiver = login();
        seedTopLevelAiCalls(caregiver, 10);
        grantPro(caregiver.familyId());

        // 已开通 Pro → 即使早已超出免费额度也放行 → 503（而非 403）
        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAT_BODY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }

    @Test
    void subStepUsageDoesNotCountAgainstFreeQuota() throws Exception {
        LoginResult caregiver = login();
        // 同一回合内部的子步（planner / 视觉 / 记账 / 会话压缩）不应计入免费次数
        seedTopLevelAiCalls(caregiver, 3);
        seedUsage(caregiver, "agent_planner", 20);
        seedUsage(caregiver, "agent_visual_analysis", 20);
        seedUsage(caregiver, "agent_expense_recognition", 20);
        seedUsage(caregiver, "conversation_summary", 20);

        // 顶层只有 3 次 < 10 → 放行 → 503
        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAT_BODY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }

    private void seedTopLevelAiCalls(LoginResult caregiver, int count) {
        for (int i = 0; i < count; i++) {
            seedUsage(caregiver, i % 2 == 0 ? "agent_chat" : "agent_stream", i);
        }
    }

    private void seedUsage(LoginResult caregiver, String feature, int ageMinutes) {
        AiUsageLogRecord record = new AiUsageLogRecord();
        record.setId("ai-usage-test-" + UUID.randomUUID());
        record.setFamilyId(caregiver.familyId());
        record.setUserId(caregiver.userId());
        record.setRequestId("request-" + UUID.randomUUID());
        record.setProvider("deepseek");
        record.setModel("deepseek-v4-pro");
        record.setFeature(feature);
        record.setInputType("text");
        record.setInputTokens(100);
        record.setOutputTokens(20);
        record.setTotalTokens(120);
        record.setSuccess("true");
        record.setQuotaCounted("true");
        record.setCreatedAt(Instant.now().minusSeconds(60L * ageMinutes).toString());
        aiUsageLogRecordService.save(record);
    }

    private void grantPro(String familyId) {
        String now = Instant.now().toString();
        ProTrialEntitlementRecord record = new ProTrialEntitlementRecord();
        record.setId("pro-entitlement-" + familyId);
        record.setFamilyId(familyId);
        record.setEnabled("true");
        record.setPlanCode("beta");
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        entitlementService.saveOrUpdate(record);
    }

    private LoginResult login() throws Exception {
        String inviteCode = "P" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String existing = Files.readString(inviteCodesPath);
        if (!existing.contains(inviteCode)) {
            Files.writeString(inviteCodesPath, inviteCode + "\n", StandardOpenOption.APPEND);
        }
        long suffix = Math.floorMod(System.nanoTime(), 100_000_000L);
        String phone = "139" + String.format("%08d", suffix);
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","inviteCode":"%s","roleName":"妈妈","caregiver":true}
                                """.formatted(phone, inviteCode)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode payload = objectMapper.readTree(body);
        return new LoginResult(
                payload.path("accessToken").asText(),
                payload.path("user").path("id").asText(),
                payload.path("family").path("id").asText()
        );
    }

    private record LoginResult(String token, String userId, String familyId) {
        private String bearer() {
            return "Bearer " + token;
        }
    }
}
