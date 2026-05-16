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
import com.xiaobao.babycompanion.dto.agent.AgentExpense;
import com.xiaobao.babycompanion.dto.agent.AgentReminder;
import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EffectPolicy {

    private static final int MIN_INTERVAL_REMINDER_MINUTES = 10;
    private static final int MAX_INTERVAL_REMINDER_MINUTES = 12 * 60;

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
        AgentEffectDecision expenseDecision = expenseSignalDecision(signals);
        List<AgentEffectDecision> modelExpenseDecisions = listOrEmpty(response.expenses()).stream()
                .map((expense) -> expenseDecision(expense, signals))
                .filter((decision) -> decision != null)
                .toList();
        boolean hasModelPendingExpense = modelExpenseDecisions.stream().anyMatch((decision) -> "pending".equals(decision.mode()));
        boolean deferPreviousExpenseReference = "ask".equals(expenseDecision == null ? "" : expenseDecision.mode())
                && referencesPreviousExpenseEvidence(userMessage);
        if (expenseDecision != null && !("ask".equals(expenseDecision.mode()) && hasModelPendingExpense) && !deferPreviousExpenseReference) {
            decisions.add(expenseDecision);
        }
        boolean expenseAlreadyCapturedByRule = "pending".equals(expenseDecision == null ? "" : expenseDecision.mode());
        if (!expenseAlreadyCapturedByRule) {
            decisions.addAll(modelExpenseDecisions);
        }
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
        AgentEffectDecision ruleReminder = reminderSignalDecision(signals, highRisk);
        if (ruleReminder != null) {
            decisions.add(ruleReminder);
        } else {
            listOrEmpty(response.reminders()).forEach((reminder) ->
                    decisions.add(reminderDecision(reminder, signals, highRisk))
            );
        }
        if (!suppressModelMemories(signals, ruleReminder)) {
            listOrEmpty(response.memories()).forEach((memory) ->
                    decisions.add(decision("pending", "memory", objectMapper.valueToTree(memory), 0.66, "长期记忆需要确认后保存。", "model"))
            );
        }
        return decisions;
    }

    private boolean referencesPreviousExpenseEvidence(String text) {
        if (!StringUtils.hasText(text)) return false;
        String value = text.trim();
        boolean expenseIntent = value.matches(".*(花费|支出|账本|记账|费用|记录).*");
        boolean previousReference = value.matches(".*(上面|上面的|前面|之前|上一条|这些|那几张|刚才.*(图|图片|照片|截图|订单|小票|收据|花费)).*");
        boolean repeatIntent = value.matches(".*(重新|再|一遍|再记|再记录|重记).*");
        boolean directRecordReference = value.matches(".*(上面|上面的|前面|之前|上一条|这些|那几张).*记录.*");
        return expenseIntent && previousReference && (repeatIntent || directRecordReference);
    }

    private AgentEffectDecision expenseSignalDecision(RecordSignals signals) {
        ExpenseSignal signal = signals.expenseSignal();
        if (signal == null) return null;
        boolean hasTitle = StringUtils.hasText(signal.title());
        boolean hasAmount = signal.amount() != null && signal.amount() > 0;
        if (!hasTitle || !hasAmount) {
            ObjectNode ask = objectMapper.createObjectNode();
            ask.put("topic", "expense");
            ArrayNode missing = objectMapper.createArrayNode();
            if (!hasTitle) missing.add("花在什么上");
            if (!hasAmount) missing.add("实际花了多少钱");
            ask.set("missingFields", missing);
            ask.put("question", !hasTitle
                    ? "这笔钱是买了什么？告诉我商品或用途和实际金额后，我再帮你记到账本里。"
                    : "这笔支出实际花了多少钱？确认金额后我再帮你记到账本里。");
            return decision("ask", "expenseItem", ask, 0.82, "记账信息还缺少商品或金额。", "rule");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.putNull("id");
        payload.put("title", signal.title());
        payload.put("amount", roundMoney(signal.amount()));
        payload.put("currency", "CNY");
        payload.put("category", StringUtils.hasText(signal.category()) ? signal.category() : "other");
        payload.put("date", StringUtils.hasText(signal.date()) ? signal.date() : "");
        payload.putNull("quantity");
        payload.putNull("unitPrice");
        payload.putNull("merchant");
        payload.put("note", signal.sourceText());
        payload.putNull("brand");
        payload.putNull("spec");
        payload.set("attachmentIds", objectMapper.createArrayNode());
        payload.put("source", "agent");
        payload.putNull("createdAt");
        payload.putNull("updatedAt");
        return decision("pending", "expenseItem", payload, 0.9, "识别到明确的小宝支出，请确认后记到账本。", "rule");
    }

    private AgentEffectDecision expenseDecision(AgentExpense expense, RecordSignals signals) {
        if (expense == null) return null;
        boolean hasTitle = StringUtils.hasText(expense.title());
        boolean hasAmount = expense.amount() != null && expense.amount() > 0;
        boolean hasCategory = StringUtils.hasText(expense.category());
        String date = StringUtils.hasText(expense.date())
                ? expense.date()
                : signals.targetDates().stream().findFirst().orElse("");
        if (!hasTitle || !hasAmount || !hasCategory || !StringUtils.hasText(date)) {
            ObjectNode ask = objectMapper.createObjectNode();
            ask.put("topic", "expense");
            ArrayNode missing = objectMapper.createArrayNode();
            if (!hasTitle) missing.add("买了什么或花在什么上");
            if (!hasAmount) missing.add("实际花了多少钱");
            if (!hasCategory) missing.add("支出分类");
            if (!StringUtils.hasText(date)) missing.add("日期");
            ask.set("missingFields", missing);
            ask.put("question", "这笔账还缺少" + missingText(missing) + "，补充后我再整理成待确认草稿。");
            return decision("ask", "expenseItem", ask, 0.82, "记账信息还缺少必要字段。", "model");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.putNull("id");
        payload.put("title", expense.title().trim());
        payload.put("amount", roundMoney(expense.amount()));
        payload.put("currency", StringUtils.hasText(expense.currency()) ? expense.currency() : "CNY");
        payload.put("category", expense.category());
        payload.put("date", date);
        if (expense.quantity() == null) payload.putNull("quantity");
        else payload.put("quantity", expense.quantity());
        if (expense.unitPrice() == null) payload.putNull("unitPrice");
        else payload.put("unitPrice", roundMoney(expense.unitPrice()));
        if (StringUtils.hasText(expense.merchant())) payload.put("merchant", expense.merchant().trim());
        else payload.putNull("merchant");
        if (StringUtils.hasText(expense.note())) payload.put("note", expense.note().trim());
        else payload.putNull("note");
        if (StringUtils.hasText(expense.brand())) payload.put("brand", expense.brand().trim());
        else payload.putNull("brand");
        if (StringUtils.hasText(expense.spec())) payload.put("spec", expense.spec().trim());
        else payload.putNull("spec");
        ArrayNode attachmentIds = objectMapper.createArrayNode();
        listOrEmpty(expense.attachmentIds()).stream()
                .filter(StringUtils::hasText)
                .forEach(attachmentIds::add);
        payload.set("attachmentIds", attachmentIds);
        payload.put("source", "agent");
        payload.putNull("createdAt");
        payload.putNull("updatedAt");
        return decision("pending", "expenseItem", payload, 0.84, "AI 已整理出待确认账本草稿。", "model");
    }

    private String missingText(ArrayNode missing) {
        List<String> fields = new ArrayList<>();
        missing.forEach((node) -> fields.add(node.asText()));
        return String.join("、", fields);
    }

    private double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private AgentEffectDecision reminderSignalDecision(RecordSignals signals, boolean highRisk) {
        ReminderSignal signal = signals.reminderSignal();
        if (signal == null || !"interval".equals(signal.kind())) return null;
        Integer intervalMinutes = signal.intervalMinutes();
        if (intervalMinutes == null || intervalMinutes < MIN_INTERVAL_REMINDER_MINUTES || intervalMinutes > MAX_INTERVAL_REMINDER_MINUTES) {
            ObjectNode ask = objectMapper.createObjectNode();
            ask.put("topic", "reminder");
            ask.putArray("missingFields").add("提醒间隔");
            ask.put("question", "想每隔多久提醒一次？告诉我明确的间隔后，我再帮你设置。");
            return decision("ask", "reminder", ask, 0.86, "循环提醒缺少明确或合理的间隔。", "rule");
        }

        boolean feeding = "feeding".equals(signal.topic());
        boolean ringing = signal.ringingRequested();
        String title = reminderTitle(signal.sourceText(), feeding);
        ObjectNode payload = objectMapper.createObjectNode();
        payload.putNull("id");
        payload.put("title", title);
        payload.put("reminderKind", ringing ? "alarm" : "schedule");
        payload.put("scheduleMode", "interval");
        payload.put("alertMode", ringing ? "ringing" : "notification");
        payload.put("dueText", "每 " + formatIntervalText(intervalMinutes) + " " + title);
        payload.putNull("dueAt");
        payload.put("timeSourceText", signal.sourceText());
        payload.put("timezone", "Asia/Shanghai");
        payload.putNull("notificationId");
        payload.put("notificationStatus", "pending");
        payload.putNull("notificationError");
        payload.put("category", feeding ? "care" : "custom");
        payload.put("recurrence", "每 " + formatIntervalText(intervalMinutes) + " " + title);
        ObjectNode repeatRule = objectMapper.createObjectNode();
        repeatRule.put("mode", "fixedInterval");
        repeatRule.put("intervalMinutes", intervalMinutes);
        repeatRule.put("anchorType", feeding ? "careEvent" : "now");
        if (feeding) {
            repeatRule.put("careEventType", "milk");
        }
        payload.set("repeatRule", repeatRule);
        if (ringing) {
            payload.put("soundId", "soft_chime");
        } else {
            payload.putNull("soundId");
        }
        payload.putNull("lastAnchorEventId");
        payload.putNull("lastAnchorAt");
        payload.put("status", "open");
        payload.putNull("createdAt");
        payload.set("history", objectMapper.createArrayNode().add("按循环提醒规则创建"));

        return decision(
                highRisk ? "pending" : "auto",
                "reminder",
                payload,
                highRisk ? 0.72 : 0.96,
                highRisk ? "健康、疫苗或用药相关提醒需要确认后再创建。" : "识别到明确的循环提醒，已创建提醒。",
                "rule"
        );
    }

    private String reminderTitle(String sourceText, boolean feeding) {
        if (feeding) return "喂奶提醒";
        if (sourceText != null && sourceText.matches(".*喝水.*")) return "喝水提醒";
        if (sourceText != null && sourceText.matches(".*(吃药|用药|喂药).*")) return "用药提醒";
        if (sourceText != null && sourceText.matches(".*洗澡.*")) return "洗澡提醒";
        return "循环提醒";
    }

    private boolean suppressModelMemories(RecordSignals signals, AgentEffectDecision ruleReminder) {
        return ruleReminder != null || (signals.topics().contains("reminder") && !signals.concreteCareLog());
    }

    private String formatIntervalText(int minutes) {
        if (minutes % 60 == 0) return (minutes / 60) + " 小时";
        if (minutes < 60) return minutes + " 分钟";
        return (minutes / 60) + " 小时 " + (minutes % 60) + " 分钟";
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
        if ("interval".equals(payload.path("scheduleMode").asText())) {
            JsonNode repeatRule = payload.path("repeatRule");
            int intervalMinutes = repeatRule.path("intervalMinutes").asInt(0);
            boolean validRule = "fixedInterval".equals(repeatRule.path("mode").asText())
                    && ("now".equals(repeatRule.path("anchorType").asText())
                    || ("careEvent".equals(repeatRule.path("anchorType").asText()) && "milk".equals(repeatRule.path("careEventType").asText())))
                    && intervalMinutes >= MIN_INTERVAL_REMINDER_MINUTES
                    && intervalMinutes <= MAX_INTERVAL_REMINDER_MINUTES;
            if (!validRule) {
                ObjectNode ask = objectMapper.createObjectNode();
                ask.put("topic", "reminder");
                ask.putArray("missingFields").add("提醒间隔");
                ask.put("question", "想每隔多久提醒一次？告诉我明确的间隔后，我再帮你设置。");
                ask.set("draftReminder", payload);
                return decision("ask", "reminder", ask, 0.66, "循环提醒缺少明确或合理的间隔。", "model");
            }
            if ("ringing".equals(payload.path("alertMode").asText()) && !StringUtils.hasText(text(payload, "soundId"))) {
                payload.put("soundId", "soft_chime");
            }
            return decision(
                    highRisk ? "pending" : "auto",
                    "reminder",
                    payload,
                    highRisk ? 0.72 : 0.9,
                    highRisk ? "健康、疫苗或用药相关提醒需要确认后再创建。" : "识别到明确的循环提醒，已创建提醒。",
                    "model"
            );
        }
        if (!hasUsableScheduleTime(payload, signals)) {
            ObjectNode ask = objectMapper.createObjectNode();
            ask.put("topic", "reminder");
            ask.putArray("missingFields").add("提醒时间");
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
        String reminderKind = text(payload, "reminderKind");
        if (!StringUtils.hasText(text(payload, "scheduleMode"))) {
            payload.put("scheduleMode", payload.path("repeatRule").isObject() || "alarm".equals(reminderKind) ? "interval" : "once");
        }
        if (!"interval".equals(payload.path("scheduleMode").asText()) && !"once".equals(payload.path("scheduleMode").asText())) {
            payload.put("scheduleMode", payload.path("repeatRule").isObject() ? "interval" : "once");
        }
        if (!StringUtils.hasText(text(payload, "alertMode"))) {
            payload.put("alertMode", "alarm".equals(reminderKind) ? "ringing" : "notification");
        }
        if (!"ringing".equals(payload.path("alertMode").asText()) && !"notification".equals(payload.path("alertMode").asText())) {
            payload.put("alertMode", "alarm".equals(reminderKind) ? "ringing" : "notification");
        }
        if (!StringUtils.hasText(text(payload, "reminderKind"))) {
            payload.put("reminderKind", "ringing".equals(payload.path("alertMode").asText()) ? "alarm" : "schedule");
        }
        if ("ringing".equals(payload.path("alertMode").asText())) {
            payload.put("reminderKind", "alarm");
        } else {
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
