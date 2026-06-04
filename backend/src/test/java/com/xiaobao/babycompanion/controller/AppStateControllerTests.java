package com.xiaobao.babycompanion.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import com.xiaobao.babycompanion.persistence.entity.AttachmentRecord;
import com.xiaobao.babycompanion.persistence.service.AttachmentRecordService;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/app-state",
        "auth.jwt.secret-file=target/test-data/app-state/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/app-state/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class AppStateControllerTests {

    private static final String DEFAULT_TEST_ROLE = "妈妈";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AttachmentRecordService attachmentRecordService;

    private String token;

    @BeforeEach
    void resetState() throws Exception {
        Files.createDirectories(Path.of("target/test-data/app-state/auth"));
        Files.writeString(Path.of("target/test-data/app-state/auth/invite_codes"), "TEST-CODE\n");
        token = login("13800000001");
        mockMvc.perform(put("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    @Test
    void writesStateToSqliteAndConvertsEmbeddedBase64Attachments() throws Exception {
        mockMvc.perform(put("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": {"nickname": "小宝", "stage": "4个月"},
                                  "messages": [
                                    {
                                      "id": "msg-test",
                                      "role": "user",
                                      "text": "看看这张照片",
                                      "createdAt": "2026-05-01T00:00:00Z",
                                      "attachments": [
                                        {
                                          "id": "att-test",
                                          "name": "photo.png",
                                          "kind": "image",
                                          "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                        }
                                      ]
                                    }
                                  ],
                                  "growthEvents": [],
                                  "careLogs": [],
                                  "reminders": [],
                                  "memories": [],
                                  "pendingEffects": [],
                                  "conversationSummary": {
                                    "text": "小宝近期夜里醒两次，爸爸负责洗澡。",
                                    "coveredThroughMessageId": "msg-test",
                                    "coveredThroughCreatedAt": "2026-05-01T00:00:00Z",
                                    "sourceMessageCount": 1,
                                    "updatedAt": "2026-05-01T00:01:00Z"
                                  }
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.empty").value(false))
                .andExpect(jsonPath("$.state.profile.nickname").value("小宝"))
                .andExpect(jsonPath("$.state.conversationSummary.text").value("小宝近期夜里醒两次，爸爸负责洗澡。"))
                .andExpect(jsonPath("$.state.messages[0].attachments[0].dataUrl").doesNotExist())
                .andExpect(jsonPath("$.state.messages[0].attachments[0].filePath").value(org.hamcrest.Matchers.startsWith("uploads/")))
                .andExpect(jsonPath("$.state.messages[0].attachments[0].publicUrl").value("/api/uploads/att-test"));

        mockMvc.perform(get("/api/uploads/att-test"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/uploads/att-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_PNG));
    }

    @Test
    void rejectsQueryTokenOnNonMediaApiButAcceptsBearer() throws Exception {
        // REQ-AUTH-005: a valid token in ?token= must NOT authenticate a normal API; only the
        // Authorization: Bearer header is accepted, so tokens never leak via URLs/logs/Referer.
        mockMvc.perform(get("/api/app/state").param("token", token))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk());
    }

    @Test
    void allowsQueryTokenOnUploadMediaPathForBrowserImgSrc() throws Exception {
        // Whitelist: /api/uploads/ media downloads keep the ?token= fallback because the browser
        // cannot set an Authorization header on <img>/<video> src.
        mockMvc.perform(put("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "messages": [
                                    {
                                      "id": "msg-media-token",
                                      "role": "user",
                                      "text": "看看这张照片",
                                      "createdAt": "2026-05-01T00:00:00Z",
                                      "attachments": [
                                        {
                                          "id": "att-media-token",
                                          "name": "photo.png",
                                          "kind": "image",
                                          "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                        }
                                      ]
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/uploads/att-media-token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/uploads/att-media-token").param("token", token))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_PNG));
    }

    @Test
    void rejectsUnsupportedUploadTypes() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "bad-upload",
                                  "name": "note.txt",
                                  "kind": "image",
                                  "dataUrl": "data:text/plain;base64,YWJj"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void rejectsDirectUploadWhenOssModeIsDisabled() throws Exception {
        mockMvc.perform(post("/api/uploads/presign")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "direct-local",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "mimeType": "image/png",
                                  "sizeBytes": 3
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Direct upload requires OSS storage mode"));
    }

    @Test
    void rejectsMultipartUploads() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "voice.wav", "audio/wav", new byte[] {1, 2, 3});

        mockMvc.perform(multipart("/api/uploads")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .param("id", "voice-test")
                        .param("kind", "audio"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void savesVideoUploadsWithGeneratedThumbnailMetadata() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "video-with-thumb",
                                  "name": "moment.mp4",
                                  "kind": "video",
                                  "dataUrl": "data:video/mp4;base64,AAAAGGZ0eXBpc29tAAAAAGlzb21pc28y",
                                  "thumbnailDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("video-with-thumb"))
                .andExpect(jsonPath("$.kind").value("video"))
                .andExpect(jsonPath("$.url").value("/api/uploads/video-with-thumb"))
                .andExpect(jsonPath("$.thumbnailPath").value(org.hamcrest.Matchers.startsWith("uploads/")))
                .andExpect(jsonPath("$.thumbnailUrl").value("/api/uploads/video-with-thumb/thumbnail"));

        mockMvc.perform(get("/api/uploads/video-with-thumb/thumbnail")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_JPEG));
    }

    @Test
    void sharedRecordsReturnContributorAndHydrateExpenseAttachments() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "expense-receipt",
                                  "name": "receipt.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/careLogs/care-contributor")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "care-contributor",
                                  "date": "2026-05-01",
                                  "events": [
                                    {"id": "care-event-contributor", "type": "milk", "date": "2026-05-01", "time": "08:00", "amountMl": 120}
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/albumItems/album-contributor")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "album-contributor",
                                  "kind": "media",
                                  "title": "小票照片",
                                  "date": "2026-05-01",
                                  "category": "daily",
                                  "tags": [],
                                  "attachmentId": "expense-receipt",
                                  "source": "manual"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/expenses/expense-contributor")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "expense-contributor",
                                  "title": "奶粉",
                                  "amount": 268,
                                  "currency": "CNY",
                                  "category": "formula",
                                  "date": "2026-05-01",
                                  "attachmentIds": ["expense-receipt"],
                                  "source": "manual",
                                  "createdAt": "2026-05-01T08:00:00Z",
                                  "updatedAt": "2026-05-01T08:00:00Z"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.careLogs[0].recordedBy.label").value(DEFAULT_TEST_ROLE))
                .andExpect(jsonPath("$.state.careLogs[0].events[0].recordedBy.label").value(DEFAULT_TEST_ROLE))
                .andExpect(jsonPath("$.state.albumItems[0].recordedBy.label").value(DEFAULT_TEST_ROLE))
                .andExpect(jsonPath("$.state.albumItems[0].attachment.id").value("expense-receipt"))
                .andExpect(jsonPath("$.state.expenses[0].recordedBy.label").value(DEFAULT_TEST_ROLE))
                .andExpect(jsonPath("$.state.expenses[0].attachments[0].id").value("expense-receipt"))
                .andExpect(jsonPath("$.state.expenses[0].attachments[0].url").value("/api/uploads/expense-receipt"));
    }

    @Test
    void readsLocalFilesWhenStoredPathStillHasOssPrefix() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "legacy-prefixed-path",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        AttachmentRecord record = attachmentRecordService.getById("legacy-prefixed-path");
        record.setFilePath("baby-companion/" + record.getFilePath());
        attachmentRecordService.updateById(record);

        mockMvc.perform(get("/api/uploads/legacy-prefixed-path")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_PNG));
    }

    @Test
    void regeneratesImageThumbnailWhenStoredThumbnailFileIsMissing() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "missing-thumb-image",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        AttachmentRecord record = attachmentRecordService.getById("missing-thumb-image");
        Files.deleteIfExists(Path.of("target/test-data/app-state").resolve(record.getThumbnailPath()));

        mockMvc.perform(get("/api/uploads/missing-thumb-image/thumbnail")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_JPEG));
    }

    @Test
    void missingSourceFileDoesNotTurnThumbnailRequestIntoServiceUnavailable() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "missing-source-image",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        AttachmentRecord record = attachmentRecordService.getById("missing-source-image");
        Files.deleteIfExists(Path.of("target/test-data/app-state").resolve(record.getFilePath()));
        Files.deleteIfExists(Path.of("target/test-data/app-state").resolve(record.getThumbnailPath()));

        mockMvc.perform(get("/api/uploads/missing-source-image/thumbnail")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Thumbnail not available: missing-source-image"));

        AttachmentRecord updated = attachmentRecordService.getById("missing-source-image");
        assertNull(updated.getThumbnailPath());
        assertNull(updated.getThumbnailUrl());
    }

    @Test
    void albumAttachmentsReturnCanonicalUploadUrls() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "stale-album-url",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/albumItems/stale-album")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "stale-album",
                                  "kind": "media",
                                  "title": "旧地址照片",
                                  "date": "2026-05-09",
                                  "category": "daily",
                                  "attachmentId": "stale-album-url",
                                  "attachment": {
                                    "id": "stale-album-url",
                                    "name": "photo.png",
                                    "kind": "image",
                                    "url": "http://8.210.235.155:8300/api/uploads/stale-album-url?token=expired",
                                    "publicUrl": "http://8.210.235.155:8300/api/uploads/stale-album-url?token=expired"
                                  },
                                  "source": "manual"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems[0].attachment.url").value("/api/uploads/stale-album-url"))
                .andExpect(jsonPath("$.state.albumItems[0].attachment.publicUrl").value("/api/uploads/stale-album-url"));
    }

    @Test
    void standaloneMediaUploadsDoNotAppearInAlbumState() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "standalone-album-upload",
                                  "name": "album-photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems.length()").value(0));
    }

    @Test
    void deletesStandaloneAlbumAttachmentFilesAndRecord() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "delete-album-upload",
                                  "name": "album-photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                                """))
                .andExpect(status().isOk());

        AttachmentRecord record = attachmentRecordService.getById("delete-album-upload");
        Path dataDir = Path.of("target/test-data/app-state");
        Path file = dataDir.resolve(record.getFilePath());
        Path thumbnail = dataDir.resolve(record.getThumbnailPath());
        assertTrue(Files.exists(file));
        assertTrue(Files.exists(thumbnail));

        mockMvc.perform(delete("/api/app/state/attachments/delete-album-upload")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems.length()").value(0));

        assertNull(attachmentRecordService.getById("delete-album-upload"));
        assertFalse(Files.exists(file));
        assertFalse(Files.exists(thumbnail));
    }

    @Test
    void viewerCanReadSharedStateButCannotWrite() throws Exception {
        mockMvc.perform(put("/api/app/state/profile/default")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":"共享小宝","stage":"born","birthDate":"2026-01-18"}
                                """))
                .andExpect(status().isOk());

        String viewerToken = login("13800000002", "外婆", false);

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.profile.nickname").value("共享小宝"));

        mockMvc.perform(put("/api/app/state/profile/default")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":"不能改"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));

        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"message":"今天喝奶120ml","recentMessages":[],"careLogs":[],"memories":[],"attachments":[]}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));

        mockMvc.perform(post("/api/agent/conversation-summary/compress")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));

        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "viewer-upload",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                                }
                        """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));

        mockMvc.perform(put("/api/app/state/expenses/viewer-expense")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"viewer-expense","title":"奶粉","amount":268,"currency":"CNY","category":"formula","date":"2026-05-01"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("当前身份仅可查看，不能记录或修改。"));
    }

    @Test
    void profileCaregiversAreDerivedFromFamilyMembers() throws Exception {
        mockMvc.perform(put("/api/app/state/profile/default")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":"小宝","caregivers":["legacy-caregiver"]}
                                """))
                .andExpect(status().isOk());

        String caregiverToken = login(uniquePhone(), "caregiver-a", true);

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + caregiverToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.profile.nickname").value("小宝"))
                .andExpect(jsonPath("$.state.profile.caregivers", org.hamcrest.Matchers.hasItem("caregiver-a")))
                .andExpect(jsonPath("$.state.profile.caregivers", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("legacy-caregiver"))));
    }

    @Test
    void familyMembersShareRecordsAndAlbumsButNotChatOrReminders() throws Exception {
        String secondToken = login("13800000003", "爸爸", true);

        mockMvc.perform(put("/api/app/state/messages/msg-private")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"msg-private","role":"parent","text":"A 的聊天","createdAt":"2026-05-01T08:00:00Z"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/reminders/reminder-private")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"reminder-private","title":"A 的提醒","dueText":"今天 20:00","status":"open","createdAt":"2026-05-01T08:01:00Z"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/pendingEffects/pending-private")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"pending-private","status":"pending","createdAt":"2026-05-01T08:02:00Z","reminders":[]}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/memories/memory-private")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"memory-private","text":"A 的记忆","category":"routine","createdAt":"2026-05-01T08:03:00Z"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/conversationSummary/conversation-summary")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"conversation-summary","text":"A 的聊天摘要","updatedAt":"2026-05-01T08:04:00Z"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/careLogs/care-shared")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"care-shared","date":"2026-05-01","milkMl":120}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/albumItems/album-shared")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"album-shared","kind":"media","title":"共享照片","date":"2026-05-01","category":"growth","tags":["成长"],"source":"manual"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/expenses/expense-shared")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"expense-shared","title":"奶粉","amount":268,"currency":"CNY","category":"formula","date":"2026-05-01","source":"manual"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.messages.length()").value(0))
                .andExpect(jsonPath("$.state.reminders.length()").value(0))
                .andExpect(jsonPath("$.state.pendingEffects.length()").value(0))
                .andExpect(jsonPath("$.state.memories.length()").value(0))
                .andExpect(jsonPath("$.state.conversationSummary").doesNotExist())
                .andExpect(jsonPath("$.state.careLogs[0].id").value("care-shared"))
                .andExpect(jsonPath("$.state.albumItems[0].id").value("album-shared"))
                .andExpect(jsonPath("$.state.expenses[0].id").value("expense-shared"));
    }

    @Test
    void importsLocalStateAndReturnsCanonicalState() throws Exception {
        mockMvc.perform(post("/api/app/state/import")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": {"nickname": "导入宝宝"},
                                  "messages": [],
                                  "growthEvents": [],
                                  "careLogs": [{"id": "care-test", "date": "2026-05-01", "milkMl": 600}],
                                  "reminders": [],
                                  "memories": [],
                                  "pendingEffects": [{"id": "effect-test", "status": "pending", "createdAt": "2026-05-01T00:00:00Z", "reminders": []}]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.empty").value(false))
                .andExpect(jsonPath("$.state.profile.nickname").value("导入宝宝"))
                .andExpect(jsonPath("$.state.careLogs[0].milkMl").value(600))
                .andExpect(jsonPath("$.state.pendingEffects[0].id").value("effect-test"));
    }

    @Test
    void confirmingPendingGrowthMeasurementsPersistsSharedGrowthData() throws Exception {
        mockMvc.perform(put("/api/app/state/pendingEffects/effect-growth-measurements")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "effect-growth-measurements",
                                  "status": "pending",
                                  "createdAt": "2026-06-04T09:21:42Z",
                                  "growthMeasurements": [
                                    {"id": "growth-measurement-height", "type": "height", "value": 68.2, "date": "2026-06-04", "note": "身高68.2cm"},
                                    {"id": "growth-measurement-weight", "type": "weight", "value": 7.4, "date": "2026-06-04", "note": "体重7.4kg"},
                                    {"id": "growth-measurement-head", "type": "headCircumference", "value": 42.0, "date": "2026-06-04", "note": "头围42cm"}
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/app/state/pending-effects/effect-growth-measurements/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.pendingEffects.length()").value(0))
                .andExpect(jsonPath("$.state.growthMeasurements.length()").value(3))
                .andExpect(jsonPath("$.state.growthMeasurements[?(@.type == 'height')].value").value(org.hamcrest.Matchers.hasItem(68.2)))
                .andExpect(jsonPath("$.state.growthMeasurements[?(@.type == 'weight')].value").value(org.hamcrest.Matchers.hasItem(7.4)))
                .andExpect(jsonPath("$.state.growthMeasurements[?(@.type == 'headCircumference')].value").value(org.hamcrest.Matchers.hasItem(42.0)));
    }

    @Test
    void upsertingAndDeletingGrowthMeasurementMaintainsSharedData() throws Exception {
        mockMvc.perform(put("/api/app/state/growthMeasurements/growth-weight-maintenance")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "growth-weight-maintenance",
                                  "type": "weight",
                                  "value": 7.4,
                                  "date": "2026-06-04",
                                  "note": "初始体重"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.growthMeasurements.length()").value(1))
                .andExpect(jsonPath("$.state.growthMeasurements[0].value").value(7.4));

        mockMvc.perform(put("/api/app/state/growthMeasurements/growth-weight-maintenance")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "growth-weight-maintenance",
                                  "type": "weight",
                                  "value": 7.5,
                                  "date": "2026-06-04",
                                  "note": "更正体重"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.growthMeasurements.length()").value(1))
                .andExpect(jsonPath("$.state.growthMeasurements[0].value").value(7.5))
                .andExpect(jsonPath("$.state.growthMeasurements[0].note").value("更正体重"));

        mockMvc.perform(delete("/api/app/state/growthMeasurements/growth-weight-maintenance")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.growthMeasurements.length()").value(0));
    }

    @Test
    void confirmingPendingExpenseWithGeneratedIndexIdDoesNotOverwriteExistingExpense() throws Exception {
        mockMvc.perform(put("/api/app/state/expenses/expense-0")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "expense-0",
                                  "title": "住院费用",
                                  "amount": 8887.24,
                                  "currency": "CNY",
                                  "category": "health",
                                  "date": "2026-04-19",
                                  "source": "agent"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/pendingEffects/effect-expense")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "effect-expense",
                                  "status": "pending",
                                  "createdAt": "2026-05-16T09:21:42Z",
                                  "expenses": [
                                    {
                                      "id": "expense-0",
                                      "title": "奶粉",
                                      "amount": 97.1,
                                      "currency": "CNY",
                                      "category": "formula",
                                      "date": "2026-03-18",
                                      "source": "agent"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/app/state/pending-effects/effect-expense/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses.length()").value(2))
                .andExpect(jsonPath("$.state.expenses[?(@.id == 'expense-0')].title")
                        .value(org.hamcrest.Matchers.hasItem("住院费用")))
                .andExpect(jsonPath("$.state.expenses[?(@.title == '奶粉')].id")
                        .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("expense-0"))));
    }

    @Test
    void confirmingPendingGrowthEventWithGeneratedIndexIdDoesNotOverwriteExistingGrowthEvent() throws Exception {
        // 用户已有一条 fallback 格式 id 的成长记录（生产里真实存在 growth-0 / growth-1）
        mockMvc.perform(put("/api/app/state/growthEvents/growth-0")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "growth-0",
                                  "type": "日常瞬间",
                                  "title": "躺在床上睁着眼",
                                  "date": "2026-06-03"
                                }
                                """))
                .andExpect(status().isOk());

        // AI 生成的 pending 成长事件复用了同样的 fallback id growth-0
        mockMvc.perform(put("/api/app/state/pendingEffects/effect-growth")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "effect-growth",
                                  "status": "pending",
                                  "createdAt": "2026-06-04T13:37:53Z",
                                  "growthEvent": {
                                    "id": "growth-0",
                                    "type": "日常瞬间",
                                    "title": "练习抬头",
                                    "date": "2026-06-04"
                                  }
                                }
                                """))
                .andExpect(status().isOk());

        // 确认后：既有 growth-0 不能被覆盖，新事件必须用新生成的唯一 id
        mockMvc.perform(post("/api/app/state/pending-effects/effect-growth/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.growthEvents.length()").value(2))
                .andExpect(jsonPath("$.state.growthEvents[?(@.id == 'growth-0')].title")
                        .value(org.hamcrest.Matchers.hasItem("躺在床上睁着眼")))
                .andExpect(jsonPath("$.state.growthEvents[?(@.title == '练习抬头')].id")
                        .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("growth-0"))));
    }

    @Test
    void confirmingDuplicateExpenseAcrossPendingEffectsSavesOnlyOnce() throws Exception {
        String pendingExpense = """
                {
                  "status": "pending",
                  "createdAt": "2026-05-16T09:21:42Z",
                  "expenses": [
                    {
                      "id": null,
                      "title": "a2紫白金奶粉",
                      "amount": 97.1,
                      "currency": "CNY",
                      "category": "formula",
                      "date": "2026-03-18",
                      "merchant": "a2海外旗舰店",
                      "attachmentIds": ["attachment-dup"],
                      "source": "agent"
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/app/state/pendingEffects/effect-a")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pendingExpense.replaceFirst("\\{", "{\"id\":\"effect-a\",")))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/app/state/pendingEffects/effect-b")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pendingExpense.replaceFirst("\\{", "{\"id\":\"effect-b\",")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/app/state/pending-effects/effect-a/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses.length()").value(1));
        mockMvc.perform(post("/api/app/state/pending-effects/effect-b/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses.length()").value(1))
                .andExpect(jsonPath("$.state.expenses[0].title").value("a2紫白金奶粉"));
    }

    @Test
    void confirmingPendingExpenseInfersCategoryWithoutBlocking() throws Exception {
        mockMvc.perform(put("/api/app/state/pendingEffects/effect-category")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "effect-category",
                                  "status": "pending",
                                  "createdAt": "2026-05-16T09:21:42Z",
                                  "expenses": [
                                    {
                                      "id": null,
                                      "title": "月子鞋",
                                      "amount": 89.9,
                                      "currency": "CNY",
                                      "category": "",
                                      "date": "2026-03-18",
                                      "source": "agent"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/app/state/pending-effects/effect-category/confirm")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses.length()").value(1))
                .andExpect(jsonPath("$.state.expenses[0].category").value("clothing"));
    }

    @Test
    void importsDuplicateMemoryIdsWithoutPrimaryKeyConflict() throws Exception {
        mockMvc.perform(post("/api/app/state/import")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": {"nickname": "导入宝宝"},
                                  "messages": [],
                                  "growthEvents": [],
                                  "careLogs": [],
                                  "reminders": [],
                                  "memories": [
                                    {"id": "memory-dup", "text": "旧记忆", "category": "routine", "confidence": 0.6},
                                    {"id": "memory-dup", "text": "新记忆", "category": "routine", "confidence": 0.8}
                                  ],
                                  "pendingEffects": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.memories.length()").value(1))
                .andExpect(jsonPath("$.state.memories[0].text").value("新记忆"));
    }

    @Test
    void upsertsAndDeletesAlbumItems() throws Exception {
        mockMvc.perform(put("/api/app/state/albumItems/album-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "album-test",
                                  "kind": "keyEvent",
                                  "title": "第一次翻身",
                                  "date": "2026-05-01",
                                  "category": "growth",
                                  "tags": ["成长", "里程碑"],
                                  "linkedType": "growthEvent",
                                  "linkedId": "growth-test",
                                  "source": "manual"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems[0].id").value("album-test"))
                .andExpect(jsonPath("$.state.albumItems[0].title").value("第一次翻身"));

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems[0].category").value("growth"));

        mockMvc.perform(delete("/api/app/state/albumItems/album-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.albumItems.length()").value(0));
    }

    @Test
    void upsertsAndDeletesExpenses() throws Exception {
        mockMvc.perform(put("/api/app/state/expenses/expense-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "expense-test",
                                  "title": "奶粉",
                                  "amount": 268,
                                  "currency": "CNY",
                                  "category": "formula",
                                  "date": "2026-05-01",
                                  "quantity": 1,
                                  "unitPrice": 268,
                                  "merchant": "母婴店",
                                  "source": "manual"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses[0].id").value("expense-test"))
                .andExpect(jsonPath("$.state.expenses[0].amount").value(268));

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses[0].category").value("formula"));

        mockMvc.perform(delete("/api/app/state/expenses/expense-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.expenses.length()").value(0));
    }

    @Test
    void skipsConversationCompressionBelowThreshold() throws Exception {
        mockMvc.perform(put("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": {"nickname": "小宝"},
                                  "messages": [
                                    {"id": "msg-1", "role": "parent", "text": "今天喝奶120ml", "createdAt": "2026-05-01T08:00:00Z"},
                                    {"id": "msg-2", "role": "ai", "text": "已记录。", "createdAt": "2026-05-01T08:00:05Z"}
                                  ],
                                  "growthEvents": [],
                                  "careLogs": [],
                                  "reminders": [],
                                  "memories": [],
                                  "pendingEffects": []
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/agent/conversation-summary/compress")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needed").value(false))
                .andExpect(jsonPath("$.status").value("skipped"))
                .andExpect(jsonPath("$.conversationSummary").doesNotExist());
    }

    @Test
    void replacesCareLogSnapshotWithoutAppendingMergedArrays() throws Exception {
        String original = """
                {
                  "id": "care-test",
                  "date": "2026-05-01",
                  "notes": ["原始记录"],
                  "events": [{"id": "event-milk", "type": "milk", "date": "2026-05-01", "time": "08:00", "amountMl": 120}]
                }
                """;

        mockMvc.perform(put("/api/app/state/careLogs/care-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(original))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/app/state/careLogs/care-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "care-test",
                                  "date": "2026-05-01",
                                  "notes": ["自动记录"],
                                  "events": [{"id": "event-sleep", "type": "sleep", "date": "2026-05-01", "time": "20:30"}]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.careLogs[0].notes.length()").value(2))
                .andExpect(jsonPath("$.state.careLogs[0].events.length()").value(2));

        mockMvc.perform(put("/api/app/state/careLogs/care-test?mode=replace")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(original))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.careLogs[0].notes.length()").value(1))
                .andExpect(jsonPath("$.state.careLogs[0].notes[0]").value("原始记录"))
                .andExpect(jsonPath("$.state.careLogs[0].events.length()").value(1))
                .andExpect(jsonPath("$.state.careLogs[0].events[0].id").value("event-milk"));
    }

    @Test
    void rejectsUnsupportedCollectionOnUpsert() throws Exception {
        mockMvc.perform(put("/api/app/state/secrets/anything")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void rejectsUnsupportedCollectionOnDelete() throws Exception {
        mockMvc.perform(delete("/api/app/state/secrets/anything")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void rejectsInvalidUpsertMode() throws Exception {
        mockMvc.perform(put("/api/app/state/careLogs/care-test?mode=drop-all")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"care-test","date":"2026-05-01"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    private String login(String phone) throws Exception {
        return login(phone, DEFAULT_TEST_ROLE, true);
    }

    private String uniquePhone() {
        long suffix = Math.floorMod(System.nanoTime(), 100_000_000L);
        return "139" + String.format("%08d", suffix);
    }

    private String login(String phone, String roleName, boolean caregiver) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","inviteCode":"TEST-CODE","roleName":"%s","caregiver":%s}
                                """.formatted(phone, roleName, caregiver)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        int tokenStart = body.indexOf("\"accessToken\":\"") + "\"accessToken\":\"".length();
        int tokenEnd = body.indexOf('"', tokenStart);
        return body.substring(tokenStart, tokenEnd);
    }

    private String bearer() {
        return "Bearer " + token;
    }
}
