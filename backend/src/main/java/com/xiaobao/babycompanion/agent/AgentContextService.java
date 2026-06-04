package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.service.AppStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AgentContextService {

    private final AppStateService appStateService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AgentContextService(AppStateService appStateService, ObjectMapper objectMapper) {
        this(appStateService, objectMapper, Clock.system(ZoneId.of("Asia/Shanghai")));
    }

    @Autowired
    public AgentContextService(AppStateService appStateService, ObjectMapper objectMapper, Clock clock) {
        this.appStateService = appStateService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public AgentContextSnapshot build(AgentChatRequest request, AgentPlan plan, RecordSignals signals) {
        return build(null, request, plan, signals);
    }

    public AgentContextSnapshot build(String familyId, AgentChatRequest request, AgentPlan plan, RecordSignals signals) {
        return build(familyId, null, request, plan, signals);
    }

    public AgentContextSnapshot build(String familyId, String userId, AgentChatRequest request, AgentPlan plan, RecordSignals signals) {
        AppStateDto state = StringUtils.hasText(familyId)
                ? appStateService.readForUser(familyId, userId).state()
                : appStateService.read().state();
        JsonNode profile = state.profile() != null && !state.profile().isNull()
                ? state.profile()
                : objectMapper.valueToTree(request.babyProfile());

        List<String> topics = plan.topics() == null || plan.topics().isEmpty() ? signals.topics() : plan.topics();
        List<String> dates = plan.targetDates() == null || plan.targetDates().isEmpty() ? signals.targetDates() : plan.targetDates();

        List<JsonNode> careLogs = relevant(state.careLogs(), dates, topics, "date", 10);
        List<JsonNode> growthEvents = relevant(state.growthEvents(), dates, topics, "date", 6);
        List<JsonNode> growthMeasurements = relevant(state.growthMeasurements(), dates, topics, "date", 12);
        List<JsonNode> reminders = relevant(state.reminders(), dates, topics, "createdAt", 6);
        List<JsonNode> memories = relevant(state.memories(), dates, topics, "updatedAt", 8);
        List<JsonNode> recentMessages = tail(state.messages(), 12);
        JsonNode conversationSummary = state.conversationSummary();
        Map<String, Object> trends = trends(careLogs);
        Map<String, Object> recordContext = recordContext(request, state, trends);

        return new AgentContextSnapshot(
                profile,
                recentMessages,
                careLogs,
                growthEvents,
                growthMeasurements,
                reminders,
                memories,
                conversationSummary,
                recordContext,
                trends
        );
    }

    private Map<String, Object> recordContext(AgentChatRequest request, AppStateDto state, Map<String, Object> trends) {
        JsonNode page = request.pageContext();
        String today = LocalDate.now(clock).toString();
        String selectedDate = text(page, "selectedDate");
        if (!StringUtils.hasText(selectedDate)) selectedDate = today;

        List<JsonNode> careLogs = state.careLogs() == null ? List.of() : state.careLogs();
        List<JsonNode> growthEvents = state.growthEvents() == null ? List.of() : state.growthEvents();
        List<JsonNode> growthMeasurements = state.growthMeasurements() == null ? List.of() : state.growthMeasurements();
        List<JsonNode> reminders = state.reminders() == null ? List.of() : state.reminders();
        List<JsonNode> pendingEffects = state.pendingEffects() == null ? List.of() : state.pendingEffects();

        JsonNode selectedCareLog = pageValue(page, "selectedCareLog");
        if (selectedCareLog == null || selectedCareLog.isNull()) selectedCareLog = careLogForDate(careLogs, selectedDate);
        JsonNode todayCareLog = pageValue(page, "todayCareLog");
        if (todayCareLog == null || todayCareLog.isNull()) todayCareLog = careLogForDate(careLogs, today);

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("activeTab", text(page, "activeTab"));
        context.put("selectedDate", selectedDate);
        context.put("selectedCareLog", selectedCareLog);
        context.put("selectedEvents", arrayOrEmpty(pageValue(page, "selectedEvents")));
        context.put("todayCareLog", todayCareLog);
        context.put("recentCareLogs", recentCareLogs(careLogs, 7));
        context.put("openReminders", pageArrayOrDefault(page, "openReminders", openReminders(reminders)));
        JsonNode pagePendingSummaries = pageValue(page, "pendingEffectSummaries");
        context.put("pendingEffectSummaries", pagePendingSummaries != null && pagePendingSummaries.isArray()
                ? arrayOrEmpty(pagePendingSummaries)
                : pendingEffectSummaries(pendingEffects));
        context.put("recentGrowthEvents", tail(growthEvents, 5));
        context.put("recentGrowthMeasurements", recentGrowthMeasurements(growthMeasurements, 8));
        context.put("trends", trends);
        return context;
    }

    private JsonNode careLogForDate(List<JsonNode> careLogs, String date) {
        if (!StringUtils.hasText(date)) return null;
        return careLogs.stream()
                .filter((log) -> date.equals(dateText(log, "date")))
                .findFirst()
                .orElse(null);
    }

    private List<JsonNode> recentCareLogs(List<JsonNode> careLogs, int limit) {
        if (careLogs == null || careLogs.isEmpty()) return List.of();
        List<JsonNode> sorted = new ArrayList<>(careLogs);
        sorted.sort((left, right) -> dateText(right, "date").compareTo(dateText(left, "date")));
        return sorted.stream().limit(limit).toList();
    }

    private List<JsonNode> recentGrowthMeasurements(List<JsonNode> growthMeasurements, int limit) {
        if (growthMeasurements == null || growthMeasurements.isEmpty()) return List.of();
        List<JsonNode> sorted = new ArrayList<>(growthMeasurements);
        sorted.sort((left, right) -> dateText(right, "date").compareTo(dateText(left, "date")));
        return sorted.stream().limit(limit).toList();
    }

    private List<JsonNode> openReminders(List<JsonNode> reminders) {
        if (reminders == null || reminders.isEmpty()) return List.of();
        return reminders.stream()
                .filter((reminder) -> !"done".equals(text(reminder, "status")))
                .limit(8)
                .toList();
    }

    private List<Map<String, Object>> pendingEffectSummaries(List<JsonNode> pendingEffects) {
        if (pendingEffects == null || pendingEffects.isEmpty()) return List.of();
        return pendingEffects.stream()
                .limit(6)
                .map((effect) -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", text(effect, "id"));
                    item.put("createdAt", text(effect, "createdAt"));
                    item.put("tags", effect == null ? null : effect.get("tags"));
                    item.put("hasCareLogPatch", effect != null && effect.hasNonNull("careLogPatch"));
                    item.put("growthEventTitle", text(effect == null ? null : effect.get("growthEvent"), "title"));
                    item.put("reminderCount", arraySize(effect == null ? null : effect.get("reminders")));
                    item.put("memoryCount", arraySize(effect == null ? null : effect.get("memories")));
                    return item;
                })
                .toList();
    }

    private List<JsonNode> pageArrayOrDefault(JsonNode page, String field, List<JsonNode> fallback) {
        JsonNode value = pageValue(page, field);
        return value != null && value.isArray() ? arrayOrEmpty(value) : fallback;
    }

    private List<JsonNode> arrayOrEmpty(JsonNode value) {
        if (value == null || !value.isArray()) return List.of();
        List<JsonNode> items = new ArrayList<>();
        value.forEach(items::add);
        return items;
    }

    private int arraySize(JsonNode value) {
        return value != null && value.isArray() ? value.size() : 0;
    }

    private List<JsonNode> relevant(List<JsonNode> items, List<String> dates, List<String> topics, String dateField, int limit) {
        if (items == null || items.isEmpty()) return List.of();
        return items.stream()
                .sorted(Comparator
                        .comparingInt((JsonNode item) -> score(item, dates, topics, dateField))
                        .reversed()
                        .thenComparing((left, right) -> dateText(right, dateField).compareTo(dateText(left, dateField))))
                .limit(limit)
                .toList();
    }

    private int score(JsonNode item, List<String> dates, List<String> topics, String dateField) {
        int score = 0;
        String serialized = item.toString();
        String date = dateText(item, dateField);
        for (String target : dates == null ? List.<String>of() : dates) {
            if (StringUtils.hasText(target) && date.startsWith(target)) score += 100;
        }
        for (String topic : topics == null ? List.<String>of() : topics) {
            score += switch (topic) {
                case "feeding" -> containsAny(serialized, "milk", "喝奶", "吃奶", "喂奶", "奶量") ? 30 : 0;
                case "sleep" -> containsAny(serialized, "sleep", "睡", "夜醒", "哄睡") ? 30 : 0;
                case "poop" -> containsAny(serialized, "poop", "便便", "大便") ? 30 : 0;
                case "temperature" -> containsAny(serialized, "temperature", "体温", "发烧") ? 30 : 0;
                case "vaccine" -> containsAny(serialized, "vaccine", "疫苗", "接种") ? 30 : 0;
                default -> 0;
            };
        }
        if (withinDays(date, 7)) score += 10;
        if (withinDays(date, 30)) score += 5;
        return score;
    }

    private Map<String, Object> trends(List<JsonNode> careLogs) {
        int milkDays = 0;
        int milkTotal = 0;
        int sleepDays = 0;
        double sleepTotal = 0;
        int wakeTotal = 0;
        for (JsonNode log : careLogs) {
            if (withinDays(dateText(log, "date"), 7)) {
                if (log.has("milkMl") && log.get("milkMl").canConvertToInt()) {
                    milkDays += 1;
                    milkTotal += log.get("milkMl").asInt();
                }
                if (log.has("sleepHours") && log.get("sleepHours").isNumber()) {
                    sleepDays += 1;
                    sleepTotal += log.get("sleepHours").asDouble();
                }
                if (log.has("wakes") && log.get("wakes").canConvertToInt()) {
                    wakeTotal += log.get("wakes").asInt();
                }
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("careLogDaysInContext", careLogs.size());
        result.put("sevenDayAverageMilkMl", milkDays == 0 ? null : Math.round((double) milkTotal / milkDays));
        result.put("sevenDayAverageSleepHours", sleepDays == 0 ? null : Math.round((sleepTotal / sleepDays) * 10) / 10.0);
        result.put("sevenDayWakeTotal", wakeTotal);
        return result;
    }

    private String dateText(JsonNode item, String field) {
        JsonNode value = item == null ? null : item.get(field);
        return value != null && value.isTextual() ? value.asText() : "";
    }

    private JsonNode pageValue(JsonNode page, String field) {
        return page == null || page.isNull() ? null : page.get(field);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.asText() : "";
    }

    private boolean withinDays(String value, int days) {
        if (!StringUtils.hasText(value) || value.length() < 10) return false;
        try {
            LocalDate date = LocalDate.parse(value.substring(0, 10));
            LocalDate today = LocalDate.now(clock);
            return !date.isAfter(today) && !date.isBefore(today.minusDays(days));
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }

    private <T> List<T> tail(List<T> items, int limit) {
        if (items == null || items.isEmpty()) return List.of();
        int start = Math.max(0, items.size() - limit);
        return items.subList(start, items.size());
    }
}
