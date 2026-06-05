package com.xiaobao.babycompanion.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/family-member",
        "auth.jwt.secret-file=target/test-data/family-member/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/family-member/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class FamilyMemberManagementTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/family-member/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void caregiverListsRemovesMembersAndRevokesKickedToken() throws Exception {
        String invite = inviteCode();
        LoginResult mom = login(phone(), invite, "妈妈", true);
        LoginResult grandma = login(phone(), invite, "外婆", false);
        assertEquals(mom.familyId(), grandma.familyId());

        // caregiver: 看到 2 成员、canManage=true
        mockMvc.perform(get("/api/auth/family/members").header(HttpHeaders.AUTHORIZATION, mom.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(true))
                .andExpect(jsonPath("$.members", hasSize(2)));

        // viewer: canManage=false
        mockMvc.perform(get("/api/auth/family/members").header(HttpHeaders.AUTHORIZATION, grandma.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(false));

        // viewer 不能踢人 -> 403
        mockMvc.perform(delete("/api/auth/family/members/" + mom.userId())
                        .header(HttpHeaders.AUTHORIZATION, grandma.bearer()))
                .andExpect(status().isForbidden());

        // caregiver 不能踢自己 -> 400
        mockMvc.perform(delete("/api/auth/family/members/" + mom.userId())
                        .header(HttpHeaders.AUTHORIZATION, mom.bearer()))
                .andExpect(status().isBadRequest());

        // caregiver 踢 viewer -> 200
        mockMvc.perform(delete("/api/auth/family/members/" + grandma.userId())
                        .header(HttpHeaders.AUTHORIZATION, mom.bearer()))
                .andExpect(status().isOk());

        // 被踢者 token 立即失效（session 撤销）-> 401
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, grandma.bearer()))
                .andExpect(status().isUnauthorized());

        // 成员列表只剩 mom
        mockMvc.perform(get("/api/auth/family/members").header(HttpHeaders.AUTHORIZATION, mom.bearer()))
                .andExpect(jsonPath("$.members", hasSize(1)));
    }

    @Test
    void demotingMemberRevokesTheirTokenAndSelfDemotionIsRejected() throws Exception {
        String invite = inviteCode();
        LoginResult mom = login(phone(), invite, "妈妈", true);
        LoginResult dad = login(phone(), invite, "爸爸", true);

        // mom 把 dad 降为只读
        mockMvc.perform(put("/api/auth/family/members/" + dad.userId() + "/caregiver")
                        .header(HttpHeaders.AUTHORIZATION, mom.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"caregiver\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caregiver").value(false));

        // dad 旧 token 失效（强制重登）-> 401
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, dad.bearer()))
                .andExpect(status().isUnauthorized());

        // mom 不能撤销自己的照护权限 -> 400
        mockMvc.perform(put("/api/auth/family/members/" + mom.userId() + "/caregiver")
                        .header(HttpHeaders.AUTHORIZATION, mom.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"caregiver\":false}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetInviteCodeInvalidatesOldAndIssuesWorkingNewCode() throws Exception {
        String invite = inviteCode();
        LoginResult mom = login(phone(), invite, "妈妈", true);

        String body = mockMvc.perform(post("/api/auth/family/invite-code/reset")
                        .header(HttpHeaders.AUTHORIZATION, mom.bearer()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String newCode = objectMapper.readTree(body).path("inviteCode").asText();

        // 旧码已作废 -> 新人用旧码登录失败 401
        String strangerPhone = phone();
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","inviteCode":"%s","roleName":"亲友","caregiver":false}
                                """.formatted(strangerPhone, invite)))
                .andExpect(status().isUnauthorized());

        // 新码可用，加入同一家庭
        LoginResult joiner = login(phone(), newCode, "亲友", false);
        assertEquals(mom.familyId(), joiner.familyId());
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
        return "F" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
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
