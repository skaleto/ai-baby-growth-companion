package com.xiaobao.babycompanion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.agent.action.AgentActionContext;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "app.storage.data-dir=target/test-data/agent-mutation-service",
        "auth.jwt.secret-file=target/test-data/agent-mutation-service/auth/jwt_secret",
        "auth.invite-codes-file=target/test-data/agent-mutation-service/auth/invite_codes",
        "deepseek.api-key=",
        "deepseek.api-key-file=",
        "doubao.api-key=",
        "doubao.api-key-file="
})
class AgentMutationServiceTests {

    private static final String FAMILY_ID = "family-agent-actions";
    private static final String USER_ID = "user-agent-actions";

    @Autowired
    private AgentMutationService mutationService;

    @Autowired
    private AppStateService appStateService;

    @Autowired
    private ObjectMapper objectMapper;

    private AgentActionContext context;

    @BeforeEach
    void resetState() {
        context = new AgentActionContext(
                "trace-agent-actions",
                FAMILY_ID,
                USER_ID,
                Clock.fixed(Instant.parse("2026-06-06T16:22:00Z"), ZoneId.of("Asia/Shanghai")),
                objectMapper.createObjectNode().put("feeding", "混合喂养")
        );
        appStateService.replace(FAMILY_ID, USER_ID, new AppStateDto(
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                null
        ));
    }

    @Test
    void careLogPatchWritesOnceForSameIdempotencyKey() {
        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("date", "2026-06-07");
        patch.put("milkMl", 120);
        patch.put("milkTimes", 1);
        patch.putArray("events").addObject()
                .put("type", "milk")
                .put("date", "2026-06-07")
                .put("time", "00:22")
                .put("title", "喝奶")
                .put("amountMl", 120)
                .put("note", "配方奶");

        mutationService.applyCareLogPatch(context, "record_feeding_event", "feed-0022", patch);
        mutationService.applyCareLogPatch(context, "record_feeding_event", "feed-0022", patch);

        List<JsonNode> careLogs = appStateService.readForUser(FAMILY_ID, USER_ID).state().careLogs();
        assertThat(careLogs).hasSize(1);
        assertThat(careLogs.get(0).path("milkMl").asInt()).isEqualTo(120);
        assertThat(careLogs.get(0).path("milkTimes").asInt()).isEqualTo(1);
        assertThat(careLogs.get(0).path("events")).hasSize(1);
        assertThat(careLogs.get(0).path("agentActionIds")).anyMatch((node) -> node.asText().equals("feed-0022"));
    }

    @Test
    void pendingEffectsUseStableIdAndAgentActionSource() {
        ObjectNode effect = objectMapper.createObjectNode();
        effect.putArray("growthMeasurements").addObject()
                .put("type", "weight")
                .put("value", 5.4)
                .put("unit", "kg")
                .put("date", "2026-06-01");

        mutationService.createPendingEffect(
                context,
                "create_growth_measurement_pending",
                "growth-last-week",
                "growth_measurement",
                effect,
                Map.of("measurementCount", 1)
        );
        mutationService.createPendingEffect(
                context,
                "create_growth_measurement_pending",
                "growth-last-week",
                "growth_measurement",
                effect,
                Map.of("measurementCount", 1)
        );

        List<JsonNode> pendingEffects = appStateService.readForUser(FAMILY_ID, USER_ID).state().pendingEffects();
        assertThat(pendingEffects).hasSize(1);
        JsonNode pending = pendingEffects.get(0);
        assertThat(pending.path("id").asText()).isEqualTo("pending-effect:create_growth_measurement_pending:family-agent-actions:growth-last-week");
        assertThat(pending.path("domain").asText()).isEqualTo("growth_measurement");
        assertThat(pending.path("source").path("kind").asText()).isEqualTo("agent_action");
        assertThat(pending.path("source").path("toolName").asText()).isEqualTo("create_growth_measurement_pending");
        assertThat(pending.path("source").path("idempotencyKey").asText()).isEqualTo("growth-last-week");
    }
}
