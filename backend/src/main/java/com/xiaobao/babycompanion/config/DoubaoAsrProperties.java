package com.xiaobao.babycompanion.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "doubao.asr")
public class DoubaoAsrProperties {

    private String apiKey;
    private String apiKeyFile = "/Users/.doubao_asr_key";
    private String endpoint = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
    private String resourceId = "volc.seedasr.sauc.duration";
    private Duration connectTimeout = Duration.ofSeconds(8);

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

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getResourceId() {
        return resourceId;
    }

    public void setResourceId(String resourceId) {
        this.resourceId = resourceId;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(Duration connectTimeout) {
        this.connectTimeout = connectTimeout;
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
            throw new IllegalStateException("Failed to read Doubao ASR API key file: " + apiKeyFile, exception);
        }
    }
}
