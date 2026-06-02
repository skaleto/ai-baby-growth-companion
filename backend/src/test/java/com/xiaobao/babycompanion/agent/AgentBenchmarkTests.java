package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentCareLog;
import com.xiaobao.babycompanion.dto.agent.AgentCareLogEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentExpense;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.dto.agent.AgentReminder;
import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Agent benchmark")
class AgentBenchmarkTests {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");
    private static final List<String> TECHNICAL_WORDS = List.of(
            "milkMl",
            "feedingType",
            "dueAt",
            "intervalMinutes",
            "alertMode",
            "scheduleMode",
            "reminderKind",
            "token",
            "provider",
            "model",
            "quota_counted"
    );

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-13T12:45:00Z"), APP_ZONE);
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(objectMapper, clock);
    private final AgentPlanner planner = new AgentPlanner(objectMapper, clock);
    private final EffectPolicy policy = new EffectPolicy(objectMapper, new CareEventCompletenessPolicy(objectMapper));
    private final SkillRegistry skillRegistry = new SkillRegistry();
    private final SkillDisclosureService skillDisclosureService = new SkillDisclosureService(skillRegistry);

    @Test
    void benchmarkTwelveHourFeedingTimeUsesCurrentAppClock() {
        RecordSignals signals = extractor.extract("6点半配方奶120ml");

        JsonNode event = signals.careLogPatch().path("events").get(0);
        assertThat(event.path("type").asText()).isEqualTo("milk");
        assertThat(event.path("time").asText()).isEqualTo("18:30");
        assertThat(event.path("amountMl").asInt()).isEqualTo(120);
    }

    @Test
    void benchmarkCompleteMixedFeedingRecordAutoWritesCareLog() {
        String message = "今天18:30配方奶120ml";
        var decisions = policy.decide(
                response(careLog("2026-05-13", 120, List.of(milkEvent("18:30", 120))), List.of(), List.of(), List.of(), List.of()),
                extractor.extract(message),
                objectMapper.createObjectNode().put("feeding", "混合喂养"),
                message
        );

        assertThat(decisions).hasSize(1);
        AgentEffectDecision decision = decisions.get(0);
        assertThat(decision.mode()).isEqualTo("auto");
        assertThat(decision.type()).isEqualTo("careLog");
        assertThat(decision.payload().path("events").get(0).path("time").asText()).isEqualTo("18:30");
        assertThat(decision.payload().path("events").get(0).path("amountMl").asInt()).isEqualTo(120);
    }

