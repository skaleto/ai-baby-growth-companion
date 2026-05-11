package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.dto.app.AppStateResponse;
import com.xiaobao.babycompanion.service.AppStateService;
import org.junit.jupiter.api.Test;

class AgentContextServiceTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void ranksTargetDateAndTopicCareLogsFirst() {
        AppStateService appStateService = mock(AppStateService.class);
        ObjectNode target = careLog("care-target", "2026-05-01", 120, "今天喝奶");
        ObjectNode other = careLog("care-other", "2026-04-20", 80, "很早以前喝奶");
        when(appStateService.read()).thenReturn(new AppStateResponse(false, new AppStateDto(
                objectMapper.createObjectNode().put("nickname", "小宝"),
                List.of(),
                List.of(),
                List.of(other, target),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null
        )));
        AgentContextService service = new AgentContextService(appStateService, objectMapper);

        AgentContextSnapshot snapshot = service.build(
                new AgentChatRequest("今天喝奶怎么样", null, null, List.of(), List.of(), List.of(), List.of(), null, false),
                new AgentPlan("record", List.of("feeding"), List.of("2026-05-01"), List.of("careHistory"), List.of(), List.of("none"), null),
                new RecordSignals(List.of("2026-05-01"), List.of("feeding"), List.of(), null, false, false, List.of(), false)
        );

        assertThat(snapshot.careLogs()).hasSize(2);
        assertThat(snapshot.careLogs().get(0).path("id").asText()).isEqualTo("care-target");
        assertThat(snapshot.trends()).containsKey("sevenDayAverageMilkMl");
    }

    @Test
    void includesConversationSummaryAndRecordContext() throws Exception {
        AppStateService appStateService = mock(AppStateService.class);
        String today = LocalDate.now().toString();
        ObjectNode summary = objectMapper.createObjectNode()
                .put("id", "conversation-summary")
                .put("text", "小宝最近夜醒两次，爸爸主要负责洗澡。")
                .put("coveredThroughMessageId", "msg-12")
                .put("coveredThroughCreatedAt", today + "T08:00:00Z")
                .put("sourceMessageCount", 12)
                .put("updatedAt", today + "T08:01:00Z");
        ObjectNode todayLog = careLog("care-today", today, 150, "今天喝奶");
        ObjectNode reminder = objectMapper.createObjectNode()
                .put("id", "reminder-vaccine")
                .put("title", "预约疫苗")
                .put("status", "open")
                .put("createdAt", today + "T09:00:00Z");
        ObjectNode pending = objectMapper.createObjectNode()
                .put("id", "pending-1")
                .put("createdAt", today + "T09:30:00Z");
        pending.putArray("tags").add("喂养");
        pending.putArray("reminders").add(reminder);
        ObjectNode pageContext = objectMapper.createObjectNode()
                .put("activeTab", "records")
                .put("selectedDate", today);
        pageContext.putArray("selectedEvents").add(objectMapper.createObjectNode()
                .put("id", "event-1")
                .put("title", "喝奶")
                .put("date", today));

        when(appStateService.read()).thenReturn(new AppStateResponse(false, new AppStateDto(
                objectMapper.createObjectNode().put("nickname", "小宝"),
                List.of(),
                List.of(),
                List.of(todayLog),
                List.of(reminder),
                List.of(),
                List.of(pending),
                List.of(),
                List.of(),
                summary,
                null,
                null
        )));
        AgentContextService service = new AgentContextService(appStateService, objectMapper);

        AgentContextSnapshot snapshot = service.build(
                new AgentChatRequest("今天状态怎么样", null, null, List.of(), List.of(), List.of(), List.of(), pageContext, false),
                new AgentPlan("answer", List.of("feeding"), List.of(today), List.of(), List.of(), List.of("none"), null),
                new RecordSignals(List.of(today), List.of("feeding"), List.of(), null, false, false, List.of(), false)
        );

        assertThat(snapshot.conversationSummary().path("text").asText()).contains("夜醒");
        Map<String, Object> recordContext = snapshot.recordContext();
        assertThat(recordContext).containsEntry("activeTab", "records");
        assertThat(recordContext).containsEntry("selectedDate", today);
        assertThat((List<?>) recordContext.get("selectedEvents")).hasSize(1);
        assertThat((List<?>) recordContext.get("recentCareLogs")).hasSize(1);
        assertThat((List<?>) recordContext.get("openReminders")).hasSize(1);
        assertThat((List<?>) recordContext.get("pendingEffectSummaries")).hasSize(1);
    }

    private ObjectNode careLog(String id, String date, int milkMl, String note) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", id);
        node.put("date", date);
        node.put("milkMl", milkMl);
        node.putArray("notes").add(note);
        return node;
    }
}
