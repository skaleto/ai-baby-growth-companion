package com.xiaobao.babycompanion.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "doubao")
public class DoubaoProperties {

    private String apiKey;
    private String apiKeyFile = "/Users/.doubao_apikey";
    private String baseUrl = "https://ark.cn-beijing.volces.com/api/v3";
    private String chatPath = "/chat/completions";
    private String seed20LiteModel = "doubao-seed-2-0-lite-260215";
    private String seed20ProModel = "doubao-seed-2-0-pro-260215";
    private String lowLatencyServiceTier = "fast";
    private Duration connectTimeout = Duration.ofSeconds(5);
    private Duration readTimeout = Duration.ofSeconds(120);

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
            throw new IllegalStateException("Failed to read Doubao API key file: " + apiKeyFile, exception);
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

    public String getSeed20LiteModel() {
        return seed20LiteModel;
    }

    public void setSeed20LiteModel(String seed20LiteModel) {
        this.seed20LiteModel = seed20LiteModel;
    }

    public String getSeed20ProModel() {
        return seed20ProModel;
    }

    public void setSeed20ProModel(String seed20ProModel) {
        this.seed20ProModel = seed20ProModel;
    }

    public String getLowLatencyServiceTier() {
        return lowLatencyServiceTier;
    }

    public void setLowLatencyServiceTier(String lowLatencyServiceTier) {
        this.lowLatencyServiceTier = lowLatencyServiceTier;
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
