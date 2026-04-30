package com.xiaobao.babycompanion.service;

import java.net.http.HttpClient;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.dto.ChatRequest;
import com.xiaobao.babycompanion.dto.ChatResponse;
import com.xiaobao.babycompanion.exception.DeepSeekApiException;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatResponse;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class DeepSeekChatService {

    private static final String SYSTEM_PROMPT = """
            你是“AI宝宝成长伙伴”的后端育儿助手。你帮助孕期到宝宝 1 岁家庭整理聊天记录。
            回复要温柔、简洁、可执行。你可以总结成长事件、喂养、睡眠、提醒和照护建议。
            健康、疫苗、用药相关内容只提供记录和低风险常识建议，必须提醒用户以医生或社区医院安排为准。
            不要做医疗诊断，不要替用户决定用药。
            """;

    private final DeepSeekProperties properties;
    private final RestClient restClient;

    public DeepSeekChatService(DeepSeekProperties properties) {
        this.properties = properties;
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.getConnectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.getReadTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public ChatResponse chat(ChatRequest request) {
        String apiKey = properties.getResolvedApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("DEEPSEEK_API_KEY is not configured");
        }

        DeepSeekChatRequest deepSeekRequest = new DeepSeekChatRequest(
                properties.getModel(),
                List.of(
                        new DeepSeekMessage("system", SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildUserMessage(request))
                ),
                false,
                properties.getMaxTokens(),
                properties.getTemperature(),
                null
        );

        try {
            DeepSeekChatResponse response = restClient.post()
                    .uri(properties.getChatPath())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(deepSeekRequest)
                    .retrieve()
                    .body(DeepSeekChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new DeepSeekApiException("DeepSeek returned an empty response");
            }

            String reply = Optional.ofNullable(response.choices().get(0).message())
                    .map(DeepSeekMessage::content)
                    .filter(StringUtils::hasText)
                    .orElseThrow(() -> new DeepSeekApiException("DeepSeek response did not include message content"));

            return new ChatResponse(reply, response.model(), response.id(), Instant.now());
        } catch (RestClientException exception) {
            throw new DeepSeekApiException("Failed to call DeepSeek API", exception);
        }
    }

    private String buildUserMessage(ChatRequest request) {
        StringBuilder builder = new StringBuilder();
        if (StringUtils.hasText(request.babyNickname())) {
            builder.append("宝宝昵称：").append(request.babyNickname()).append('\n');
        }
        if (StringUtils.hasText(request.context())) {
            builder.append("上下文：").append(request.context()).append('\n');
        }
        builder.append("家长输入：").append(request.message());
        return builder.toString();
    }
}
