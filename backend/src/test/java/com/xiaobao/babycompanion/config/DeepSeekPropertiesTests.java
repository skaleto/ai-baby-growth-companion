package com.xiaobao.babycompanion.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DeepSeekPropertiesTests {

    @TempDir
    private Path tempDir;

    @Test
    void readsApiKeyFromConfiguredFile() throws Exception {
        Path keyFile = tempDir.resolve("deepseek_apikey");
        Files.writeString(keyFile, "test-key-from-file\n");

        DeepSeekProperties properties = new DeepSeekProperties();
        properties.setApiKeyFile(keyFile.toString());

        assertThat(properties.getResolvedApiKey()).isEqualTo("test-key-from-file");
    }

    @Test
    void prefersExplicitApiKeyOverFile() throws Exception {
        Path keyFile = tempDir.resolve("deepseek_apikey");
        Files.writeString(keyFile, "test-key-from-file");

        DeepSeekProperties properties = new DeepSeekProperties();
        properties.setApiKey("test-key-explicit");
        properties.setApiKeyFile(keyFile.toString());

        assertThat(properties.getResolvedApiKey()).isEqualTo("test-key-explicit");
    }
}
