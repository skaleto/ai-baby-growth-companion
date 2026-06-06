package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import org.junit.jupiter.api.Test;

class RecordSignalExtractorTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(
            objectMapper,
            Clock.fixed(Instant.parse("2026-05-03T04:00:00Z"), ZoneId.of("Asia/Shanghai"))
    );

    @Test
    void extractsTimedMilkEvent() {
        RecordSignals signals = extractor.extract("今天 8点喝奶120ml");

        assertThat(signals.topics()).contains("feeding");
        assertThat(signals.concreteCareLog()).isTrue();
        assertThat(signals.careLogPatch().path("milkMl").asInt()).isEqualTo(120);
        assertThat(signals.careLogPatch().path("events").get(0).path("time").asText()).isEqualTo("08:00");
    }

    @Test
    void treatsTimedMlAsMilkEventWhenContextImpliesFeeding() {
        RecordSignals signals = extractor.extract("今天15:30喝了100ml");

        assertThat(signals.topics()).contains("feeding");
        assertThat(signals.concreteCareLog()).isTrue();
        assertThat(signals.careLogPatch().path("milkMl").asInt()).isEqualTo(100);
        assertThat(signals.careLogPatch().path("events").get(0).path("type").asText()).isEqualTo("milk");
        assertThat(signals.careLogPatch().path("events").get(0).path("time").asText()).isEqualTo("15:30");
    }

    @Test
    void infersAmbiguousSixThirtyAsEveningWhenCurrentTimeIsLaterToday() {
        RecordSignalExtractor eveningExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-05-03T12:00:00Z"), ZoneId.of("Asia/Shanghai"))
        );

        RecordSignals signals = eveningExtractor.extract("6点半喝奶120ml");

        assertThat(signals.careLogPatch().path("events").get(0).path("time").asText()).isEqualTo("18:30");
    }

    @Test
    void keepsAmbiguousSixThirtyAsMorningWhenCurrentTimeIsMorning() {
        RecordSignalExtractor morningExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-05-03T00:00:00Z"), ZoneId.of("Asia/Shanghai"))
        );

        RecordSignals signals = morningExtractor.extract("6点半喝奶120ml");

        assertThat(signals.careLogPatch().path("events").get(0).path("time").asText()).isEqualTo("06:30");
    }

    @Test
    void asksForIncompleteSleepStart() {
        RecordSignals signals = extractor.extract("小宝，晚上8点半睡觉。");

        assertThat(signals.concreteCareLog()).isFalse();
        assertThat(signals.careLogPatch()).isNull();
        assertThat(signals.clarifications()).hasSize(1);
        assertThat(signals.clarifications().get(0).missingFields()).contains("durationHours");
    }

    @Test
    void splitsMultipleCareEventsFromOneMessage() {
        RecordSignals signals = extractor.extract("今天8点喝奶120ml，9点睡了1小时，10点便便");

        var events = signals.careLogPatch().path("events");
        assertThat(events.size()).isEqualTo(3);
        assertThat(events.get(0).path("type").asText()).isEqualTo("milk");
        assertThat(events.get(0).path("time").asText()).isEqualTo("08:00");
        assertThat(events.get(1).path("type").asText()).isEqualTo("sleep");
        assertThat(events.get(1).path("durationHours").asDouble()).isEqualTo(1.0);
        assertThat(events.get(2).path("type").asText()).isEqualTo("poop");
        assertThat(events.get(2).path("time").asText()).isEqualTo("10:00");
    }

    @Test
    void keepsUntimedCareAsDailySummaryOnly() {
        RecordSignals signals = extractor.extract("今天喝奶120ml，睡了1小时");

        var events = signals.careLogPatch().path("events");
        assertThat(signals.careLogPatch().path("milkMl").asInt()).isEqualTo(120);
        assertThat(signals.careLogPatch().path("sleepHours").asDouble()).isEqualTo(1.0);
        assertThat(events).isEmpty();
    }

    @Test
    void extractsDailyMilkSummary() {
        RecordSignals signals = extractor.extract("今天喝奶5次，每次120ml");

        assertThat(signals.concreteCareLog()).isTrue();
        assertThat(signals.careLogPatch().path("milkTimes").asInt()).isEqualTo(5);
        assertThat(signals.careLogPatch().path("milkMl").asInt()).isEqualTo(600);
        assertThat(signals.careLogPatch().path("events")).isEmpty();
    }

    @Test
    void asksWhenFeedingStartHasNoAmount() {
        RecordSignals signals = extractor.extract("现在5:16又要开始吃奶了");

        assertThat(signals.topics()).contains("feeding");
        assertThat(signals.concreteCareLog()).isFalse();
        assertThat(signals.careLogPatch()).isNull();
        assertThat(signals.clarifications()).hasSize(1);
        assertThat(signals.clarifications().get(0).missingFields()).contains("milkMl");
    }

    @Test
    void detectsUnsupportedMutationRequest() {
        RecordSignals signals = extractor.extract("撤销刚才那条记录");

        assertThat(signals.unsupportedMutationRequest()).isTrue();
    }

    @Test
    void detectsReminderAndVaccineRisk() {
        RecordSignals signals = extractor.extract("明天上午提醒我打疫苗");

        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.riskHints()).contains("vaccine");
    }

    @Test
    void detectsRelativeReminderTime() {
        RecordSignals signals = extractor.extract("三分钟后提醒我喝奶");

        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.reminderSignal()).isNull();
    }

    @Test
    void detectsHalfHourMilkIntervalReminder() {
        RecordSignals signals = extractor.extract("每半小时提醒我喂奶");

        assertThat(signals.topics()).contains("reminder", "feeding");
        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.reminderSignal()).isNotNull();
        assertThat(signals.reminderSignal().kind()).isEqualTo("interval");
        assertThat(signals.reminderSignal().topic()).isEqualTo("feeding");
        assertThat(signals.reminderSignal().ringingRequested()).isTrue();
        assertThat(signals.reminderSignal().intervalMinutes()).isEqualTo(30);
    }

    @Test
    void detectsTenMinuteMilkIntervalReminder() {
        RecordSignals signals = extractor.extract("每十分钟提醒我喂奶");

        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.reminderSignal()).isNotNull();
        assertThat(signals.reminderSignal().intervalMinutes()).isEqualTo(10);
    }

    @Test
    void detectsGenericIntervalNotificationReminder() {
        RecordSignals signals = extractor.extract("每两小时提醒我喝水");

        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.reminderSignal()).isNotNull();
        assertThat(signals.reminderSignal().topic()).isEqualTo("general");
        assertThat(signals.reminderSignal().ringingRequested()).isFalse();
        assertThat(signals.reminderSignal().intervalMinutes()).isEqualTo(120);
    }

    @Test
    void detectsGenericIntervalRingingReminder() {
        RecordSignals signals = extractor.extract("每两小时闹钟提醒我喝水");

        assertThat(signals.explicitReminderTime()).isTrue();
        assertThat(signals.reminderSignal()).isNotNull();
        assertThat(signals.reminderSignal().ringingRequested()).isTrue();
        assertThat(signals.reminderSignal().intervalMinutes()).isEqualTo(120);
    }

    @Test
    void detectsChineseClockReminderTimeFromAsrText() {
        RecordSignals signals = extractor.extract("晚上八点提醒我给小宝洗澡");

        assertThat(signals.topics()).contains("reminder");
        assertThat(signals.explicitReminderTime()).isTrue();
    }

    @Test
    void extractsExpenseSignalForBabyPurchase() {
        RecordSignals signals = extractor.extract("今天给小宝买奶粉花了268");

        assertThat(signals.topics()).contains("expense");
        assertThat(signals.expenseSignal()).isNotNull();
        assertThat(signals.expenseSignal().title()).isEqualTo("奶粉");
        assertThat(signals.expenseSignal().amount()).isEqualTo(268);
        assertThat(signals.expenseSignal().category()).isEqualTo("formula");
    }

    @Test
    void treatsBarcodePriceQueryAsLookupOnly() {
        RecordSignals signals = extractor.extract("这个条形码多少钱");

        assertThat(signals.topics()).contains("expense");
        assertThat(signals.expenseSignal()).isNull();
        assertThat(signals.concreteCareLog()).isFalse();
    }

    @Test
    void extractsGrowthMeasurementWithCopulaWeekdayAndPreciseWeight() {
        RecordSignalExtractor saturdayExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-06-06T12:20:00Z"), ZoneId.of("Asia/Shanghai"))
        );

        RecordSignals signals = saturdayExtractor.extract("这周二量了一下小宝的体重是5.54公斤。");

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.targetDates()).containsExactly("2026-06-02");
        assertThat(signals.growthMeasurements()).hasSize(1);
        GrowthMeasurementSignal measurement = signals.growthMeasurements().get(0);
        assertThat(measurement.type()).isEqualTo("weight");
        assertThat(measurement.value()).isEqualTo(5.54);
        assertThat(measurement.date()).isEqualTo("2026-06-02");
        assertThat(measurement.needsClarification()).isFalse();
    }

    @Test
    void borrowsRecentGrowthMeasurementDateForShortFollowUpMeasurement() {
        RecordSignalExtractor saturdayExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-06-06T12:20:00Z"), ZoneId.of("Asia/Shanghai"))
        );
        List<AgentChatMessage> recentMessages = List.of(
                new AgentChatMessage("msg-prev", "parent", "这周二量了一下小宝的体重是5.54公斤。", "2026-06-06T12:15:37.584Z", List.of(), List.of()),
                new AgentChatMessage("msg-ai", "ai", "好的，爸爸。芊宝这周二（6月2日）的体重是5.54公斤，我帮你整理成待确认的成长测量草稿了。", "2026-06-06T12:15:44.379Z", List.of(), List.of("成长", "体重"))
        );

        RecordSignals signals = saturdayExtractor.extract("身高是64厘米。", recentMessages);

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.targetDates()).containsExactly("2026-06-02");
        assertThat(signals.growthMeasurements()).hasSize(1);
        GrowthMeasurementSignal measurement = signals.growthMeasurements().get(0);
        assertThat(measurement.type()).isEqualTo("height");
        assertThat(measurement.value()).isEqualTo(64.0);
        assertThat(measurement.date()).isEqualTo("2026-06-02");
    }

    @Test
    void replaysRecentGrowthMeasurementsWhenUserAsksToRecordThemAgain() {
        RecordSignalExtractor saturdayExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-06-06T13:30:00Z"), ZoneId.of("Asia/Shanghai"))
        );
        List<AgentChatMessage> recentMessages = List.of(
                new AgentChatMessage("msg-weight", "parent", "这周二量了一下小宝的体重是5.54公斤。", "2026-06-06T12:15:37.584Z", List.of(), List.of()),
                new AgentChatMessage("msg-weight-ai", "ai", "好的，爸爸。芊宝这周二（6月2日）的体重是5.54公斤，我帮你整理成待确认的成长测量草稿了。", "2026-06-06T12:15:44.379Z", List.of(), List.of("成长", "体重")),
                new AgentChatMessage("msg-height", "parent", "身高是64厘米。", "2026-06-06T12:16:06.864Z", List.of(), List.of()),
                new AgentChatMessage("msg-height-ai", "ai", "好的，爸爸。芊宝这周二（6月2日）的身高是64厘米，我帮你整理成待确认的成长测量草稿了。", "2026-06-06T12:16:13.907Z", List.of(), List.of("成长", "身高"))
        );

        RecordSignals signals = saturdayExtractor.extract("刚才的这些成长记录再帮我记一遍。喂喂喂。", recentMessages);

        assertThat(signals.topics()).contains("growth");
        assertThat(signals.targetDates()).containsExactly("2026-06-02");
        assertThat(signals.growthMeasurements()).hasSize(2);
        assertThat(signals.growthMeasurements()).extracting(GrowthMeasurementSignal::type)
                .containsExactly("weight", "height");
        assertThat(signals.growthMeasurements()).extracting(GrowthMeasurementSignal::value)
                .containsExactly(5.54, 64.0);
        assertThat(signals.growthMeasurements()).extracting(GrowthMeasurementSignal::date)
                .containsExactly("2026-06-02", "2026-06-02");
    }
}
