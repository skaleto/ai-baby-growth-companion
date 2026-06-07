package com.xiaobao.babycompanion.agent.action;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.junit.jupiter.api.Test;

class RecordFeedingEventToolTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AgentMutationService mutationService = mock(AgentMutationService.class);
    private final RecordFeedingEventTool tool = new RecordFeedingEventTool(objectMapper, mutationService);
    private final AgentActionContext context = new AgentActionContext(
            "trace-feed",
            "family-feed",
            "user-feed",
            Clock.fixed(Instant.parse("2026-06-06T16:22:00Z"), ZoneId.of("Asia/Shanghai")),
            objectMapper.createObjectNode().put("feeding", "混合喂养")
    );

    @Test
    void mixedFeedingWithoutMilkTypeAsksInsteadOfWriting() {
        AgentActionResult result = tool.executeAction(new AgentActionCall(
                "call-feed-1",
                "record_feeding_event",
                """
                        {"date":"2026-06-07","time":"00:22","amountMl":120,"idempotencyKey":"feed-0022"}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("needs_input");
        assertThat(result.missingFields()).contains("feedingType");
        assertThat(result.userMessage()).contains("母乳还是配方奶");
        verifyNoInteractions(mutationService);
    }

    @Test
    void completeFeedingEventWritesCareLogPatch() {
        when(mutationService.applyCareLogPatch(eq(context), eq("record_feeding_event"), eq("feed-0022"), any()))
                .thenReturn(new AgentActionResult(
                        "applied",
                        "record_feeding_event",
                        "care_log",
                        List.of("care-2026-06-07"),
                        null,
                        Map.of("amountMl", 120, "feedingType", "formula"),
                        "已记录 120ml 配方奶。",
                        List.of(),
                        List.of()
                ));

        AgentActionResult result = tool.executeAction(new AgentActionCall(
                "call-feed-2",
                "record_feeding_event",
                """
                        {"date":"2026-06-07","time":"00:22","amountMl":120,"feedingType":"formula","idempotencyKey":"feed-0022"}
                        """
        ), context);

        assertThat(result.status()).isEqualTo("applied");
        assertThat(result.recordIds()).containsExactly("care-2026-06-07");
    }
}