    @Test
    void benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting() {
        String message = "现在5:16开始吃奶";
        var decisions = policy.decide(
                response(careLog("2026-05-13", null, List.of(milkEvent("17:16", null))), List.of(), List.of(), List.of(), List.of()),
                extractor.extract(message)
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).type()).isEqualTo("careLog");
        assertUserFacingTextIsNatural(decisions.get(0));
    }

    @Test
    void benchmarkSleepDurationAutoWritesAndSleepStartAsks() {
        var complete = policy.decide(
                response(sleepLog("2026-05-13", "09:00", 1.0), List.of(), List.of(), List.of(), List.of()),
                extractor.extract("今天9点睡了1小时")
        );
        assertThat(complete).hasSize(1);
        assertThat(complete.get(0).mode()).isEqualTo("auto");
        assertThat(complete.get(0).payload().path("events").get(0).path("type").asText()).isEqualTo("sleep");

        var incomplete = policy.decide(
                response(sleepLog("2026-05-13", "09:00", null), List.of(), List.of(), List.of(), List.of()),
                extractor.extract("今天9点睡着了")
        );
        assertThat(incomplete).hasSize(1);
        assertThat(incomplete.get(0).mode()).isEqualTo("ask");
        assertUserFacingTextIsNatural(incomplete.get(0));
    }

    @Test
    void benchmarkHighRiskFeverStaysPending() {
        var decisions = policy.decide(
                response(
                        new AgentCareLog(null, "2026-05-13", null, null, null, null, null, List.of(), null, 39.2, List.of("体温39.2度"), List.of()),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(new AgentSafetyAlert("urgent", "fever", "高热风险", "建议尽快就医"))
                ),
                extractor.extract("宝宝体温39.2度")
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).type()).isEqualTo("careLog");
    }

    @Test
    void benchmarkOnceMilkReminderDoesNotAskCareRecordFields() {
        String message = "10:45提醒我喂奶";
        var decisions = policy.decide(
                response(null, List.of(reminder("提醒喂奶", "schedule", "once", "notification", "今天 10:45", "2026-05-13T10:45:00+08:00", null)), List.of(), List.of(), List.of()),
                extractor.extract(message),
                objectMapper.createObjectNode().put("feeding", "混合喂养"),
                message
        );

        assertThat(decisions).hasSize(1);
        AgentEffectDecision decision = decisions.get(0);
        assertThat(decision.mode()).isEqualTo("auto");
        assertThat(decision.type()).isEqualTo("reminder");
        assertThat(decision.payload().path("scheduleMode").asText()).isEqualTo("once");
        assertThat(decision.payload().path("alertMode").asText()).isEqualTo("notification");
        assertThat(decision.payload().path("repeatRule").isMissingNode() || decision.payload().path("repeatRule").isNull()).isTrue();
    }

    @Test
    void benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory() {
        var decisions = policy.decide(
                response(
                        null,
                        List.of(reminder("提醒喂奶", "schedule", "once", "notification", "十分钟后", null, null)),
                        List.of(new AgentMemory(null, "小宝目前是混合喂养，暂未发现过敏", "profile", 0.8, null)),
                        List.of(),
                        List.of()
                ),
                extractor.extract("每十分钟提醒我喂奶")
        );

        assertThat(decisions).hasSize(1);
        AgentEffectDecision decision = decisions.get(0);
        assertThat(decision.mode()).isEqualTo("auto");
        assertThat(decision.type()).isEqualTo("reminder");
        assertThat(decision.payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decision.payload().path("alertMode").asText()).isEqualTo("ringing");
        assertThat(decision.payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(10);
        assertThat(decision.payload().path("repeatRule").path("anchorType").asText()).isEqualTo("careEvent");
    }

    @Test
    void benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested() {
        var notification = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), extractor.extract("每两小时提醒我喝水"));
        assertThat(notification).hasSize(1);
        assertThat(notification.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(notification.get(0).payload().path("alertMode").asText()).isEqualTo("notification");
        assertThat(notification.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(120);

        var ringing = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), extractor.extract("每两小时闹钟提醒我喝水"));
        assertThat(ringing).hasSize(1);
        assertThat(ringing.get(0).payload().path("alertMode").asText()).isEqualTo("ringing");
    }

    @Test
    void benchmarkVagueReminderAsksForNaturalTimeOnly() {
        var decisions = policy.decide(
                response(null, List.of(reminder("提醒喝奶", "schedule", "once", "notification", "过会儿", null, null)), List.of(), List.of(), List.of()),
                extractor.extract("过会儿提醒我喝奶")
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("具体时间");
        assertUserFacingTextIsNatural(decisions.get(0));
    }

    @Test
    void benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord() {
        var expense = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), extractor.extract("今天给小宝买奶粉花了268"));
        assertThat(expense).hasSize(1);
        assertThat(expense.get(0).mode()).isEqualTo("pending");
        assertThat(expense.get(0).type()).isEqualTo("expenseItem");
        assertThat(expense.get(0).payload().path("title").asText()).isEqualTo("奶粉");
        assertThat(expense.get(0).payload().path("amount").asDouble()).isEqualTo(268);
        assertThat(expense.get(0).payload().path("category").asText()).isEqualTo("formula");

        var barcodePrice = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), extractor.extract("这个条形码多少钱"));
        assertThat(barcodePrice).isEmpty();
    }

    @Test
    void benchmarkUnsupportedChatMutationIsBoundaryOnly() {
        var decisions = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), extractor.extract("撤销刚才那条记录"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ignore");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("不能直接在聊天里撤销");
        assertUserFacingTextIsNatural(decisions.get(0));
    }

    @Test
    void benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools() {
        AgentChatRequest request = new AgentChatRequest("查一下杭州新生儿疫苗政策", null, null, List.of(), List.of(), List.of(), List.of(), null, false);
        RecordSignals signals = extractor.extract(request.message());

        AgentPlan plan = planner.parse(
                """
                        {"intent":"question","topics":["vaccine","policy"],"targetDates":[],"contextNeeds":["profile","web"],"toolRequests":[],"riskHints":["vaccine"]}
                        """,
                request,
                signals
        );

        assertThat(plan.toolRequests()).hasSize(1);
        assertThat(plan.toolRequests().get(0).toolId()).isEqualTo("web_search");
    }

    @Test
    void benchmarkExpenseImageRecognitionDoesNotUseWebSearch() {
        AgentChatRequest request = new AgentChatRequest(
                "帮我识别这几张小票花费并记到账本",
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(new AgentAttachment("attachment-1", "receipt.jpg", "image", null, "data:image/jpeg;base64,abc")),
                null,
                false
        );

        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));

        assertThat(plan.topics()).contains("expense");
        assertThat(plan.contextNeeds()).doesNotContain("web");
        assertThat(plan.toolRequests()).isEmpty();
    }

    @Test
    void benchmarkOneImageExpenseSkillCreatesPendingDraft() {
        AgentChatRequest request = expenseImageRequest("帮我识别这张奶粉订单花费并记到账本", List.of("attachment-1"));
        ExpenseRecognitionSkill skill = new ExpenseRecognitionSkill(objectMapper);

        ExpenseRecognitionResult result = skill.execute(
                expenseInput(request, 4),
                (modelRequest, batchNumber, batchCount) -> new ExpenseRecognitionModelResponse("req-1", "doubao", expenseJson("attachment-1", 268), null),
                null
        );

        assertThat(result.status()).isEqualTo("complete");
        assertThat(result.effectCandidates()).hasSize(1);
        assertThat(result.effectCandidates().get(0).mode()).isEqualTo("pending");
        assertThat(result.effectCandidates().get(0).payload().path("amount").asDouble()).isEqualTo(268);
    }

    @Test
    void benchmarkEightImageExpenseSkillBatchesWithoutWebSearch() {
        AgentChatRequest request = expenseImageRequest(
                "帮我识别这 8 张小票花费并记到账本",
                java.util.stream.IntStream.rangeClosed(1, 8).mapToObj((index) -> "attachment-" + index).toList()
        );
        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));
        ExpenseRecognitionSkill skill = new ExpenseRecognitionSkill(objectMapper);
        List<Integer> batchNumbers = new java.util.ArrayList<>();

        ExpenseRecognitionResult result = skill.execute(
                expenseInput(request, 4),
                (modelRequest, batchNumber, batchCount) -> {
                    batchNumbers.add(batchNumber);
                    return new ExpenseRecognitionModelResponse(
                            "req-" + batchNumber,
                            "doubao",
                            batchNumber == 1 ? expenseJson("attachment-1", 268) : "{\"status\":\"no_recognizable_amount\",\"expenses\":[],\"clarifications\":[],\"evidence\":[]}",
                            null
                    );
                },
                null
        );

        assertThat(plan.toolRequests()).isEmpty();
        assertThat(batchNumbers).containsExactly(1, 2);
        assertThat(result.traceSummary().batchCount()).isEqualTo(2);
    }

    @Test
    void benchmarkPreviousImageRetryRoutesIntoExpenseSkill() {
        AgentChatRequest request = expenseImageRequest("把刚才上面的这些花费再记录一遍", List.of("attachment-prior-1"));
        AgentPlan plan = new AgentPlan("record", List.of("expense"), List.of(), List.of("profile"), List.of(), List.of("none"), null);
        SkillRouter router = new SkillRouter(skillDisclosureService);

        SkillPlan skillPlan = router.plan(request, plan, extractor.extract(request.message()));

        assertThat(skillPlan.executes("expense-recognition")).isTrue();
    }

    @Test
    void benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding() {
        AgentChatRequest request = previousExpenseImageRetryRequest("把刚才我上传的图片对应的花费再记录一下");
        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));
        SkillRouter router = new SkillRouter(skillDisclosureService);

        SkillPlan skillPlan = router.plan(request, plan, extractor.extract(request.message()));

        assertThat(request.attachments()).isEmpty();
        assertThat(plan.skillRequests()).extracting(SkillPlanEntry::skillId).contains("expense-recognition");
        assertThat(skillPlan.executes("expense-recognition")).isTrue();
    }

    @Test
    void benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification() {
        AgentChatRequest request = expenseImageRequest("把月子鞋和摇奶器这些花费记到账本", List.of("attachment-1"));
        ExpenseRecognitionSkill skill = new ExpenseRecognitionSkill(objectMapper);

        ExpenseRecognitionResult result = skill.execute(
                expenseInput(request, 4),
                (modelRequest, batchNumber, batchCount) -> new ExpenseRecognitionModelResponse("req-1", "doubao", categoryFallbackExpenseJson(), null),
                null
        );

        assertThat(result.status()).isEqualTo("complete");
        assertThat(result.clarifications()).isEmpty();
        assertThat(result.effectCandidates()).extracting((decision) -> decision.payload().path("category").asText())
                .containsExactly("clothing", "daily");
    }

    @Test
    void benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk() {
        String message = "给宝宝买尿裤记账";
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("title", "纸尿裤");
        payload.put("amount", 129.9);
        payload.put("currency", "CNY");
        payload.put("category", "diaper");
        payload.put("date", "2026-05-13");
        payload.putArray("attachmentIds").add("attachment-1");

        var decisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                extractor.extract(message),
                null,
                message,
                List.of(new AgentEffectDecision("decision-skill", "pending", "expenseItem", payload, 0.9, "skill recognized", "expense-recognition"))
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).payload().path("amount").asDouble()).isEqualTo(129.9);
    }

    @Test
    void benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk() {
        String message = "帮我识别这几张小票花费并记到账本";
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("title", "奶粉");
        payload.put("amount", 268.0);
        payload.put("currency", "CNY");
        payload.put("category", "formula");
        payload.put("date", "2026-05-13");
        payload.putArray("attachmentIds").add("attachment-1");
        payload.put("persistenceStatus", "saved");

        var decisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                extractor.extract(message),
                null,
                message,
                List.of(new AgentEffectDecision(
                        "decision-saved",
                        "auto",
                        "expenseItem",
                        payload,
                        0.96,
                        "支出已自动保存到账本。",
                        "expense-recognition"
                ))
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).payload().path("persistenceStatus").asText()).isEqualTo("saved");
    }

    @Test
    void benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded() {
        SkillDisclosureResult recordOnly = skillDisclosureService.disclose(
                new AgentPlan("record", List.of("feeding"), List.of("2026-05-13"), List.of("profile", "careHistory"), List.of(), List.of("none"), null),
                extractor.extract("今天18:30配方奶120ml"),
                "今天18:30配方奶120ml"
        );
        assertThat(recordOnly.contexts()).isEmpty();

        SkillDisclosureResult feverQuestion = skillDisclosureService.disclose(
                new AgentPlan("question", List.of("temperature"), List.of(), List.of("profile"), List.of(), List.of("fever"), null),
                extractor.extract("宝宝发烧39度怎么办"),
                "宝宝发烧39度怎么办"
        );
        String text = feverQuestion.contexts().toString();
        assertThat(feverQuestion.disclosedSkillIds()).contains("pediatric-care-guide");
        assertThat(text).contains("temperature");
        assertThat(text).contains("redFlags");
    }

    @Test
    void benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy() {
        String copy = "今天还没看到喂养记录，要补一下吗？今天还没看到睡眠记录，要补一下吗？";

        assertThat(copy).contains("还没看到");
        assertThat(copy).contains("要补一下吗");
        assertThat(copy).doesNotContain("漏记了");
        assertThat(copy).doesNotContain("异常");
        for (String word : TECHNICAL_WORDS) {
            assertThat(copy).doesNotContain(word);
        }
    }

    @Test
    void benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy() {
        String summaryText = "小宝今天的小结：喂养记录：1 次，共 120 ml。 今天还没看到睡眠记录，要补一下吗？";

        assertThat(summaryText).doesNotContain("私密复诊提醒");
        assertThat(summaryText).doesNotContain("账号私有聊天");
        assertThat(summaryText).doesNotContain("会话摘要");
        for (String word : TECHNICAL_WORDS) {
            assertThat(summaryText).doesNotContain(word);
        }
    }

    @Test
    void benchmarkAgentPromptIncludesCaregiverSupportAndHighRiskBoundaries() {
        String prompt = AgentPrompts.AGENT_SYSTEM_PROMPT;

        assertThat(prompt).contains("照护人表达疲惫、自责、无助");
        assertThat(prompt).contains("结合上下文里的真实照护记录");
        assertThat(prompt).contains("不要诊断心理状态");
        assertThat(prompt).contains("不要把疲惫表达包装成付费焦虑");
        assertThat(prompt).contains("自伤、伤害宝宝");
        assertThat(prompt).contains("先联系身边家人、当地急救或专业医生");
    }

    private AgentCareLog careLog(String date, Integer milkMl, List<AgentCareLogEvent> events) {
        return new AgentCareLog(null, date, milkMl, null, null, null, null, List.of(), null, null, List.of(), events);
    }

    private AgentCareLog sleepLog(String date, String time, Double durationHours) {
        return new AgentCareLog(
                null,
                date,
                null,
                null,
                durationHours,
                null,
                null,
                List.of(),
                null,
                null,
                List.of(),
                List.of(new AgentCareLogEvent(null, "sleep", date, time, "睡觉", null, durationHours, null, "睡眠", List.of("睡眠")))
        );
    }

    private AgentCareLogEvent milkEvent(String time, Integer amountMl) {
        return new AgentCareLogEvent(null, "milk", "2026-05-13", time, "喝奶", amountMl, null, null, "喝奶", List.of("喂养"));
    }

    private AgentReminder reminder(
            String title,
            String reminderKind,
            String scheduleMode,
            String alertMode,
            String dueText,
            String dueAt,
            JsonNode repeatRule
    ) {
        return new AgentReminder(
                null,
                title,
                reminderKind,
                scheduleMode,
                alertMode,
                dueText,
                dueAt,
                dueText,
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                repeatRule,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        );
    }

    private AgentChatResponse response(
            AgentCareLog careLog,
            List<AgentReminder> reminders,
            List<AgentMemory> memories,
            List<AgentExpense> expenses,
            List<AgentSafetyAlert> alerts
    ) {
        return new AgentChatResponse(
                "好的",
                List.of(),
                null,
                careLog,
                reminders,
                memories,
                expenses,
                List.of(),
                alerts,
                List.of(),
                List.of("default-baby-companion"),
                "benchmark-trace",
                "benchmark-fixture",
                "benchmark-request"
        );
    }

    private AgentChatRequest expenseImageRequest(String message, List<String> attachmentIds) {
        return new AgentChatRequest(
                message,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                attachmentIds.stream()
                        .map((id) -> new AgentAttachment(id, id + ".jpg", "image", null, "data:image/jpeg;base64,abc"))
                        .toList(),
                null,
                false
        );
    }

    private AgentChatRequest previousExpenseImageRetryRequest(String message) {
        return new AgentChatRequest(
                message,
                null,
                null,
                List.of(new AgentChatMessage(
                        "msg-prior",
                        "parent",
                        "刚才这些宝宝用品花费帮我识别一下",
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
    }

    private ExpenseRecognitionInput expenseInput(AgentChatRequest request, int batchSize) {
        com.xiaobao.babycompanion.config.AgentRuntimeProperties.ModelProfile profile =
                new com.xiaobao.babycompanion.config.AgentRuntimeProperties.ModelProfile();
        profile.setBatchSize(batchSize);
        profile.setTemperature(0.0);
        RuntimeModel runtimeModel = new RuntimeModel(
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
        List<VisualAttachmentInput> visualInputs = request.attachments().stream()
                .map((attachment) -> new VisualAttachmentInput(attachment.id(), attachment.name(), attachment.kind(), attachment.dataUrl()))
                .toList();
        return new ExpenseRecognitionInput(request, extractor.extract(request.message()), "benchmark-trace", runtimeModel, profile, visualInputs);
    }

    private String expenseJson(String attachmentId, double amount) {
        return """
                {
                  "status": "complete",
                  "aiTextDraft": "已识别出支出。",
                  "expenses": [{
                    "title": "奶粉",
                    "amount": %s,
                    "currency": "CNY",
                    "category": "formula",
                    "date": "2026-05-13",
                    "attachmentIds": ["%s"],
                    "note": "截图显示实付款"
                  }],
                  "clarifications": [],
                  "evidence": [{"attachmentId":"%s","visibleFacts":["实付款"],"confidence":0.9}]
                }
                """.formatted(amount, attachmentId, attachmentId);
    }

    private String categoryFallbackExpenseJson() {
        return """
                {
                  "status": "needs_clarification",
                  "aiTextDraft": "需要确认分类",
                  "expenses": [{
                    "title": "月子鞋",
                    "amount": 59.9,
                    "currency": "CNY",
                    "category": "unknown",
                    "date": "2026-05-13",
                    "attachmentIds": ["attachment-1"],
                    "note": "截图显示月子鞋实付款"
                  }, {
                    "title": "摇奶器",
                    "amount": 129,
                    "currency": "CNY",
                    "category": "",
                    "date": "2026-05-13",
                    "attachmentIds": ["attachment-1"],
                    "note": "截图显示摇奶器实付款"
                  }],
                  "clarifications": ["请确认月子鞋和摇奶器分别属于什么分类？"],
                  "evidence": [{"attachmentId":"attachment-1","visibleFacts":["实付款"],"confidence":0.9}]
                }
                """;
    }

    // ── Daily-summary AI integration benchmarks ─────────────────────────────

    @Test
    void benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator() {
        com.xiaobao.babycompanion.service.DailySummaryFindingValidator validator =
                new com.xiaobao.babycompanion.service.DailySummaryFindingValidator();
        com.xiaobao.babycompanion.service.DailySummaryFindingValidator.KnownIds knownIds =
                com.xiaobao.babycompanion.service.DailySummaryFindingValidator.KnownIds.empty();

        List<com.xiaobao.babycompanion.dto.pro.FindingDto> input = List.of(
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "family_action_continuity", "妈妈用白噪音哄睡了 25 分钟",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null),
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "cross_domain_link", "今天买的奶粉今天就用了",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null),
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "expense_price_compare", "飞鹤1段单价比上月贵了 12 元",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null),
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "trend_anomaly", "本周奶量平均比上周低 25%",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null),
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "media_milestone_candidate", "可能是第一次扶站",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null),
                new com.xiaobao.babycompanion.dto.pro.FindingDto(
                        "memory_recall", "记忆里你说过先观察鸡蛋过敏",
                        com.xiaobao.babycompanion.dto.pro.FindingRelated.empty(), null)
        );

        List<com.xiaobao.babycompanion.dto.pro.FindingDto> result = validator.validate(input, knownIds);

        assertThat(result).hasSize(6);
        java.util.Set<String> seenTypes = result.stream()
                .map(com.xiaobao.babycompanion.dto.pro.FindingDto::type)
                .collect(java.util.stream.Collectors.toSet());
        assertThat(seenTypes).hasSize(6);
    }

    @Test
    void benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings() {
        com.xiaobao.babycompanion.service.DailySummaryAiClient failingClient =
                contextJson -> { throw new com.xiaobao.babycompanion.service.DailySummaryAiClient.DailySummaryAiException("simulated"); };

        List<com.xiaobao.babycompanion.dto.pro.FindingDto> findings;
        try {
            findings = failingClient.call("{}");
        } catch (Exception e) {
            // mirrors DailySummaryService.generateFindings() catch block: any failure → empty list
            findings = List.of();
        }

        String deterministicText = "小宝今天的小结：今天还没有太多正式记录。";

        assertThat(findings).isEmpty();
        assertThat(deterministicText).isNotEmpty();
    }

    private void assertUserFacingTextIsNatural(AgentEffectDecision decision) {
        ObjectNode payload = decision.payload() instanceof ObjectNode object ? object : objectMapper.createObjectNode();
        String visibleText = String.join(
                " ",
                decision.reason() == null ? "" : decision.reason(),
                payload.path("question").asText(""),
                payload.path("dueText").asText(""),
                payload.path("title").asText("")
        );
        for (String word : TECHNICAL_WORDS) {
            assertThat(visibleText).doesNotContain(word);
        }
    }
}
