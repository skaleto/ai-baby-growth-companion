package com.xiaobao.babycompanion.service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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

    private void warnIfSoftThresholdExceeded(String familyId) {
        long tokens = monthlyTokens(familyId);
        if (tokens > SOFT_MONTHLY_TOKEN_THRESHOLD) {
            LOGGER.warn("AI usage soft threshold exceeded. familyId={}, last30dTokens={}", familyId, tokens);
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
