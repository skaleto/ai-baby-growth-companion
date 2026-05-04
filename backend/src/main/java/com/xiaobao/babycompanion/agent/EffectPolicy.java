package com.xiaobao.babycompanion.agent;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentChatResponse;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.dto.agent.AgentReminder;
import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EffectPolicy {

    private final ObjectMapper objectMapper;
    private final CareEventCompletenessPolicy completenessPolicy;

    public EffectPolicy(ObjectMapper objectMapper, CareEventCompletenessPolicy completenessPolicy) {
        this.objectMapper = objectMapper;
        this.completenessPolicy = completenessPolicy;
    }

    public List<AgentEffectDecision> decide(AgentChatResponse response, RecordSignals signals) {
        return decide(response, signals, null, "");
    }

    public List<AgentEffectDecision> decide(AgentChatResponse response, RecordSignals signals, JsonNode babyProfile, String userMessage) {
        List<AgentEffectDecision> decisions = new ArrayList<>();
        boolean highRisk = highRisk(response.safetyAlerts(), signals);
        decisions.addAll(completenessPolicy.boundaryDecisions(signals));
        if (signals.unsupportedMutationRequest()) return decisions;
        AgentEffectDecision mixedFeedingClarification = mixedFeedingClarification(response, signals, babyProfile, userMessage);
        if (mixedFeedingClarification != null) decisions.add(mixedFeedingClarification);
        boolean needsClarification = decisions.stream().anyMatch((decision) -> "ask".equals(decision.mode()));

        JsonNode carePayload = mergedCarePayload(response, signals);
        carePayload = completenessPolicy.normalizeCarePayload(carePayload);
        if (!needsClarification && completenessPolicy.hasCompleteCareContent(carePayload)) {
            boolean auto = !highRisk && signals.concreteCareLog() && completenessPolicy.hasAutoRecordableCare(carePayload);
            decisions.add(decision(
                    auto ? "auto" : "pending",
                    "careLog",
                    carePayload,
                    auto ? 0.92 : 0.68,
                    auto ? "识别到明确的日常照护记录，已自动记录。" : "照护内容需要你确认后再记录。",
                    response.careLogPatch() != null && signals.careLogPatch() != null ? "model+rule" : response.careLogPatch() != null ? "model" : "rule"
            ));
        }

        if (response.growthEvent() != null) {
            decisions.add(decision("pending", "growthEvent", objectMapper.valueToTree(response.growthEvent()), 0.72, "成长事件需要确认后归档。", "model"));
        }
        listOrEmpty(response.reminders()).forEach((reminder) ->
                decisions.add(reminderDecision(reminder, signals, highRisk))
        );
        listOrEmpty(response.memories()).forEach((memory) ->
                decisions.add(decision("pending", "memory", objectMapper.valueToTree(memory), 0.66, "长期记忆需要确认后保存。", "model"))
        );
        return decisions;
    }

    private AgentEffectDecision mixedFeedingClarification(
            AgentChatResponse response,
            RecordSignals signals,
            JsonNode babyProfile,
            String userMessage
    ) {
        if (!mixedFeedingProfile(babyProfile)) return null;
        if (!signals.topics().contains("feeding")) return null;
        String text = userMessage == null ? "" : userMessage;
        if (explicitMilkType(text)) return null;

        JsonNode carePayload = mergedCarePayload(response, signals);
        boolean hasMilkAmount = number(carePayload, "milkMl") > 0 ||
                hasMilkAmountEvent(carePayload == null ? null : carePayload.path("events"));
        if (!hasMilkAmount && signals.topics().contains("reminder") && reminderIntent(text)) {
            return null;
        }
        boolean hasAnyMilkSignal = hasMilkAmount || text.matches(".*(喝奶|吃奶|喂奶|奶量|奶粉|母乳|配方奶).*");
        if (!hasAnyMilkSignal) return null;

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("topic", "feeding");
        ArrayNode missingFields = objectMapper.createArrayNode();
        if (!hasMilkAmount) missingFields.add("milkMl");
        missingFields.add("feedingType");
        payload.set("missingFields", missingFields);
        payload.put(
                "question",
                hasMilkAmount
                        ? "小宝现在是混合喂养，这次喝的是母乳还是配方奶？告诉我奶的类型后，我再帮你记到喂养记录里。"
                        : "小宝现在是混合喂养，这次喝完后告诉我喝了多少 ml，以及是母乳还是配方奶，我再帮你记到喂养记录里。"
        );
        if (carePayload != null && !carePayload.isNull()) {
            payload.set("draftCareLog", carePayload);
        }
        return decision("ask", "careLog", payload, 0.9, "混合喂养下缺少奶的类型，需要先确认。", "rule");
    }

    private boolean mixedFeedingProfile(JsonNode babyProfile) {
        String feeding = text(babyProfile, "feeding");
        return StringUtils.hasText(feeding) && feeding.contains("混合");
    }

    private boolean explicitMilkType(String text) {
        return StringUtils.hasText(text) && text.matches(".*(母乳|亲喂|配方奶|奶粉|水奶|液态奶|冻奶|解冻奶|挤奶|吸出来的奶).*");
    }

    private boolean reminderIntent(String text) {
        return StringUtils.hasText(text) && text.matches(".*(提醒|闹钟|定时|记得).*");
    }

    private boolean hasMilkAmountEvent(JsonNode events) {
        if (!(events instanceof ArrayNode array)) return false;
        for (JsonNode event : array) {
            if ("milk".equals(text(event, "type")) && number(event, "amountMl") > 0) return true;
        }
        return false;
    }

    private AgentEffectDecision decision(String mode, String type, JsonNode payload, double confidence, String reason, String source) {
        return new AgentEffectDecision("decision-" + UUID.randomUUID(), mode, type, payload, confidence, reason, source);
    }

    private AgentEffectDecision reminderDecision(AgentReminder reminder, RecordSignals signals, boolean highRisk) {
        ObjectNode payload = normalizeReminderPayload(reminder);
        if ("alarm".equals(payload.path("reminderKind").asText())) {
            JsonNode repeatRule = payload.path("repeatRule");
            int intervalMinutes = repeatRule.path("intervalMinutes").asInt(0);
            boolean validRule = "fixedInterval".equals(repeatRule.path("mode").asText())
                    && "careEvent".equals(repeatRule.path("anchorType").asText())
                    && "milk".equals(repeatRule.path("careEventType").asText())
                    && intervalMinutes >= 30
                    && intervalMinutes <= 12 * 60;
            if (!validRule) {
                ObjectNode ask = objectMapper.createObjectNode();
                ask.put("topic", "reminder");
                ask.putArray("missingFields").add("intervalMinutes");
                ask.put("question", "想每隔多久提醒一次喂奶？告诉我明确的间隔后，我再帮你设置喂奶闹钟。");
                ask.set("draftReminder", payload);
                return decision("ask", "reminder", ask, 0.66, "循环闹钟缺少明确或合理的间隔。", "model");
            }
            payload.put("category", "care");
            if (!StringUtils.hasText(text(payload, "soundId"))) {
                payload.put("soundId", "soft_chime");
            }
            return decision(
                    highRisk ? "pending" : "auto",
                    "reminder",
                    payload,
                    highRisk ? 0.72 : 0.9,
                    highRisk ? "健康、疫苗或用药相关提醒需要确认后再创建。" : "识别到明确的喂奶循环闹钟，已创建提醒。",
                    "model"
            );
        }
        if (!hasUsableScheduleTime(payload, signals)) {
            ObjectNode ask = objectMapper.createObjectNode();
            ask.put("topic", "reminder");
            ask.putArray("missingFields").add("dueAt");
            ask.put("question", "这个提醒想定在什么时候？告诉我具体时间后，我再帮你设置。");
            ask.set("draftReminder", payload);
            return decision("ask", "reminder", ask, 0.64, "提醒时间不明确，需要补充具体时间。", "model");
        }
        boolean auto = !highRisk;
        return decision(
                auto ? "auto" : "pending",
                "reminder",
                payload,
                auto ? 0.9 : 0.72,
                auto ? "识别到明确的低风险提醒，已创建提醒。" : "健康、疫苗或用药相关提醒需要确认后再创建。",
                "model"
        );
    }

    private boolean hasUsableScheduleTime(ObjectNode payload, RecordSignals signals) {
        if (parseableDueAt(text(payload, "dueAt")) && (signals.explicitReminderTime() || concreteReminderTimeText(payload))) {
            return true;
        }
        return signals.explicitReminderTime() || concreteReminderTimeText(payload);
    }

    private boolean concreteReminderTimeText(ObjectNode payload) {
        String value = String.join(" ",
                text(payload, "dueText"),
                text(payload, "timeSourceText"),
                text(payload, "title")
        );
        if (!StringUtils.hasText(value)) return false;
        if (value.matches(".*(过会儿|晚点|找时间|有空|回头|稍后).*")) return false;
        return value.matches(".*(\\d{1,2}:\\d{2}).*")
                || value.matches(".*(今天|明天|后天|大后天|周[一二三四五六日天1-7]|星期[一二三四五六日天1-7]|\\d{1,2}\\s*月\\s*\\d{1,2}\\s*[日号]?|20\\d{2}).*")
                || value.matches(".*(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十半]+)\\s*(分钟|分|小时|天)\\s*后.*")
                || value.matches(".*(凌晨|早上|上午|中午|下午|晚上)?\\s*(\\d{1,2}|[一二两三四五六七八九十]{1,3})\\s*点(半|\\d{1,2}|[一二两三四五六七八九十]{1,3})?.*");
    }

    private boolean parseableDueAt(String dueAt) {
        if (!StringUtils.hasText(dueAt)) return false;
        for (Parser parser : List.<Parser>of(
                () -> OffsetDateTime.parse(dueAt),
                () -> Instant.parse(dueAt),
                () -> LocalDateTime.parse(dueAt)
        )) {
            try {
                parser.parse();
                return true;
            } catch (DateTimeParseException ignored) {
                // Try the next common ISO-8601 shape.
            }
        }
        return false;
    }

    @FunctionalInterface
    private interface Parser {
        Object parse();
    }

    private ObjectNode normalizeReminderPayload(AgentReminder reminder) {
        ObjectNode payload = objectMapper.valueToTree(reminder);
        if (!StringUtils.hasText(text(payload, "reminderKind"))) {
            payload.put("reminderKind", "schedule");
        }
        if (!StringUtils.hasText(text(payload, "timezone"))) {
            payload.put("timezone", "Asia/Shanghai");
        }
        if (!StringUtils.hasText(text(payload, "notificationStatus"))) {
            payload.put("notificationStatus", "pending");
        }
        if (!StringUtils.hasText(text(payload, "status"))) {
            payload.put("status", "open");
        }
        return payload;
    }

    private JsonNode mergedCarePayload(AgentChatResponse response, RecordSignals signals) {
        JsonNode model = response.careLogPatch() == null ? null : objectMapper.valueToTree(response.careLogPatch());
        JsonNode rule = signals.careLogPatch();
        if (model == null || model.isNull()) return normalizeCarePayload(rule);
        if (rule == null || rule.isNull() || !(model instanceof ObjectNode modelObject) || !(rule instanceof ObjectNode ruleObject)) {
            return normalizeCarePayload(model);
        }

        ObjectNode merged = modelObject.deepCopy();
        ruleObject.fields().forEachRemaining((entry) -> {
            if ("events".equals(entry.getKey()) && entry.getValue() instanceof ArrayNode ruleEvents) {
                merged.set("events", mergeEvents(merged.get("events"), ruleEvents));
            } else if (!merged.hasNonNull(entry.getKey())) {
                merged.set(entry.getKey(), entry.getValue());
            }
        });
        return normalizeCarePayload(merged);
    }

    private ArrayNode mergeEvents(JsonNode modelEvents, ArrayNode ruleEvents) {
        ArrayNode merged = objectMapper.createArrayNode();
        List<String> signatures = new ArrayList<>();

        if (!ruleEvents.isEmpty() && (eventCount(modelEvents) < ruleEvents.size() || timedEventCount(ruleEvents) > timedEventCount(modelEvents))) {
            addUniqueEvents(merged, signatures, ruleEvents);
            addUniqueEvents(merged, signatures, modelEvents);
        } else {
            addUniqueEvents(merged, signatures, modelEvents);
            addUniqueEvents(merged, signatures, ruleEvents);
        }
        return merged;
    }

    private void addUniqueEvents(ArrayNode target, List<String> signatures, JsonNode events) {
        if (!(events instanceof ArrayNode array)) return;
        for (JsonNode event : array) {
            JsonNode normalized = normalizeCareEvent(event);
            String signature = eventSignature(normalized);
            if (signatures.contains(signature)) continue;
            target.add(normalized);
            signatures.add(signature);
            if (target.size() >= 24) return;
        }
    }

    private JsonNode normalizeCarePayload(JsonNode payload) {
        if (!(payload instanceof ObjectNode object)) return payload;
        ObjectNode normalized = object.deepCopy();
        if (normalized.get("events") instanceof ArrayNode events) {
            ArrayNode deduped = objectMapper.createArrayNode();
            addUniqueEvents(deduped, new ArrayList<>(), events);
            normalized.set("events", deduped);
        }
        return normalized;
    }

    private JsonNode normalizeCareEvent(JsonNode event) {
        return completenessPolicy.normalizeCareEvent(event);
    }

    private int eventCount(JsonNode events) {
        return events instanceof ArrayNode array ? array.size() : 0;
    }

    private int timedEventCount(JsonNode events) {
        if (!(events instanceof ArrayNode array)) return 0;
        int count = 0;
        for (JsonNode event : array) {
            if (StringUtils.hasText(text(event, "time"))) count += 1;
        }
        return count;
    }

    private String eventSignature(JsonNode event) {
        // The model and rule extractor can disagree on date when the user did not
        // say one explicitly. A careLog payload is single-day, so date should not
        // make the same timed event look unique during model/rule reconciliation.
        return String.join("|",
                text(event, "type"),
                text(event, "time"),
                String.valueOf(number(event, "amountMl")),
                String.valueOf(number(event, "durationHours")),
                String.valueOf(number(event, "temperature"))
        );
    }

    private boolean highRisk(List<AgentSafetyAlert> alerts, RecordSignals signals) {
        boolean urgent = listOrEmpty(alerts).stream().anyMatch((alert) -> "urgent".equals(alert.level()));
        boolean medical = signals.riskHints().stream().anyMatch((hint) ->
                List.of("fever", "medicine", "vaccine", "allergy", "breathing", "injury").contains(hint)
        );
        return urgent || medical;
    }

    private double number(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isNumber() ? value.asDouble() : 0;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.asText() : "";
    }

    private <T> List<T> listOrEmpty(List<T> values) {
        return values == null ? List.of() : values;
    }
}
