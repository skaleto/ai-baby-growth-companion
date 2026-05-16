package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.persistence.entity.SkillRunRecord;
import com.xiaobao.babycompanion.persistence.service.AgentRunRecordService;
import com.xiaobao.babycompanion.persistence.service.SkillRunRecordService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AgentTraceServiceTests {

    @Test
    void skillTraceScrubsInlineMediaPayloads() {
        AgentRunRecordService agentRunService = mock(AgentRunRecordService.class);
        SkillRunRecordService skillRunService = mock(SkillRunRecordService.class);
        when(skillRunService.save(any())).thenReturn(true);
        AgentTraceService service = new AgentTraceService(
                agentRunService,
                skillRunService,
                new ObjectMapper(),
                Clock.fixed(Instant.parse("2026-05-16T08:00:00Z"), ZoneId.of("Asia/Shanghai"))
        );

        SkillTraceSummary summary = new SkillTraceSummary(
                "expense-recognition",
                SkillMode.EXECUTE,
                "failed",
                "expenseRecognition",
                "doubao-seed-2.0-pro",
                1,
                List.of("attachment-1"),
                Map.of(
                        "attachmentId", "attachment-1",
                        "dataUrl", "data:image/jpeg;base64,AAAA",
                        "visibleText", "data:image/png;base64,BBBB",
                        "nested", Map.of("rawBase64", "AAAA")
                ),
                Map.of("status", "failed"),
                List.<AgentEffectDecision>of(),
                "图片分析失败",
                "timeout",
                123,
                Instant.parse("2026-05-16T08:00:00Z"),
                Instant.parse("2026-05-16T08:00:01Z")
        );

        service.recordSkillRun("agent-run-1", "trace-1", summary);

        ArgumentCaptor<SkillRunRecord> captor = ArgumentCaptor.forClass(SkillRunRecord.class);
        verify(skillRunService).save(captor.capture());
        SkillRunRecord record = captor.getValue();
        assertThat(record.getAttachmentIdsJson()).contains("attachment-1");
        assertThat(record.getInputSummaryJson()).doesNotContain("data:image");
        assertThat(record.getInputSummaryJson()).doesNotContain("AAAA");
        assertThat(record.getInputSummaryJson()).doesNotContain("BBBB");
        assertThat(record.getInputSummaryJson()).contains("[redacted-media-payload]");
    }
}
