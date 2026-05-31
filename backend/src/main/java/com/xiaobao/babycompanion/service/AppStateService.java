package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.IService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.dto.app.AppStateResponse;
import com.xiaobao.babycompanion.dto.app.AttachmentDto;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord;
import com.xiaobao.babycompanion.persistence.entity.AppRecordEntity;
import com.xiaobao.babycompanion.persistence.entity.AttachmentRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthFamilyMemberRecord;
import com.xiaobao.babycompanion.persistence.entity.BabyProfileRecord;
import com.xiaobao.babycompanion.persistence.entity.CareLogRecord;
import com.xiaobao.babycompanion.persistence.entity.ChatMessageRecord;
import com.xiaobao.babycompanion.persistence.entity.ConversationSummaryRecord;
import com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord;
import com.xiaobao.babycompanion.persistence.entity.GrowthEventRecord;
import com.xiaobao.babycompanion.persistence.entity.GrowthMeasurementRecord;
import com.xiaobao.babycompanion.persistence.entity.MemoryItemRecord;
import com.xiaobao.babycompanion.persistence.entity.PendingEffectRecord;
import com.xiaobao.babycompanion.persistence.entity.ReminderRecord;
import com.xiaobao.babycompanion.persistence.service.AttachmentRecordService;
import com.xiaobao.babycompanion.persistence.service.AlbumItemRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthFamilyMemberRecordService;
import com.xiaobao.babycompanion.persistence.service.BabyProfileRecordService;
import com.xiaobao.babycompanion.persistence.service.CareLogRecordService;
import com.xiaobao.babycompanion.persistence.service.ChatMessageRecordService;
import com.xiaobao.babycompanion.persistence.service.ConversationSummaryRecordService;
import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService;
import com.xiaobao.babycompanion.persistence.service.GrowthEventRecordService;
import com.xiaobao.babycompanion.persistence.service.GrowthMeasurementRecordService;
import com.xiaobao.babycompanion.persistence.service.MemoryItemRecordService;
import com.xiaobao.babycompanion.persistence.service.PendingEffectRecordService;
import com.xiaobao.babycompanion.persistence.service.ReminderRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AppStateService {

    private static final String PROFILE_ID = "default";
    private static final Set<String> ATTACHMENT_KINDS = Set.of("image", "video", "audio");
    private static final List<String> SHARED_ATTACHMENT_OWNER_TYPES = List.of("profile", "growth", "care", "album", "expense");
    private static final Set<String> EXPENSE_CATEGORIES = Set.of(
            "formula", "diaper", "food", "clothing", "toy", "health", "vaccine", "daily", "education", "other"
    );

    private final BabyProfileRecordService profileService;
    private final ChatMessageRecordService messageService;
    private final GrowthEventRecordService growthService;
    private final GrowthMeasurementRecordService growthMeasurementService;
    private final CareLogRecordService careLogService;
    private final ReminderRecordService reminderService;
    private final MemoryItemRecordService memoryService;
    private final PendingEffectRecordService pendingEffectService;
    private final AlbumItemRecordService albumItemService;
    private final ExpenseItemRecordService expenseItemService;
    private final ConversationSummaryRecordService conversationSummaryService;
    private final AttachmentRecordService attachmentRecordService;
    private final AuthFamilyMemberRecordService familyMemberService;
    private final AttachmentStorageService attachmentStorageService;
    private final ProTrialService proTrialService;
    private final DailySummaryService dailySummaryService;
    private final ObjectMapper objectMapper;
    private final CurrentUser currentUser;

    public AppStateService(
            BabyProfileRecordService profileService,
            ChatMessageRecordService messageService,
            GrowthEventRecordService growthService,
            GrowthMeasurementRecordService growthMeasurementService,
            CareLogRecordService careLogService,
            ReminderRecordService reminderService,
            MemoryItemRecordService memoryService,
            PendingEffectRecordService pendingEffectService,
            AlbumItemRecordService albumItemService,
            ExpenseItemRecordService expenseItemService,
            ConversationSummaryRecordService conversationSummaryService,
            AttachmentRecordService attachmentRecordService,
            AuthFamilyMemberRecordService familyMemberService,
            AttachmentStorageService attachmentStorageService,
            ProTrialService proTrialService,
            DailySummaryService dailySummaryService,
            ObjectMapper objectMapper,
            CurrentUser currentUser
    ) {
        this.profileService = profileService;
        this.messageService = messageService;
        this.growthService = growthService;
        this.growthMeasurementService = growthMeasurementService;
        this.careLogService = careLogService;
        this.reminderService = reminderService;
        this.memoryService = memoryService;
        this.pendingEffectService = pendingEffectService;
        this.albumItemService = albumItemService;
        this.expenseItemService = expenseItemService;
        this.conversationSummaryService = conversationSummaryService;
        this.attachmentRecordService = attachmentRecordService;
        this.familyMemberService = familyMemberService;
        this.attachmentStorageService = attachmentStorageService;
        this.proTrialService = proTrialService;
        this.dailySummaryService = dailySummaryService;
        this.objectMapper = objectMapper;
        this.currentUser = currentUser;
    }

    public AppStateResponse read() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return readForUser(principal.familyId(), principal.userId());
    }

    public AppStateResponse readFamily(String familyId) {
        return readForUser(familyId, null);
    }

    public AppStateResponse readForUser(String familyId, String userId) {
        AppStateDto state = new AppStateDto(
                readProfile(familyId),
                readPrivateList(messageService, familyId, userId),
                readList(growthService, familyId),
                readList(growthMeasurementService, familyId),
                readCareLogs(familyId),
                readPrivateList(reminderService, familyId, userId),
                readPrivateList(memoryService, familyId, userId),
                readPrivateList(pendingEffectService, familyId, userId),
                readAlbumItems(familyId),
                readList(expenseItemService, familyId),
                readConversationSummary(familyId, userId),
                null,
                null,
                proTrialNode(familyId, userId),
                dailySummaryNode(familyId, userId, null),
                dailySummarySettingsNode(familyId, userId)
        );
        return new AppStateResponse(isEmpty(state), state);
    }

    private JsonNode proTrialNode(String familyId, String userId) {
        return StringUtils.hasText(userId) ? objectMapper.valueToTree(proTrialService.status(familyId, userId)) : null;
    }

    private JsonNode dailySummaryNode(String familyId, String userId, String date) {
        return StringUtils.hasText(userId) ? objectMapper.valueToTree(dailySummaryService.read(familyId, userId, date)) : null;
    }

    private JsonNode dailySummarySettingsNode(String familyId, String userId) {
        return StringUtils.hasText(userId) ? objectMapper.valueToTree(proTrialService.summarySettings(familyId, userId)) : null;
    }

    @Transactional
    public AppStateResponse replace(AppStateDto state) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        return replace(principal.familyId(), principal.userId(), state);
    }

    @Transactional
    public AppStateResponse replace(String familyId, String userId, AppStateDto state) {
        clearForUser(familyId, userId);
        String now = Instant.now().toString();
        if (state.profile() != null && !state.profile().isNull()) {
            ObjectNode profile = mutable(state.profile(), "profile", PROFILE_ID, familyId, userId);
            BabyProfileRecord record = record(BabyProfileRecord::new, "profile-" + familyId, profile, "profile", "profile", now, familyId, userId);
            profileService.saveOrUpdate(record);
        }
        saveList(messageService, ChatMessageRecord::new, state.messages(), "message", now, familyId, userId);
        saveList(growthService, GrowthEventRecord::new, state.growthEvents(), "growth", now, familyId, userId);
        saveList(growthMeasurementService, GrowthMeasurementRecord::new, state.growthMeasurements(), "growthMeasurement", now, familyId, userId);
        saveList(careLogService, CareLogRecord::new, state.careLogs(), "care", now, familyId, userId);
        saveList(reminderService, ReminderRecord::new, state.reminders(), "reminder", now, familyId, userId);
        saveList(memoryService, MemoryItemRecord::new, state.memories(), "memory", now, familyId, userId);
        saveList(pendingEffectService, PendingEffectRecord::new, state.pendingEffects(), "pending", now, familyId, userId);
        saveList(albumItemService, AlbumItemRecord::new, state.albumItems(), "album", now, familyId, userId);
        saveList(expenseItemService, ExpenseItemRecord::new, state.expenses(), "expense", now, familyId, userId);
        saveConversationSummary(state.conversationSummary(), now, familyId, userId);
        return readForUser(familyId, userId);
    }

    @Transactional
    public AppStateResponse importState(AppStateDto state) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        return replace(principal.familyId(), principal.userId(), state);
    }

    @Transactional
    public AppStateResponse upsertRecord(String collection, String id, JsonNode item, String mode) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        String now = Instant.now().toString();
        switch (collection) {
            case "profile" -> {
                ObjectNode profile = mutable(item, "profile", PROFILE_ID, familyId, userId);
                profileService.saveOrUpdate(record(BabyProfileRecord::new, "profile-" + familyId, profile, "profile", "profile", now, familyId, userId));
            }
            case "messages" -> saveEffectObject(messageService, ChatMessageRecord::new, withId(item, id), "message", now, familyId, userId);
            case "growthEvents" -> saveEffectObject(growthService, GrowthEventRecord::new, withId(item, id), "growth", now, familyId, userId);
            case "growthMeasurements" -> saveEffectObject(growthMeasurementService, GrowthMeasurementRecord::new, withId(item, id), "growthMeasurement", now, familyId, userId);
            case "careLogs" -> {
                if ("replace".equalsIgnoreCase(mode)) {
                    saveCareLogSnapshot(withId(item, id), now, familyId, userId);
                } else {
                    saveCareLogPatch(withId(item, id), now, familyId, userId);
                }
            }
            case "reminders" -> saveEffectObject(reminderService, ReminderRecord::new, withId(item, id), "reminder", now, familyId, userId);
            case "memories" -> saveEffectObject(memoryService, MemoryItemRecord::new, withId(item, id), "memory", now, familyId, userId);
            case "pendingEffects" -> saveEffectObject(pendingEffectService, PendingEffectRecord::new, withId(item, id), "pending", now, familyId, userId);
            case "albumItems" -> saveEffectObject(albumItemService, AlbumItemRecord::new, withId(item, id), "album", now, familyId, userId);
            case "expenses" -> saveEffectObject(expenseItemService, ExpenseItemRecord::new, withId(item, id), "expense", now, familyId, userId);
            case "conversationSummary" -> saveConversationSummary(item, now, familyId, userId);
            default -> throw new IllegalArgumentException("Unsupported state collection: " + collection);
        }
        return readForUser(familyId, userId);
    }

    @Transactional
    public AppStateResponse deleteRecord(String collection, String id) {
        currentUser.requireCaregiver();
        String familyId = currentUser.requireFamilyId();
        String userId = currentUser.requirePrincipal().userId();
        switch (collection) {
            case "messages" -> messageService.remove(privateQuery(ChatMessageRecord.class, familyId, userId).eq("id", id));
            case "growthEvents" -> growthService.remove(familyQuery(GrowthEventRecord.class, familyId).eq("id", id));
            case "growthMeasurements" -> growthMeasurementService.remove(familyQuery(GrowthMeasurementRecord.class, familyId).eq("id", id));
            case "careLogs" -> careLogService.remove(familyQuery(CareLogRecord.class, familyId).eq("id", id));
            case "reminders" -> reminderService.remove(privateQuery(ReminderRecord.class, familyId, userId).eq("id", id));
            case "memories" -> memoryService.remove(privateQuery(MemoryItemRecord.class, familyId, userId).eq("id", id));
            case "pendingEffects" -> pendingEffectService.remove(privateQuery(PendingEffectRecord.class, familyId, userId).eq("id", id));
            case "albumItems" -> albumItemService.remove(familyQuery(AlbumItemRecord.class, familyId).eq("id", id));
            case "expenses" -> expenseItemService.remove(familyQuery(ExpenseItemRecord.class, familyId).eq("id", id));
            case "conversationSummary" -> conversationSummaryService.remove(privateQuery(ConversationSummaryRecord.class, familyId, userId));
            default -> throw new IllegalArgumentException("Unsupported state collection: " + collection);
        }
        return readForUser(familyId, userId);
    }

    @Transactional
    public AppStateResponse deleteAttachment(String id) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        removeAlbumItemsForAttachment(familyId, id);
        removeAttachmentReferencesFromRecords(familyId, id);
        attachmentStorageService.deleteAttachment(id, familyId);
        return readForUser(familyId, userId);
    }

    @Transactional
    public AppStateResponse confirmPendingEffect(String id) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        PendingEffectRecord record = pendingEffectService.getOne(privateQuery(PendingEffectRecord.class, familyId, userId).eq("id", id), false);
        if (record == null) {
            return readForUser(familyId, userId);
        }
        JsonNode effect = parse(record.getPayloadJson());
        String now = Instant.now().toString();
        saveEffectObject(growthService, GrowthEventRecord::new, effect.get("growthEvent"), "growth", now, familyId, userId);
        saveCareLogPatch(effect.get("careLogPatch"), now, familyId, userId);
        saveEffectArray(reminderService, ReminderRecord::new, effect.get("reminders"), "reminder", now, familyId, userId);
        saveEffectArray(memoryService, MemoryItemRecord::new, effect.get("memories"), "memory", now, familyId, userId);
        persistAgentExpenseCandidates(toList(effect.get("expenses")), true, now, familyId, userId);
        pendingEffectService.remove(privateQuery(PendingEffectRecord.class, familyId, userId).eq("id", id));
        return readForUser(familyId, userId);
    }

    @Transactional
    public ExpensePersistenceResult persistAgentExpenseCandidates(List<JsonNode> candidates, boolean shouldSave) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return persistAgentExpenseCandidates(candidates, shouldSave, Instant.now().toString(), principal.familyId(), principal.userId());
    }

    @Transactional
    public ExpensePersistenceResult persistAgentExpenseCandidates(
            List<JsonNode> candidates,
            boolean shouldSave,
            String familyId,
            String userId
    ) {
        return persistAgentExpenseCandidates(candidates, shouldSave, Instant.now().toString(), familyId, userId);
    }

    private ExpensePersistenceResult persistAgentExpenseCandidates(
            List<JsonNode> candidates,
            boolean shouldSave,
            String now,
            String familyId,
            String userId
    ) {
        if (candidates == null || candidates.isEmpty()) return ExpensePersistenceResult.empty();

        List<JsonNode> saved = new ArrayList<>();
        List<JsonNode> duplicates = new ArrayList<>();
        List<JsonNode> needsInput = new ArrayList<>();
        List<JsonNode> readOnly = new ArrayList<>();
        Set<String> existingKeys = existingExpenseDedupeKeys(familyId);
        Set<String> batchKeys = new LinkedHashSet<>();

        int index = 0;
        for (JsonNode candidate : candidates) {
            if (candidate == null || candidate.isNull()) continue;
            ObjectNode payload = expensePayload(candidate);
            normalizeExpenseCategory(payload);
            String dedupeKey = expenseDedupeKey(payload);
            if (StringUtils.hasText(dedupeKey)) {
                payload.put("sourceExpenseKey", dedupeKey);
                payload.put("dedupeKey", dedupeKey);
            }

            if (!completeExpensePayload(payload)) {
                payload.put("persistenceStatus", "needsInput");
                needsInput.add(payload);
                index += 1;
                continue;
            }
            if (!shouldSave) {
                payload.put("persistenceStatus", "readOnly");
                readOnly.add(payload);
                index += 1;
                continue;
            }
            if (StringUtils.hasText(dedupeKey) && (!batchKeys.add(dedupeKey) || existingKeys.contains(dedupeKey))) {
                payload.put("persistenceStatus", "duplicate");
                duplicates.add(payload);
                index += 1;
                continue;
            }

            String id = recordId(payload, "expense", index, true);
            ObjectNode storedPayload = mutable(payload, "expense", id, familyId, userId);
            storedPayload.put("persistenceStatus", "saved");
            ExpenseItemRecord existing = expenseItemService.getOne(new QueryWrapper<ExpenseItemRecord>().eq("family_id", familyId).eq("id", id), false);
            expenseItemService.saveOrUpdate(preserveCreator(record(ExpenseItemRecord::new, id, storedPayload, "expense", sortKey(storedPayload, "expense", index), now, familyId, userId), existing));
            saved.add(storedPayload);
            if (StringUtils.hasText(dedupeKey)) existingKeys.add(dedupeKey);
            index += 1;
        }
        return new ExpensePersistenceResult(saved, duplicates, needsInput, readOnly);
    }

    @Transactional
    public AppStateResponse discardPendingEffect(String id) {
        currentUser.requireCaregiver();
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        pendingEffectService.remove(privateQuery(PendingEffectRecord.class, familyId, userId).eq("id", id));
        return readForUser(familyId, userId);
    }

    @Transactional
    public void claimOwnerlessData(String familyId, String userId) {
        claimOwnerless(profileService, familyId, userId);
        claimOwnerless(messageService, familyId, userId);
        claimOwnerless(growthService, familyId, userId);
        claimOwnerless(careLogService, familyId, userId);
        claimOwnerless(reminderService, familyId, userId);
        claimOwnerless(memoryService, familyId, userId);
        claimOwnerless(pendingEffectService, familyId, userId);
        claimOwnerless(albumItemService, familyId, userId);
        claimOwnerless(expenseItemService, familyId, userId);
        claimOwnerless(conversationSummaryService, familyId, userId);
        UpdateWrapper<AttachmentRecord> attachmentUpdate = new UpdateWrapper<>();
        attachmentUpdate.and((wrapper) -> wrapper.isNull("family_id").or().eq("family_id", ""));
        attachmentUpdate.set("family_id", familyId);
        attachmentUpdate.set("owner_user_id", userId);
        attachmentUpdate.set("created_by_user_id", userId);
        attachmentRecordService.update(attachmentUpdate);
    }

    public boolean isOnboardingRequired(String familyId) {
        JsonNode profile = readProfile(familyId);
        if (profile == null || profile.isNull()) return true;
        return !StringUtils.hasText(text(profile, "nickname", ""));
    }

    private JsonNode readProfile(String familyId) {
        QueryWrapper<BabyProfileRecord> query = familyQuery(BabyProfileRecord.class, familyId);
        query.last("LIMIT 1");
        BabyProfileRecord profile = profileService.getOne(query, false);
        JsonNode payload = profile == null ? null : parse(profile.getPayloadJson());
        if (payload == null || payload.isNull()) return payload;
        List<String> caregivers = familyCaregiverRoles(familyId);
        if (caregivers.isEmpty()) return payload;

        ObjectNode object;
        if (payload instanceof ObjectNode profileObject) {
            object = profileObject.deepCopy();
        } else {
            object = objectMapper.createObjectNode();
        }
        ArrayNode caregiverArray = objectMapper.createArrayNode();
        caregivers.forEach(caregiverArray::add);
        object.set("caregivers", caregiverArray);
        return object;
    }

    private List<String> familyCaregiverRoles(String familyId) {
        if (!StringUtils.hasText(familyId)) return List.of();
        QueryWrapper<AuthFamilyMemberRecord> query = new QueryWrapper<AuthFamilyMemberRecord>()
                .eq("family_id", familyId)
                .eq("is_caregiver", "true")
                .orderByAsc("joined_at");
        Set<String> roles = new LinkedHashSet<>();
        for (AuthFamilyMemberRecord member : familyMemberService.list(query)) {
            String roleName = member.getRoleName() == null ? "" : member.getRoleName().trim();
            if (StringUtils.hasText(roleName) && !"家庭成员".equals(roleName)) {
                roles.add(roleName);
            }
        }
        return new ArrayList<>(roles);
    }

    private JsonNode readConversationSummary(String familyId, String userId) {
        QueryWrapper<ConversationSummaryRecord> query = privateQuery(ConversationSummaryRecord.class, familyId, userId);
        query.last("LIMIT 1");
        ConversationSummaryRecord summary = conversationSummaryService.getOne(query, false);
        return summary == null ? null : parse(summary.getPayloadJson());
    }

    private <T extends AppRecordEntity> List<JsonNode> readList(IService<T> service, String familyId) {
        QueryWrapper<T> query = familyQuery(null, familyId);
        return readRecords(service, query, familyId);
    }

    private <T extends AppRecordEntity> List<JsonNode> readPrivateList(IService<T> service, String familyId, String userId) {
        QueryWrapper<T> query = privateQuery(null, familyId, userId);
        return readRecords(service, query, familyId);
    }

    private <T extends AppRecordEntity> List<JsonNode> readRecords(IService<T> service, QueryWrapper<T> query, String familyId) {
        query.orderByAsc("sort_key").orderByAsc("created_at");
        Map<String, AttachmentDto> attachmentCache = new LinkedHashMap<>();
        Map<String, ObjectNode> contributorCache = new LinkedHashMap<>();
        return service.list(query).stream()
                .map((record) -> hydratedRecordPayload(record, familyId, attachmentCache, contributorCache))
                .toList();
    }

    private <T extends AppRecordEntity> JsonNode hydratedRecordPayload(
            T record,
            String familyId,
            Map<String, AttachmentDto> attachmentCache,
            Map<String, ObjectNode> contributorCache
    ) {
        JsonNode payload = decorateRecordedBy(record, parse(record.getPayloadJson()), familyId, contributorCache);
        return hydrateAttachmentMetadata(payload, familyId, attachmentCache);
    }

    private List<JsonNode> readAlbumItems(String familyId) {
        return new ArrayList<>(readList(albumItemService, familyId));
    }

    private void collectAlbumAttachmentIds(JsonNode node, Set<String> attachmentIds) {
        if (node == null || node.isNull()) return;
        if (node instanceof ObjectNode object) {
            String attachmentId = text(object, "attachmentId", "");
            if (StringUtils.hasText(attachmentId)) attachmentIds.add(attachmentId);
            JsonNode attachment = object.get("attachment");
            if (attachment instanceof ObjectNode attachmentObject) {
                String id = text(attachmentObject, "id", "");
                if (StringUtils.hasText(id)) attachmentIds.add(id);
            }
            object.fields().forEachRemaining((entry) -> collectAlbumAttachmentIds(entry.getValue(), attachmentIds));
        } else if (node.isArray()) {
            for (JsonNode child : node) collectAlbumAttachmentIds(child, attachmentIds);
        }
    }

    private void removeAlbumItemsForAttachment(String familyId, String attachmentId) {
        if (!StringUtils.hasText(attachmentId)) return;
        QueryWrapper<AlbumItemRecord> query = familyQuery(AlbumItemRecord.class, familyId);
        for (AlbumItemRecord record : albumItemService.list(query)) {
            Set<String> attachmentIds = new LinkedHashSet<>();
            collectAlbumAttachmentIds(parse(record.getPayloadJson()), attachmentIds);
            if (attachmentIds.contains(attachmentId)) {
                albumItemService.remove(familyQuery(AlbumItemRecord.class, familyId).eq("id", record.getId()));
            }
        }
    }

    private void removeAttachmentReferencesFromRecords(String familyId, String attachmentId) {
        if (!StringUtils.hasText(attachmentId)) return;
        removeAttachmentReferencesFromRecords(profileService, familyId, attachmentId);
        removeAttachmentReferencesFromRecords(messageService, familyId, attachmentId);
        removeAttachmentReferencesFromRecords(growthService, familyId, attachmentId);
        removeAttachmentReferencesFromRecords(careLogService, familyId, attachmentId);
        removeAttachmentReferencesFromRecords(pendingEffectService, familyId, attachmentId);
        removeAttachmentReferencesFromRecords(expenseItemService, familyId, attachmentId);
    }

    private <T extends AppRecordEntity> void removeAttachmentReferencesFromRecords(IService<T> service, String familyId, String attachmentId) {
        QueryWrapper<T> query = familyQuery(null, familyId);
        String now = Instant.now().toString();
        for (T record : service.list(query)) {
            JsonNode payload = parse(record.getPayloadJson());
            if (!pruneAttachmentReferences(payload, attachmentId)) continue;
            record.setPayloadJson(write(payload));
            record.setUpdatedAt(now);
            service.updateById(record);
        }
    }

    private boolean pruneAttachmentReferences(JsonNode node, String attachmentId) {
        if (node == null || node.isNull()) return false;
        boolean changed = false;
        if (node instanceof ObjectNode object) {
            if (attachmentId.equals(text(object, "attachmentId", ""))) {
                object.remove("attachmentId");
                changed = true;
            }

            JsonNode attachmentIds = object.get("attachmentIds");
            if (attachmentIds instanceof ArrayNode idsArray) {
                for (int index = idsArray.size() - 1; index >= 0; index--) {
                    JsonNode item = idsArray.get(index);
                    if (item.isTextual() && attachmentId.equals(item.asText())) {
                        idsArray.remove(index);
                        changed = true;
                    }
                }
            }

            JsonNode attachment = object.get("attachment");
            if (matchesAttachmentReference(attachment, attachmentId)) {
                object.remove("attachment");
                changed = true;
            }

            JsonNode attachments = object.get("attachments");
            if (attachments instanceof ArrayNode array) {
                for (int index = array.size() - 1; index >= 0; index--) {
                    JsonNode item = array.get(index);
                    if (matchesAttachmentReference(item, attachmentId)) {
                        array.remove(index);
                        changed = true;
                    } else if (pruneAttachmentReferences(item, attachmentId)) {
                        changed = true;
                    }
                }
            }

            List<String> fieldNames = new ArrayList<>();
            object.fieldNames().forEachRemaining(fieldNames::add);
            for (String fieldName : fieldNames) {
                if ("attachment".equals(fieldName) || "attachments".equals(fieldName)
                        || "attachmentId".equals(fieldName) || "attachmentIds".equals(fieldName)) {
                    continue;
                }
                if (pruneAttachmentReferences(object.get(fieldName), attachmentId)) {
                    changed = true;
                }
            }
            return changed;
        }
        if (node instanceof ArrayNode array) {
            for (JsonNode child : array) {
                if (pruneAttachmentReferences(child, attachmentId)) {
                    changed = true;
                }
            }
        }
        return changed;
    }

    private boolean matchesAttachmentReference(JsonNode node, String attachmentId) {
        if (node != null && node.isTextual()) return attachmentId.equals(node.asText());
        if (!(node instanceof ObjectNode object)) return false;
        return attachmentId.equals(text(object, "id", ""))
                || attachmentId.equals(text(object, "attachmentId", ""));
    }

    private List<JsonNode> readCareLogs(String familyId) {
        QueryWrapper<CareLogRecord> query = familyQuery(CareLogRecord.class, familyId);
        query.orderByAsc("sort_key").orderByAsc("created_at");
        Map<String, ObjectNode> byDate = new LinkedHashMap<>();
        Map<String, AttachmentDto> attachmentCache = new LinkedHashMap<>();
        Map<String, ObjectNode> contributorCache = new LinkedHashMap<>();
        for (CareLogRecord record : careLogService.list(query)) {
            JsonNode payload = decorateRecordedBy(record, parse(record.getPayloadJson()), familyId, contributorCache);
            payload = hydrateAttachmentMetadata(payload, familyId, attachmentCache);
            if (!(payload instanceof ObjectNode object)) continue;
            String date = text(object, "date", record.getSortKey());
            ObjectNode existing = byDate.get(date);
            byDate.put(date, existing == null ? object.deepCopy() : mergeCareLogJson(existing, object));
        }
        return new ArrayList<>(byDate.values());
    }

    private <T extends AppRecordEntity> void saveList(
            IService<T> service,
            Supplier<T> supplier,
            List<JsonNode> items,
            String ownerType,
            String now,
            String familyId,
            String userId
    ) {
        if (items == null || items.isEmpty()) return;
        saveList(service, supplier, items, ownerType, now, familyId, userId, false);
    }

    private <T extends AppRecordEntity> void saveList(
            IService<T> service,
            Supplier<T> supplier,
            List<JsonNode> items,
            String ownerType,
            String now,
            String familyId,
            String userId,
            boolean regenerateEffectFallbackIds
    ) {
        if (items == null || items.isEmpty()) return;
        List<T> records = new ArrayList<>();
        List<JsonNode> dedupedItems = dedupeItems(items, ownerType);
        for (int index = 0; index < dedupedItems.size(); index += 1) {
            JsonNode item = dedupedItems.get(index);
            if (item == null || item.isNull()) continue;
            String id = recordId(item, ownerType, index, regenerateEffectFallbackIds);
            ObjectNode payload = mutable(item, ownerType, id, familyId, userId);
            records.add(record(supplier, id, payload, ownerType, sortKey(payload, ownerType, index), now, familyId, userId));
        }
        if (!records.isEmpty()) service.saveOrUpdateBatch(records);
    }

    private <T extends AppRecordEntity> void saveEffectArray(
            IService<T> service,
            Supplier<T> supplier,
            JsonNode node,
            String ownerType,
            String now,
            String familyId,
            String userId
    ) {
        if (!(node instanceof ArrayNode array)) return;
        saveList(service, supplier, toList(array), ownerType, now, familyId, userId, true);
    }

    private <T extends AppRecordEntity> void saveEffectObject(
            IService<T> service,
            Supplier<T> supplier,
            JsonNode node,
            String ownerType,
            String now,
            String familyId,
            String userId
    ) {
        if (node == null || node.isNull()) return;
        String id = recordId(node, ownerType, 0, false);
        ObjectNode payload = mutable(node, ownerType, id, familyId, userId);
        T existing = service.getOne(new QueryWrapper<T>().eq("family_id", familyId).eq("id", id), false);
        service.saveOrUpdate(preserveCreator(record(supplier, id, payload, ownerType, sortKey(payload, ownerType, 0), now, familyId, userId), existing));
    }

    private String recordId(JsonNode item, String ownerType, int index, boolean regenerateEffectFallbackIds) {
        String fallback = regenerateEffectFallbackIds ? generatedRecordId(ownerType) : ownerType + "-" + index;
        String id = text(item, "id", fallback);
        if (regenerateEffectFallbackIds && isGeneratedIndexId(ownerType, id)) {
            return generatedRecordId(ownerType);
        }
        return id;
    }

    private boolean isGeneratedIndexId(String ownerType, String id) {
        return StringUtils.hasText(ownerType)
                && StringUtils.hasText(id)
                && id.matches(ownerType + "-\\d+");
    }

    private String generatedRecordId(String ownerType) {
        return ownerType + "-" + UUID.randomUUID();
    }

    private void saveCareLogPatch(JsonNode patch, String now, String familyId, String userId) {
        if (patch == null || patch.isNull()) return;
        ObjectNode next = mutable(patch, "care", text(patch, "id", "care-" + UUID.randomUUID()), familyId, userId);
        String date = text(next, "date", "");
        if (StringUtils.hasText(date)) {
            List<CareLogRecord> existingRecords = careLogService.list(familyQuery(CareLogRecord.class, familyId).eq("sort_key", date).orderByAsc("created_at"));
            if (!existingRecords.isEmpty()) {
                CareLogRecord primary = existingRecords.get(0);
                ObjectNode merged = objectMapper.createObjectNode();
                for (CareLogRecord existingRecord : existingRecords) {
                    JsonNode payload = parse(existingRecord.getPayloadJson());
                    if (payload instanceof ObjectNode object) {
                        merged = mergeCareLogJson(merged, object);
                    }
                }
                merged = mergeCareLogJson(merged, next);
                List<String> duplicateIds = existingRecords.stream().skip(1).map(CareLogRecord::getId).toList();
                if (!duplicateIds.isEmpty()) {
                    careLogService.remove(familyQuery(CareLogRecord.class, familyId).in("id", duplicateIds));
                }
                merged.put("id", primary.getId());
                careLogService.saveOrUpdate(preserveCreator(record(CareLogRecord::new, primary.getId(), merged, "care", date, now, familyId, userId), primary));
                return;
            }
        }
        String id = text(next, "id", "care-" + UUID.randomUUID());
        CareLogRecord existing = careLogService.getOne(familyQuery(CareLogRecord.class, familyId).eq("id", id), false);
        careLogService.saveOrUpdate(preserveCreator(record(CareLogRecord::new, id, next, "care", sortKey(next, "care", 0), now, familyId, userId), existing));
    }

    private void saveCareLogSnapshot(JsonNode snapshot, String now, String familyId, String userId) {
        if (snapshot == null || snapshot.isNull()) return;
        ObjectNode next = mutable(snapshot, "care", text(snapshot, "id", "care-" + UUID.randomUUID()), familyId, userId);
        String id = text(next, "id", "care-" + UUID.randomUUID());
        String date = text(next, "date", sortKey(next, "care", 0));
        if (StringUtils.hasText(date)) {
            QueryWrapper<CareLogRecord> duplicates = familyQuery(CareLogRecord.class, familyId)
                    .eq("sort_key", date)
                    .ne("id", id);
            careLogService.remove(duplicates);
        }
        CareLogRecord existing = careLogService.getOne(familyQuery(CareLogRecord.class, familyId).eq("id", id), false);
        careLogService.saveOrUpdate(preserveCreator(record(CareLogRecord::new, id, next, "care", date, now, familyId, userId), existing));
    }

    private void saveConversationSummary(JsonNode summary, String now, String familyId, String userId) {
        conversationSummaryService.remove(privateQuery(ConversationSummaryRecord.class, familyId, userId));
        if (summary == null || summary.isNull()) return;
        ObjectNode next = mutable(summary, "conversationSummary", "conversation-summary", familyId, userId);
        next.put("id", "conversation-summary");
        conversationSummaryService.saveOrUpdate(record(
                ConversationSummaryRecord::new,
                "conversation-summary-" + familyId + "-" + userId,
                next,
                "conversationSummary",
                "conversation-summary",
                now,
                familyId,
                userId
        ));
    }

    private ObjectNode mergeCareLogJson(JsonNode existing, ObjectNode patch) {
        ObjectNode merged = existing instanceof ObjectNode object ? object.deepCopy() : objectMapper.createObjectNode();
        patch.fields().forEachRemaining((entry) -> {
            if ("notes".equals(entry.getKey()) || "solids".equals(entry.getKey()) || "events".equals(entry.getKey())) {
                merged.set(entry.getKey(), mergeArrayUnique(entry.getKey(), merged.get(entry.getKey()), entry.getValue()));
            } else if (!entry.getValue().isNull()) {
                merged.set(entry.getKey(), entry.getValue());
            }
        });
        return merged;
    }

    private ArrayNode mergeArrayUnique(String field, JsonNode left, JsonNode right) {
        ArrayNode array = objectMapper.createArrayNode();
        Set<String> signatures = new LinkedHashSet<>();
        appendUniqueArrayItems(field, array, signatures, left);
        appendUniqueArrayItems(field, array, signatures, right);
        return array;
    }

    private void appendUniqueArrayItems(String field, ArrayNode target, Set<String> signatures, JsonNode source) {
        if (!(source instanceof ArrayNode array)) return;
        for (JsonNode item : array) {
            String signature = arrayItemSignature(field, item);
            if (signatures.add(signature)) {
                target.add(item);
            }
        }
    }

    private String arrayItemSignature(String field, JsonNode item) {
        if ("events".equals(field) && item instanceof ObjectNode) {
            return String.join("|",
                    text(item, "type", ""),
                    text(item, "date", ""),
                    text(item, "time", ""),
                    scalarText(item.get("amountMl")),
                    scalarText(item.get("durationHours")),
                    scalarText(item.get("temperature"))
            );
        }
        return item == null ? "" : write(item);
    }

    private String scalarText(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (node.isNumber() || node.isTextual() || node.isBoolean()) return node.asText();
        return write(node);
    }

    private List<JsonNode> toList(ArrayNode array) {
        List<JsonNode> items = new ArrayList<>();
        array.forEach((item) -> items.add(item));
        return items;
    }

    private List<JsonNode> toList(JsonNode node) {
        return node instanceof ArrayNode array ? toList(array) : List.of();
    }

    private ObjectNode expensePayload(JsonNode node) {
        JsonNode copy = node == null ? objectMapper.createObjectNode() : node.deepCopy();
        if (copy instanceof ObjectNode object) return object;
        ObjectNode object = objectMapper.createObjectNode();
        object.set("value", copy);
        return object;
    }

    private boolean completeExpensePayload(ObjectNode payload) {
        return StringUtils.hasText(text(payload, "title", ""))
                && expenseAmount(payload) > 0
                && StringUtils.hasText(text(payload, "date", ""));
    }

    private void normalizeExpenseCategory(ObjectNode payload) {
        String category = text(payload, "category", "");
        if (!EXPENSE_CATEGORIES.contains(category)) {
            category = "";
        }
        if (!StringUtils.hasText(category) || "other".equals(category)) {
            String inferred = expenseCategoryFromText(
                    text(payload, "title", "")
                            + " "
                            + text(payload, "note", "")
                            + " "
                            + text(payload, "brand", "")
                            + " "
                            + text(payload, "spec", "")
            );
            category = StringUtils.hasText(inferred) ? inferred : "other";
        }
        payload.put("category", category);
    }

    private String expenseCategoryFromText(String raw) {
        String value = raw == null ? "" : raw;
        if (value.matches(".*(奶粉|配方奶|水奶|液态奶).*")) return "formula";
        if (value.matches(".*(尿裤|纸尿裤|拉拉裤|尿不湿).*")) return "diaper";
        if (value.matches(".*(辅食|米粉|果泥|肉泥|零食).*")) return "food";
        if (value.matches(".*(月子鞋|月子服|孕妇装|哺乳衣|衣服|裤子|帽子|袜|鞋|围兜|睡袋).*")) return "clothing";
        if (value.matches(".*(玩具|绘本|摇铃|积木).*")) return "toy";
        if (value.matches(".*(疫苗|接种).*")) return "vaccine";
        if (value.matches(".*(体检|挂号|医院|药|护理|退烧|体温计|检查).*")) return "health";
        if (value.matches(".*(摇奶器|恒温壶|奶瓶|奶瓶刷|消毒柜|消毒器|温奶器|吸奶器|湿巾|棉柔巾|洗护|沐浴|润肤|日用|洗衣机).*")) return "daily";
        if (value.matches(".*(早教|课程|摄影|游泳|娱乐).*")) return "education";
        return "other";
    }

    private Set<String> existingExpenseDedupeKeys(String familyId) {
        Set<String> keys = new LinkedHashSet<>();
        for (ExpenseItemRecord record : expenseItemService.list(familyQuery(ExpenseItemRecord.class, familyId))) {
            JsonNode payload = parse(record.getPayloadJson());
            addKey(keys, text(payload, "sourceExpenseKey", ""));
            addKey(keys, text(payload, "dedupeKey", ""));
            if (payload instanceof ObjectNode object) addKey(keys, expenseDedupeKey(object));
        }
        return keys;
    }

    private void addKey(Set<String> keys, String key) {
        if (StringUtils.hasText(key)) keys.add(key);
    }

    private String expenseDedupeKey(ObjectNode payload) {
        String date = text(payload, "date", "");
        double amount = expenseAmount(payload);
        String title = normalizedExpenseText(text(payload, "title", ""));
        String merchant = normalizedExpenseText(text(payload, "merchant", ""));
        String attachments = normalizedAttachmentIds(payload.get("attachmentIds"));
        if (!StringUtils.hasText(date) || amount <= 0 || !StringUtils.hasText(title)) return "";
        return String.join("|", date, String.format(Locale.ROOT, "%.2f", Math.round(amount * 100.0) / 100.0), title, merchant, attachments);
    }

    private String normalizedAttachmentIds(JsonNode node) {
        if (!(node instanceof ArrayNode array)) return "";
        List<String> values = new ArrayList<>();
        for (JsonNode item : array) {
            if (item != null && item.isTextual() && StringUtils.hasText(item.asText())) {
                values.add(item.asText().trim());
            }
        }
        values.sort(String::compareTo);
        return String.join(",", values);
    }

    private String normalizedExpenseText(String value) {
        if (!StringUtils.hasText(value)) return "";
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[\\s　,，.。:：;；、/\\\\()（）\\[\\]【】\"'“”‘’]+", "")
                .trim();
    }

    private double expenseAmount(JsonNode payload) {
        JsonNode value = payload == null ? null : payload.get("amount");
        if (value == null || value.isNull()) return 0;
        if (value.isNumber()) return value.asDouble();
        if (value.isTextual()) {
            try {
                return Double.parseDouble(value.asText().trim());
            } catch (NumberFormatException ignored) {
                return 0;
            }
        }
        return 0;
    }

    private JsonNode withId(JsonNode item, String id) {
        if (!(item instanceof ObjectNode object)) return item;
        if (StringUtils.hasText(id) && !StringUtils.hasText(text(object, "id", ""))) {
            object.put("id", id);
        }
        return object;
    }

    private <T extends AppRecordEntity> T record(
            Supplier<T> supplier,
            String id,
            ObjectNode payload,
            String ownerType,
            String sortKey,
            String now,
            String familyId,
            String userId
    ) {
        T record = supplier.get();
        record.setId(id);
        record.setPayloadJson(write(payload));
        record.setRole(text(payload, "role", null));
        record.setStatus(text(payload, "status", null));
        record.setSortKey(sortKey);
        record.setOwnerUserId(userId);
        record.setFamilyId(familyId);
        record.setCreatedByUserId(userId);
        record.setCreatedAt(text(payload, "createdAt", now));
        record.setUpdatedAt(text(payload, "updatedAt", now));
        persistAttachmentMetadata(payload, ownerType, id, familyId, userId);
        return record;
    }

    private ObjectNode mutable(JsonNode node, String ownerType, String ownerId, String familyId, String userId) {
        JsonNode copy = node.deepCopy();
        ObjectNode objectNode;
        if (copy instanceof ObjectNode object) {
            objectNode = object;
        } else {
            objectNode = objectMapper.createObjectNode();
            objectNode.set("value", copy);
        }
        if (!"profile".equals(ownerType)) {
            objectNode.put("id", ownerId);
        }
        objectNode.remove(List.of("recordedBy", "createdByUserId"));
        normalizeAttachments(objectNode, ownerType, ownerId, familyId, userId);
        return objectNode;
    }

    private <T extends AppRecordEntity> T preserveCreator(T next, T existing) {
        if (existing == null) return next;
        if (StringUtils.hasText(existing.getCreatedByUserId())) {
            next.setCreatedByUserId(existing.getCreatedByUserId());
        }
        return next;
    }

    private <T extends AppRecordEntity> JsonNode decorateRecordedBy(T record, JsonNode node, String familyId, Map<String, ObjectNode> contributorCache) {
        if (!(node instanceof ObjectNode object)) return node;
        String userId = StringUtils.hasText(record.getCreatedByUserId())
                ? record.getCreatedByUserId()
                : record.getOwnerUserId();
        if (!StringUtils.hasText(userId)) return node;
        ObjectNode contributor = contributorNode(familyId, userId, contributorCache);
        object.put("createdByUserId", userId);
        object.set("recordedBy", contributor.deepCopy());
        JsonNode events = object.get("events");
        if (events instanceof ArrayNode array) {
            for (JsonNode event : array) {
                if (event instanceof ObjectNode eventObject && !eventObject.has("recordedBy")) {
                    eventObject.put("createdByUserId", userId);
                    eventObject.set("recordedBy", contributor.deepCopy());
                }
            }
        }
        return object;
    }

    private ObjectNode contributorNode(String familyId, String userId, Map<String, ObjectNode> contributorCache) {
        String cacheKey = familyId + ":" + userId;
        ObjectNode cached = contributorCache.get(cacheKey);
        if (cached != null) return cached;

        AuthFamilyMemberRecord member = familyMemberService.getOne(new QueryWrapper<AuthFamilyMemberRecord>()
                .eq("family_id", familyId)
                .eq("user_id", userId)
                .last("LIMIT 1"), false);
        String roleName = member == null ? "" : member.getRoleName();
        if (!StringUtils.hasText(roleName)) roleName = "家庭成员";
        ObjectNode node = objectMapper.createObjectNode();
        node.put("userId", userId);
        node.put("roleName", roleName);
        node.put("label", roleName);
        node.put("caregiver", member != null && "true".equalsIgnoreCase(member.getIsCaregiver()));
        contributorCache.put(cacheKey, node);
        return node;
    }

    private JsonNode hydrateAttachmentMetadata(JsonNode node, String familyId, Map<String, AttachmentDto> attachmentCache) {
        if (node == null) return null;
        if (node instanceof ObjectNode object) {
            hydrateAttachmentReferenceFields(object, familyId, attachmentCache);
            hydrateSingleAttachment(object, familyId, attachmentCache);
            object.fields().forEachRemaining((entry) -> hydrateAttachmentMetadata(entry.getValue(), familyId, attachmentCache));
        } else if (node.isArray()) {
            for (JsonNode child : node) hydrateAttachmentMetadata(child, familyId, attachmentCache);
        }
        return node;
    }

    private void hydrateAttachmentReferenceFields(ObjectNode object, String familyId, Map<String, AttachmentDto> attachmentCache) {
        String attachmentId = text(object, "attachmentId", "");
        if (StringUtils.hasText(attachmentId)) {
            AttachmentDto attachment = attachmentById(attachmentId, familyId, attachmentCache);
            if (attachment != null) object.set("attachment", attachmentNode(attachment));
        }

        JsonNode attachmentIds = object.get("attachmentIds");
        if (!(attachmentIds instanceof ArrayNode idsArray)) return;
        ArrayNode attachments = objectMapper.createArrayNode();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode item : idsArray) {
            if (!item.isTextual()) continue;
            String id = item.asText();
            if (!StringUtils.hasText(id) || !seen.add(id)) continue;
            AttachmentDto attachment = attachmentById(id, familyId, attachmentCache);
            if (attachment != null) attachments.add(attachmentNode(attachment));
        }
        object.set("attachments", attachments);
    }

    private AttachmentDto attachmentById(String id, String familyId, Map<String, AttachmentDto> attachmentCache) {
        String cacheKey = familyId + ":" + id;
        if (attachmentCache.containsKey(cacheKey)) {
            return attachmentCache.get(cacheKey);
        }
        AttachmentDto attachment = attachmentStorageService.metadata(id, familyId);
        attachmentCache.put(cacheKey, attachment);
        return attachment;
    }

    private ObjectNode attachmentNode(AttachmentDto attachment) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", attachment.id());
        node.put("name", attachment.name());
        node.put("kind", attachment.kind());
        if (StringUtils.hasText(attachment.mimeType())) node.put("mimeType", attachment.mimeType());
        if (StringUtils.hasText(attachment.filePath())) node.put("filePath", attachment.filePath());
        if (StringUtils.hasText(attachment.publicUrl())) node.put("publicUrl", attachment.publicUrl());
        if (StringUtils.hasText(attachment.url())) node.put("url", attachment.url());
        if (StringUtils.hasText(attachment.thumbnailPath())) node.put("thumbnailPath", attachment.thumbnailPath());
        if (StringUtils.hasText(attachment.thumbnailUrl())) node.put("thumbnailUrl", attachment.thumbnailUrl());
        if (StringUtils.hasText(attachment.createdAt())) node.put("createdAt", attachment.createdAt());
        return node;
    }

    private void hydrateSingleAttachment(ObjectNode object, String familyId, Map<String, AttachmentDto> attachmentCache) {
        String id = text(object, "id", "");
        String kind = text(object, "kind", "");
        if (!StringUtils.hasText(id) || !ATTACHMENT_KINDS.contains(kind)) return;
        AttachmentDto attachment = attachmentById(id, familyId, attachmentCache);
        if (attachment == null) return;
        if (!StringUtils.hasText(text(object, "name", ""))) object.put("name", attachment.name());
        if (!StringUtils.hasText(text(object, "mimeType", ""))) object.put("mimeType", attachment.mimeType());
        if (StringUtils.hasText(attachment.filePath())) object.put("filePath", attachment.filePath());
        if (StringUtils.hasText(attachment.publicUrl())) object.put("publicUrl", attachment.publicUrl());
        if (StringUtils.hasText(attachment.url())) object.put("url", attachment.url());
        if (StringUtils.hasText(attachment.thumbnailPath())) {
            object.put("thumbnailPath", attachment.thumbnailPath());
        } else {
            object.remove("thumbnailPath");
        }
        if (StringUtils.hasText(attachment.thumbnailUrl())) {
            object.put("thumbnailUrl", attachment.thumbnailUrl());
        } else {
            object.remove("thumbnailUrl");
        }
    }

    private void normalizeAttachments(JsonNode node, String ownerType, String ownerId, String familyId, String userId) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode object = (ObjectNode) node;
            JsonNode attachments = object.get("attachments");
            if (attachments instanceof ArrayNode array) {
                for (JsonNode item : array) {
                    if (item instanceof ObjectNode attachment) {
                        normalizeAttachment(attachment, ownerType, ownerId, familyId, userId);
                    }
                }
            }
            object.fields().forEachRemaining((entry) -> normalizeAttachments(entry.getValue(), ownerType, ownerId, familyId, userId));
        } else if (node.isArray()) {
            for (JsonNode child : node) normalizeAttachments(child, ownerType, ownerId, familyId, userId);
        }
    }

    private void normalizeAttachment(ObjectNode attachment, String ownerType, String ownerId, String familyId, String userId) {
        String id = text(attachment, "id", "attachment-" + ownerId + "-" + System.nanoTime());
        String name = text(attachment, "name", id);
        String kind = text(attachment, "kind", "image");
        String dataUrl = text(attachment, "dataUrl", "");
        if (StringUtils.hasText(dataUrl)) {
            AttachmentDto saved = attachmentStorageService.saveDataUrlAttachment(id, name, kind, dataUrl, ownerType, ownerId, familyId, userId);
            attachment.remove("dataUrl");
            attachment.put("id", saved.id());
            attachment.put("name", saved.name());
            attachment.put("kind", saved.kind());
            attachment.put("mimeType", saved.mimeType());
            attachment.put("filePath", saved.filePath());
            attachment.put("publicUrl", saved.publicUrl());
            if (StringUtils.hasText(saved.thumbnailPath())) attachment.put("thumbnailPath", saved.thumbnailPath());
            if (StringUtils.hasText(saved.thumbnailUrl())) attachment.put("thumbnailUrl", saved.thumbnailUrl());
            attachment.put("url", saved.url());
            return;
        }
        persistAttachmentMetadata(attachment, ownerType, ownerId, familyId, userId);
    }

    private void persistAttachmentMetadata(JsonNode node, String ownerType, String ownerId, String familyId, String userId) {
        if (!(node instanceof ObjectNode object)) return;
        if (!StringUtils.hasText(text(object, "filePath", "")) && !StringUtils.hasText(text(object, "publicUrl", ""))) return;

        String id = text(object, "id", "attachment-" + ownerId);
        AttachmentRecord existing = attachmentRecordService.getOne(new QueryWrapper<AttachmentRecord>()
                .eq("id", id)
                .eq("family_id", familyId), false);
        AttachmentRecord record = new AttachmentRecord();
        record.setId(id);
        record.setName(preservedAttachmentField(existing, AttachmentRecord::getName, object, "name", id));
        record.setKind(preservedAttachmentField(existing, AttachmentRecord::getKind, object, "kind", "image"));
        record.setMimeType(preservedAttachmentField(existing, AttachmentRecord::getMimeType, object, "mimeType", ""));
        record.setFilePath(preservedAttachmentField(existing, AttachmentRecord::getFilePath, object, "filePath", ""));
        record.setPublicUrl(preservedAttachmentField(existing, AttachmentRecord::getPublicUrl, object, "publicUrl", text(object, "url", "/api/uploads/" + id)));
        record.setThumbnailPath(preservedAttachmentField(existing, AttachmentRecord::getThumbnailPath, object, "thumbnailPath", ""));
        record.setThumbnailUrl(preservedAttachmentField(existing, AttachmentRecord::getThumbnailUrl, object, "thumbnailUrl", ""));
        record.setOwnerType(ownerType);
        record.setOwnerId(ownerId);
        record.setOwnerUserId(preservedAttachmentValue(existing, AttachmentRecord::getOwnerUserId, userId));
        record.setFamilyId(familyId);
        record.setCreatedByUserId(preservedAttachmentValue(existing, AttachmentRecord::getCreatedByUserId, userId));
        record.setCreatedAt(preservedAttachmentField(existing, AttachmentRecord::getCreatedAt, object, "createdAt", Instant.now().toString()));
        record.setPayloadJson(write(attachmentRecordPayload(record)));
        attachmentRecordService.saveOrUpdate(record);
    }

    private String preservedAttachmentField(
            AttachmentRecord existing,
            Function<AttachmentRecord, String> existingValue,
            ObjectNode object,
            String field,
            String fallback
    ) {
        return preservedAttachmentValue(existing, existingValue, text(object, field, fallback));
    }

    private String preservedAttachmentValue(AttachmentRecord existing, Function<AttachmentRecord, String> existingValue, String fallback) {
        String value = existing == null ? null : existingValue.apply(existing);
        return StringUtils.hasText(value) ? value : fallback;
    }

    private ObjectNode attachmentRecordPayload(AttachmentRecord record) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("id", record.getId());
        payload.put("name", record.getName());
        payload.put("kind", record.getKind());
        payload.put("mimeType", record.getMimeType());
        payload.put("filePath", record.getFilePath());
        payload.put("publicUrl", record.getPublicUrl());
        payload.put("url", record.getPublicUrl());
        if (StringUtils.hasText(record.getThumbnailPath())) payload.put("thumbnailPath", record.getThumbnailPath());
        if (StringUtils.hasText(record.getThumbnailUrl())) payload.put("thumbnailUrl", record.getThumbnailUrl());
        return payload;
    }

    private void clear(String familyId) {
        profileService.remove(familyQuery(BabyProfileRecord.class, familyId));
        messageService.remove(familyQuery(ChatMessageRecord.class, familyId));
        growthService.remove(familyQuery(GrowthEventRecord.class, familyId));
        growthMeasurementService.remove(familyQuery(GrowthMeasurementRecord.class, familyId));
        careLogService.remove(familyQuery(CareLogRecord.class, familyId));
        reminderService.remove(familyQuery(ReminderRecord.class, familyId));
        memoryService.remove(familyQuery(MemoryItemRecord.class, familyId));
        pendingEffectService.remove(familyQuery(PendingEffectRecord.class, familyId));
        albumItemService.remove(familyQuery(AlbumItemRecord.class, familyId));
        expenseItemService.remove(familyQuery(ExpenseItemRecord.class, familyId));
        conversationSummaryService.remove(familyQuery(ConversationSummaryRecord.class, familyId));
        attachmentRecordService.remove(new QueryWrapper<AttachmentRecord>().eq("family_id", familyId));
    }

    private void clearForUser(String familyId, String userId) {
        profileService.remove(familyQuery(BabyProfileRecord.class, familyId));
        growthService.remove(familyQuery(GrowthEventRecord.class, familyId));
        growthMeasurementService.remove(familyQuery(GrowthMeasurementRecord.class, familyId));
        careLogService.remove(familyQuery(CareLogRecord.class, familyId));
        albumItemService.remove(familyQuery(AlbumItemRecord.class, familyId));
        expenseItemService.remove(familyQuery(ExpenseItemRecord.class, familyId));
        messageService.remove(privateQuery(ChatMessageRecord.class, familyId, userId));
        reminderService.remove(privateQuery(ReminderRecord.class, familyId, userId));
        memoryService.remove(privateQuery(MemoryItemRecord.class, familyId, userId));
        pendingEffectService.remove(privateQuery(PendingEffectRecord.class, familyId, userId));
        conversationSummaryService.remove(privateQuery(ConversationSummaryRecord.class, familyId, userId));
        QueryWrapper<AttachmentRecord> attachments = new QueryWrapper<AttachmentRecord>()
                .eq("family_id", familyId)
                .and((wrapper) -> wrapper
                        .in("owner_type", SHARED_ATTACHMENT_OWNER_TYPES)
                        .or()
                        .eq("owner_user_id", userId));
        attachmentRecordService.remove(attachments);
    }

    private <T extends AppRecordEntity> void claimOwnerless(IService<T> service, String familyId, String userId) {
        UpdateWrapper<T> update = new UpdateWrapper<>();
        update.and((wrapper) -> wrapper.isNull("family_id").or().eq("family_id", ""));
        update.set("family_id", familyId);
        update.set("owner_user_id", userId);
        update.set("created_by_user_id", userId);
        service.update(update);
    }

    private <T extends AppRecordEntity> QueryWrapper<T> familyQuery(Class<T> ignored, String familyId) {
        return new QueryWrapper<T>().eq("family_id", familyId);
    }

    private <T extends AppRecordEntity> QueryWrapper<T> privateQuery(Class<T> ignored, String familyId, String userId) {
        QueryWrapper<T> query = familyQuery(ignored, familyId);
        if (StringUtils.hasText(userId)) {
            query.eq("owner_user_id", userId);
        } else {
            query.and((wrapper) -> wrapper.isNull("owner_user_id").or().eq("owner_user_id", ""));
        }
        return query;
    }

    private List<JsonNode> dedupeItems(List<JsonNode> items, String ownerType) {
        Map<String, JsonNode> byId = new LinkedHashMap<>();
        int anonymousIndex = 0;
        for (JsonNode item : items) {
            if (item == null || item.isNull()) continue;
            JsonNode copy = item.deepCopy();
            ObjectNode object;
            if (copy instanceof ObjectNode existing) {
                object = existing;
            } else {
                object = objectMapper.createObjectNode();
                object.set("value", copy);
            }
            String id = text(object, "id", "");
            if (!StringUtils.hasText(id)) {
                id = ownerType + "-" + anonymousIndex + "-" + UUID.randomUUID();
                object.put("id", id);
            }
            byId.put(id, object);
            anonymousIndex += 1;
        }
        return new ArrayList<>(byId.values());
    }

    private boolean isEmpty(AppStateDto state) {
        return state.profile() == null
                && empty(state.messages())
                && empty(state.growthEvents())
                && empty(state.growthMeasurements())
                && empty(state.careLogs())
                && empty(state.reminders())
                && empty(state.memories())
                && empty(state.pendingEffects())
                && empty(state.albumItems())
                && empty(state.expenses())
                && (state.conversationSummary() == null || state.conversationSummary().isNull());
    }

    private boolean empty(List<?> items) {
        return items == null || items.isEmpty();
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to parse stored app state", exception);
        }
    }

    private String write(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize app state", exception);
        }
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && StringUtils.hasText(value.asText()) ? value.asText() : fallback;
    }

    private String sortKey(JsonNode node, String ownerType, int index) {
        return switch (ownerType) {
            case "message" -> text(node, "createdAt", "%08d".formatted(index));
            case "growth", "care" -> text(node, "date", "%08d".formatted(index));
            case "reminder" -> text(node, "createdAt", "%08d".formatted(index));
            case "memory" -> text(node, "updatedAt", "%08d".formatted(index));
            case "pending" -> text(node, "createdAt", "%08d".formatted(index));
            case "album" -> text(node, "occurredAt", text(node, "date", "%08d".formatted(index)));
            case "expense" -> text(node, "date", text(node, "createdAt", "%08d".formatted(index)));
            case "conversationSummary" -> text(node, "updatedAt", "%08d".formatted(index));
            default -> "%08d".formatted(index);
        };
    }
}
