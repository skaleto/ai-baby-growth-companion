package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.xiaobao.babycompanion.exception.ForbiddenException;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AgentRequestGuard {

    private static final Logger LOGGER = LoggerFactory.getLogger(AgentRequestGuard.class);

    private final AiUsageLogService usageLogService;
    private final Clock clock;
    private final int perMinuteLimit;
    private final long monthlyTokenBudget;
    private final Map<String, Deque<Instant>> familyHits = new ConcurrentHashMap<>();

    public AgentRequestGuard(
            AiUsageLogService usageLogService,
            Clock clock,
            @Value("${app.agent.guard.per-minute-limit:30}") int perMinuteLimit,
            @Value("${app.agent.guard.monthly-token-budget:2000000}") long monthlyTokenBudget
    ) {
        this.usageLogService = usageLogService;
        this.clock = clock;
        this.perMinuteLimit = perMinuteLimit;
        this.monthlyTokenBudget = monthlyTokenBudget;
    }

    public void checkAllowed(String familyId) {
        if (!StringUtils.hasText(familyId)) return;
        enforceRateLimit(familyId);
        enforceMonthlyBudget(familyId);
    }

    private void enforceRateLimit(String familyId) {
        if (perMinuteLimit <= 0) return;
        Instant now = Instant.now(clock);
        Instant cutoff = now.minus(Duration.ofMinutes(1));
        Deque<Instant> hits = familyHits.computeIfAbsent(familyId, (key) -> new ArrayDeque<>());
        synchronized (hits) {
            while (!hits.isEmpty() && hits.peekFirst().isBefore(cutoff)) {
                hits.pollFirst();
            }
            if (hits.size() >= perMinuteLimit) {
                LOGGER.warn("Agent rate limit hit. familyId={}, perMinute={}, hits={}", familyId, perMinuteLimit, hits.size());
                throw new ForbiddenException("请求过于频繁，请稍后再试。");
            }
            hits.addLast(now);
        }
    }

    private void enforceMonthlyBudget(String familyId) {
        if (monthlyTokenBudget <= 0) return;
        long used = usageLogService.monthlyTokens(familyId);
        if (used >= monthlyTokenBudget) {
            LOGGER.warn("Agent monthly token budget exceeded. familyId={}, used={}, budget={}", familyId, used, monthlyTokenBudget);
            throw new ForbiddenException("本月 AI 用量已达上限，请稍后再试或联系管理员。");
        }
    }
}
