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
                                          "dataUrl": "data:image/png;base64,YWJj"
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
    void savesMultipartUploadsAsFiles() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "voice.wav", "audio/wav", new byte[] {1, 2, 3});

        mockMvc.perform(multipart("/api/uploads")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .param("id", "voice-test")
                        .param("kind", "audio"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("voice-test"))
                .andExpect(jsonPath("$.kind").value("audio"))
                .andExpect(jsonPath("$.filePath").value(org.hamcrest.Matchers.startsWith("uploads/")));

        mockMvc.perform(get("/api/uploads/voice-test"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/uploads/voice-test")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("audio/wav"));
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
                                  "dataUrl": "data:video/mp4;base64,AQIDBA==",
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
    void readsLocalFilesWhenStoredPathStillHasOssPrefix() throws Exception {
        mockMvc.perform(post("/api/uploads")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "legacy-prefixed-path",
                                  "name": "photo.png",
                                  "kind": "image",
                                  "dataUrl": "data:image/png;base64,YWJj"
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
                                  "dataUrl": "data:image/png;base64,YWJj"
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
                                  "dataUrl": "data:image/png;base64,YWJj"
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
                                  "dataUrl": "data:image/png;base64,YWJj"
                                }
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

        mockMvc.perform(get("/api/app/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state.messages.length()").value(0))
                .andExpect(jsonPath("$.state.reminders.length()").value(0))
                .andExpect(jsonPath("$.state.pendingEffects.length()").value(0))
                .andExpect(jsonPath("$.state.memories.length()").value(0))
                .andExpect(jsonPath("$.state.conversationSummary").doesNotExist())
                .andExpect(jsonPath("$.state.careLogs[0].id").value("care-shared"))
                .andExpect(jsonPath("$.state.albumItems[0].id").value("album-shared"));
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

    private String login(String phone) throws Exception {
        return login(phone, "妈妈", true);
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
