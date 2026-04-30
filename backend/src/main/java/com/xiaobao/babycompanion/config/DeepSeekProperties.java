package com.xiaobao.babycompanion.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "deepseek")
public class DeepSeekProperties {

    private String apiKey;
    private String apiKeyFile = "/Users/.deepseek_apikey";
    private String baseUrl = "https://api.deepseek.com";
    private String chatPath = "/chat/completions";
    private String model = "deepseek-v4-flash";
    private Integer maxTokens = 800;
    private Integer agentMaxTokens = 2000;
    private Double temperature = 0.4;
    private Duration connectTimeout = Duration.ofSeconds(5);
    private Duration readTimeout = Duration.ofSeconds(45);

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiKeyFile() {
        return apiKeyFile;
    }

    public void setApiKeyFile(String apiKeyFile) {
        this.apiKeyFile = apiKeyFile;
    }

    public String getResolvedApiKey() {
        if (StringUtils.hasText(apiKey)) {
            return apiKey.trim();
        }
        if (!StringUtils.hasText(apiKeyFile)) {
            return "";
        }

        Path path = Path.of(apiKeyFile);
        if (!Files.isRegularFile(path)) {
            return "";
        }

        try {
            return Files.readString(path).trim();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read DeepSeek API key file: " + apiKeyFile, exception);
        }
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getChatPath() {
        return chatPath;
    }

    public void setChatPath(String chatPath) {
        this.chatPath = chatPath;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public Integer getAgentMaxTokens() {
        return agentMaxTokens;
    }

    public void setAgentMaxTokens(Integer agentMaxTokens) {
        this.agentMaxTokens = agentMaxTokens;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(Duration connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    public Duration getReadTimeout() {
        return readTimeout;
    }

    public void setReadTimeout(Duration readTimeout) {
        this.readTimeout = readTimeout;
    }
}
