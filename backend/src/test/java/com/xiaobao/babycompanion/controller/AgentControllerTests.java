package com.xiaobao.babycompanion.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {"deepseek.api-key=", "deepseek.api-key-file=", "doubao.api-key=", "doubao.api-key-file="})
@AutoConfigureMockMvc
class AgentControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void returnsServiceUnavailableWhenApiKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/agent/chat")
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
