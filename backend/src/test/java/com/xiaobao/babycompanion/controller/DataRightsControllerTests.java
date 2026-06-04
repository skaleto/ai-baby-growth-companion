package com.xiaobao.babycompanion.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.persistence.entity.DataRightsRequestRecord;
import com.xiaobao.babycompanion.persistence.service.DataRightsRequestRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/data-rights",
        "auth.jwt.secret-file=target/test-data/data-rights/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/data-rights/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class DataRightsControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataRightsRequestRecordService recordService;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/data-rights/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void submitRequestPersistsPendingForEachSupportedType() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "妈妈", true);

        for (String type : new String[]{"export", "delete_family", "delete_media", "account_deletion"}) {
            mockMvc.perform(post("/api/data-rights/request")
                            .header(HttpHeaders.AUTHORIZATION, login.bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"type\":\"%s\",\"reason\":\"reason-%s\"}".formatted(type, type)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.requestId").value(startsWith("dr-")))
                    .andExpect(jsonPath("$.type").value(type))
                    .andExpect(jsonPath("$.status").value("pending"))
                    .andExpect(jsonPath("$.createdAt").isNotEmpty());
        }

        long pendingCount = recordService.count(new QueryWrapper<DataRightsRequestRecord>()
                .eq("user_id", login.userId())
                .eq("status", "pending"));
        assertEquals(4, pendingCount);

        DataRightsRequestRecord exportRecord = recordService.getOne(new QueryWrapper<DataRightsRequestRecord>()
                .eq("user_id", login.userId())
                .eq("type", "export"), false);
        assertNotNull(exportRecord);
        assertEquals(login.familyId(), exportRecord.getFamilyId());
        assertEquals("pending", exportRecord.getStatus());
        assertEquals("reason-export", exportRecord.getReason());
    }

    @Test
    void invalidTypeReturnsBadRequest() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "爸爸", true);

        mockMvc.perform(post("/api/data-rights/request")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"delete_everything\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        long count = recordService.count(new QueryWrapper<DataRightsRequestRecord>()
                .eq("user_id", login.userId()));
        assertEquals(0, count);
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mockMvc.perform(post("/api/data-rights/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"export\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/data-rights/requests"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listReturnsOnlyOwnRequestsNewestFirst() throws Exception {
        String inviteCode = inviteCode();
        LoginResult owner = login(phone(), inviteCode, "妈妈", true);
        LoginResult other = login(phone(), inviteCode, "爸爸", true);

        submit(owner, "export");
        submit(owner, "delete_media");
        submit(other, "account_deletion");

        mockMvc.perform(get("/api/data-rights/requests")
                        .header(HttpHeaders.AUTHORIZATION, owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].type").value("delete_media"))
                .andExpect(jsonPath("$[1].type").value("export"));

        mockMvc.perform(get("/api/data-rights/requests")
                        .header(HttpHeaders.AUTHORIZATION, other.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].type").value("account_deletion"));
    }

    private void submit(LoginResult login, String type) throws Exception {
        mockMvc.perform(post("/api/data-rights/request")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"%s\"}".formatted(type)))
                .andExpect(status().isOk());
        // Ensure distinct, strictly increasing createdAt values for deterministic ordering.
        Thread.sleep(5);
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
