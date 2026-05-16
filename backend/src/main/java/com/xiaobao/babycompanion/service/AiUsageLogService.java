package com.xiaobao.babycompanion.service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.xiaobao.babycompanion.dto.pro.AiUsageBreakdownDto;
import com.xiaobao.babycompanion.dto.pro.AiUsageSummaryDto;
import com.xiaobao.babycompanion.persistence.entity.AiUsageLogRecord;
import com.xiaobao.babycompanion.persistence.service.AiUsageLogRecordService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AiUsageLogService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiUsageLogService.class);
    private static final long SOFT_MONTHLY_TOKEN_THRESHOLD = 500_000L;

    private final AiUsageLogRecordService recordService;
    private final Clock clock;

    public AiUsageLogService(AiUsageLogRecordService recordService, Clock clock) {
        this.recordService = recordService;
        this.clock = clock;
    }

    public void record(UsageEvent event) {
        if (event == null) return;
        try {
            AiUsageLogRecord record = new AiUsageLogRecord();
            record.setId("ai-usage-" + UUID.randomUUID());
            record.setFamilyId(event.familyId());
            record.setUserId(event.userId());
            record.setRequestId(event.requestId());
            record.setProvider(event.provider());
            record.setModel(event.model());
            record.setFeature(event.feature());
            record.setInputType(event.inputType());
            record.setInputTokens(event.inputTokens());
            record.setOutputTokens(event.outputTokens());
            record.setTotalTokens(event.totalTokens());
            record.setSuccess(Boolean.TRUE.equals(event.success()) ? "true" : "false");
            record.setErrorCode(event.errorCode());
            record.setProRequired(Boolean.TRUE.equals(event.proRequired()) ? "true" : "false");
            record.setQuotaCounted(Boolean.TRUE.equals(event.quotaCounted()) ? "true" : "false");
            record.setCreatedAt(Instant.now(clock).toString());
            recordService.save(record);
            warnIfSoftThresholdExceeded(event.familyId());
        } catch (Exception exception) {
            LOGGER.warn("Failed to persist AI usage log. requestId={}, feature={}, cause={}",
                    event.requestId(),
                    event.feature(),
                    exception.getMessage());
        }
    }

    public long monthlyTokens(String familyId) {
        if (!StringUtils.hasText(familyId)) return 0;
        String since = Instant.now(clock).minus(30, ChronoUnit.DAYS).toString();
        QueryWrapper<AiUsageLogRecord> query = new QueryWrapper<AiUsageLogRecord>()
                .eq("family_id", familyId)
                .eq("quota_counted", "true")
                .ge("created_at", since);
        return recordService.list(query).stream()
                .mapToLong((record) -> record.getTotalTokens() == null ? 0L : record.getTotalTokens())
                .sum();
    }

    public AiUsageSummaryDto summary(String familyId, Integer requestedDays) {
        int days = requestedDays == null ? 30 : Math.max(1, Math.min(90, requestedDays));
        Instant now = Instant.now(clock);
        String since = now.minus(days, ChronoUnit.DAYS).toString();
        List<AiUsageLogRecord> records = recordService.list(new QueryWrapper<AiUsageLogRecord>()
                .eq("family_id", familyId)
                .ge("created_at", since)
                .orderByDesc("created_at"));
        UsageBucket total = new UsageBucket("total", "全部", null, null, null, null);
        Map<String, UsageBucket> byFeature = new LinkedHashMap<>();
        Map<String, UsageBucket> byModel = new LinkedHashMap<>();

        records.forEach((record) -> {
            total.add(record);

            String feature = fallback(record.getFeature(), "unknown");
            byFeature.computeIfAbsent(feature, (key) ->
                    new UsageBucket(key, feature, null, null, feature, null)
            ).add(record);

            String provider = fallback(record.getProvider(), "unknown");
            String model = fallback(record.getModel(), "unknown");
            String modelKey = provider + ":" + model;
            byModel.computeIfAbsent(modelKey, (key) ->
                    new UsageBucket(key, model, provider, model, null, null)
            ).add(record);
        });

        return new AiUsageSummaryDto(
                days,
                since,
                now.toString(),
                total.requestCount,
                total.successfulRequestCount,
                total.meteredRequestCount,
                total.unmeteredRequestCount,
                total.inputTokens,
                total.outputTokens,
                total.totalTokens,
                sortedBreakdowns(byFeature),
                sortedBreakdowns(byModel)
        );
    }

    private void warnIfSoftThresholdExceeded(String familyId) {
        long tokens = monthlyTokens(familyId);
        if (tokens > SOFT_MONTHLY_TOKEN_THRESHOLD) {
            LOGGER.warn("AI usage soft threshold exceeded. familyId={}, last30dTokens={}", familyId, tokens);
        }
    }

    private List<AiUsageBreakdownDto> sortedBreakdowns(Map<String, UsageBucket> buckets) {
        return buckets.values().stream()
                .sorted(Comparator
                        .comparingLong((UsageBucket bucket) -> bucket.totalTokens).reversed()
                        .thenComparing(Comparator.comparingLong((UsageBucket bucket) -> bucket.requestCount).reversed())
                        .thenComparing((bucket) -> bucket.label))
                .map(UsageBucket::toDto)
                .toList();
    }

    private String fallback(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private static final class UsageBucket {
        private final String key;
        private final String label;
        private final String provider;
        private final String model;
        private final String feature;
        private final String inputType;
        private long requestCount;
        private long successfulRequestCount;
        private long meteredRequestCount;
        private long unmeteredRequestCount;
        private long inputTokens;
        private long outputTokens;
        private long totalTokens;

        private UsageBucket(String key, String label, String provider, String model, String feature, String inputType) {
            this.key = key;
            this.label = label;
            this.provider = provider;
            this.model = model;
            this.feature = feature;
            this.inputType = inputType;
        }

        private void add(AiUsageLogRecord record) {
            requestCount += 1;
            if ("true".equalsIgnoreCase(record.getSuccess())) successfulRequestCount += 1;
            if (record.getTotalTokens() == null) {
                unmeteredRequestCount += 1;
            } else {
                meteredRequestCount += 1;
                totalTokens += record.getTotalTokens();
            }
            inputTokens += record.getInputTokens() == null ? 0L : record.getInputTokens();
            outputTokens += record.getOutputTokens() == null ? 0L : record.getOutputTokens();
        }

        private AiUsageBreakdownDto toDto() {
            return new AiUsageBreakdownDto(
                    key,
                    label,
                    provider,
                    model,
                    feature,
                    inputType,
                    requestCount,
                    successfulRequestCount,
                    meteredRequestCount,
                    unmeteredRequestCount,
                    inputTokens,
                    outputTokens,
                    totalTokens
            );
        }
    }

    public record UsageEvent(
            String familyId,
            String userId,
            String requestId,
            String provider,
            String model,
            String feature,
            String inputType,
            Integer inputTokens,
            Integer outputTokens,
            Integer totalTokens,
            Boolean success,
            String errorCode,
            Boolean proRequired,
            Boolean quotaCounted
    ) {
    }
}
