package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.persistence.entity.AgentRunRecord;
import com.xiaobao.babycompanion.persistence.entity.SkillRunRecord;
import com.xiaobao.babycompanion.persistence.service.AgentRunRecordService;
import com.xiaobao.babycompanion.persistence.service.SkillRunRecordService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AgentTraceService {

    private final AgentRunRecordService agentRunRecordService;
    private final SkillRunRecordService skillRunRecordService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AgentTraceService(
            AgentRunRecordService agentRunRecordService,
            SkillRunRecordService skillRunRecordService,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.agentRunRecordService = agentRunRecordService;
        this.skillRunRecordService = skillRunRecordService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public AgentRunRecord startAgentRun(
            String traceId,
            String familyId,
            String userId,
            String messageId,
            String inputType,
            String plannerModel,
            String finalModel
    ) {
        Instant now = Instant.now(clock);
        AgentRunRecord record = new AgentRunRecord();
        record.setId("agent-run-" + UUID.randomUUID());
        record.setTraceId(traceId);
        record.setFamilyId(familyId);
        record.setUserId(userId);
        record.setMessageId(messageId);
        record.setStatus("running");
        record.setInputType(inputType);
        record.setPlannerModel(plannerModel);
        record.setFinalModel(finalModel);
        record.setStartedAt(now.toString());
        record.setCreatedAt(now.toString());
        agentRunRecordService.save(record);
        return record;
    }

    public void recordPlan(AgentRunRecord record, AgentPlan plan, SkillPlan skillPlan) {
        if (record == null) return;
        record.setPlannerResultJson(safeJson(summary(plan)));
        record.setSkillPlanJson(safeJson(skillPlan == null ? SkillPlan.empty() : skillPlan));
        agentRunRecordService.updateById(record);
    }

    public void completeAgentRun(AgentRunRecord record, List<AgentEffectDecision> decisions) {
        if (record == null) return;
        record.setStatus("succeeded");
        record.setEffectSummaryJson(safeJson(effectSummary(decisions)));
        record.setCompletedAt(Instant.now(clock).toString());
        agentRunRecordService.updateById(record);
    }

    public void failAgentRun(AgentRunRecord record, String errorCode) {
        if (record == null) return;
        record.setStatus("failed");
        record.setErrorCode(abbreviate(errorCode, 240));
        record.setCompletedAt(Instant.now(clock).toString());
        agentRunRecordService.updateById(record);
    }

    public SkillRunRecord recordSkillRun(String agentRunId, String traceId, SkillTraceSummary summary) {
        if (summary == null) return null;
        Instant now = Instant.now(clock);
        SkillRunRecord record = new SkillRunRecord();
        record.setId("skill-run-" + UUID.randomUUID());
        record.setTraceId(StringUtils.hasText(traceId) ? traceId : "trace-" + UUID.randomUUID());
        record.setAgentRunId(agentRunId);
        record.setSkillId(summary.skillId());
        record.setMode(summary.mode() == null ? null : summary.mode().wireValue());
        record.setStatus(summary.status());
        record.setModelProfile(summary.modelProfile());
        record.setModel(summary.model());
        record.setBatchCount(summary.batchCount());
        record.setAttachmentIdsJson(safeJson(summary.attachmentIds()));
        record.setInputSummaryJson(safeJson(summary.inputSummary()));
        record.setResultSummaryJson(safeJson(summary.resultSummary()));
        record.setEffectCandidateSummaryJson(safeJson(effectSummary(summary.effectCandidates())));
        record.setUserFacingError(abbreviate(summary.userFacingError(), 500));
        record.setErrorCode(abbreviate(summary.errorCode(), 240));
        record.setLatencyMs(summary.latencyMs());
        record.setStartedAt((summary.startedAt() == null ? now : summary.startedAt()).toString());
        record.setCompletedAt((summary.completedAt() == null ? now : summary.completedAt()).toString());
        record.setCreatedAt(now.toString());
        skillRunRecordService.save(record);
        return record;
    }

    private Map<String, Object> summary(AgentPlan plan) {
        if (plan == null) return Map.of();
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("intent", plan.intent());
        values.put("topics", plan.topics());
        values.put("targetDates", plan.targetDates());
        values.put("contextNeeds", plan.contextNeeds());
        values.put("toolRequestCount", plan.toolRequests() == null ? 0 : plan.toolRequests().size());
        values.put("riskHints", plan.riskHints());
        values.put("mediaAction", plan.mediaAction());
        return values;
    }

    private List<Map<String, Object>> effectSummary(List<AgentEffectDecision> decisions) {
        if (decisions == null) return List.of();
        return decisions.stream().map((decision) -> {
            Map<String, Object> values = new LinkedHashMap<>();
            values.put("id", decision.id());
            values.put("mode", decision.mode());
            values.put("type", decision.type());
            values.put("confidence", decision.confidence());
            values.put("source", decision.source());
            values.put("payloadFields", decision.payload() == null ? List.of() :
                    java.util.stream.StreamSupport.stream(
                                    java.util.Spliterators.spliteratorUnknownSize(decision.payload().fieldNames(), 0),
                                    false
                            )
                            .toList());
            return values;
        }).toList();
    }

    private String safeJson(Object value) {
        Object scrubbed = scrubTracePayload(value);
        try {
            return objectMapper.writeValueAsString(scrubbed);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    Object scrubTracePayload(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> scrubbed = new LinkedHashMap<>();
            map.forEach((key, raw) -> {
                String name = String.valueOf(key);
                if (sensitiveTraceField(name)) return;
                scrubbed.put(name, scrubTracePayload(raw));
            });
            return scrubbed;
        }
        if (value instanceof Iterable<?> iterable) {
            List<Object> scrubbed = new java.util.ArrayList<>();
            iterable.forEach((item) -> scrubbed.add(scrubTracePayload(item)));
            return scrubbed;
        }
        if (value instanceof String text && looksLikeInlineMedia(text)) {
            return "[redacted-media-payload]";
        }
        return value;
    }

    private boolean sensitiveTraceField(String name) {
        String normalized = name == null ? "" : name.toLowerCase();
        return normalized.equals("dataurl")
                || normalized.equals("data_url")
                || normalized.contains("base64")
                || normalized.contains("payloadbytes")
                || normalized.contains("video_bytes")
                || normalized.contains("image_bytes");
    }

    private boolean looksLikeInlineMedia(String text) {
        return StringUtils.hasText(text)
                && (text.startsWith("data:image/")
                || text.startsWith("data:video/")
                || text.startsWith("data:audio/"));
    }

    private String abbreviate(String value, int maxLength) {
        if (!StringUtils.hasText(value)) return value;
        String trimmed = value.trim();
        if (trimmed.length() <= maxLength) return trimmed;
        return trimmed.substring(0, Math.max(0, maxLength - 1)) + "…";
    }
}
