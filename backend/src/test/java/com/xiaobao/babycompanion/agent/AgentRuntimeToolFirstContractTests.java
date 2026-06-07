package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class AgentRuntimeToolFirstContractTests {

    @Test
    void runtimeDoesNotInvokeOldExtractorOrEffectPolicyWriteChain() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/xiaobao/babycompanion/agent/AgentRuntime.java"));

        assertThat(source).doesNotContain("recordSignalExtractor.extract");
        assertThat(source).doesNotContain("effectPolicy.decide");
        assertThat(source).contains("runModelSelectedTools");
        assertThat(source).contains("AgentActionResponseGuard");
    }
}
