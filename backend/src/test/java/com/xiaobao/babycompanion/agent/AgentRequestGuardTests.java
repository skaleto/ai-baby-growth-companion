package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import com.xiaobao.babycompanion.exception.ForbiddenException;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AgentRequestGuardTests {

    private AiUsageLogService usageLogService;

    @BeforeEach
    void setUp() {
        usageLogService = mock(AiUsageLogService.class);
        when(usageLogService.monthlyTokens(org.mockito.ArgumentMatchers.anyString())).thenReturn(0L);
    }

    @Test
    void allowsRequestsBelowPerMinuteLimit() {
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 3, 1_000_000L);

        guard.checkAllowed("family-1");
        guard.checkAllowed("family-1");
        guard.checkAllowed("family-1");
    }

    @Test
    void rejectsRequestExceedingPerMinuteLimit() {
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 2, 1_000_000L);

        guard.checkAllowed("family-1");
        guard.checkAllowed("family-1");

        assertThatThrownBy(() -> guard.checkAllowed("family-1"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("请求过于频繁");
    }

    @Test
    void rateLimitIsScopedPerFamily() {
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 1, 1_000_000L);

        guard.checkAllowed("family-1");
        guard.checkAllowed("family-2");

        assertThatThrownBy(() -> guard.checkAllowed("family-1"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> guard.checkAllowed("family-2"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void rejectsRequestWhenMonthlyBudgetExhausted() {
        when(usageLogService.monthlyTokens("family-overused")).thenReturn(2_500_000L);
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 30, 2_000_000L);

        assertThatThrownBy(() -> guard.checkAllowed("family-overused"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("本月 AI 用量已达上限");
    }

    @Test
    void allowsRequestWhenBudgetDisabled() {
        when(usageLogService.monthlyTokens(org.mockito.ArgumentMatchers.anyString())).thenReturn(Long.MAX_VALUE);
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 30, 0L);

        guard.checkAllowed("family-1");
    }

    @Test
    void ignoresBlankFamilyId() {
        AgentRequestGuard guard = new AgentRequestGuard(usageLogService, fixedClock(Instant.parse("2026-05-17T00:00:00Z")), 1, 1L);

        guard.checkAllowed(null);
        guard.checkAllowed("");
        assertThat(true).isTrue();
    }

    private Clock fixedClock(Instant instant) {
        return Clock.fixed(instant, ZoneOffset.UTC);
    }
}
