package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.pro.DailySummarySettingsDto;
import com.xiaobao.babycompanion.dto.pro.ProTrialApplicationDto;
import com.xiaobao.babycompanion.dto.pro.ProTrialEntitlementDto;
import com.xiaobao.babycompanion.dto.pro.ProTrialStatusDto;
import com.xiaobao.babycompanion.dto.pro.UpdateDailySummarySettingsRequest;
import com.xiaobao.babycompanion.exception.ForbiddenException;
import com.xiaobao.babycompanion.persistence.entity.DailySummarySettingRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialApplicationRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialEntitlementRecord;
import com.xiaobao.babycompanion.persistence.service.DailySummarySettingRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialApplicationRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialEntitlementRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ProTrialService {

    public static final String DEFAULT_REMINDER_TIME = "21:30";

    private final ProTrialApplicationRecordService applicationService;
    private final ProTrialEntitlementRecordService entitlementService;
    private final DailySummarySettingRecordService settingService;
    private final CurrentUser currentUser;
    private final ObjectMapper objectMapper;

    public ProTrialService(
            ProTrialApplicationRecordService applicationService,
            ProTrialEntitlementRecordService entitlementService,
            DailySummarySettingRecordService settingService,
            CurrentUser currentUser,
            ObjectMapper objectMapper
    ) {
        this.applicationService = applicationService;
        this.entitlementService = entitlementService;
        this.settingService = settingService;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
    }

    public ProTrialStatusDto currentStatus() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return status(principal.familyId(), principal.userId());
    }

    public ProTrialStatusDto status(String familyId, String userId) {
        ProTrialEntitlementRecord entitlement = entitlement(familyId);
        boolean enabled = entitlementEnabled(entitlement);
        ProTrialApplicationRecord application = application(familyId, userId);
        return new ProTrialStatusDto(
                enabled,
                entitlement == null ? new ProTrialEntitlementDto(false, null, null, null) : entitlementDto(entitlement, enabled),
                application == null ? null : applicationDto(application),
                enabled ? "本家庭已开通 Pro 内测" : "申请 Pro 内测后，可体验少输入、少遗漏、自动整理。"
        );
    }

    /**
     * Validation phase: all families have Pro access by default.
     * To re-enable Pro gating, change the body to: {@code return isProEnabledByEntitlement(familyId);}
     * See docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md §4.2
     */
    public boolean isProEnabled(String familyId) {
        return true;
    }

    @SuppressWarnings("unused")
    private boolean isProEnabledByEntitlement(String familyId) {
        return entitlementEnabled(entitlement(familyId));
    }

    /**
     * Validation phase: no-op. See isProEnabled() Javadoc.
     */
    public void requireProCaregiver(String familyId) {
        currentUser.requireCaregiver();
        // Pro gating bypassed during validation phase.
    }

    @SuppressWarnings("unused")
    private void requireProCaregiverByEntitlement(String familyId) {
        if (!isProEnabledByEntitlement(familyId)) {
            throw new ForbiddenException("当前家庭还没有开通 Pro 内测，先申请后再使用今日小结。");
        }
    }

    @Transactional
    public ProTrialStatusDto submitApplication(String source) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        ProTrialApplicationRecord existing = application(familyId, userId);
        String now = Instant.now().toString();
        if (existing == null) {
            existing = new ProTrialApplicationRecord();
            existing.setId("pro-app-" + UUID.randomUUID());
            existing.setFamilyId(familyId);
            existing.setUserId(userId);
            existing.setPhone(principal.phone());
            existing.setStatus("pending");
            existing.setCreatedAt(now);
        }
        existing.setSource(StringUtils.hasText(source) ? source.trim() : "app");
        existing.setUpdatedAt(now);
        applicationService.saveOrUpdate(existing);
        return status(familyId, userId);
    }

    public DailySummarySettingsDto currentSummarySettings() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return summarySettings(principal.familyId(), principal.userId());
    }

    public DailySummarySettingsDto summarySettings(String familyId, String userId) {
        DailySummarySettingRecord record = setting(familyId, userId);
        if (record == null) return new DailySummarySettingsDto(true, DEFAULT_REMINDER_TIME, List.of());
        return new DailySummarySettingsDto(
                !"false".equalsIgnoreCase(record.getEnabled()),
                StringUtils.hasText(record.getReminderTime()) ? record.getReminderTime() : DEFAULT_REMINDER_TIME,
                parseMutedTypes(record.getMutedMissingTypes())
        );
    }

    @Transactional
    public DailySummarySettingsDto updateSummarySettings(UpdateDailySummarySettingsRequest request) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        String familyId = principal.familyId();
        String userId = principal.userId();
        DailySummarySettingRecord record = setting(familyId, userId);
        String now = Instant.now().toString();
        if (record == null) {
            record = new DailySummarySettingRecord();
            record.setId("daily-summary-setting-" + familyId + "-" + userId);
            record.setFamilyId(familyId);
            record.setUserId(userId);
            record.setCreatedAt(now);
        }
        if (request.enabled() != null) {
            record.setEnabled(Boolean.TRUE.equals(request.enabled()) ? "true" : "false");
        } else if (!StringUtils.hasText(record.getEnabled())) {
            record.setEnabled("true");
        }
        if (StringUtils.hasText(request.reminderTime())) {
            record.setReminderTime(normalizeReminderTime(request.reminderTime()));
        } else if (!StringUtils.hasText(record.getReminderTime())) {
            record.setReminderTime(DEFAULT_REMINDER_TIME);
        }
        if (request.mutedMissingTypes() != null) {
            record.setMutedMissingTypes(writeList(request.mutedMissingTypes()));
        } else if (!StringUtils.hasText(record.getMutedMissingTypes())) {
            record.setMutedMissingTypes("[]");
        }
        record.setUpdatedAt(now);
        settingService.saveOrUpdate(record);
        return summarySettings(familyId, userId);
    }

    private ProTrialApplicationRecord application(String familyId, String userId) {
        if (!StringUtils.hasText(userId)) return null;
        QueryWrapper<ProTrialApplicationRecord> query = new QueryWrapper<ProTrialApplicationRecord>()
                .eq("family_id", familyId)
                .eq("user_id", userId)
                .orderByDesc("updated_at")
                .last("LIMIT 1");
        return applicationService.getOne(query, false);
    }

    private ProTrialEntitlementRecord entitlement(String familyId) {
        QueryWrapper<ProTrialEntitlementRecord> query = new QueryWrapper<ProTrialEntitlementRecord>()
                .eq("family_id", familyId)
                .last("LIMIT 1");
        return entitlementService.getOne(query, false);
    }

    private DailySummarySettingRecord setting(String familyId, String userId) {
        if (!StringUtils.hasText(userId)) return null;
        QueryWrapper<DailySummarySettingRecord> query = new QueryWrapper<DailySummarySettingRecord>()
                .eq("family_id", familyId)
                .eq("user_id", userId)
                .last("LIMIT 1");
        return settingService.getOne(query, false);
    }

    private boolean entitlementEnabled(ProTrialEntitlementRecord entitlement) {
        if (entitlement == null || !"true".equalsIgnoreCase(entitlement.getEnabled())) return false;
        Instant now = Instant.now();
        if (isAfter(entitlement.getStartsAt(), now)) {
            return false;
        }
        return !StringUtils.hasText(entitlement.getExpiresAt()) || isAfter(entitlement.getExpiresAt(), now);
    }

    private boolean isAfter(String value, Instant now) {
        if (!StringUtils.hasText(value)) return false;
        try {
            return Instant.parse(value).isAfter(now);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private ProTrialApplicationDto applicationDto(ProTrialApplicationRecord record) {
        return new ProTrialApplicationDto(
                record.getId(),
                record.getStatus(),
                record.getSource(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private ProTrialEntitlementDto entitlementDto(ProTrialEntitlementRecord record, boolean enabled) {
        return new ProTrialEntitlementDto(
                enabled,
                record.getPlanCode(),
                record.getStartsAt(),
                record.getExpiresAt()
        );
    }

    private String normalizeReminderTime(String value) {
        String trimmed = value.trim();
        return trimmed.matches("^\\d{2}:\\d{2}$") ? trimmed : DEFAULT_REMINDER_TIME;
    }

    private List<String> parseMutedTypes(String json) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readerForListOf(String.class).readValue(json);
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private String writeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values.stream()
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .distinct()
                    .toList());
        } catch (JsonProcessingException exception) {
            return "[]";
        }
    }
}
