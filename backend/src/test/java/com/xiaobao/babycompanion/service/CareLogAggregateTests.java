package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import com.xiaobao.babycompanion.persistence.service.CareLogRecordService;
import com.xiaobao.babycompanion.persistence.service.CareLogRecordService.DaysAggregate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CareLogAggregateTests {

    @Autowired
    CareLogRecordService careLogService;

    @Test
    void returnsEmptyWhenFamilyHasNoLogs() {
        DaysAggregate result = careLogService.getRecentDaysAggregate("family-empty", 7);
        assertEquals(7, result.days());
        assertEquals(0, result.recordedDays());
        assertEquals(0.0, result.avgMilkMl());
    }

    @Test
    void avgIsOverRecordedDaysNotCalendarDays() {
        String familyId = "family-seed-aggregate-" + System.currentTimeMillis();
        seedCareLog(familyId, daysAgo(1), 600, 5, 12.0, 1);
        seedCareLog(familyId, daysAgo(2), 400, 4, 10.0, 2);

        DaysAggregate result = careLogService.getRecentDaysAggregate(familyId, 7);

        assertEquals(2, result.recordedDays());
        assertEquals(500.0, result.avgMilkMl(), 0.01);
        assertEquals(4.5, result.avgMilkTimes(), 0.01);
        assertEquals(11.0, result.avgSleepHours(), 0.01);
        assertEquals(1.5, result.avgNightWakeTimes(), 0.01);
    }

    @Test
    void ignoresLogsOlderThanWindow() {
        String familyId = "family-window-" + System.currentTimeMillis();
        seedCareLog(familyId, daysAgo(1), 500, 5, 12.0, 1);
        seedCareLog(familyId, daysAgo(30), 999, 99, 99.0, 99);

        DaysAggregate result = careLogService.getRecentDaysAggregate(familyId, 7);

        assertEquals(1, result.recordedDays());
        assertEquals(500.0, result.avgMilkMl(), 0.01);
    }

    private String daysAgo(int days) {
        return java.time.LocalDate.now().minusDays(days).toString();
    }

    private void seedCareLog(String familyId, String date, int milkMl, int milkTimes, double sleepHours, int nightWakes) {
        com.xiaobao.babycompanion.persistence.entity.CareLogRecord rec =
                new com.xiaobao.babycompanion.persistence.entity.CareLogRecord();
        rec.setId("seed-care-" + familyId + "-" + date);
        rec.setFamilyId(familyId);
        rec.setSortKey(date);
        rec.setPayloadJson(String.format(java.util.Locale.US,
                "{\"id\":\"%s\",\"date\":\"%s\",\"milkMl\":%d,\"milkTimes\":%d,\"sleepHours\":%.1f,\"nightWakeTimes\":%d,\"events\":[]}",
                rec.getId(), date, milkMl, milkTimes, sleepHours, nightWakes));
        careLogService.save(rec);
    }
}
