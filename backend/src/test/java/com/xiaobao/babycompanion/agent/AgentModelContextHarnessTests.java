package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class AgentModelContextHarnessTests {

    @Test
    void classpathHarnessMatchesRepoHarnessDocument() throws Exception {
        Path rootHarness = Path.of("harness", "agent-model-context-harness.md");
        if (!Files.exists(rootHarness)) {
            rootHarness = Path.of("..", "harness", "agent-model-context-harness.md");
        }

        assertThat(Files.readString(rootHarness).trim())
                .isEqualTo(AgentModelContextHarness.promptBlock());
    }
}
