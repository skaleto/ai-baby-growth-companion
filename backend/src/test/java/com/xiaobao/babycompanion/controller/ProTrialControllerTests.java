package com.xiaobao.babycompanion.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.persistence.entity.AiUsageLogRecord;
import com.xiaobao.babycompanion.persistence.entity.DailySummaryRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialApplicationRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialEntitlementRecord;
import com.xiaobao.babycompanion.persistence.service.AiUsageLogRecordService;
import com.xiaobao.babycompanion.persistence.service.DailySummaryRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialApplicationRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialEntitlementRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/pro-trial",
        "auth.jwt.secret-file=target/test-data/pro-trial/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/pro-trial/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class ProTrialControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProTrialApplicationRecordService applicationService;

    @Autowired
    private ProTrialEntitlementRecordService entitlementService;

    @Autowired
    private DailySummaryRecordService summaryRecordService;

    @Autowired
    private AiUsageLogRecordService aiUsageLogRecordService;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/pro-trial/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void proTrialApplicationIsPersistedIdempotentlyAndVisibleInAppState() throws Exception {
        String inviteCode = inviteCode();
        LoginResult login = login(phone(), inviteCode, "妈妈", true);

        mockMvc.perform(post("/api/pro/trial/apply")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"my-page\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.application.status").value("pending"))
                .andExpect(jsonPath("$.application.source").value("my-page"));

        mockMvc.perform(post("/api/pro/trial/apply")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"record-today\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.application.status").value("pending"))
                .andExpect(jsonPath("$.application.source").value("record-today"));

        long applicationCount = applicationService.count(new QueryWrapper<ProTrialApplicationRecord>()
                .eq("family_id", login.familyId())
                .eq("user_id", login.userId()));
        assertEquals(1, applicationCount);

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.proTrial.enabled").value(false))
                .andExpect(jsonPath("$.state.proTrial.application.status").value("pending"))
                .andExpect(jsonPath("$.state.dailySummarySettings.enabled").value(true))
                .andExpect(jsonPath("$.state.dailySummarySettings.reminderTime").value("21:30"));
    }

    @Test
    void summaryGenerationRequiresProCaregiverAndDoesNotPersistAccountPrivateMissingItems() throws Exception {
        String inviteCode = inviteCode();
        LoginResult caregiver = login(phone(), inviteCode, "爸爸", true);
        grantPro(caregiver.familyId());

        mockMvc.perform(put("/api/app/state/careLogs/2026-05-14?mode=replace")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "2026-05-14",
                                  "date": "2026-05-14",
                                  "milkMl": 120,
                                  "milkTimes": 1,
                                  "events": [
                                    {"id": "milk-1", "type": "milk", "date": "2026-05-14", "time": "08:00", "amountMl": 120}
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/reminders/private-reminder")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "private-reminder",
                                  "title": "私密复诊提醒",
                                  "status": "active",
                                  "date": "2026-05-14"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/pro/daily-summary/generate")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-05-14\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("喂养记录")))
                .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("私密复诊提醒"))))
                .andExpect(jsonPath("$.missingItems[0].type").value("sleep"))
                .andExpect(jsonPath("$.accountMissingItems[0].scope").value("account"));

        DailySummaryRecord stored = summaryRecordService.getOne(new QueryWrapper<DailySummaryRecord>()
                .eq("family_id", caregiver.familyId())
                .eq("summary_date", "2026-05-14"), false);
        assertNotNull(stored);
        assertFalse(stored.getPayloadJson().contains("account-open-reminders"));
        assertFalse(stored.getPayloadJson().contains("私密复诊提醒"));

        long usageCount = aiUsageLogRecordService.count(new QueryWrapper<AiUsageLogRecord>()
                .eq("family_id", caregiver.familyId())
                .eq("feature", "daily_summary")
                .eq("success", "true"));
        assertTrue(usageCount >= 1);

        LoginResult viewer = login(phone(), inviteCode, "外婆", false);
        mockMvc.perform(get("/api/pro/daily-summary?date=2026-05-14")
                        .header(HttpHeaders.AUTHORIZATION, viewer.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("喂养记录")))
                .andExpect(jsonPath("$.accountMissingItems").value(hasSize(0)));

        mockMvc.perform(post("/api/pro/daily-summary/generate")
                        .header(HttpHeaders.AUTHORIZATION, viewer.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-05-14\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));
    }

    @Test
    void nonProFamilyCannotGenerateDailySummary() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "妈妈", true);

        mockMvc.perform(post("/api/pro/daily-summary/generate")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-05-14\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前家庭还没有开通 Pro 内测，先申请后再使用今日小结。"));
    }

    @Test
    void usageSummaryIsFamilyScopedAndLimitedToRequestedWindow() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "妈妈", true);
        LoginResult otherFamily = login(phone(), inviteCode(), "爸爸", true);
        Instant now = Instant.now();

        saveUsage(login.familyId(), login.userId(), "agent_chat", "deepseek", "deepseek-v4-pro", 100, 20, 120, now.minusSeconds(3600).toString());
        saveUsage(login.familyId(), login.userId(), "daily_summary", "rules", "daily-summary-v1", 25, 5, 30, now.minusSeconds(7200).toString());
        saveUsage(login.familyId(), login.userId(), "agent_stream", "doubao", "doubao-seed-2.0-pro", null, null, null, now.minusSeconds(9000).toString());
        saveUsage(login.familyId(), login.userId(), "old_call", "deepseek", "deepseek-v4-pro", 400, 100, 500, now.minusSeconds(40L * 24 * 3600).toString());
        saveUsage(otherFamily.familyId(), otherFamily.userId(), "agent_chat", "deepseek", "deepseek-v4-pro", 700, 80, 780, now.toString());

        mockMvc.perform(get("/api/pro/usage?days=30")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.requestCount").value(3))
                .andExpect(jsonPath("$.successfulRequestCount").value(3))
                .andExpect(jsonPath("$.meteredRequestCount").value(2))
                .andExpect(jsonPath("$.unmeteredRequestCount").value(1))
                .andExpect(jsonPath("$.inputTokens").value(125))
                .andExpect(jsonPath("$.outputTokens").value(25))
                .andExpect(jsonPath("$.totalTokens").value(150))
                .andExpect(jsonPath("$.byFeature[0].feature").value("agent_chat"))
                .andExpect(jsonPath("$.byFeature[0].totalTokens").value(120))
                .andExpect(jsonPath("$.byModel[0].provider").value("deepseek"))
                .andExpect(jsonPath("$.byModel[0].totalTokens").value(120));
    }

    private LoginResult login(String phone, String inviteCode, String roleName, boolean caregiver) throws Exception {
        ensureInviteCode(inviteCode);
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","inviteCode":"%s","roleName":"%s","caregiver":%s}
                                """.formatted(phone, inviteCode, roleName, caregiver)))
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

    private void ensureInviteCode(String inviteCode) throws Exception {
        String existing = Files.readString(inviteCodesPath);
        if (!existing.contains(inviteCode)) {
            Files.writeString(inviteCodesPath, inviteCode + "\n", StandardOpenOption.APPEND);
        }
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

    private void saveUsage(
            String familyId,
            String userId,
            String feature,
            String provider,
            String model,
            Integer inputTokens,
            Integer outputTokens,
            Integer totalTokens,
            String createdAt
    ) {
        AiUsageLogRecord record = new AiUsageLogRecord();
        record.setId("ai-usage-test-" + UUID.randomUUID());
        record.setFamilyId(familyId);
        record.setUserId(userId);
        record.setRequestId("request-" + UUID.randomUUID());
        record.setProvider(provider);
        record.setModel(model);
        record.setFeature(feature);
        record.setInputType("text");
        record.setInputTokens(inputTokens);
        record.setOutputTokens(outputTokens);
        record.setTotalTokens(totalTokens);
        record.setSuccess("true");
        record.setQuotaCounted("true");
        record.setCreatedAt(createdAt);
        aiUsageLogRecordService.save(record);
    }

    private String inviteCode() {
        return "P" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private String phone() {
        long suffix = Math.floorMod(System.nanoTime(), 100_000_000L);
        return "139" + String.format("%08d", suffix);
    }

    private record LoginResult(String token, String userId, String familyId) {
        private String bearer() {
            return "Bearer " + token;
        }
    }
}
