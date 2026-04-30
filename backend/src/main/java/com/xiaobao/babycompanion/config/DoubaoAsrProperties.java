package com.xiaobao.babycompanion.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "doubao.asr")
public class DoubaoAsrProperties {

    private String appKey;
    private String accessKey;
    private String accessKeyFile = "/Users/.doubao_apikey";
    private String endpoint = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
    private String resourceId = "volc.seedasr.sauc.duration";
    private Duration connectTimeout = Duration.ofSeconds(8);

    public String getAppKey() {
        return appKey;
    }

    public void setAppKey(String appKey) {
        this.appKey = appKey;
    }

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getAccessKeyFile() {
        return accessKeyFile;
    }

    public void setAccessKeyFile(String accessKeyFile) {
        this.accessKeyFile = accessKeyFile;
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

    public String getResolvedAccessKey() {
        if (StringUtils.hasText(accessKey)) {
            return accessKey.trim();
        }
        if (!StringUtils.hasText(accessKeyFile)) {
            return "";
        }

        Path path = Path.of(accessKeyFile);
        if (!Files.isRegularFile(path)) {
            return "";
        }

        try {
            return Files.readString(path).trim();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read Doubao ASR access key file: " + accessKeyFile, exception);
        }
    }
}
