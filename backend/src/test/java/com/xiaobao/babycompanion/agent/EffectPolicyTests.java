package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentCareLog;
import com.xiaobao.babycompanion.dto.agent.AgentCareLogEvent;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
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
        assertThat(decisions.get(0).payload().path("missingFields").get(0).asText()).isEqualTo("dueAt");
    }

    @Test
    void asksWhenReminderTimeIsVague() {
        AgentChatResponse response = response(List.of(new AgentReminder(
                null,
                "提醒喝奶",
                "schedule",
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
        assertThat(decisions.get(0).payload().path("missingFields").get(0).asText()).isEqualTo("dueAt");
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
        assertThat(decisions.get(0).payload().path("repeatRule").path("intervalMinutes").asInt()).isEqualTo(180);
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
                alerts,
                List.of(),
                List.of("default-baby-companion"),
                "trace",
                "model",
                "request"
        );
    }
}
