package com.xiaobao.babycompanion.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
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
        "app.storage.data-dir=target/test-data/upload-poster",
        "auth.jwt.secret-file=target/test-data/upload-poster/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/upload-poster/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class UploadPosterControllerTests {

    // 1x1 黑色 JPEG(ImageIO 可解码)
    private static final String JPEG_1PX_BASE64 =
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private Path inviteCodesPath;

    @BeforeEach
    void setUpInviteFile() throws Exception {
        inviteCodesPath = Path.of("target/test-data/upload-poster/auth/invite_codes");
        Files.createDirectories(inviteCodesPath.getParent());
        if (!Files.exists(inviteCodesPath)) {
            Files.writeString(inviteCodesPath, "# test invite codes\n");
        }
    }

    @Test
    void backfillsMissingVideoPosterAndStaysIdempotent() throws Exception {
        LoginResult login = login(phone(), inviteCode(), "妈妈", true);
        String attachmentId = "video-" + UUID.randomUUID();
        uploadVideoWithoutThumbnail(login, attachmentId);

        String firstBody = mockMvc.perform(post("/api/uploads/" + attachmentId + "/poster")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"thumbnailDataUrl\":\"data:image/jpeg;base64," + JPEG_1PX_BASE64 + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(attachmentId))
                .andReturn().getResponse().getContentAsString();
        JsonNode first = objectMapper.readTree(firstBody);
        String thumbnailUrl = first.path("thumbnailUrl").asText();
        org.junit.jupiter.api.Assertions.assertTrue(
                thumbnailUrl != null && !thumbnailUrl.isBlank(),
                "poster backfill should produce a thumbnailUrl");

        // 幂等:再传一张(即使内容不同)不得覆盖已有封面
        String secondBody = mockMvc.perform(post("/api/uploads/" + attachmentId + "/poster")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"thumbnailDataUrl\":\"data:image/jpeg;base64," + JPEG_1PX_BASE64 + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode second = objectMapper.readTree(secondBody);
        assertEquals(first.path("thumbnailPath").asText(), second.path("thumbnailPath").asText(),
                "second poster upload must not replace the existing thumbnail");
    }

    @Test
    void rejectsViewerAndNonVideoAndGarbagePayload() throws Exception {
        LoginResult caregiver = login(phone(), inviteCode(), "妈妈", true);
        String videoId = "video-" + UUID.randomUUID();
        uploadVideoWithoutThumbnail(caregiver, videoId);

        // 仅查看成员(同家庭,caregiver=false)不可回填
        LoginResult viewer = login(phone(), caregiver.inviteCode(), "亲友", false);
        mockMvc.perform(post("/api/uploads/" + videoId + "/poster")
                        .header(HttpHeaders.AUTHORIZATION, viewer.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"thumbnailDataUrl\":\"data:image/jpeg;base64," + JPEG_1PX_BASE64 + "\"}"))
                .andExpect(status().is4xxClientError());

        // 非法 payload(非图片 dataUrl)
        mockMvc.perform(post("/api/uploads/" + videoId + "/poster")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"thumbnailDataUrl\":\"data:text/plain;base64,aGk=\"}"))
                .andExpect(status().is4xxClientError());

        // 图片附件不适用本端点
        String imageId = "image-" + UUID.randomUUID();
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + imageId + "\",\"kind\":\"image\",\"name\":\"p.jpg\",\"dataUrl\":\"data:image/jpeg;base64," + JPEG_1PX_BASE64 + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/uploads/" + imageId + "/poster")
                        .header(HttpHeaders.AUTHORIZATION, caregiver.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"thumbnailDataUrl\":\"data:image/jpeg;base64," + JPEG_1PX_BASE64 + "\"}"))
                .andExpect(status().is4xxClientError());
    }

    private void uploadVideoWithoutThumbnail(LoginResult login, String attachmentId) throws Exception {
        byte[] mp4 = new byte[]{0, 0, 0, 24, 'f', 't', 'y', 'p', 'm', 'p', '4', '2', 0, 0, 0, 0, 'm', 'p', '4', '2', 'i', 's', 'o', 'm'};
        String videoB64 = Base64.getEncoder().encodeToString(mp4);
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, login.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + attachmentId + "\",\"kind\":\"video\",\"name\":\"clip.mp4\",\"dataUrl\":\"data:video/mp4;base64," + videoB64 + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(attachmentId));
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
                payload.path("family").path("id").asText(),
                inviteCode
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

    private record LoginResult(String token, String familyId, String inviteCode) {
        private String bearer() {
            return "Bearer " + token;
        }
    }
}
