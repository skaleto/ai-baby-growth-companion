package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AgentRuntimeTests {

    private final SkillRegistry skillRegistry = new SkillRegistry();
    private final AgentRuntime agentRuntime = runtimeWith(new DoubaoProperties());

    private AgentRuntime runtimeWith(DoubaoProperties doubaoProperties) {
        return runtimeWith(doubaoProperties, null);
    }

    private AgentRuntime runtimeWith(DoubaoProperties doubaoProperties, AppStateService appStateService) {
        ObjectMapper objectMapper = new ObjectMapper();
        SkillDisclosureService disclosureService = new SkillDisclosureService(skillRegistry);
        return new AgentRuntime(
                new DeepSeekProperties(),
                doubaoProperties,
                objectMapper,
                new AgentPlanner(objectMapper),
                null,
                appStateService,
                (AttachmentStorageService) null,
                new CurrentUser(),
                skillRegistry,
                disclosureService,
                new AgentRuntimeProperties(),
                new SkillRouter(disclosureService),
                new ExpenseRecognitionSkill(objectMapper),
                null,
                new ToolRegistry(List.of()),
                new SafetyGuard(),
                null,
                Runnable::run,
                Clock.system(ZoneId.of("Asia/Shanghai"))
        );
    }

    @Test
    void parsesModelJsonAndAddsRuntimeMetadata() {
        AgentChatResponse response = agentRuntime.parseModelContent(
                """
                        {
                          "aiText": "我看到了这条喂养信息。",
                          "tags": ["喂养"],
                          "growthEvent": null,
                          "careLogPatch": {"date":"2026-06-07","milkMl": 120},
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

        assertThat(response.aiText()).isEqualTo("我看到了这条喂养信息。");
        assertThat(response.careLogPatch().milkMl()).isEqualTo(120);
        assertThat(response.usedSkills()).containsExactly("default-baby-companion");
        assertThat(response.traceId()).isEqualTo("agent-test");
        assertThat(response.model()).isEqualTo("deepseek-test");
    }

    @Test
    void finalComposerClearsLegacyWritableFieldsAndEffectDecisions() {
        AgentChatResponse modelResponse = new AgentChatResponse(
                "我看到了这条记录。",
                List.of("喂养"),
                null,
                new com.xiaobao.babycompanion.dto.agent.AgentCareLog(
                        null,
                        "2026-06-07",
                        120,
                        1,
                        null,
                        null,
                        null,
                        List.of(),
                        null,
                        null,
                        List.of(),
                        List.of()
                ),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(new com.xiaobao.babycompanion.dto.agent.AgentEffectDecision("old", "auto", "careLog", null, 0.9, "old", "old")),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndActionResults(modelResponse, "刚才喝了120ml", List.of());

        assertThat(response.careLogPatch()).isNull();
        assertThat(response.growthEvent()).isNull();
        assertThat(response.reminders()).isEmpty();
        assertThat(response.memories()).isEmpty();
        assertThat(response.expenses()).isEmpty();
        assertThat(response.effectDecisions()).isEmpty();
    }

    @Test
    void finalComposerCannotClaimRecordedWithoutAppliedActionResult() {
        AgentChatResponse modelResponse = new AgentChatResponse(
                "好的，已经记到今天的喂养记录里了。",
                List.of("喂养"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndActionResults(modelResponse, "刚才喝了120ml", List.of());

        assertThat(response.aiText()).contains("没有保存成功");
        assertThat(response.aiText()).doesNotContain("已经记到");
    }

    @Test
    void finalComposerAllowsRecordedClaimWithAppliedActionResult() {
        AgentChatResponse modelResponse = new AgentChatResponse(
                "好的，已经记到今天的喂养记录里了。",
                List.of("喂养"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("record_feeding_event"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndActionResults(
                modelResponse,
                "刚才喝了120ml配方奶",
                List.of(new AgentActionResult(
                        "applied",
                        "record_feeding_event",
                        "care_log",
                        List.of("care-2026-06-07"),
                        null,
                        Map.of("amountMl", 120),
                        "已记录 120ml 配方奶。",
                        List.of(),
                        List.of()
                ))
        );

        assertThat(response.aiText()).isEqualTo("好的，已经记到今天的喂养记录里了。");
    }

    @Test
    void expenseRecognitionCreatesPendingDraftInsteadOfDirectExpenseSave() {
        AppStateService appStateService = mock(AppStateService.class);
        AgentRuntime runtime = runtimeWith(new DoubaoProperties(), appStateService);
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode expense = objectMapper.createObjectNode();
        expense.put("title", "奶粉");
        expense.put("amount", 268);
        expense.put("currency", "CNY");
        expense.put("category", "formula");
        expense.put("date", "2026-06-07");

        List<AgentActionResult> results = runtime.expenseRecognitionActionResults(
                new ExpenseRecognitionResult(
                        "complete",
                        "我已识别出奶粉 268 元。",
                        null,
                        List.of(new AgentEffectDecision("candidate-1", "pending", "expenseItem", expense, 0.92, "识别到支出", "expense-recognition")),
                        List.of(),
                        List.of(),
                        List.of(),
                        null
                ),
                true,
                "trace-expense",
                "family-expense",
                "user-expense"
        );

        ArgumentCaptor<JsonNode> pendingCaptor = ArgumentCaptor.forClass(JsonNode.class);
        verify(appStateService).upsertAgentPendingEffect(eq("family-expense"), eq("user-expense"), pendingCaptor.capture());
        verify(appStateService, never()).persistAgentExpenseCandidates(any(), eq(true), eq("family-expense"), eq("user-expense"));
        JsonNode pending = pendingCaptor.getValue();
        assertThat(pending.path("domain").asText()).isEqualTo("ledger");
        assertThat(pending.path("source").path("kind").asText()).isEqualTo("agent_action");
        assertThat(pending.path("expenses")).hasSize(1);
        assertThat(pending.path("expenses").get(0).path("amount").asDouble()).isEqualTo(268);
        assertThat(results).hasSize(1);
        assertThat(results.get(0).status()).isEqualTo("pending_created");
        assertThat(results.get(0).pendingEffectId()).isEqualTo(pending.path("id").asText());
    }
}
