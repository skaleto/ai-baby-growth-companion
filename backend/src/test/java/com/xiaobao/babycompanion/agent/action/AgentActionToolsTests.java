package com.xiaobao.babycompanion.agent.action;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.junit.jupiter.api.Test;

class AgentActionToolsTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AgentMutationService mutationService = mock(AgentMutationService.class);
    private final AgentActionContext context = new AgentActionContext(
            "trace-actions",
            "family-actions",
            "user-actions",
            Clock.fixed(Instant.parse("2026-06-06T16:22:00Z"), ZoneId.of("Asia/Shanghai")),
            objectMapper.createObjectNode().put("feeding", "混合喂养")
    );

    @Test
    void sleepDurationWritesCareLogPatch() {
        when(mutationService.applyCareLogPatch(eq(context), eq("record_sleep_event"), eq("sleep-0900"), any()))
                .thenReturn(applied("record_sleep_event", "care-2026-06-07"));

        AgentActionResult result = new RecordSleepEventTool(objectMapper, mutationService).executeAction(new AgentActionCall(
                "call-sleep",
                "record_sleep_event",
                """
                        {"date":"2026-06-07","time":"09:00","durationHours":1.5,"idempotencyKey":"sleep-0900"}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("applied");
        assertThat(result.recordIds()).containsExactly("care-2026-06-07");
    }

    @Test
    void highTemperatureCreatesPendingHealthObservation() {
        when(mutationService.createPendingEffect(eq(context), eq("record_temperature_event"), eq("temp-392"), eq("health_observation"), any(), any()))
                .thenReturn(pending("record_temperature_event", "pending-temp-392"));

        AgentActionResult result = new RecordTemperatureEventTool(objectMapper, mutationService).executeAction(new AgentActionCall(
                "call-temp",
                "record_temperature_event",
                """
                        {"date":"2026-06-07","time":"00:30","temperatureC":39.2,"idempotencyKey":"temp-392"}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("pending_created");
        assertThat(result.pendingEffectId()).isEqualTo("pending-temp-392");
    }

    @Test
    void growthMeasurementsCreatePendingEffect() {
        when(mutationService.createPendingEffect(eq(context), eq("create_growth_measurement_pending"), eq("growth-20260601"), eq("growth_measurement"), any(), any()))
                .thenReturn(pending("create_growth_measurement_pending", "pending-growth"));

        AgentActionResult result = new CreateGrowthMeasurementPendingTool(objectMapper, mutationService).executeAction(new AgentActionCall(
                "call-growth",
                "create_growth_measurement_pending",
                """
                        {"idempotencyKey":"growth-20260601","measurements":[{"type":"weight","value":5.4,"unit":"kg","date":"2026-06-01"},{"type":"height","value":64,"unit":"cm","date":"2026-06-01"}]}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("pending_created");
        assertThat(result.pendingEffectId()).isEqualTo("pending-growth");
    }

    @Test
    void expenseCreatesPendingEffect() {
        when(mutationService.createPendingEffect(eq(context), eq("create_expense_pending"), eq("expense-diaper-129"), eq("expense"), any(), any()))
                .thenReturn(pending("create_expense_pending", "pending-expense"));

        AgentActionResult result = new CreateExpensePendingTool(objectMapper, mutationService).executeAction(new AgentActionCall(
                "call-expense",
                "create_expense_pending",
                """
                        {"idempotencyKey":"expense-diaper-129","title":"尿裤","amount":129,"currency":"CNY","category":"diaper","date":"2026-06-07"}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("pending_created");
        assertThat(result.pendingEffectId()).isEqualTo("pending-expense");
    }

    private AgentActionResult applied(String toolName, String recordId) {
        return new AgentActionResult("applied", toolName, "care_log", List.of(recordId), null, Map.of(), "已记录。", List.of(), List.of());
    }

    private AgentActionResult pending(String toolName, String pendingEffectId) {
        return new AgentActionResult("pending_created", toolName, "pending_effect", List.of(), pendingEffectId, Map.of(), "已创建待确认草稿。", List.of(), List.of());
    }
}
