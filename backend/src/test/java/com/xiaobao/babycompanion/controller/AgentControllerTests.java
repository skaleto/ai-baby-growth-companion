package com.xiaobao.babycompanion.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/agent-controller",
        "auth.jwt.secret-file=target/test-data/agent-controller/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/agent-controller/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
@AutoConfigureMockMvc
class AgentControllerTests {

    @Autowired
    private MockMvc mockMvc;

    private String token;

    @BeforeEach
    void login() throws Exception {
        Files.createDirectories(Path.of("target/test-data/agent-controller/auth"));
        Files.writeString(Path.of("target/test-data/agent-controller/auth/invite_codes"), "AGENT-CODE\n");
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"13800000002","inviteCode":"AGENT-CODE"}
                                """))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        int tokenStart = body.indexOf("\"accessToken\":\"") + "\"accessToken\":\"".length();
        int tokenEnd = body.indexOf('"', tokenStart);
        token = body.substring(tokenStart, tokenEnd);
    }

    @Test
    void returnsServiceUnavailableWhenApiKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/agent/chat")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "message": "今天小宝喝奶 5 次，每次 120ml",
                                  "recentMessages": [],
                                  "careLogs": [],
                                  "memories": [],
                                  "attachments": []
                                }
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }
}
