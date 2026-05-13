package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentGrowthEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.junit.jupiter.api.Test;

class AgentRuntimeTests {

    private final SkillRegistry skillRegistry = new SkillRegistry();
    private final AgentRuntime agentRuntime = runtimeWith(new DoubaoProperties());

    private AgentRuntime runtimeWith(DoubaoProperties doubaoProperties) {
        return new AgentRuntime(
                new DeepSeekProperties(),
                doubaoProperties,
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
    }

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
    void acceptsStringSafetyAlertsFromModel() {
        AgentChatResponse response = agentRuntime.parseModelContent(
                """
                        {
                          "aiText": "19 号体检和疫苗可以先记个提醒，具体安排以社区医院通知为准。",
                          "tags": ["提醒"],
                          "growthEvent": null,
                          "careLogPatch": null,
                          "reminders": [],
                          "memories": [],
                          "sources": [],
                          "safetyAlerts": [
                            "疫苗、体检的具体安排和注意事项请以社区医院或医生的通知为准。"
                          ]
                        }
                        """,
                "agent-test",
                "doubao-test",
                "request-test",
                List.of("default-baby-companion"),
                List.of()
        );

        assertThat(response.safetyAlerts()).hasSize(1);
        assertThat(response.safetyAlerts().get(0).level()).isEqualTo("info");
        assertThat(response.safetyAlerts().get(0).category()).isEqualTo("general");
        assertThat(response.safetyAlerts().get(0).message()).contains("社区医院");
    }

    @Test
    void acceptsObjectSafetyAlertsFromModel() {
        AgentChatResponse response = agentRuntime.parseModelContent(
                """
                        {
                          "aiText": "涉及疫苗时请以医生安排为准。",
                          "tags": ["提醒"],
                          "growthEvent": null,
                          "careLogPatch": null,
                          "reminders": [],
                          "memories": [],
                          "sources": [],
                          "safetyAlerts": [
                            {
                              "level": "warning",
                              "category": "medical",
                              "message": "接种前请确认宝宝当日状态。",
                              "recommendedAction": "按社区医院通知执行"
                            }
                          ]
                        }
                        """,
                "agent-test",
                "doubao-test",
                "request-test",
                List.of("default-baby-companion"),
                List.of()
        );

        assertThat(response.safetyAlerts()).hasSize(1);
        assertThat(response.safetyAlerts().get(0).level()).isEqualTo("warning");
        assertThat(response.safetyAlerts().get(0).category()).isEqualTo("medical");
        assertThat(response.safetyAlerts().get(0).recommendedAction()).isEqualTo("按社区医院通知执行");
    }

    @Test
    void rejectsNonJsonModelContent() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> agentRuntime.parseModelContent(
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

    @Test
    void doubaoLowLatencyKeepsStandardModelAndMarksServiceTierMode() throws Exception {
        Object runtimeModel = resolveRuntimeModel(agentRuntime, "doubao-seed-2.0-lite", true);

        assertThat(runtimeModelValue(runtimeModel, "apiModel")).isEqualTo("doubao-seed-2-0-lite-260215");
        assertThat(runtimeModelValue(runtimeModel, "lowLatencyEnabled")).isEqualTo(true);
    }

    @Test
    void serializesServiceTierForFastInference() throws Exception {
        DeepSeekChatRequest request = new DeepSeekChatRequest(
                "doubao-seed-2-0-lite-260215",
                List.of(new DeepSeekMessage("user", "hello")),
                true,
                100,
                0.2,
                null,
                null,
                null,
                null,
                "fast"
        );

        String json = new ObjectMapper().writeValueAsString(request);

        assertThat(json).contains("\"service_tier\":\"fast\"");
    }

    private Object resolveRuntimeModel(AgentRuntime runtime, String model, boolean lowLatencyEnabled) throws Exception {
        Method method = AgentRuntime.class.getDeclaredMethod("resolveModel", String.class, boolean.class);
        method.setAccessible(true);
        return method.invoke(runtime, model, lowLatencyEnabled);
    }

    private Object runtimeModelValue(Object runtimeModel, String accessor) throws Exception {
        Method method = runtimeModel.getClass().getDeclaredMethod(accessor);
        method.setAccessible(true);
        return method.invoke(runtimeModel);
    }
}
