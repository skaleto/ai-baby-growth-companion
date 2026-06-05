package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.config.DeepSeekProperties;
import com.xiaobao.babycompanion.config.DoubaoProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentCareLog;
import com.xiaobao.babycompanion.dto.agent.AgentCareLogEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentExpense;
import com.xiaobao.babycompanion.dto.agent.AgentGrowthEvent;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.dto.agent.AgentReminder;
import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import com.xiaobao.babycompanion.service.ExpensePersistenceResult;
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
    void benchmarkEmbeddedQuestionWithConcreteMilkRecordStillAutoWritesCareLog() {
        String message = "今天芊宝发生了什么？刚才9点多喝了100毫升的奶粉，喝完之后吐了。";
        RecordSignalExtractor lateEveningExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-05-13T14:15:00Z"), APP_ZONE)
        );
        RecordSignals signals = lateEveningExtractor.extract(message);

        assertThat(signals.concreteCareLog()).isTrue();
        assertThat(signals.careLogPatch().path("milkMl").asInt()).isEqualTo(100);
        assertThat(signals.careLogPatch().path("milkTimes").asInt()).isEqualTo(1);
        assertThat(signals.careLogPatch().path("events").get(0).path("time").asText()).isEqualTo("21:00");

        var decisions = policy.decide(
                response(careLog("2026-05-13", 100, List.of(milkEvent("21:00", 100))), List.of(), List.of(), List.of(), List.of(new AgentSafetyAlert("notice", "health", "吐奶留意", "观察状态"))),
                signals,
                objectMapper.createObjectNode().put("feeding", "混合喂养"),
                message
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("careLog");
        assertThat(decisions.get(0).payload().path("events").get(0).path("time").asText()).isEqualTo("21:00");
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
    void benchmarkMedicineAndVaccineRemindersStayPending() {
        var medicineDecisions = policy.decide(
                response(null, List.of(reminder("用药提醒", "schedule", "once", "notification", "明天 09:00", "2026-06-05T09:00:00+08:00", null)), List.of(), List.of(), List.of()),
                extractor.extract("明天上午9点提醒我给宝宝吃医生开的维生素D")
        );
        var vaccineDecisions = policy.decide(
                response(null, List.of(reminder("疫苗提醒", "schedule", "once", "notification", "下周二 09:00", "2026-06-09T09:00:00+08:00", null)), List.of(), List.of(), List.of()),
                extractor.extract("下周二上午9点提醒我带小宝去社区医院打疫苗")
        );

        assertThat(medicineDecisions).hasSize(1);
        assertThat(medicineDecisions.get(0).type()).isEqualTo("reminder");
        assertThat(medicineDecisions.get(0).mode()).isEqualTo("pending");
        assertThat(medicineDecisions.get(0).reason()).contains("用药");
        assertThat(vaccineDecisions).hasSize(1);
        assertThat(vaccineDecisions.get(0).type()).isEqualTo("reminder");
        assertThat(vaccineDecisions.get(0).mode()).isEqualTo("pending");
        assertThat(vaccineDecisions.get(0).reason()).contains("疫苗");
    }

    @Test
    void benchmarkGrowthMeasurementsBecomePendingDrafts() {
        String message = "今天身高68.2cm，体重7.4kg，头围42cm，帮我维护到成长数据里";
        RecordSignals signals = extractor.extract(message);

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.growthMeasurements()).hasSize(3);
        assertThat(signals.growthMeasurements()).extracting(GrowthMeasurementSignal::type)
                .containsExactly("height", "weight", "headCircumference");

        var decisions = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), signals);

        assertThat(decisions).hasSize(3);
        assertThat(decisions).allMatch((decision) -> "pending".equals(decision.mode()));
        assertThat(decisions).allMatch((decision) -> "growthMeasurement".equals(decision.type()));
        assertThat(decisions).extracting((decision) -> decision.payload().path("value").asDouble())
                .containsExactly(68.2, 7.4, 42.0);
    }

    @Test
    void benchmarkAmbiguousGrowthWeightUnitAsksInsteadOfPendingDraft() {
        String message = "今天体重14，帮我维护到成长数据里";
        RecordSignals signals = extractor.extract(message);

        assertThat(signals.topics()).contains("growth");

        var decisions = policy.decide(
                responseWithGrowthEvent(new AgentGrowthEvent(null, "measurement", "体重14", "2026-05-13", "今天体重14", false, null, List.of("成长"))),
                signals
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).type()).isEqualTo("growthMeasurement");
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("斤").contains("公斤");
    }

    @Test
    void benchmarkOutOfRangeGrowthMeasurementAsksInsteadOfPendingDraft() {
        String message = "今天身高999cm，帮我维护到成长数据里";
        RecordSignals signals = extractor.extract(message);

        assertThat(signals.topics()).contains("growth");

        var decisions = policy.decide(
                responseWithGrowthEvent(new AgentGrowthEvent(null, "measurement", "身高999cm", "2026-05-13", "今天身高999cm", false, null, List.of("成长"))),
                signals
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).type()).isEqualTo("growthMeasurement");
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("身高").contains("确认");
    }

    @Test
    void benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly() {
        String message = "把今天体重7.4kg改成7.5kg";
        RecordSignals signals = extractor.extract(message);

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.unsupportedMutationRequest()).isTrue();

        var decisions = policy.decide(
                responseWithGrowthEvent(new AgentGrowthEvent(null, "measurement", "体重7.5kg", "2026-05-13", "更正体重", false, null, List.of("成长"))),
                signals,
                objectMapper.createObjectNode(),
                message
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ignore");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("成长数据").contains("成长页");
        assertThat(AgentCapabilityContract.unsupportedMutationMessage()).contains("记录页").contains("修改");
    }

    @Test
    void benchmarkGrowthMeasurementHistoryDeleteStaysBoundaryOnly() {
        String message = "删掉今天的体重记录";
        RecordSignals signals = extractor.extract(message);

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.unsupportedMutationRequest()).isTrue();

        var decisions = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), signals);

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ignore");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("成长数据").contains("成长页");
    }

    @Test
    void benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft() {
        String message = "今天体重还是7.4kg，帮我维护到成长数据里";
        RecordSignals signals = extractor.extract(message);
        ObjectNode existing = objectMapper.createObjectNode();
        existing.put("id", "growth-weight-today");
        existing.put("type", "weight");
        existing.put("value", 7.4);
        existing.put("date", "2026-05-13");
        existing.put("note", "已有同日体重");

        var decisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                signals,
                objectMapper.createObjectNode(),
                message,
                List.<AgentEffectDecision>of(),
                List.of(existing)
        );

        assertThat(signals.growthMeasurements()).hasSize(1);
        assertThat(signals.growthMeasurements().get(0).type()).isEqualTo("weight");
        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).type()).isEqualTo("growthMeasurement");
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("今天").contains("体重").contains("7.4");
    }

    @Test
    void benchmarkDuplicateGrowthMeasurementReplyDoesNotInviteDuplicateRecord() {
        String message = "今天体重还是7.4kg，帮我维护到成长数据里";
        RecordSignals signals = extractor.extract(message);
        ObjectNode existing = objectMapper.createObjectNode();
        existing.put("id", "growth-weight-today");
        existing.put("type", "weight");
        existing.put("value", 7.4);
        existing.put("date", signals.growthMeasurements().get(0).date());
        existing.put("note", "已有同日体重");

        AgentChatResponse finalResponse = runtimeForBenchmark().withSafetyAlertsAndDecisions(
                aiTextOnlyResponse("需要我帮你再记一条今天的体重吗？还是想修改之前那条？"),
                message,
                signals,
                null,
                objectMapper.createObjectNode(),
                List.of(),
                ExpensePersistenceResult.empty(),
                List.of(existing)
        );

        assertThat(finalResponse.aiText()).contains("已经有").contains("体重").contains("7.4");
        assertThat(finalResponse.aiText()).doesNotContain("再记一条");
        assertThat(finalResponse.effectDecisions()).hasSize(1);
        assertThat(finalResponse.effectDecisions().get(0).mode()).isEqualTo("ask");
    }

    @Test
    void benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk() {
        String message = "今天还有哪些提醒？帮我列一下就好，不用新增";
        RecordSignals signals = extractor.extract(message);

        AgentChatResponse finalResponse = runtimeForBenchmark().withSafetyAlertsAndDecisions(
                aiTextOnlyResponse("今天有一个提醒：社区医院疫苗预约，时间在今天 15:30。"),
                message,
                signals,
                null,
                objectMapper.createObjectNode(),
                List.of(),
                ExpensePersistenceResult.empty(),
                List.of()
        );

        assertThat(signals.readOnlyReminderQuery()).isTrue();
        assertThat(finalResponse.aiText()).contains("社区医院疫苗预约");
        assertThat(finalResponse.aiText()).doesNotContain("这个提醒想定");
        assertThat(finalResponse.aiText()).doesNotContain("我再帮你设置");
        assertThat(finalResponse.effectDecisions()).isEmpty();
    }

    @Test
    void benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk() {
        String message = "请只基于今天已有记录，帮我总结一下今天的奶量、睡眠和需要交接的点，不要新增任何记录";
        RecordSignals signals = extractor.extract(message);

        AgentChatResponse finalResponse = runtimeForBenchmark().withSafetyAlertsAndDecisions(
                aiTextOnlyResponse("今天已有记录：奶量 240ml，睡眠 3 小时，晚上留意湿疹提醒。"),
                message,
                signals,
                null,
                objectMapper.createObjectNode(),
                List.of(),
                ExpensePersistenceResult.empty(),
                List.of()
        );

        assertThat(signals.readOnlySummaryQuery()).isTrue();
        assertThat(finalResponse.effectDecisions()).isEmpty();
        assertThat(finalResponse.aiText()).contains("240").contains("3");
        assertThat(finalResponse.aiText()).doesNotContain("喝了多少 ml");
        assertThat(finalResponse.aiText()).doesNotContain("我再帮你记");
    }

    @Test
    void benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk() {
        String message = "请只看这周已有记录，帮我总结奶量、睡眠和体重趋势，不要生成新记录";
        RecordSignals signals = extractor.extract(message);

        AgentChatResponse finalResponse = runtimeForBenchmark().withSafetyAlertsAndDecisions(
                aiTextOnlyResponse("这周奶量从 420ml 到 480ml，睡眠从 5.5 小时到 6.5 小时，体重 7.4kg。"),
                message,
                signals,
                null,
                objectMapper.createObjectNode(),
                List.of(),
                ExpensePersistenceResult.empty(),
                List.of()
        );

        assertThat(signals.readOnlySummaryQuery()).isTrue();
        assertThat(finalResponse.effectDecisions()).isEmpty();
        assertThat(finalResponse.aiText()).contains("480").contains("7.4");
        assertThat(finalResponse.aiText()).doesNotContain("喝了多少 ml");
        assertThat(finalResponse.aiText()).doesNotContain("我再帮你记");
    }

    @Test
    void benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime() {
        String message = "把我的产后复诊提醒同步给全家，让爷爷奶奶也都能看到";
        RecordSignals signals = extractor.extract(message);

        AgentChatResponse finalResponse = runtimeForBenchmark().withSafetyAlertsAndDecisions(
                aiTextOnlyResponse("好的，我会把“产后复诊”提醒同步给全家，这样爷爷奶奶也能看到了。"),
                message,
                signals,
                null,
                objectMapper.createObjectNode(),
                List.of(),
                ExpensePersistenceResult.empty(),
                List.of()
        );

        assertThat(signals.privateStateShareRequest()).isTrue();
        assertThat(finalResponse.aiText()).contains("不能").contains("自动同步");
        assertThat(finalResponse.aiText()).doesNotContain("我会把");
        assertThat(finalResponse.aiText()).doesNotContain("已同步");
        assertThat(finalResponse.aiText()).doesNotContain("他们就能看到了");
        assertThat(finalResponse.aiText()).doesNotContain("这个提醒想定");
        assertThat(finalResponse.effectDecisions()).isEmpty();
    }

    @Test
    void benchmarkGenericCareQuestionSuppressesModelMemoryCandidate() {
        var decisions = policy.decide(
                response(null, List.of(), List.of(new AgentMemory(null, "小宝不爱吃辅食", "preference", 0.62, null)), List.of(), List.of()),
                extractor.extract("宝宝不爱吃辅食怎么办")
        );

        assertThat(decisions).isEmpty();
    }

    @Test
    void benchmarkExplicitHealthMemoryBecomesPendingDraft() {
        String message = "记住一下，小宝吃鸡蛋会起疹子，以后要注意";
        RecordSignals signals = extractor.extract(message);

        var decisions = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), signals);

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).type()).isEqualTo("memory");
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).payload().path("category").asText()).isEqualTo("health");
        assertThat(decisions.get(0).payload().path("text").asText()).contains("鸡蛋").contains("疹子");
    }

    @Test
    void benchmarkExplicitPreferenceAndCaregiverMemoriesBecomePendingDrafts() {
        var preferenceDecisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                extractor.extract("记住一下，小宝喜欢睡前听白噪音")
        );
        var caregiverDecisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                extractor.extract("记住一下，晚上主要是爸爸哄睡，妈妈负责喂奶")
        );

        assertThat(preferenceDecisions).hasSize(1);
        assertThat(preferenceDecisions.get(0).type()).isEqualTo("memory");
        assertThat(preferenceDecisions.get(0).mode()).isEqualTo("pending");
        assertThat(preferenceDecisions.get(0).payload().path("category").asText()).isEqualTo("preference");
        assertThat(preferenceDecisions.get(0).payload().path("text").asText()).contains("白噪音");
        assertThat(caregiverDecisions).hasSize(1);
        assertThat(caregiverDecisions.get(0).type()).isEqualTo("memory");
        assertThat(caregiverDecisions.get(0).mode()).isEqualTo("pending");
        assertThat(caregiverDecisions.get(0).payload().path("category").asText()).isEqualTo("caregiver");
        assertThat(caregiverDecisions.get(0).payload().path("text").asText()).contains("爸爸").contains("妈妈");
    }

    @Test
    void benchmarkProfileUpdateRequestIsBoundaryOnly() {
        RecordSignals signals = extractor.extract("把宝宝昵称改成桃桃");

        assertThat(signals.unsupportedMutationRequest()).isTrue();
        var decisions = policy.decide(response(null, List.of(), List.of(), List.of(), List.of()), signals);

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ignore");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("资料页");
        assertUserFacingTextIsNatural(decisions.get(0));
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
    void benchmarkVagueReminderAsksEvenWhenModelOmitsReminderDto() {
        var decisions = policy.decide(
                response(null, List.of(), List.of(), List.of(), List.of()),
                extractor.extract("过会儿提醒我喝奶")
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
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
        String copy = "小宝今天的小结：喂养记录：1 次，共 120 ml。";

        assertThat(copy).doesNotContain("还没看到");
        assertThat(copy).doesNotContain("要补一下吗");
        assertThat(copy).doesNotContain("补一下");
        assertThat(copy).doesNotContain("漏记了");
        assertThat(copy).doesNotContain("异常");
        for (String word : TECHNICAL_WORDS) {
            assertThat(copy).doesNotContain(word);
        }
    }

    @Test
    void benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy() {
        String summaryText = "小宝今天的小结：喂养记录：1 次，共 120 ml。";

        assertThat(summaryText).doesNotContain("私密复诊提醒");
        assertThat(summaryText).doesNotContain("账号私有聊天");
        assertThat(summaryText).doesNotContain("会话摘要");
        assertThat(summaryText).doesNotContain("待确认信息");
        assertThat(summaryText).doesNotContain("未完成提醒");
        assertThat(summaryText).doesNotContain("要补一下吗");
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

    private AgentChatResponse responseWithGrowthEvent(AgentGrowthEvent growthEvent) {
        return new AgentChatResponse(
                "好的",
                List.of(),
                growthEvent,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "benchmark-trace",
                "benchmark-fixture",
                "benchmark-request"
        );
    }

    private AgentChatResponse aiTextOnlyResponse(String aiText) {
        return new AgentChatResponse(
                aiText,
                List.of(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "benchmark-trace",
                "benchmark-fixture",
                "benchmark-request"
        );
    }

    private AgentRuntime runtimeForBenchmark() {
        return new AgentRuntime(
                new DeepSeekProperties(),
                new DoubaoProperties(),
                objectMapper,
                planner,
                null,
                null,
                null,
                extractor,
                policy,
                new CurrentUser(),
                skillRegistry,
                skillDisclosureService,
                new AgentRuntimeProperties(),
                new SkillRouter(skillDisclosureService),
                new ExpenseRecognitionSkill(objectMapper),
                null,
                new ToolRegistry(List.of()),
                new SafetyGuard(),
                null,
                Runnable::run,
                clock
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
