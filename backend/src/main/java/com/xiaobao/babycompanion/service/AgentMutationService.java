package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.agent.action.AgentActionContext;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AgentMutationService {

    private final AppStateService appStateService;
    private final ObjectMapper objectMapper;

    public AgentMutationService(AppStateService appStateService, ObjectMapper objectMapper) {
        this.appStateService = appStateService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AgentActionResult applyCareLogPatch(
            AgentActionContext context,
            String toolName,
            String idempotencyKey,
            ObjectNode patch
    ) {
        if (context == null || !StringUtils.hasText(context.familyId()) || !StringUtils.hasText(context.userId())) {
            return AgentActionResult.failed(toolName, "care_log", "当前账号上下文不完整，暂时不能保存记录。", "missing family or user id");
        }
        if (!StringUtils.hasText(idempotencyKey)) {
            return AgentActionResult.failed(toolName, "care_log", "这条记录缺少安全去重信息，暂时没有保存。", "missing idempotency key");
        }
        if (appStateService.hasCareLogAgentAction(context.familyId(), context.userId(), idempotencyKey)) {
            return new AgentActionResult(
                    "applied",
                    toolName,
                    "care_log",
                    careLogIdsForDate(context, patch),
                    null,
                    factsFromPatch(patch),
                    "这条记录已经保存过了。",
                    List.of(),
                    List.of("duplicate_idempotency_key")
            );
        }
        ObjectNode next = patch.deepCopy();
        appendArrayText(next, "agentActionIds", idempotencyKey);
        ObjectNode source = next.putObject("source");
        source.put("kind", "agent_action");
        source.put("traceId", context.traceId());
        source.put("toolName", toolName);
        source.put("idempotencyKey", idempotencyKey);
        appStateService.appendAgentCareLogPatch(context.familyId(), context.userId(), next);
        return new AgentActionResult(
                "applied",
                toolName,
                "care_log",
                careLogIdsForDate(context, next),
                null,
                factsFromPatch(next),
                "已保存到今天的记录里。",
                List.of(),
                List.of()
        );
    }

    @Transactional
    public AgentActionResult createPendingEffect(
            AgentActionContext context,
            String toolName,
            String idempotencyKey,
            String domain,
            ObjectNode effect,
            Map<String, Object> facts
    ) {
        if (context == null || !StringUtils.hasText(context.familyId()) || !StringUtils.hasText(context.userId())) {
            return AgentActionResult.failed(toolName, "pending_effect", "当前账号上下文不完整，暂时不能保存草稿。", "missing family or user id");
        }
        if (!StringUtils.hasText(idempotencyKey)) {
            return AgentActionResult.failed(toolName, "pending_effect", "这条草稿缺少安全去重信息，暂时没有保存。", "missing idempotency key");
        }
        String id = "pending-effect:%s:%s:%s".formatted(toolName, context.familyId(), idempotencyKey);
        ObjectNode pending = effect == null ? objectMapper.createObjectNode() : effect.deepCopy();
        pending.put("id", id);
        pending.put("domain", StringUtils.hasText(domain) ? domain : "record");
        pending.put("status", "pending");
        pending.put("createdAt", Instant.now(context.clock()).toString());
        ObjectNode source = pending.putObject("source");
        source.put("kind", "agent_action");
        source.put("traceId", context.traceId());
        source.put("toolCallId", idempotencyKey);
        source.put("toolName", toolName);
        source.put("idempotencyKey", idempotencyKey);
        pending.set("payload", effect == null ? objectMapper.createObjectNode() : effect.deepCopy());
        appStateService.upsertAgentPendingEffect(context.familyId(), context.userId(), pending);
        return new AgentActionResult(
                "pending_created",
                toolName,
                "pending_effect",
                List.of(),
                id,
                facts == null ? Map.of() : facts,
                "已整理成待确认草稿。",
                List.of(),
                List.of()
        );
    }

    private void appendArrayText(ObjectNode node, String field, String value) {
        JsonNode existing = node.get(field);
        ArrayNode array = existing instanceof ArrayNode existingArray ? existingArray : node.putArray(field);
        boolean exists = false;
        for (JsonNode item : array) {
            if (item.isTextual() && value.equals(item.asText())) {
                exists = true;
                break;
            }
        }
        if (!exists) array.add(value);
    }

    private List<String> careLogIdsForDate(AgentActionContext context, JsonNode patch) {
        String date = text(patch, "date", "");
        // 评审 P4:窄读 careLogs 单表(去读放大),不再 readForUser 拉全部 ~13 个集合;数据与原来逐条等价。
        return appStateService.careLogsForFamily(context.familyId()).stream()
                .filter((careLog) -> !StringUtils.hasText(date) || date.equals(text(careLog, "date", "")))
                .map((careLog) -> text(careLog, "id", ""))
                .filter(StringUtils::hasText)
                .toList();
    }

    private Map<String, Object> factsFromPatch(JsonNode patch) {
        var facts = new java.util.LinkedHashMap<String, Object>();
        putIfPresent(facts, patch, "date");
        putIfPresent(facts, patch, "milkMl");
        putIfPresent(facts, patch, "milkTimes");
        putIfPresent(facts, patch, "sleepHours");
        putIfPresent(facts, patch, "temperature");
        return facts;
    }

    private void putIfPresent(Map<String, Object> facts, JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) return;
        if (value.isNumber()) facts.put(field, value.numberValue());
        else if (value.isTextual()) facts.put(field, value.asText());
        else if (value.isBoolean()) facts.put(field, value.asBoolean());
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }
}
