package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentGrowthEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import org.junit.jupiter.api.Test;

class AgentRuntimeTests {

    private final SkillRegistry skillRegistry = new SkillRegistry();
    private final AgentRuntime agentRuntime = new AgentRuntime(
            new DeepSeekProperties(),
            new DoubaoProperties(),
            new ObjectMapper(),
            new AgentPlanner(new ObjectMapper()),
            null,
            null,
            new RecordSignalExtractor(new ObjectMapper()),
            new EffectPolicy(new ObjectMapper(), new CareEventCompletenessPolicy(new ObjectMapper())),
            new CurrentUser(),
            skillRegistry,
            new SkillDisclosureService(skillRegistry),
            new ToolRegistry(List.of()),
            new SafetyGuard()
    );

    @Test
    void parsesModelJsonAndAddsRuntimeMetadata() {
        AgentChatResponse response = agentRuntime.parseModelContent(
                """
                        {
                          "aiText": "已帮你记录今天的喂养。",
                          "tags": ["喂养"],
                          "growthEvent": null,
                          "careLogPatch": {"milkMl": 600, "milkTimes": 5, "solids": [], "notes": ["喝奶 5 次"]},
                          "reminders": [],
                          "memories": [],
                          "sources": [],
                          "usedSkills": ["ignored-by-runtime"]
                        }
                        """,
                "agent-test",
                "deepseek-test",
                "request-test",
                List.of("default-baby-companion"),
                List.of()
        );

        assertThat(response.aiText()).isEqualTo("已帮你记录今天的喂养。");
        assertThat(response.tags()).containsExactly("喂养");
        assertThat(response.careLogPatch().milkMl()).isEqualTo(600);
        assertThat(response.usedSkills()).containsExactly("default-baby-companion");
        assertThat(response.safetyAlerts()).isEmpty();
        assertThat(response.traceId()).isEqualTo("agent-test");
        assertThat(response.model()).isEqualTo("deepseek-test");
        assertThat(response.requestId()).isEqualTo("request-test");
    }

    @Test
    void rejectsNonJsonModelContent() {
        assertThatThrownBy(() -> agentRuntime.parseModelContent(
                "我已经帮你记录好了。",
                "agent-test",
                "deepseek-test",
                "request-test",
                List.of("default-baby-companion"),
                List.of()
        )).isInstanceOf(AgentResponseParseException.class)
                .hasMessageContaining("JSON object");
    }

    @Test
    void mediaSaveOnlySuppressesUnrelatedEffects() {
        RecordSignals signals = new RecordSignalExtractor(new ObjectMapper()).extract("刚才的视频记录到相册里");
        AgentPlan plan = new AgentPlan(
                "question",
                List.of("growth"),
                List.of(),
                List.of("profile"),
                List.of(),
                List.of("none"),
                new AgentMediaAction("save_to_album", "previous", "video", "刚才的视频", "daily", 0.9, "用户要求保存上一条视频")
        );
        AgentChatResponse modelResponse = new AgentChatResponse(
                "可以，也要不要记录之前的抬头和便便？",
                List.of("相册"),
                new AgentGrowthEvent(null, "milestone", "第一次抬头", "2026-05-06", "宝宝第一次抬头", true, null, List.of("成长")),
                null,
                List.of(),
                List.of(new AgentMemory(null, "宝宝目前是混合喂养", "profile", 0.8, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "agent-test",
                "model-test",
                "request-test"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                "刚才的视频记录到相册里",
                signals,
                plan,
                new ObjectMapper().createObjectNode()
        );

        assertThat(response.aiText()).isEqualTo("已把刚才的视频整理到相册里。");
        assertThat(response.growthEvent()).isNull();
        assertThat(response.memories()).isEmpty();
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).type()).isEqualTo("albumItem");
    }
}
