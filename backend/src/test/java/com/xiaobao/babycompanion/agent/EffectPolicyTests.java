package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentCareLog;
import com.xiaobao.babycompanion.dto.agent.AgentCareLogEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentExpense;
import com.xiaobao.babycompanion.dto.agent.AgentMemory;
import com.xiaobao.babycompanion.dto.agent.AgentReminder;
import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import org.junit.jupiter.api.Test;

class EffectPolicyTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(objectMapper);
    private final EffectPolicy policy = new EffectPolicy(objectMapper, new CareEventCompletenessPolicy(objectMapper));

    @Test
    void autoRecordsConcreteLowRiskCareLog() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                120,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("8点喝奶120ml"),
                List.of()
        ), List.of());

        var decisions = policy.decide(response, extractor.extract("今天8点喝奶120ml"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("careLog");
    }

    @Test
    void keepsHighRiskCareLogPending() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                39.2,
                List.of("体温39.2度"),
                List.of()
        ), List.of(new AgentSafetyAlert("urgent", "fever", "高热风险", "建议尽快就医")));

        var decisions = policy.decide(response, extractor.extract("宝宝体温39.2度"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
    }

    @Test
    void prefersSplitRuleEventsWhenModelReturnsMixedCareEvent() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                120,
                null,
                1.0,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("8点喝奶120ml，9点睡了1小时"),
                List.of(new AgentCareLogEvent(
                        null,
                        "note",
                        "2026-05-01",
                        "08:00",
                        "照护记录",
                        null,
                        null,
                        null,
                        "8点喝奶120ml，9点睡了1小时",
                        List.of("照护记录")
                ))
        ), List.of());

        var decisions = policy.decide(response, extractor.extract("今天8点喝奶120ml，9点睡了1小时"));

        var events = decisions.get(0).payload().path("events");
        assertThat(events.size()).isGreaterThanOrEqualTo(2);
        assertThat(events.get(0).path("type").asText()).isEqualTo("milk");
        assertThat(events.get(1).path("type").asText()).isEqualTo("sleep");
    }

    @Test
    void normalizesAndDeduplicatesSleepTimelineEvents() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("小宝晚上8点半睡了1小时"),
                List.of(new AgentCareLogEvent(
                        null,
                        "sleep",
                        "2026-05-01",
                        "20:30",
                        "小宝入睡",
                        null,
                        1.0,
                        null,
                        "晚上8点半睡了1小时",
                        List.of("入睡")
                ))
        ), List.of());

        var decisions = policy.decide(response, extractor.extract("小宝，晚上8点半睡了1小时。"));

        var events = decisions.get(0).payload().path("events");
        assertThat(events).hasSize(1);
        assertThat(events.get(0).path("type").asText()).isEqualTo("sleep");
        assertThat(events.get(0).path("title").asText()).isEqualTo("睡觉");
        assertThat(events.get(0).path("time").asText()).isEqualTo("20:30");
    }

    @Test
    void asksInsteadOfRecordingIncompleteFeedingStart() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("开始吃奶"),
                List.of(new AgentCareLogEvent(
                        null,
                        "milk",
                        "2026-05-01",
                        "17:16",
                        "喝奶",
                        null,
                        null,
                        null,
                        "开始吃奶",
                        List.of("喝奶")
                ))
        ), List.of());

        var decisions = policy.decide(response, extractor.extract("现在5:16又要开始吃奶了"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("missingFields").get(0).asText()).isEqualTo("milkMl");
    }

    @Test
    void asksForMilkTypeWhenMixedFeedingProfileHasGenericMilkRecord() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                120,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("8点喝奶120ml"),
                List.of()
        ), List.of());
        var profile = objectMapper.createObjectNode().put("feeding", "混合喂养");

        var decisions = policy.decide(response, extractor.extract("今天8点喝奶120ml"), profile, "今天8点喝奶120ml");

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("missingFields"))
                .anyMatch((field) -> field.asText().equals("feedingType"));
        assertThat(decisions.get(0).payload().path("question").asText()).contains("母乳还是配方奶");
    }

    @Test
    void doesNotAskMilkTypeForReminderOnlyInMixedFeedingProfile() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒喂奶",
                "schedule",
                "once",
                "notification",
                "今天 10:45",
                "2026-05-04T10:45:00+08:00",
                "10:45提醒我喂奶",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                null,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());
        var profile = objectMapper.createObjectNode().put("feeding", "混合喂养");

        var decisions = policy.decide(response, extractor.extract("10:45提醒我喂奶"), profile, "10:45提醒我喂奶");

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
    }

    @Test
    void recordsWhenMixedFeedingMessageIncludesMilkType() {
        AgentChatResponse response = response(new AgentCareLog(
                null,
                "2026-05-01",
                120,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                List.of("8点配方奶120ml"),
                List.of()
        ), List.of());
        var profile = objectMapper.createObjectNode().put("feeding", "混合喂养");

        var decisions = policy.decide(response, extractor.extract("今天8点配方奶120ml"), profile, "今天8点配方奶120ml");

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("careLog");
    }

    @Test
    void preservesCompleteExpenseSkillCandidateOverTextOnlyRuleAsk() {
        String message = "给宝宝买尿裤记账";
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("title", "纸尿裤");
        payload.put("amount", 129.9);
        payload.put("currency", "CNY");
        payload.put("category", "diaper");
        payload.put("date", "2026-05-16");
        payload.putArray("attachmentIds").add("attachment-1");
        payload.put("sourceSkill", "expense-recognition");

        var decisions = policy.decide(
                response((AgentCareLog) null, List.of()),
                extractor.extract(message),
                null,
                message,
                List.of(new com.xiaobao.babycompanion.dto.agent.AgentEffectDecision(
                        "decision-skill",
                        "pending",
                        "expenseItem",
                        payload,
                        0.9,
                        "skill recognized complete expense",
                        "expense-recognition"
                ))
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).source()).isEqualTo("expense-recognition");
        assertThat(decisions.get(0).payload().path("amount").asDouble()).isEqualTo(129.9);
    }

    @Test
    void skipsDuplicateModelExpenseWhenExpenseSkillAlreadyProducedCandidates() {
        String message = "识别这些订单支出并记到账本";
        ObjectNode skillPayload = objectMapper.createObjectNode();
        skillPayload.put("title", "奶粉");
        skillPayload.put("amount", 268.0);
        skillPayload.put("currency", "CNY");
        skillPayload.put("category", "formula");
        skillPayload.put("date", "2026-05-16");
        skillPayload.putArray("attachmentIds").add("attachment-1");
        skillPayload.put("sourceSkill", "expense-recognition");
        AgentChatResponse response = new AgentChatResponse(
                "我已从截图识别出奶粉支出。",
                List.of(),
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
                        "天猫",
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

        var decisions = policy.decide(
                response,
                extractor.extract(message),
                null,
                message,
                List.of(new com.xiaobao.babycompanion.dto.agent.AgentEffectDecision(
                        "decision-skill",
                        "pending",
                        "expenseItem",
                        skillPayload,
                        0.9,
                        "skill recognized complete expense",
                        "expense-recognition"
                ))
        );

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).source()).isEqualTo("expense-recognition");
        assertThat(decisions.get(0).payload().path("title").asText()).isEqualTo("奶粉");
    }

    @Test
    void ignoresUnsupportedChatMutationRequest() {
        var decisions = policy.decide(response((AgentCareLog) null, List.of()), extractor.extract("撤销刚才那条记录"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ignore");
        assertThat(decisions.get(0).payload().path("question").asText()).contains("不能直接在聊天里撤销");
    }

    @Test
    void autoCreatesLowRiskReminderWithRelativeTime() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒喝奶",
                "schedule",
                "once",
                "notification",
                "三分钟后",
                null,
                "三分钟后",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                null,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());

        var decisions = policy.decide(response, extractor.extract("三分钟后提醒我喝奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
    }

    @Test
    void acceptsModelDueAtWhenRuleExtractorMissesReminderTime() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒洗澡",
                "schedule",
                "once",
                "notification",
                "今天 20:00",
                "2026-05-04T20:00:00+08:00",
                "八点提醒我给小宝洗澡",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                null,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());

        var decisions = policy.decide(response, extractor.extract("提醒我给小宝洗澡"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).payload().path("dueAt").asText()).isEqualTo("2026-05-04T20:00:00+08:00");
    }

    @Test
    void stillAsksWhenModelInventsDueAtForVagueReminder() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒喝奶",
                "schedule",
                "once",
                "notification",
                "过会儿",
                "2026-05-04T20:00:00+08:00",
                "过会儿",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                null,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());

        var decisions = policy.decide(response, extractor.extract("过会儿提醒我喝奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("missingFields").get(0).asText()).isEqualTo("提醒时间");
    }

    @Test
    void asksWhenReminderTimeIsVague() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒喝奶",
                "schedule",
                "once",
                "notification",
                "过会儿",
                null,
                "过会儿",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                null,
                null,
                null,
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());

        var decisions = policy.decide(response, extractor.extract("过会儿提醒我喝奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).payload().path("missingFields").get(0).asText()).isEqualTo("提醒时间");
    }

    @Test
    void keepsRelativeMilkReminderAsScheduleAndSuppressesProfileMemory() {
        AgentChatResponse response = new AgentChatResponse(
                "好的",
                List.of(),
                null,
                null,
                List.of(new AgentReminder(
                        null,
                        "提醒喂奶",
                        "schedule",
                        "once",
                        "notification",
                        "三分钟后",
                        "2099-05-04T20:03:00+08:00",
                        "三分钟后提醒我喂奶",
                        "Asia/Shanghai",
                        null,
                        "pending",
                        null,
                        "care",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "open",
                        null,
                        List.of()
                )),
                List.of(new AgentMemory(null, "小宝目前是混合喂养，暂未发现过敏", "profile", 0.8, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        var decisions = policy.decide(response, extractor.extract("三分钟后提醒我喂奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
        assertThat(decisions.get(0).payload().path("reminderKind").asText()).isEqualTo("schedule");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("once");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("notification");
        assertThat(decisions.get(0).payload().path("repeatRule").isMissingNode()
                || decisions.get(0).payload().path("repeatRule").isNull()).isTrue();
    }

    @Test
    void autoCreatesMilkIntervalAlarmReminder() {
        var repeatRule = objectMapper.createObjectNode();
        repeatRule.put("mode", "fixedInterval");
        repeatRule.put("intervalMinutes", 180);
        repeatRule.put("anchorType", "careEvent");
        repeatRule.put("careEventType", "milk");
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "喂奶提醒",
                "alarm",
                "interval",
                "ringing",
                "每 3 小时喂奶提醒",
                null,
                "每 3 小时",
                "Asia/Shanghai",
                null,
                "pending",
                null,
                "care",
                "每 3 小时",
                repeatRule,
                "soft_chime",
                null,
                null,
                "open",
                null,
                List.of()
        )), List.of());

        var decisions = policy.decide(response, extractor.extract("每 3 小时提醒我喂奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).payload().path("reminderKind").asText()).isEqualTo("alarm");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("ringing");
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(180);
    }

    @Test
    void forcesHalfHourMilkIntervalReminderEvenWhenModelReturnsScheduleAndMemory() {
        AgentChatResponse response = new AgentChatResponse(
                "好的",
                List.of(),
                null,
                null,
                List.of(new AgentReminder(
                        null,
                        "提醒喂奶",
                        "schedule",
                        "once",
                        "notification",
                        "半小时后",
                        null,
                        "每半小时提醒我喂奶",
                        "Asia/Shanghai",
                        null,
                        "pending",
                        null,
                        "care",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "open",
                        null,
                        List.of()
                )),
                List.of(new AgentMemory(null, "小宝目前是混合喂养，暂未发现过敏", "profile", 0.8, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        var decisions = policy.decide(response, extractor.extract("每半小时提醒我喂奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
        assertThat(decisions.get(0).payload().path("reminderKind").asText()).isEqualTo("alarm");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("ringing");
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(30);
    }

    @Test
    void forcesTenMinuteMilkIntervalReminderWithoutAskingAgain() {
        AgentChatResponse response = new AgentChatResponse(
                "好的，已帮你创建喂奶闹钟。",
                List.of(),
                null,
                null,
                List.of(new AgentReminder(
                        null,
                        "提醒喂奶",
                        "schedule",
                        "once",
                        "notification",
                        "十分钟后",
                        null,
                        "每十分钟提醒我喂奶",
                        "Asia/Shanghai",
                        null,
                        "pending",
                        null,
                        "care",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "open",
                        null,
                        List.of()
                )),
                List.of(new AgentMemory(null, "小宝目前是混合喂养，暂未发现过敏", "profile", 0.8, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        var decisions = policy.decide(response, extractor.extract("每十分钟提醒我喂奶"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
        assertThat(decisions.get(0).payload().path("reminderKind").asText()).isEqualTo("alarm");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("ringing");
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(10);
    }

    @Test
    void createsGenericIntervalNotificationReminderByDefault() {
        var decisions = policy.decide(response(List.of(), List.of()), extractor.extract("每两小时提醒我喝水"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("notification");
        assertThat(decisions.get(0).payload().path("repeatRule").path("anchorType").asText()).isEqualTo("now");
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(120);
    }

    @Test
    void createsGenericIntervalRingingReminderWhenRequested() {
        var decisions = policy.decide(response(List.of(), List.of()), extractor.extract("每两小时闹钟提醒我喝水"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("auto");
        assertThat(decisions.get(0).type()).isEqualTo("reminder");
        assertThat(decisions.get(0).payload().path("scheduleMode").asText()).isEqualTo("interval");
        assertThat(decisions.get(0).payload().path("alertMode").asText()).isEqualTo("ringing");
        assertThat(decisions.get(0).payload().path("repeatRule").path("anchorType").asText()).isEqualTo("now");
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(120);
    }

    @Test
    void createsPendingDraftForConcreteExpense() {
        var decisions = policy.decide(response(List.of(), List.of()), extractor.extract("今天给小宝买奶粉花了268"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).type()).isEqualTo("expenseItem");
        assertThat(decisions.get(0).payload().path("title").asText()).isEqualTo("奶粉");
        assertThat(decisions.get(0).payload().path("amount").asDouble()).isEqualTo(268);
        assertThat(decisions.get(0).payload().path("category").asText()).isEqualTo("formula");
        assertThat(decisions.get(0).payload().has("barcode")).isFalse();
        assertThat(decisions.get(0).payload().has("productImageUrl")).isFalse();
    }

    @Test
    void asksForActualAmountBeforeRecordingExpense() {
        var decisions = policy.decide(response(List.of(), List.of()), extractor.extract("今天给小宝买了奶粉"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).type()).isEqualTo("expenseItem");
        assertThat(decisions.get(0).payload().path("missingFields"))
                .anyMatch((field) -> field.asText().equals("实际花了多少钱"));
    }

    @Test
    void createsPendingDraftForModelExpense() {
        AgentChatResponse response = new AgentChatResponse(
                "我整理了一笔待确认支出。",
                List.of(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(new AgentExpense(
                        null,
                        "纸尿裤",
                        129.9,
                        "CNY",
                        "diapers",
                        "2026-05-01",
                        null,
                        null,
                        "天猫",
                        "订单截图识别",
                        "帮宝适",
                        "M",
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

        var decisions = policy.decide(response, extractor.extract("这张订单截图帮我记到账本"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).type()).isEqualTo("expenseItem");
        assertThat(decisions.get(0).payload().path("title").asText()).isEqualTo("纸尿裤");
        assertThat(decisions.get(0).payload().path("amount").asDouble()).isEqualTo(129.9);
        assertThat(decisions.get(0).payload().path("source").asText()).isEqualTo("agent");
    }

    @Test
    void modelExpenseWithAmountOverridesRuleAmountQuestion() {
        AgentChatResponse response = new AgentChatResponse(
                "我已从截图识别出支出。",
                List.of(),
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

        var decisions = policy.decide(response, extractor.extract("帮我识别这几张小票花费并记到账本"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("pending");
        assertThat(decisions.get(0).type()).isEqualTo("expenseItem");
        assertThat(decisions.get(0).payload().path("title").asText()).isEqualTo("奶粉");
        assertThat(decisions.get(0).payload().path("amount").asDouble()).isEqualTo(268);
    }

    @Test
    void autoSavedExpenseSkillCandidateSuppressesRuleAmountQuestion() {
        String message = "帮我识别这几张小票花费并记到账本";
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("title", "奶粉");
        payload.put("amount", 268.0);
        payload.put("currency", "CNY");
        payload.put("category", "formula");
        payload.put("date", "2026-05-16");
        payload.putArray("attachmentIds").add("attachment-1");
        payload.put("persistenceStatus", "saved");

        var decisions = policy.decide(
                response((AgentCareLog) null, List.of()),
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
    void asksForMissingFieldsOnModelExpense() {
        AgentChatResponse response = new AgentChatResponse(
                "我还需要确认一下金额。",
                List.of(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(new AgentExpense(null, "奶粉", null, "CNY", "formula", "2026-05-01", null, null, null, null, null, null, List.of(), "agent", null, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );

        var decisions = policy.decide(response, extractor.extract("看一下这张商品照片"));

        assertThat(decisions).hasSize(1);
        assertThat(decisions.get(0).mode()).isEqualTo("ask");
        assertThat(decisions.get(0).type()).isEqualTo("expenseItem");
        assertThat(decisions.get(0).payload().path("missingFields"))
                .anyMatch((field) -> field.asText().equals("实际花了多少钱"));
    }

    @Test
    void doesNotTurnBarcodePriceQueryIntoExpense() {
        var decisions = policy.decide(response(List.of(), List.of()), extractor.extract("这个条形码多少钱"));

        assertThat(decisions).isEmpty();
    }

    private AgentChatResponse response(AgentCareLog careLog, List<AgentSafetyAlert> alerts) {
        return response(careLog, List.of(), alerts);
    }

    private AgentChatResponse response(List<AgentReminder> reminders, List<AgentSafetyAlert> alerts) {
        return response(null, reminders, alerts);
    }

    private AgentChatResponse response(AgentCareLog careLog, List<AgentReminder> reminders, List<AgentSafetyAlert> alerts) {
        return new AgentChatResponse(
                "好的",
                List.of(),
                null,
                careLog,
                reminders,
                List.of(),
                List.of(),
                List.of(),
                alerts,
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );
    }
}
