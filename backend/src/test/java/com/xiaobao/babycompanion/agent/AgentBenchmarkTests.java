package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.agent.action.AgentActionContext;
import com.xiaobao.babycompanion.agent.action.AgentActionResponseGuard;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import com.xiaobao.babycompanion.agent.action.CreateExpensePendingTool;
import com.xiaobao.babycompanion.agent.action.CreateGrowthMeasurementPendingTool;
import com.xiaobao.babycompanion.agent.action.CreateMilestonePendingTool;
import com.xiaobao.babycompanion.agent.action.RecordDiaperEventTool;
import com.xiaobao.babycompanion.agent.action.RecordFeedingEventTool;
import com.xiaobao.babycompanion.agent.action.RecordSleepEventTool;
import com.xiaobao.babycompanion.agent.action.RecordTemperatureEventTool;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Agent tool-first benchmark")
class AgentBenchmarkTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AgentMutationService mutationService = mock(AgentMutationService.class);
    private final AgentActionContext context = new AgentActionContext(
            "trace-benchmark",
            "family-benchmark",
            "user-benchmark",
            Clock.fixed(Instant.parse("2026-06-06T16:22:00Z"), ZoneId.of("Asia/Shanghai")),
            objectMapper.createObjectNode().put("feeding", "混合喂养")
    );

    @Test
    void benchmarkHarnessStillCarriesCoreBadCasesForModelContext() {
        String harness = AgentModelContextHarness.promptBlock();

        assertThat(harness).contains("刚才/刚刚/现在/这次");
        assertThat(harness).contains("currentTime");
        assertThat(harness).contains("时间线事件");
        assertThat(harness).contains("当天奶量总计");
        assertThat(harness).contains("十二点/12点");
        assertThat(harness).contains("00:00");
        assertThat(harness).contains("混合喂养仍要确认奶类");
        assertThat(harness).contains("待确认草稿");
    }

    @Test
    void benchmarkAllRetainedRecordAndLedgerToolsArePresent() {
        List<String> toolIds = List.of(
                new RecordFeedingEventTool(objectMapper, mutationService).id(),
                new RecordSleepEventTool(objectMapper, mutationService).id(),
                new RecordDiaperEventTool(objectMapper, mutationService).id(),
                new RecordTemperatureEventTool(objectMapper, mutationService).id(),
                new CreateGrowthMeasurementPendingTool(objectMapper, mutationService).id(),
                new CreateMilestonePendingTool(objectMapper, mutationService).id(),
                new CreateExpensePendingTool(objectMapper, mutationService).id()
        );

        assertThat(toolIds).containsExactly(
                "record_feeding_event",
                "record_sleep_event",
                "record_diaper_event",
                "record_temperature_event",
                "create_growth_measurement_pending",
                "create_milestone_pending",
                "create_expense_pending"
        );
    }

    @Test
    void benchmarkToolSchemasExposeStrictFunctionDefinitions() {
        var feedingDefinition = new RecordFeedingEventTool(objectMapper, mutationService).definition();
        var expenseDefinition = new CreateExpensePendingTool(objectMapper, mutationService).definition();

        assertThat(feedingDefinition.type()).isEqualTo("function");
        assertThat(feedingDefinition.function().name()).isEqualTo("record_feeding_event");
        assertThat(feedingDefinition.function().strict()).isTrue();
        assertThat(expenseDefinition.function().name()).isEqualTo("create_expense_pending");
        assertThat(expenseDefinition.function().parameters().toString()).contains("amount");
    }

    @Test
    void benchmarkMixedFeedingWithoutMilkTypeDoesNotMutate() {
        AgentActionResult result = new RecordFeedingEventTool(objectMapper, mutationService).executeAction(
                new com.xiaobao.babycompanion.agent.action.AgentActionCall(
                        "call-feed",
                        "record_feeding_event",
                        """
                                {"date":"2026-06-07","time":"00:22","amountMl":120,"idempotencyKey":"feed-0022"}
                                """
                ),
                context
        );

        assertThat(result.status()).isEqualTo("needs_input");
        assertThat(result.userMessage()).contains("母乳还是配方奶");
        assertThat(result.missingFields()).contains("feedingType");
    }

    @Test
    void benchmarkResponseGuardBlocksFalseRecordedCopy() {
        String guarded = new AgentActionResponseGuard().groundFinalText(
                "好的，已经记到今天的喂养记录里了。",
                List.of()
        );

        assertThat(guarded).contains("没有保存成功");
        assertThat(guarded).doesNotContain("已经记到");
    }

    @Test
    void benchmarkResponseGuardAllowsAppliedCopy() {
        String guarded = new AgentActionResponseGuard().groundFinalText(
                "好的，已经记到今天的喂养记录里了。",
                List.of(new AgentActionResult(
                        "applied",
                        "record_feeding_event",
                        "care_log",
                        List.of("care-2026-06-07"),
                        null,
                        Map.of("amountMl", 120),
                        "已记录 120ml 配方奶。",
                        List.of(),
                        List.of()
                ))
        );

        assertThat(guarded).isEqualTo("好的，已经记到今天的喂养记录里了。");
    }
}
