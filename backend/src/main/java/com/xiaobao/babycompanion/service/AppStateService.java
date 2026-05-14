package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
import com.xiaobao.babycompanion.persistence.service.MemoryItemRecordService;
import com.xiaobao.babycompanion.persistence.service.PendingEffectRecordService;
import com.xiaobao.babycompanion.persistence.service.ReminderRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AppStateService {

    private static final String PROFILE_ID = "default";

    private final BabyProfileRecordService profileService;
    private final ChatMessageRecordService messageService;
    private final GrowthEventRecordService growthService;
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
    public AppStateResponse upsertRecord(String collection, String id, JsonNode item) {
        return upsertRecord(collection, id, item, "merge");
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
        saveEffectArray(expenseItemService, ExpenseItemRecord::new, effect.get("expenses"), "expense", now, familyId, userId);
        pendingEffectService.remove(privateQuery(PendingEffectRecord.class, familyId, userId).eq("id", id));
        return readForUser(familyId, userId);
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
        query.orderByAsc("sort_key").orderByAsc("created_at");
        Map<String, AttachmentDto> attachmentCache = new LinkedHashMap<>();
        return service.list(query).stream()
                .map((record) -> hydrateAttachmentMetadata(parse(record.getPayloadJson()), familyId, attachmentCache))
                .toList();
    }

    private <T extends AppRecordEntity> List<JsonNode> readPrivateList(IService<T> service, String familyId, String userId) {
        QueryWrapper<T> query = privateQuery(null, familyId, userId);
        query.orderByAsc("sort_key").orderByAsc("created_at");
        Map<String, AttachmentDto> attachmentCache = new LinkedHashMap<>();
        return service.list(query).stream()
                .map((record) -> hydrateAttachmentMetadata(parse(record.getPayloadJson()), familyId, attachmentCache))
                .toList();
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
                if ("attachment".equals(fieldName) || "attachments".equals(fieldName)) continue;
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
        if (!(node instanceof ObjectNode object)) return false;
        return attachmentId.equals(text(object, "id", ""))
                || attachmentId.equals(text(object, "attachmentId", ""));
    }

    private List<JsonNode> readCareLogs(String familyId) {
        QueryWrapper<CareLogRecord> query = familyQuery(CareLogRecord.class, familyId);
        query.orderByAsc("sort_key").orderByAsc("created_at");
        Map<String, ObjectNode> byDate = new LinkedHashMap<>();
        for (CareLogRecord record : careLogService.list(query)) {
            JsonNode payload = parse(record.getPayloadJson());
            payload = hydrateAttachmentMetadata(payload, familyId, new LinkedHashMap<>());
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
        List<T> records = new ArrayList<>();
        List<JsonNode> dedupedItems = dedupeItems(items, ownerType);
        for (int index = 0; index < dedupedItems.size(); index += 1) {
            JsonNode item = dedupedItems.get(index);
            if (item == null || item.isNull()) continue;
            String id = text(item, "id", ownerType + "-" + index);
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
        saveList(service, supplier, toList(array), ownerType, now, familyId, userId);
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
        String id = text(node, "id", ownerType + "-0");
        ObjectNode payload = mutable(node, ownerType, id, familyId, userId);
        service.saveOrUpdate(record(supplier, id, payload, ownerType, sortKey(payload, ownerType, 0), now, familyId, userId));
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
                careLogService.saveOrUpdate(record(CareLogRecord::new, primary.getId(), merged, "care", date, now, familyId, userId));
                return;
            }
        }
        String id = text(next, "id", "care-" + UUID.randomUUID());
        careLogService.saveOrUpdate(record(CareLogRecord::new, id, next, "care", sortKey(next, "care", 0), now, familyId, userId));
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
        careLogService.saveOrUpdate(record(CareLogRecord::new, id, next, "care", date, now, familyId, userId));
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
        if (!StringUtils.hasText(text(objectNode, "id", "")) && !"profile".equals(ownerType)) {
            objectNode.put("id", ownerId);
        }
        normalizeAttachments(objectNode, ownerType, ownerId, familyId, userId);
        return objectNode;
    }

    private JsonNode hydrateAttachmentMetadata(JsonNode node, String familyId, Map<String, AttachmentDto> attachmentCache) {
        if (node == null) return null;
        if (node instanceof ObjectNode object) {
            hydrateSingleAttachment(object, familyId, attachmentCache);
            object.fields().forEachRemaining((entry) -> hydrateAttachmentMetadata(entry.getValue(), familyId, attachmentCache));
        } else if (node.isArray()) {
            for (JsonNode child : node) hydrateAttachmentMetadata(child, familyId, attachmentCache);
        }
        return node;
    }

    private void hydrateSingleAttachment(ObjectNode object, String familyId, Map<String, AttachmentDto> attachmentCache) {
        String id = text(object, "id", "");
        String kind = text(object, "kind", "");
        if (!StringUtils.hasText(id) || !List.of("image", "video", "audio").contains(kind)) return;
        String cacheKey = familyId + ":" + id;
        AttachmentDto attachment;
        if (attachmentCache.containsKey(cacheKey)) {
            attachment = attachmentCache.get(cacheKey);
        } else {
            attachment = attachmentStorageService.metadata(id, familyId);
            attachmentCache.put(cacheKey, attachment);
        }
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
        record.setName(existing != null && StringUtils.hasText(existing.getName()) ? existing.getName() : text(object, "name", id));
        record.setKind(existing != null && StringUtils.hasText(existing.getKind()) ? existing.getKind() : text(object, "kind", "image"));
        record.setMimeType(existing != null && StringUtils.hasText(existing.getMimeType()) ? existing.getMimeType() : text(object, "mimeType", ""));
        record.setFilePath(existing != null && StringUtils.hasText(existing.getFilePath()) ? existing.getFilePath() : text(object, "filePath", ""));
        record.setPublicUrl(existing != null && StringUtils.hasText(existing.getPublicUrl()) ? existing.getPublicUrl() : text(object, "publicUrl", text(object, "url", "/api/uploads/" + id)));
        record.setThumbnailPath(existing != null && StringUtils.hasText(existing.getThumbnailPath()) ? existing.getThumbnailPath() : text(object, "thumbnailPath", ""));
        record.setThumbnailUrl(existing != null && StringUtils.hasText(existing.getThumbnailUrl()) ? existing.getThumbnailUrl() : text(object, "thumbnailUrl", ""));
        record.setOwnerType(ownerType);
        record.setOwnerId(ownerId);
        record.setOwnerUserId(existing != null && StringUtils.hasText(existing.getOwnerUserId()) ? existing.getOwnerUserId() : userId);
        record.setFamilyId(familyId);
        record.setCreatedByUserId(existing != null && StringUtils.hasText(existing.getCreatedByUserId()) ? existing.getCreatedByUserId() : userId);
        record.setCreatedAt(existing != null && StringUtils.hasText(existing.getCreatedAt()) ? existing.getCreatedAt() : text(object, "createdAt", Instant.now().toString()));
        record.setPayloadJson(write(attachmentRecordPayload(record)));
        attachmentRecordService.saveOrUpdate(record);
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
                        .in("owner_type", List.of("profile", "growth", "care", "album", "expense"))
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
