package com.xiaobao.babycompanion.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import com.xiaobao.babycompanion.persistence.entity.ClientErrorRecord;
import com.xiaobao.babycompanion.persistence.service.ClientErrorRecordService;
import com.xiaobao.babycompanion.service.ClientErrorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/client-errors",
        "auth.jwt.secret-file=target/test-data/client-errors/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/client-errors/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class ClientErrorControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientErrorRecordService recordService;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/client-errors/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void authenticatedReportAttachesFamilyAndUser() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "妈妈", true);
        String marker = "auth-crash-" + UUID.randomUUID();

        mockMvc.perform(post("/api/client-errors")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"crash","message":"%s","page":"AlbumScreen",
                                 "appVersion":"0.1.0","bundleVersion":"0.1.1","deviceInfo":"iPhone15,2 iOS 17.4"}
                                """.formatted(marker)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(true));

        ClientErrorRecord record = findByMessage(marker);
        assertNotNull(record);
        assertEquals("crash", record.getKind());
        assertEquals(login.familyId(), record.getFamilyId());
        assertEquals(login.userId(), record.getUserId());
        assertEquals("AlbumScreen", record.getPage());
        assertEquals("0.1.0", record.getAppVersion());
        assertEquals("0.1.1", record.getBundleVersion());
        assertEquals("iPhone15,2 iOS 17.4", record.getDeviceInfo());
        assertNotNull(record.getCreatedAt());
    }

    @Test
    void unauthenticatedReportIsAcceptedWithEmptyIdentity() throws Exception {
        String marker = "anon-whitescreen-" + UUID.randomUUID();

        mockMvc.perform(post("/api/client-errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"whitescreen","message":"%s","deviceInfo":"Pixel 8 Android 14"}
                                """.formatted(marker)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(true));

        ClientErrorRecord record = findByMessage(marker);
        assertNotNull(record);
        assertEquals("whitescreen", record.getKind());
        assertNull(record.getFamilyId());
        assertNull(record.getUserId());
        assertEquals("Pixel 8 Android 14", record.getDeviceInfo());
    }

    @Test
    void oversizedMessageIsTruncated() throws Exception {
        String prefix = "long-" + UUID.randomUUID() + "-";
        String longMessage = prefix + "x".repeat(5000);
        String body = objectMapper.writeValueAsString(
                objectMapper.createObjectNode()
                        .put("kind", "api_fail")
                        .put("message", longMessage));

        mockMvc.perform(post("/api/client-errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(true));

        ClientErrorRecord record = recordService.getOne(new QueryWrapper<ClientErrorRecord>()
                .likeRight("message", prefix), false);
        assertNotNull(record);
        assertEquals(ClientErrorService.MAX_MESSAGE_LENGTH, record.getMessage().length());
        assertTrue(record.getMessage().startsWith(prefix));
    }

    @Test
    void unknownKindIsAcceptedAndStoredAsUnknown() throws Exception {
        String marker = "bad-kind-" + UUID.randomUUID();

        mockMvc.perform(post("/api/client-errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind":"not_a_real_kind","message":"%s"}
                                """.formatted(marker)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(true));

        ClientErrorRecord record = findByMessage(marker);
        assertNotNull(record);
        assertEquals(ClientErrorService.UNKNOWN_KIND, record.getKind());
    }

    private ClientErrorRecord findByMessage(String message) {
        return recordService.getOne(new QueryWrapper<ClientErrorRecord>()
                .eq("message", message), false);
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
