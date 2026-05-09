package com.xiaobao.babycompanion.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/mobile-updates",
        "app.mobile-updates.public-base-url=http://updates.example.test",
        "auth.jwt.secret-file=target/test-data/mobile-updates/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/mobile-updates/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class MobileUpdateControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @BeforeEach
    void resetUpdateFiles() throws Exception {
        Path root = Path.of("target/test-data/mobile-updates/mobile-updates");
        Files.createDirectories(root.resolve("bundles"));
        Files.write(root.resolve("bundles/app-0.1.1.zip"), new byte[] {1, 2, 3});
        Files.writeString(root.resolve("manifest.json"), """
                {
                  "enabled": true,
                  "version": "0.1.1",
                  "fileName": "app-0.1.1.zip",
                  "checksum": "abc123",
                  "minNativeVersion": "0.1.0",
                  "message": "UI polish"
                }
                """);
    }

    @Test
    void returnsAvailableBundleWithoutAuth() throws Exception {
        mockMvc.perform(post("/api/mobile-updates/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "appId": "com.xiaobao.growthcompanion",
                                  "platform": "ios",
                                  "nativeVersion": "0.1.0",
                                  "currentBundleVersion": "0.1.0"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.updateAvailable").value(true))
                .andExpect(jsonPath("$.version").value("0.1.1"))
                .andExpect(jsonPath("$.url").value("http://updates.example.test/api/mobile-updates/bundles/app-0.1.1.zip"))
                .andExpect(jsonPath("$.checksum").value("abc123"));
    }

    @Test
    void returnsUpToDateWhenCurrentBundleMatchesManifest() throws Exception {
        mockMvc.perform(post("/api/mobile-updates/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nativeVersion": "0.1.0",
                                  "currentBundleVersion": "0.1.1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.updateAvailable").value(false))
                .andExpect(jsonPath("$.version").value("0.1.1"));
    }

    @Test
    void blocksBundlesWhenNativeVersionIsTooOld() throws Exception {
        mockMvc.perform(post("/api/mobile-updates/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nativeVersion": "0.0.9",
                                  "currentBundleVersion": "0.1.0"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.updateAvailable").value(false))
                .andExpect(jsonPath("$.minNativeVersion").value("0.1.0"));
    }

    @Test
    void servesBundleAndRejectsTraversal() throws Exception {
        mockMvc.perform(get("/api/mobile-updates/bundles/app-0.1.1.zip"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/zip"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"app-0.1.1.zip\""));

        mockMvc.perform(get("/api/mobile-updates/bundles/..%2Fmanifest.json"))
                .andExpect(status().isBadRequest());
    }
}
