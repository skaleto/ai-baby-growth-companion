package com.xiaobao.babycompanion.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "product.lookup")
public class ProductLookupProperties {

    private boolean freeEnabled = true;
    private String domesticProvider = "none";
    private String domesticApiKey = "";
    private Duration connectTimeout = Duration.ofSeconds(5);
    private Duration readTimeout = Duration.ofSeconds(12);

    public boolean isFreeEnabled() {
        return freeEnabled;
    }

    public void setFreeEnabled(boolean freeEnabled) {
        this.freeEnabled = freeEnabled;
    }

    public String getDomesticProvider() {
        return domesticProvider;
    }

    public void setDomesticProvider(String domesticProvider) {
        this.domesticProvider = domesticProvider;
    }

    public String getDomesticApiKey() {
        return domesticApiKey;
    }

    public void setDomesticApiKey(String domesticApiKey) {
        this.domesticApiKey = domesticApiKey;
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
