package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentGrowthEvent;
import com.xiaobao.babycompanion.dto.agent.AgentExpense;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.exception.AgentResponseParseException;
import com.xiaobao.babycompanion.service.AppStateService;
import com.xiaobao.babycompanion.service.AttachmentStorageService;
import com.xiaobao.babycompanion.service.ExpensePersistenceResult;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.junit.jupiter.api.Test;

class AgentRuntimeTests {

    private final SkillRegistry skillRegistry = new SkillRegistry();
    private final AgentRuntime agentRuntime = runtimeWith(new DoubaoProperties());

    private AgentRuntime runtimeWith(DoubaoProperties doubaoProperties) {
        return runtimeWith(doubaoProperties, new AgentRuntimeProperties());
    }

    private AgentRuntime runtimeWith(DoubaoProperties doubaoProperties, AgentRuntimeProperties runtimeProperties) {
        return runtimeWith(doubaoProperties, runtimeProperties, null);
    }

    private AgentRuntime runtimeWith(
            DoubaoProperties doubaoProperties,
            AgentRuntimeProperties runtimeProperties,
            AppStateService appStateService
    ) {
        return runtimeWith(doubaoProperties, runtimeProperties, appStateService, null);
    }

    private AgentRuntime runtimeWith(
            DoubaoProperties doubaoProperties,
            AgentRuntimeProperties runtimeProperties,
            AppStateService appStateService,
            AttachmentStorageService attachmentStorageService
    ) {
        ObjectMapper objectMapper = new ObjectMapper();
        SkillDisclosureService disclosureService = new SkillDisclosureService(skillRegistry);
        return new AgentRuntime(
                new DeepSeekProperties(),
                doubaoProperties,
                objectMapper,
                new AgentPlanner(objectMapper),
                null,
                appStateService,
                attachmentStorageService,
                new RecordSignalExtractor(objectMapper),
                new EffectPolicy(objectMapper, new CareEventCompletenessPolicy(objectMapper)),
                new CurrentUser(),
                skillRegistry,
                disclosureService,
                runtimeProperties,
                new SkillRouter(disclosureService),
                new ExpenseRecognitionSkill(objectMapper),
                null,
                new ToolRegistry(List.of()),
                new SafetyGuard(),
                null,
                Runnable::run,
                java.time.Clock.system(java.time.ZoneId.of("Asia/Shanghai"))
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
    void replacesAmountQuestionWhenExpenseDraftIsAlreadyPending() {
        String userMessage = "帮我识别这几张小票花费并记到账本";
        AgentChatResponse modelResponse = new AgentChatResponse(
                "这笔支出实际花了多少钱？确认金额后我再帮你记到账本里。",
                List.of("记账"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(new AgentExpense(
                        null,
                        "奶粉",
                        268.0,
                        "CNY",
                        "formula",
                        "2026-05-01",
                        null,
                        null,
                        "京东",
                        "订单截图识别",
                        null,
                        null,
                        List.of("attachment-1"),
                        "agent",
                        null,
                        null
                )),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(new ObjectMapper()).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-01"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null
        );

        assertThat(response.aiText()).contains("已识别出这笔支出");
        assertThat(response.aiText()).doesNotContain("实际花了多少钱");
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).mode()).isEqualTo("pending");
    }

    @Test
    void replacesAmountQuestionWhenExpenseSkillCandidateIsAlreadyPending() {
        String userMessage = "帮我识别这几张小票花费并记到账本";
        AgentChatResponse modelResponse = new AgentChatResponse(
                "这笔支出实际花了多少钱？确认金额后我再帮你记到账本里。",
                List.of("记账"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("expense-recognition"),
                "trace",
                "model",
                "request"
        );
        var payload = new ObjectMapper().createObjectNode();
        payload.put("title", "奶粉");
        payload.put("amount", 268);
        payload.put("currency", "CNY");
        payload.put("category", "formula");
        payload.put("date", "2026-05-16");
        payload.putArray("attachmentIds").add("attachment-1");
        payload.put("sourceSkill", "expense-recognition");

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(new ObjectMapper()).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-16"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null,
                List.of(new com.xiaobao.babycompanion.dto.agent.AgentEffectDecision(
                        "decision-skill",
                        "pending",
                        "expenseItem",
                        payload,
                        0.9,
                        "skill recognized expense",
                        "expense-recognition"
                ))
        );

        assertThat(response.aiText()).contains("已识别出这笔支出");
        assertThat(response.aiText()).doesNotContain("实际花了多少钱");
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).source()).isEqualTo("expense-recognition");
    }

    @Test
    void savedExpensePersistenceReplacesConfirmationCopyAndKeepsAutoDecisionOnly() {
        ObjectMapper objectMapper = new ObjectMapper();
        String userMessage = "帮我识别这几张小票花费并记到账本";
        ObjectNode savedExpense = expensePayload(objectMapper, "奶粉", 268.0, "saved");
        AgentChatResponse modelResponse = new AgentChatResponse(
                "这笔支出实际花了多少钱？确认金额后我再帮你记到账本里。",
                List.of("记账"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("expense-recognition"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(objectMapper).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-16"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null,
                List.of(new AgentEffectDecision(
                        "decision-saved",
                        "auto",
                        "expenseItem",
                        savedExpense,
                        0.96,
                        "支出已自动保存到账本。",
                        "expense-recognition"
                )),
                new ExpensePersistenceResult(List.<JsonNode>of(savedExpense), List.of(), List.of(), List.of())
        );

        assertThat(response.aiText()).contains("已记录 1 笔支出到账本");
        assertThat(response.aiText()).doesNotContain("实际花了多少钱");
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).mode()).isEqualTo("auto");
        assertThat(response.effectDecisions()).noneMatch((decision) -> "pending".equals(decision.mode()));
    }

    @Test
    void readOnlyExpenseRecognitionDoesNotCreatePendingExpenseDecision() {
        ObjectMapper objectMapper = new ObjectMapper();
        String userMessage = "帮我识别这张小票花费";
        ObjectNode readOnlyExpense = expensePayload(objectMapper, "奶粉", 268.0, "readOnly");
        AgentChatResponse modelResponse = new AgentChatResponse(
                "这笔支出实际花了多少钱？确认金额后我再帮你记到账本里。",
                List.of("记账"),
                null,
                null,
                List.of(),
                List.of(),
                List.of(new AgentExpense(
                        null,
                        "奶粉",
                        268.0,
                        "CNY",
                        "formula",
                        "2026-05-16",
                        null,
                        null,
                        "京东",
                        "订单截图识别",
                        null,
                        null,
                        List.of("attachment-1"),
                        "agent",
                        null,
                        null
                )),
                List.of(),
                List.of(),
                List.of(),
                List.of("expense-recognition"),
                "trace",
                "model",
                "request"
        );

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(objectMapper).extract(userMessage),
                new AgentPlan("question", List.of("expense"), List.of("2026-05-16"), List.of("profile"), List.of(), List.of("none"), null),
                null,
                List.of(),
                new ExpensePersistenceResult(List.of(), List.of(), List.of(), List.<JsonNode>of(readOnlyExpense))
        );

        assertThat(response.aiText()).contains("只是识别，没有写入账本");
        assertThat(response.effectDecisions()).noneMatch((decision) -> "expenseItem".equals(decision.type()));
    }

    @Test
    void expensePersistenceFallbackStillReturnsSavedFactsWhenFinalModelFails() {
        ObjectMapper objectMapper = new ObjectMapper();
        String userMessage = "帮我识别这几张小票花费并记到账本";
        ObjectNode savedExpense = expensePayload(objectMapper, "奶粉", 268.0, "saved");
        AgentEffectDecision autoDecision = new AgentEffectDecision(
                "decision-saved",
                "auto",
                "expenseItem",
                savedExpense,
                0.96,
                "支出已自动保存到账本。",
                "expense-recognition"
        );

        AgentChatResponse response = agentRuntime.expensePersistenceFallbackResponse(
                userMessage,
                new RecordSignalExtractor(objectMapper).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-16"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null,
                List.of(autoDecision),
                new ExpensePersistenceResult(List.<JsonNode>of(savedExpense), List.of(), List.of(), List.of()),
                List.of("expense-recognition"),
                "trace",
                "model",
                "request",
                List.of()
        );

        assertThat(response).isNotNull();
        assertThat(response.aiText()).contains("已记录 1 笔支出到账本");
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).mode()).isEqualTo("auto");
    }

    @Test
    void expenseRecognitionPersistenceUsesExplicitPrincipalForAsyncStreams() {
        ObjectMapper objectMapper = new ObjectMapper();
        AppStateService appStateService = mock(AppStateService.class);
        AgentRuntime runtime = runtimeWith(new DoubaoProperties(), new AgentRuntimeProperties(), appStateService);
        ObjectNode savedExpense = expensePayload(objectMapper, "奶粉", 268.0, "saved");
        ExpensePersistenceResult expected = new ExpensePersistenceResult(List.<JsonNode>of(savedExpense), List.of(), List.of(), List.of());
        ExpenseRecognitionResult result = new ExpenseRecognitionResult(
                "ok",
                null,
                null,
                List.of(new AgentEffectDecision(
                        "decision-saved",
                        "auto",
                        "expenseItem",
                        savedExpense,
                        0.96,
                        "支出已自动保存到账本。",
                        "expense-recognition"
                )),
                List.of(),
                List.of(),
                List.of(),
                null
        );
        when(appStateService.persistAgentExpenseCandidates(anyList(), eq(true), eq("family-1"), eq("user-1")))
                .thenReturn(expected);

        ExpensePersistenceResult actual = runtime.persistExpenseRecognitionResult(result, true, "family-1", "user-1");

        assertThat(actual).isSameAs(expected);
        verify(appStateService).persistAgentExpenseCandidates(anyList(), eq(true), eq("family-1"), eq("user-1"));
        verify(appStateService, never()).persistAgentExpenseCandidates(anyList(), anyBoolean());
    }

    @Test
    void hydratesRecentVisualAttachmentsForPlannerSelectedExpenseSkill() {
        AttachmentStorageService attachmentStorageService = mock(AttachmentStorageService.class);
        AgentRuntime runtime = runtimeWith(new DoubaoProperties(), new AgentRuntimeProperties(), null, attachmentStorageService);
        when(attachmentStorageService.loadAgentAttachmentDataUrl(eq("attachment-prior-1"), eq("family-1")))
                .thenReturn(new AgentAttachment("attachment-prior-1", "receipt.jpg", "image", "/api/uploads/attachment-prior-1", "data:image/jpeg;base64,AAAA"));
        AgentChatRequest request = new AgentChatRequest(
                "把刚才我上传的图片对应的花费再记录一下",
                null,
                null,
                List.of(new AgentChatMessage(
                        "msg-prior",
                        "parent",
                        "这几张宝宝用品花费帮我识别一下",
                        "2026-05-16T20:01:00",
                        List.of(new AgentAttachment("attachment-prior-1", "receipt.jpg", "image", "/api/uploads/attachment-prior-1", null)),
                        List.of()
                )),
                List.of(),
                List.of(),
                List.of(),
                null,
                false
        );
        SkillPlan skillPlan = new SkillPlan(List.of(new SkillPlanEntry(
                "expense-recognition",
                SkillMode.EXECUTE,
                "planner 选择执行上一轮支出图片识别"
        )));

        List<VisualAttachmentInput> visualInputs = runtime.visualInputsForSkillExecution(
                request,
                skillPlan,
                "family-1",
                visionRuntimeModel()
        );

        assertThat(visualInputs).hasSize(1);
        assertThat(visualInputs.get(0).id()).isEqualTo("attachment-prior-1");
        assertThat(visualInputs.get(0).dataUrl()).startsWith("data:image/jpeg;base64,");
        verify(attachmentStorageService).loadAgentAttachmentDataUrl(eq("attachment-prior-1"), eq("family-1"));
    }

    @Test
    void keepsModelTextWhenRuleAskAddsAClarification() {
        String userMessage = "帮我把这些花费记到账本";
        AgentChatResponse modelResponse = new AgentChatResponse(
                "我先按宝宝支出帮你整理，但这条还差一点关键信息。",
                List.of("记账"),
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

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(new ObjectMapper()).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-01"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null
        );

        assertThat(response.aiText()).startsWith("我先按宝宝支出帮你整理");
        assertThat(response.aiText()).contains("实际花了多少钱");
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).mode()).isEqualTo("ask");
    }

    @Test
    void doesNotAppendDuplicateAmountQuestionWhenModelAlreadyAsksForAmount() {
        String userMessage = "和恒温壶这些全部都是宝宝相关的支出，关闭的那一笔不属于支出";
        AgentChatResponse modelResponse = new AgentChatResponse(
                "好的，我已经记录啦。剩下待记录的支出实际金额是多少呢？确认后我就帮你整理到账本里。",
                List.of("记账"),
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

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(new ObjectMapper()).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-01"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null
        );

        assertThat(response.aiText()).isEqualTo(modelResponse.aiText());
        assertThat(response.effectDecisions()).hasSize(1);
        assertThat(response.effectDecisions().get(0).mode()).isEqualTo("ask");
    }

    @Test
    void defersRuleAmountAskWhenRetryingPreviousExpenseImages() {
        String userMessage = "把刚才上面的这些花费重新再记录一遍。";
        AgentChatResponse modelResponse = new AgentChatResponse(
                "我会重新读取上面的订单图片，识别到金额后整理成待确认的账本草稿。",
                List.of("记账"),
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

        AgentChatResponse response = agentRuntime.withSafetyAlertsAndDecisions(
                modelResponse,
                userMessage,
                new RecordSignalExtractor(new ObjectMapper()).extract(userMessage),
                new AgentPlan("record", List.of("expense"), List.of("2026-05-01"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                null
        );

        assertThat(response.aiText()).isEqualTo(modelResponse.aiText());
        assertThat(response.effectDecisions()).isEmpty();
    }

    @Test
    void returnsActionableTimeoutCopyForVisualStreams() {
        String message = agentRuntime.userFacingModelErrorMessage(
                new java.net.http.HttpTimeoutException("request timed out"),
                "image"
        );

        assertThat(message).contains("图片分析超时");
        assertThat(message).contains("分批处理");
    }

    @Test
    void splitsMoreThanFourVisualInputsIntoModelBatches() throws Exception {
        Object runtimeModel = resolveRuntimeModel(agentRuntime, "doubao-seed-2.0-pro", false);
        Method visualInputsMethod = AgentRuntime.class.getDeclaredMethod("visualAttachmentInputs", List.class, runtimeModel.getClass());
        visualInputsMethod.setAccessible(true);
        Method batchesMethod = AgentRuntime.class.getDeclaredMethod("visualAnalysisBatches", List.class);
        batchesMethod.setAccessible(true);

        List<AgentAttachment> attachments = java.util.stream.IntStream.rangeClosed(1, 8)
                .mapToObj((index) -> new AgentAttachment(
                        "attachment-" + index,
                        "image-" + index + ".jpg",
                        "image",
                        null,
                        "data:image/jpeg;base64,AAAA"
                ))
                .toList();
        List<?> visualInputs = (List<?>) visualInputsMethod.invoke(agentRuntime, attachments, runtimeModel);

        List<?> batches = (List<?>) batchesMethod.invoke(agentRuntime, visualInputs);
        List<?> fourOrFewer = (List<?>) batchesMethod.invoke(agentRuntime, visualInputs.subList(0, 4));

        assertThat(batches).hasSize(2);
        assertThat((List<?>) batches.get(0)).hasSize(4);
        assertThat((List<?>) batches.get(1)).hasSize(4);
        assertThat(fourOrFewer).isEmpty();
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
    void expenseRecognitionProfileFallsBackToVisionModelWhenFinalModelHasNoVision() throws Exception {
        Object finalModel = resolveRuntimeModel(agentRuntime, "deepseek-v4-pro", false);
        Method method = AgentRuntime.class.getDeclaredMethod("resolveExpenseRecognitionModel", finalModel.getClass());
        method.setAccessible(true);

        Object expenseModel = method.invoke(agentRuntime, finalModel);

        assertThat(runtimeModelValue(expenseModel, "id")).isEqualTo("doubao-seed-2.0-pro");
        assertThat(runtimeModelValue(expenseModel, "supportsImageInput")).isEqualTo(true);
    }

    @Test
    void configuredExpenseRecognitionProfileIsResolvedSeparately() throws Exception {
        AgentRuntimeProperties properties = new AgentRuntimeProperties();
        properties.getModels().getExpenseRecognition().setModel("doubao-seed-2.0-lite");
        AgentRuntime runtime = runtimeWith(new DoubaoProperties(), properties);
        Object finalModel = resolveRuntimeModel(runtime, "deepseek-v4-pro", false);
        Method method = AgentRuntime.class.getDeclaredMethod("resolveExpenseRecognitionModel", finalModel.getClass());
        method.setAccessible(true);

        Object expenseModel = method.invoke(runtime, finalModel);

        assertThat(runtimeModelValue(expenseModel, "id")).isEqualTo("doubao-seed-2.0-lite");
        assertThat(runtimeModelValue(finalModel, "id")).isEqualTo("deepseek-v4-pro");
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

    private ObjectNode expensePayload(ObjectMapper objectMapper, String title, double amount, String persistenceStatus) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("title", title);
        payload.put("amount", amount);
        payload.put("currency", "CNY");
        payload.put("category", "formula");
        payload.put("date", "2026-05-16");
        payload.put("merchant", "京东");
        payload.put("note", "订单截图识别");
        payload.putArray("attachmentIds").add("attachment-1");
        payload.put("source", "agent");
        payload.put("persistenceStatus", persistenceStatus);
        return payload;
    }

    private RuntimeModel visionRuntimeModel() {
        return new RuntimeModel(
                "doubao-seed-2.0-pro",
                Provider.DOUBAO,
                "doubao-seed-2-0-pro-260215",
                true,
                true,
                false,
                "https://example.test",
                "/chat/completions",
                java.time.Duration.ofSeconds(30),
                "DOUBAO_API_KEY"
        );
    }
}
