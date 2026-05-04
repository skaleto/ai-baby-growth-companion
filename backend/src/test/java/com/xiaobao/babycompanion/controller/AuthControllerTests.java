package com.xiaobao.babycompanion.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthHashing;
import com.xiaobao.babycompanion.persistence.DatabaseInitializer;
import com.xiaobao.babycompanion.persistence.entity.AuthInviteCodeRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthFamilyMemberRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthSessionRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthUserRecord;
import com.xiaobao.babycompanion.persistence.service.AuthFamilyMemberRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthInviteCodeRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthSessionRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthUserRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/auth-controller",
        "auth.jwt.secret-file=target/test-data/auth-controller/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/auth-controller/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class AuthControllerTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AuthInviteCodeRecordService inviteCodeService;
    @Autowired
    private AuthFamilyMemberRecordService familyMemberService;
    @Autowired
    private AuthUserRecordService userService;
    @Autowired
    private AuthSessionRecordService sessionService;
    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void writeInviteCodes() throws Exception {
        Files.createDirectories(Path.of("target/test-data/auth-controller/auth"));
        List<String> codes = List.of("AUTH-CODE-1", "AUTH-CODE-2", "AUTH-CODE-3", "AUTH-CODE-4");
        Files.writeString(Path.of("target/test-data/auth-controller/auth/invite_codes"), String.join("\n", codes));
        sessionService.remove(new QueryWrapper<AuthSessionRecord>());
        familyMemberService.remove(new QueryWrapper<AuthFamilyMemberRecord>());
        userService.remove(new QueryWrapper<AuthUserRecord>());
        inviteCodeService.remove(new QueryWrapper<AuthInviteCodeRecord>());
        for (String code : codes) {
            AuthInviteCodeRecord record = new AuthInviteCodeRecord();
            record.setId("invite-" + UUID.randomUUID());
            record.setCodeHash(AuthHashing.sha256Hex(AuthHashing.normalizedInviteCode(code)));
            record.setLabel(code);
            record.setActive("true");
            record.setCreatedAt(Instant.now().toString());
            inviteCodeService.save(record);
        }
    }

    @Test
    void rejectsInvalidPhone() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"123","inviteCode":"AUTH-CODE-1"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_FAILED"));
    }

    @Test
    void rejectsWrongInviteCode() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000111","inviteCode":"WRONG-CODE"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_FAILED"));
    }

    @Test
    void rejectsNewMemberWithoutIdentitySelection() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000114","inviteCode":"AUTH-CODE-1"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("请先选择家庭身份和是否照护人。"));
    }

    @Test
    void autoRegistersAndReturnsCurrentUser() throws Exception {
        String token = login("13800000112", "AUTH-CODE-2");

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.phone").value("13800000112"))
                .andExpect(jsonPath("$.family.name").value("小宝家"))
                .andExpect(jsonPath("$.member.roleName").value("妈妈"))
                .andExpect(jsonPath("$.member.caregiver").value(true))
                .andExpect(jsonPath("$.onboardingRequired").value(true));
    }

    @Test
    void allowsMultiplePhonesToJoinSameFamilyInvite() throws Exception {
        JsonNode firstLogin = loginPayload("13800000115", "AUTH-CODE-4", "爸爸", true);
        JsonNode secondLogin = loginPayload("13800000116", "AUTH-CODE-4", "外婆", false);
        String firstToken = firstLogin.get("accessToken").asText();
        String secondToken = secondLogin.get("accessToken").asText();
        String familyId = firstLogin.at("/family/id").asText();

        assertThat(familyId).startsWith("family-");
        assertThat(familyId).isNotEqualTo(DatabaseInitializer.DEFAULT_FAMILY_ID);
        assertThat(secondLogin.at("/family/id").asText()).isEqualTo(familyId);

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.family.id").value(familyId))
                .andExpect(jsonPath("$.member.roleName").value("爸爸"))
                .andExpect(jsonPath("$.member.caregiver").value(true));

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.family.id").value(familyId))
                .andExpect(jsonPath("$.member.roleName").value("外婆"))
                .andExpect(jsonPath("$.member.caregiver").value(false));
    }

    @Test
    void rejectsDuplicateUniqueRoleInSameFamily() throws Exception {
        loginPayload("13800000125", "AUTH-CODE-4", "爸爸", true);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000126","inviteCode":"AUTH-CODE-4","roleName":"爸爸","caregiver":true}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("这个家庭已经有爸爸了，请选择其他身份。"));

        loginPayload("13800000127", "AUTH-CODE-4", "月嫂", true);
        loginPayload("13800000128", "AUTH-CODE-4", "月嫂", true);
    }

    @Test
    void previewsOccupiedRolesForFamilyInvite() throws Exception {
        loginPayload("13800000129", "AUTH-CODE-4", "爸爸", true);

        mockMvc.perform(get("/api/auth/invite/roles")
                        .param("inviteCode", "AUTH-CODE-4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.familyName").value("小宝家"))
                .andExpect(jsonPath("$.occupiedRoles[0]").value("爸爸"))
                .andExpect(jsonPath("$.uniqueRoles").isArray())
                .andExpect(jsonPath("$.repeatableRoles").isArray());

        mockMvc.perform(get("/api/auth/invite/roles")
                        .param("inviteCode", "AUTH-CODE-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.occupiedRoles.length()").value(0));
    }

    @Test
    void unusedInviteCreatesSeparateFamily() throws Exception {
        JsonNode firstLogin = loginPayload("13800000119", "AUTH-CODE-1", "妈妈", true);
        JsonNode secondLogin = loginPayload("13800000120", "AUTH-CODE-2", "爸爸", true);

        assertThat(firstLogin.at("/family/id").asText()).startsWith("family-");
        assertThat(secondLogin.at("/family/id").asText()).startsWith("family-");
        assertThat(firstLogin.at("/family/id").asText()).isNotEqualTo(secondLogin.at("/family/id").asText());
        assertThat(firstLogin.get("onboardingRequired").asBoolean()).isTrue();
        assertThat(secondLogin.get("onboardingRequired").asBoolean()).isTrue();
    }

    @Test
    void existingMemberCannotClaimUnusedInvite() throws Exception {
        JsonNode firstLogin = loginPayload("13800000123", "AUTH-CODE-1", "爸爸", true);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000123","inviteCode":"AUTH-CODE-2","roleName":"爸爸","caregiver":true}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("手机号已加入家庭，请使用原家庭邀请码登录。"));

        String secondCodeHash = AuthHashing.sha256Hex(AuthHashing.normalizedInviteCode("AUTH-CODE-2"));
        AuthInviteCodeRecord secondInvite = inviteCodeService.getOne(
                new QueryWrapper<AuthInviteCodeRecord>().eq("code_hash", secondCodeHash), false
        );
        assertThat(secondInvite.getFamilyId()).isNullOrEmpty();

        JsonNode secondLogin = loginPayload("13800000124", "AUTH-CODE-2", "妈妈", true);
        assertThat(secondLogin.at("/family/id").asText()).isNotEqualTo(firstLogin.at("/family/id").asText());
    }

    @Test
    void usedDefaultInviteGetsDedicatedFamilyForFutureMembers() throws Exception {
        String codeHash = AuthHashing.sha256Hex(AuthHashing.normalizedInviteCode("AUTH-CODE-3"));
        AuthInviteCodeRecord invite = inviteCodeService.getOne(new QueryWrapper<AuthInviteCodeRecord>().eq("code_hash", codeHash), false);
        String legacyUserId = "user-legacy-default";
        invite.setFamilyId(DatabaseInitializer.DEFAULT_FAMILY_ID);
        invite.setAssignedUserId(legacyUserId);
        invite.setUsedAt(Instant.now().toString());
        inviteCodeService.updateById(invite);

        AuthUserRecord legacyUser = new AuthUserRecord();
        legacyUser.setId(legacyUserId);
        legacyUser.setPhone("13800000121");
        legacyUser.setInviteCodeHash(codeHash);
        legacyUser.setCreatedAt(Instant.now().toString());
        legacyUser.setLastLoginAt(Instant.now().toString());
        userService.save(legacyUser);

        AuthFamilyMemberRecord legacyMember = new AuthFamilyMemberRecord();
        legacyMember.setId("member-legacy-default");
        legacyMember.setFamilyId(DatabaseInitializer.DEFAULT_FAMILY_ID);
        legacyMember.setUserId(legacyUserId);
        legacyMember.setRoleName("爸爸");
        legacyMember.setIsCaregiver("true");
        legacyMember.setJoinedInviteCodeId(invite.getId());
        legacyMember.setJoinedAt(Instant.now().toString());
        legacyMember.setLastSeenAt(Instant.now().toString());
        familyMemberService.save(legacyMember);

        JsonNode secondLogin = loginPayload("13800000122", "AUTH-CODE-3", "妈妈", true);
        String familyId = secondLogin.at("/family/id").asText();

        assertThat(familyId).startsWith("family-");
        assertThat(familyId).isNotEqualTo(DatabaseInitializer.DEFAULT_FAMILY_ID);
        AuthFamilyMemberRecord movedLegacyMember = familyMemberService.getOne(
                new QueryWrapper<AuthFamilyMemberRecord>().eq("user_id", legacyUserId), false
        );
        assertThat(movedLegacyMember.getFamilyId()).isEqualTo(familyId);
    }

    @Test
    void repeatedLoginKeepsExistingMemberIdentity() throws Exception {
        String token = login("13800000117", "AUTH-CODE-4", "爸爸", true);
        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        String secondToken = login("13800000117", "AUTH-CODE-4", "亲友", false);

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member.roleName").value("爸爸"))
                .andExpect(jsonPath("$.member.caregiver").value(true));
    }

    @Test
    void repeatedLoginCanFillPlaceholderMemberIdentity() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000118","inviteCode":"AUTH-CODE-4","roleName":"家庭成员","caregiver":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member.roleName").value("家庭成员"))
                .andExpect(jsonPath("$.member.caregiver").value(true));

        String secondToken = login("13800000118", "AUTH-CODE-4", "外婆", false);

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member.roleName").value("外婆"))
                .andExpect(jsonPath("$.member.caregiver").value(false));
    }

    @Test
    void revokesSessionOnLogout() throws Exception {
        String token = login("13800000113", "AUTH-CODE-3");

        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requiresAuthForStateApi() throws Exception {
        mockMvc.perform(get("/api/app/state"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    private String login(String phone, String inviteCode) throws Exception {
        return login(phone, inviteCode, "妈妈", true);
    }

    private String login(String phone, String inviteCode, String roleName, boolean caregiver) throws Exception {
        JsonNode payload = loginPayload(phone, inviteCode, roleName, caregiver);
        return payload.get("accessToken").asText();
    }

    private JsonNode loginPayload(String phone, String inviteCode, String roleName, boolean caregiver) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","inviteCode":"%s","roleName":"%s","caregiver":%s}
                                """.formatted(phone, inviteCode, roleName, caregiver)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }
}
