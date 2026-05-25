package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.CareLogRecord;
import com.xiaobao.babycompanion.persistence.mapper.CareLogRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class CareLogRecordService extends ServiceImpl<CareLogRecordMapper, CareLogRecord> {

    public record DaysAggregate(
            int days,
            double avgMilkMl,
            double avgMilkTimes,
            double avgSleepHours,
            double avgNightWakeTimes,
            int recordedDays
    ) {
        public static DaysAggregate empty(int days) {
            return new DaysAggregate(days, 0, 0, 0, 0, 0);
        }
    }

    public DaysAggregate getRecentDaysAggregate(String familyId, int days) {
        if (days <= 0) return DaysAggregate.empty(days);

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate windowStart = today.minusDays(days - 1);

        java.util.List<com.xiaobao.babycompanion.persistence.entity.CareLogRecord> recent =
                list(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.xiaobao.babycompanion.persistence.entity.CareLogRecord>()
                        .eq("family_id", familyId)
                        .ge("sort_key", windowStart.toString())
                        .le("sort_key", today.toString()));

        if (recent.isEmpty()) return DaysAggregate.empty(days);

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        int recordedDays = 0;
        long sumMilkMl = 0;
        int sumMilkTimes = 0;
        double sumSleepHours = 0;
        int sumNightWakes = 0;

        for (com.xiaobao.babycompanion.persistence.entity.CareLogRecord rec : recent) {
            try {
                com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(rec.getPayloadJson());
                sumMilkMl += node.path("milkMl").asInt(0);
                sumMilkTimes += node.path("milkTimes").asInt(0);
                sumSleepHours += node.path("sleepHours").asDouble(0);
                sumNightWakes += node.path("nightWakeTimes").asInt(0);
                recordedDays++;
            } catch (Exception ignore) {
                // skip malformed records
            }
        }

        if (recordedDays == 0) return DaysAggregate.empty(days);

        return new DaysAggregate(
                days,
                (double) sumMilkMl / recordedDays,
                (double) sumMilkTimes / recordedDays,
                sumSleepHours / recordedDays,
                (double) sumNightWakes / recordedDays,
                recordedDays
        );
    }
}
