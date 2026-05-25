package com.xiaobao.babycompanion.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import com.xiaobao.babycompanion.dto.pro.FindingDto;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.pro.DailySummaryDto;
import com.xiaobao.babycompanion.dto.pro.MissingItemDto;
import com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord;
import com.xiaobao.babycompanion.persistence.entity.BabyProfileRecord;
import com.xiaobao.babycompanion.persistence.entity.CareLogRecord;
import com.xiaobao.babycompanion.persistence.entity.DailySummaryRecord;
import com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord;
import com.xiaobao.babycompanion.persistence.entity.GrowthEventRecord;
import com.xiaobao.babycompanion.persistence.entity.PendingEffectRecord;
import com.xiaobao.babycompanion.persistence.entity.ReminderRecord;
import com.xiaobao.babycompanion.persistence.service.AlbumItemRecordService;
import com.xiaobao.babycompanion.persistence.service.BabyProfileRecordService;
import com.xiaobao.babycompanion.persistence.service.CareLogRecordService;
import com.xiaobao.babycompanion.persistence.service.DailySummaryRecordService;
import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService;
import com.xiaobao.babycompanion.persistence.service.GrowthEventRecordService;
import com.xiaobao.babycompanion.persistence.service.PendingEffectRecordService;
import com.xiaobao.babycompanion.persistence.service.ReminderRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DailySummaryService {

    private final DailySummaryRecordService summaryService;
    private final BabyProfileRecordService profileService;
    private final CareLogRecordService careLogService;
    private final GrowthEventRecordService growthEventService;
    private final AlbumItemRecordService albumItemService;
    private final ExpenseItemRecordService expenseItemService;
    private final ReminderRecordService reminderService;
    private final PendingEffectRecordService pendingEffectService;
    private final ProTrialService proTrialService;
    private final AiUsageLogService aiUsageLogService;
    private final CurrentUser currentUser;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final DailySummaryAiClient aiClient;
    private final DailySummaryFindingValidator findingValidator;

    public DailySummaryService(
            DailySummaryRecordService summaryService,
            BabyProfileRecordService profileService,
            CareLogRecordService careLogService,
            GrowthEventRecordService growthEventService,
            AlbumItemRecordService albumItemService,
            ExpenseItemRecordService expenseItemService,
            ReminderRecordService reminderService,
            PendingEffectRecordService pendingEffectService,
            ProTrialService proTrialService,
            AiUsageLogService aiUsageLogService,
            CurrentUser currentUser,
            ObjectMapper objectMapper,
            Clock clock,
            DailySummaryAiClient aiClient,
            DailySummaryFindingValidator findingValidator
    ) {
        this.summaryService = summaryService;
        this.profileService = profileService;
        this.careLogService = careLogService;
        this.growthEventService = growthEventService;
        this.albumItemService = albumItemService;
        this.expenseItemService = expenseItemService;
        this.reminderService = reminderService;
        this.pendingEffectService = pendingEffectService;
        this.proTrialService = proTrialService;
        this.aiUsageLogService = aiUsageLogService;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.aiClient = aiClient;
        this.findingValidator = findingValidator;
    }

    public DailySummaryDto readCurrent(String date) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return read(principal.familyId(), principal.userId(), normalizeDate(date));
    }

    public DailySummaryDto read(String familyId, String userId, String date) {
        String summaryDate = normalizeDate(date);
        DailySummaryRecord record = summaryRecord(familyId, summaryDate);
        if (record == null) return null;
        DailySummaryDto stored = parseSummary(record.getPayloadJson());
        String currentFingerprint = sourceFingerprint(familyId, summaryDate);
        return new DailySummaryDto(
                stored.id(),
                stored.date(),
                stored.text(),
                safeList(stored.facts()),
                safeList(stored.observations()),
                safeList(stored.missingItems()),
                accountMissingItems(familyId, userId, summaryDate),
                safeList(stored.findings()),
                stored.generatedAt(),
                stored.generatedByUserId(),
                record.getSourceFingerprint(),
                !currentFingerprint.equals(record.getSourceFingerprint())
        );
    }

    @Transactional
    public DailySummaryDto generate(String date) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        proTrialService.requireProCaregiver(familyId);
        String summaryDate = normalizeDate(date);
        String now = Instant.now(clock).toString();
        String fingerprint = sourceFingerprint(familyId, summaryDate);
        DailySummaryDto summary = buildSummary(familyId, userId, summaryDate, now, fingerprint);
        DailySummaryDto storedSummary = sharedSummary(summary);

        DailySummaryRecord existing = summaryRecord(familyId, summaryDate);
        DailySummaryRecord record = existing == null ? new DailySummaryRecord() : existing;
        record.setId(existing == null ? "daily-summary-" + familyId + "-" + summaryDate : existing.getId());
        record.setFamilyId(familyId);
        record.setSummaryDate(summaryDate);
        record.setPayloadJson(write(storedSummary));
        record.setSourceFingerprint(fingerprint);
        record.setGeneratedByUserId(userId);
        record.setCreatedAt(existing == null ? now : existing.getCreatedAt());
        record.setUpdatedAt(now);
        summaryService.saveOrUpdate(record);

        aiUsageLogService.record(new AiUsageLogService.UsageEvent(
                familyId,
                userId,
                "daily-summary-" + UUID.randomUUID(),
                "local",
                "daily-summary-rules",
                "daily_summary",
                "family_shared_records",
                null,
                null,
                null,
                true,
                null,
                true,
                true
        ));

        // Return the in-memory summary (which includes personal findings).
        // The stored record intentionally omits findings (sharedSummary strips them).
        return summary;
    }

    private DailySummaryDto sharedSummary(DailySummaryDto summary) {
        return new DailySummaryDto(
                summary.id(),
                summary.date(),
                summary.text(),
                safeList(summary.facts()),
                safeList(summary.observations()),
                safeList(summary.missingItems()),
                List.of(),
                List.of(),
                summary.generatedAt(),
                summary.generatedByUserId(),
                summary.sourceFingerprint(),
                summary.stale()
        );
    }

    private DailySummaryDto buildSummary(String familyId, String userId, String date, String generatedAt, String fingerprint) {
        JsonNode profile = profile(familyId);
        JsonNode careLog = careLog(familyId, date);
        List<JsonNode> growthEvents = recordsForDate(growthEventService, familyId, date);
        List<JsonNode> albumItems = recordsForDate(albumItemService, familyId, date);
        List<JsonNode> expenses = recordsForDate(expenseItemService, familyId, date);
        List<MissingItemDto> missingItems = familyMissingItems(careLog);

        List<String> facts = new ArrayList<>();
        String babyName = text(profile, "nickname", "小宝");
        if (careLog != null && !careLog.isNull()) {
            int milkMl = careLog.path("milkMl").asInt(0);
            int milkTimes = careLog.path("milkTimes").asInt(0);
            double sleepHours = careLog.path("sleepHours").asDouble(0);
            if (milkMl > 0 || milkTimes > 0) {
                facts.add("喂养记录：" + (milkTimes > 0 ? milkTimes + " 次" : "已记录")
                        + (milkMl > 0 ? "，共 " + milkMl + " ml" : ""));
            }
            if (sleepHours > 0) {
                facts.add("睡眠记录：约 " + trimNumber(sleepHours) + " 小时");
            }
        }
        if (!growthEvents.isEmpty()) facts.add("成长记录：" + growthEvents.size() + " 条");
        if (!albumItems.isEmpty()) facts.add("相册新增：" + albumItems.size() + " 项");
        if (!expenses.isEmpty()) facts.add("账本支出：" + expenses.size() + " 笔，共 " + trimMoney(expenseTotal(expenses)) + " 元");
        if (facts.isEmpty()) facts.add("今天还没有太多正式记录。");

        List<String> observations = new ArrayList<>();
        for (MissingItemDto item : missingItems) {
            observations.add(item.message());
        }
        if (observations.isEmpty()) {
            observations.add("今天的关键记录看起来已经有了基础线索，后续补充也可以随时重新整理。");
        }

        String text = babyName + "今天的小结：" + String.join("；", facts) + "。";
        if (!observations.isEmpty()) {
            text = text + " " + String.join(" ", observations);
        }

        List<FindingDto> findings = generateFindings(
                familyId, userId, date, profile, careLog, growthEvents, albumItems, expenses);

        return new DailySummaryDto(
                "daily-summary-" + familyId + "-" + date,
                date,
                text,
                facts,
                observations,
                missingItems,
                accountMissingItems(familyId, userId, date),
                findings,
                generatedAt,
                userId,
                fingerprint,
                false
        );
    }

    private List<FindingDto> generateFindings(
            String familyId,
            String userId,
            String date,
            JsonNode profile,
            JsonNode careLog,
            List<JsonNode> growthEvents,
            List<JsonNode> albumItems,
            List<JsonNode> expenses
    ) {
        // Sparse-data guard: skip AI when total records < 3
        int totalRecords = (careLog == null || careLog.isNull() ? 0 : 1)
                + growthEvents.size() + albumItems.size() + expenses.size();
        if (totalRecords < 3) return List.of();

        try {
            String contextJson = buildAiContext(familyId, userId, date, profile, careLog,
                    growthEvents, albumItems, expenses);
            List<FindingDto> raw = aiClient.call(contextJson);
            DailySummaryFindingValidator.KnownIds known = collectKnownIds(
                    careLog, growthEvents, albumItems, expenses);
            List<FindingDto> validated = findingValidator.validate(raw, known);
            return validated;
        } catch (Exception e) {
            // ANY failure -> empty findings, deterministic summary unaffected
            return List.of();
        }
    }

    private String buildAiContext(
            String familyId,
            String userId,
            String date,
            JsonNode profile,
            JsonNode careLog,
            List<JsonNode> growthEvents,
            List<JsonNode> albumItems,
            List<JsonNode> expenses
    ) throws com.fasterxml.jackson.core.JsonProcessingException {
        var weekAgg = careLogService.getRecentDaysAggregate(familyId, 7);
        var similarExpenses = new java.util.ArrayList<java.util.Map<String, Object>>();
        for (JsonNode expense : expenses) {
            String title = expense.path("title").asText("");
            if (title.isBlank()) continue;
            var matches = expenseItemService.getRecentSimilarExpenses(familyId, title, 3);
            for (var m : matches) {
                similarExpenses.add(java.util.Map.of(
                        "id", m.id(), "title", m.title(),
                        "amount", m.amount(), "date", m.date()));
            }
        }

        java.util.Map<String, Object> ctx = new java.util.LinkedHashMap<>();
        ctx.put("date", date);
        ctx.put("profile", profile);
        ctx.put("today", java.util.Map.of(
                "careLog", careLog == null ? objectMapper.createObjectNode() : careLog,
                "growthEvents", growthEvents,
                "albumItems", albumItems,
                "expenses", expenses
        ));
        ctx.put("weekAggregate", weekAgg);
        ctx.put("similarExpenses", similarExpenses);
        return objectMapper.writeValueAsString(ctx);
    }

    private DailySummaryFindingValidator.KnownIds collectKnownIds(
            JsonNode careLog,
            List<JsonNode> growthEvents,
            List<JsonNode> albumItems,
            List<JsonNode> expenses
    ) {
        java.util.Set<String> careIds = new java.util.HashSet<>();
        if (careLog != null && careLog.has("events")) {
            careLog.path("events").forEach(e -> careIds.add(e.path("id").asText("")));
        }
        return new DailySummaryFindingValidator.KnownIds(
                careIds,
                growthEvents.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
                albumItems.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
                expenses.stream().map(n -> n.path("id").asText("")).collect(java.util.stream.Collectors.toSet()),
                java.util.Set.of(),  // reminders: not yet collected
                java.util.Set.of(),  // members: not yet collected
                java.util.Set.of()   // memory: not yet collected
        );
    }

    private List<MissingItemDto> familyMissingItems(JsonNode careLog) {
        List<MissingItemDto> items = new ArrayList<>();
        if (!hasFeeding(careLog)) {
            items.add(new MissingItemDto(
                    "missing-feeding",
                    "feeding",
                    "family",
                    "喂养记录",
                    "今天还没看到喂养记录，要补一下吗？",
                    "补一下"
            ));
        }
        if (!hasSleep(careLog)) {
            items.add(new MissingItemDto(
                    "missing-sleep",
                    "sleep",
                    "family",
                    "睡眠记录",
                    "今天还没看到睡眠记录，要补一下吗？",
                    "补一下"
            ));
        }
        return items;
    }

    private List<MissingItemDto> accountMissingItems(String familyId, String userId, String date) {
        if (!StringUtils.hasText(userId)) return List.of();
        List<MissingItemDto> items = new ArrayList<>();
        long openReminders = reminderService.count(privateQuery(ReminderRecord.class, familyId, userId)
                .ne("status", "done"));
        if (openReminders > 0) {
            items.add(new MissingItemDto(
                    "account-open-reminders",
                    "reminder",
                    "account",
                    "未完成提醒",
                    "你还有 " + openReminders + " 个提醒没处理，要看一下吗？",
                    "去提醒"
            ));
        }
        long pending = pendingEffectService.count(privateQuery(PendingEffectRecord.class, familyId, userId));
        if (pending > 0) {
            items.add(new MissingItemDto(
                    "account-pending-effects",
                    "pending",
                    "account",
                    "待确认信息",
                    "你还有 " + pending + " 条待确认信息，可以确认后再重新整理。",
                    "去确认"
            ));
        }
        return items;
    }

    private boolean hasFeeding(JsonNode careLog) {
        if (careLog == null || careLog.isNull()) return false;
        if (careLog.path("milkMl").asInt(0) > 0 || careLog.path("milkTimes").asInt(0) > 0) return true;
        JsonNode events = careLog.path("events");
        if (!events.isArray()) return false;
        for (JsonNode event : events) {
            if ("milk".equals(event.path("type").asText(""))) return true;
        }
        return false;
    }

    private boolean hasSleep(JsonNode careLog) {
        if (careLog == null || careLog.isNull()) return false;
        if (careLog.path("sleepHours").asDouble(0) > 0) return true;
        JsonNode events = careLog.path("events");
        if (!events.isArray()) return false;
        for (JsonNode event : events) {
            if ("sleep".equals(event.path("type").asText(""))) return true;
        }
        return false;
    }

    private String sourceFingerprint(String familyId, String date) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String payload : sourcePayloads(familyId, date)) {
                digest.update(payload.getBytes(StandardCharsets.UTF_8));
                digest.update((byte) '\n');
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception exception) {
            return String.valueOf(sourcePayloads(familyId, date).hashCode());
        }
    }

    private List<String> sourcePayloads(String familyId, String date) {
        List<String> values = new ArrayList<>();
        BabyProfileRecord profile = profileService.getOne(familyQuery(BabyProfileRecord.class, familyId).last("LIMIT 1"), false);
        if (profile != null) values.add(profile.getPayloadJson());
        values.addAll(rawRecordsForDate(careLogService, familyId, date));
        values.addAll(rawRecordsForDate(growthEventService, familyId, date));
        values.addAll(rawRecordsForDate(albumItemService, familyId, date));
        values.addAll(rawRecordsForDate(expenseItemService, familyId, date));
        return values;
    }

    private JsonNode profile(String familyId) {
        BabyProfileRecord record = profileService.getOne(familyQuery(BabyProfileRecord.class, familyId).last("LIMIT 1"), false);
        return record == null ? objectMapper.createObjectNode() : parse(record.getPayloadJson());
    }

    private JsonNode careLog(String familyId, String date) {
        CareLogRecord record = careLogService.getOne(familyQuery(CareLogRecord.class, familyId).eq("sort_key", date).last("LIMIT 1"), false);
        return record == null ? null : parse(record.getPayloadJson());
    }

    private <T extends com.xiaobao.babycompanion.persistence.entity.AppRecordEntity> List<JsonNode> recordsForDate(
            com.baomidou.mybatisplus.extension.service.IService<T> service,
            String familyId,
            String date
    ) {
        return rawRecordsForDate(service, familyId, date).stream().map(this::parse).toList();
    }

    private <T extends com.xiaobao.babycompanion.persistence.entity.AppRecordEntity> List<String> rawRecordsForDate(
            com.baomidou.mybatisplus.extension.service.IService<T> service,
            String familyId,
            String date
    ) {
        return service.list(familyQuery(null, familyId)).stream()
                .filter((record) -> payloadDateMatches(record.getPayloadJson(), date))
                .map(com.xiaobao.babycompanion.persistence.entity.AppRecordEntity::getPayloadJson)
                .toList();
    }

    private boolean payloadDateMatches(String payloadJson, String date) {
        JsonNode node = parse(payloadJson);
        String nodeDate = text(node, "date", "");
        if (!StringUtils.hasText(nodeDate)) nodeDate = text(node, "occurredAt", "");
        if (!StringUtils.hasText(nodeDate)) nodeDate = text(node, "createdAt", "");
        return StringUtils.hasText(nodeDate) && nodeDate.startsWith(date);
    }

    private DailySummaryRecord summaryRecord(String familyId, String date) {
        return summaryService.getOne(new QueryWrapper<DailySummaryRecord>()
                .eq("family_id", familyId)
                .eq("summary_date", date)
                .last("LIMIT 1"), false);
    }

    private DailySummaryDto parseSummary(String json) {
        try {
            return objectMapper.readValue(json, DailySummaryDto.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to parse daily summary", exception);
        }
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String write(DailySummaryDto summary) {
        try {
            return objectMapper.writeValueAsString(summary);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize daily summary", exception);
        }
    }

    private String normalizeDate(String date) {
        if (StringUtils.hasText(date) && date.matches("^\\d{4}-\\d{2}-\\d{2}$")) return date;
        return LocalDate.now(clock).toString();
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private String trimNumber(double value) {
        return value == Math.rint(value) ? String.valueOf((int) value) : String.format("%.1f", value);
    }

    private String trimMoney(double value) {
        return value == Math.rint(value) ? String.valueOf((int) value) : String.format("%.2f", value);
    }

    private double expenseTotal(List<JsonNode> expenses) {
        return expenses.stream().mapToDouble((item) -> item.path("amount").asDouble(0)).sum();
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private <T extends com.xiaobao.babycompanion.persistence.entity.AppRecordEntity> QueryWrapper<T> familyQuery(Class<T> ignored, String familyId) {
        return new QueryWrapper<T>().eq("family_id", familyId);
    }

    private <T extends com.xiaobao.babycompanion.persistence.entity.AppRecordEntity> QueryWrapper<T> privateQuery(Class<T> ignored, String familyId, String userId) {
        QueryWrapper<T> query = familyQuery(ignored, familyId);
        query.eq("owner_user_id", userId);
        return query;
    }
}
