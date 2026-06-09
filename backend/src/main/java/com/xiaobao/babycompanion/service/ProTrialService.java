package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.pro.ProTrialApplicationDto;
import com.xiaobao.babycompanion.dto.pro.ProTrialEntitlementDto;
import com.xiaobao.babycompanion.dto.pro.ProTrialStatusDto;
import com.xiaobao.babycompanion.exception.ProQuotaExceededException;
import com.xiaobao.babycompanion.persistence.entity.ProTrialApplicationRecord;
import com.xiaobao.babycompanion.persistence.entity.ProTrialEntitlementRecord;
import com.xiaobao.babycompanion.persistence.entity.RedeemCodeRecord;
import com.xiaobao.babycompanion.persistence.service.ProTrialApplicationRecordService;
import com.xiaobao.babycompanion.persistence.service.ProTrialEntitlementRecordService;
import com.xiaobao.babycompanion.persistence.service.RedeemCodeRecordService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ProTrialService {

    private final ProTrialApplicationRecordService applicationService;
    private final ProTrialEntitlementRecordService entitlementService;
    private final RedeemCodeRecordService redeemCodeService;
    private final AiUsageLogService aiUsageLogService;
    private final CurrentUser currentUser;
    private final int freeMonthlyAiQuota;
    private final int redeemGrantDays;

    public ProTrialService(
            ProTrialApplicationRecordService applicationService,
            ProTrialEntitlementRecordService entitlementService,
            RedeemCodeRecordService redeemCodeService,
            AiUsageLogService aiUsageLogService,
            CurrentUser currentUser,
            @Value("${app.pro.free-monthly-ai-quota:10}") int freeMonthlyAiQuota,
            @Value("${app.pro.redeem-grant-days:90}") int redeemGrantDays
    ) {
        this.applicationService = applicationService;
        this.entitlementService = entitlementService;
        this.redeemCodeService = redeemCodeService;
        this.aiUsageLogService = aiUsageLogService;
        this.currentUser = currentUser;
        this.freeMonthlyAiQuota = freeMonthlyAiQuota;
        this.redeemGrantDays = redeemGrantDays;
    }

    public ProTrialStatusDto currentStatus() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return status(principal.familyId(), principal.userId());
    }

    public ProTrialStatusDto status(String familyId, String userId) {
        ProTrialEntitlementRecord entitlement = entitlement(familyId);
        boolean enabled = entitlementEnabled(entitlement);
        ProTrialApplicationRecord application = application(familyId, userId);
        // Pro 家庭不限次（freeCallsRemaining = null）；Free 家庭给出本月剩余免费体验次数。
        Integer freeCallsRemaining = enabled
                ? null
                : (int) Math.max(0L, freeMonthlyAiQuota - aiUsageLogService.monthlyCalls(familyId));
        return new ProTrialStatusDto(
                enabled,
                entitlement == null ? new ProTrialEntitlementDto(false, null, null, null) : entitlementDto(entitlement, enabled),
                application == null ? null : applicationDto(application),
                enabled ? "本家庭已开通 Pro 内测" : "申请 Pro 内测后，可不限次使用 AI 记录与账本整理。",
                freeMonthlyAiQuota,
                freeCallsRemaining
        );
    }

    /**
     * R1 (REQ-PRO-001): Pro 由家庭 entitlement 决定，不再默认全开。
     * entitlement 缺失/到期即非 Pro；历史数据仍可查看、导出、删除（不经此 gate）。
     */
    public boolean isProEnabled(String familyId) {
        return isProEnabledByEntitlement(familyId);
    }

    private boolean isProEnabledByEntitlement(String familyId) {
        return entitlementEnabled(entitlement(familyId));
    }

    /**
     * R-PRO（统一边界）：凡走 AI 助手的回合都属 Pro 能力。
     * 放行条件：caregiver 身份，且【家庭已开通 Pro】或【当月免费 AI 次数未用完】。
     * 免费额度用尽时抛 {@link ProQuotaExceededException} → 403/PRO_QUOTA_EXCEEDED，前端据此引导申请内测。
     * 本方法只做准入判定；实际计数由 AI 调用成功后写入的用量日志承担（见 {@link AiUsageLogService#monthlyCalls}）。
     */
    public void requireAiAccess(String familyId) {
        currentUser.requireCaregiver();
        if (isProEnabledByEntitlement(familyId)) {
            return;
        }
        long used = aiUsageLogService.monthlyCalls(familyId);
        if (used >= freeMonthlyAiQuota) {
            throw new ProQuotaExceededException(
                    "本月免费 AI 体验额度已用完（" + used + "/" + freeMonthlyAiQuota + "），申请 Pro 内测后即可不限次使用。");
        }
    }

    public int freeMonthlyAiQuota() {
        return freeMonthlyAiQuota;
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

    /**
     * 自助兑换内测码：caregiver 输入有效码 → 给本家庭开通/续期 Pro entitlement，全程无需人工审批。
     * 码不存在 / 过期 / 兑换次数用尽时抛 {@link IllegalArgumentException} → 400 + 友好文案。
     */
    @Transactional
    public ProTrialStatusDto redeem(String rawCode) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        currentUser.requireCaregiver();
        String code = rawCode == null ? "" : rawCode.trim();
        if (!StringUtils.hasText(code)) {
            throw new IllegalArgumentException("请输入内测码。");
        }
        RedeemCodeRecord record = redeemCode(code);
        if (record == null) {
            throw new IllegalArgumentException("内测码不存在或已停用。");
        }
        Instant now = Instant.now();
        if (StringUtils.hasText(record.getExpiresAt()) && !isAfter(record.getExpiresAt(), now)) {
            throw new IllegalArgumentException("内测码已过期。");
        }
        int used = record.getUsedCount() == null ? 0 : record.getUsedCount();
        int max = record.getMaxUses() == null ? 1 : record.getMaxUses();
        if (used >= max) {
            throw new IllegalArgumentException("内测码兑换次数已用完。");
        }
        grantEntitlement(principal.familyId(), record.getPlanCode(), now);
        record.setUsedCount(used + 1);
        record.setUpdatedAt(now.toString());
        redeemCodeService.updateById(record);
        return status(principal.familyId(), principal.userId());
    }

    private RedeemCodeRecord redeemCode(String code) {
        QueryWrapper<RedeemCodeRecord> query = new QueryWrapper<RedeemCodeRecord>()
                .eq("code", code)
                .last("LIMIT 1");
        return redeemCodeService.getOne(query, false);
    }

    /** 给家庭开通/续期 Pro entitlement；已有更长有效期则不缩短。 */
    private void grantEntitlement(String familyId, String planCode, Instant now) {
        ProTrialEntitlementRecord entitlement = entitlement(familyId);
        String nowText = now.toString();
        String grantedExpiry = now.plus(redeemGrantDays, ChronoUnit.DAYS).toString();
        if (entitlement == null) {
            entitlement = new ProTrialEntitlementRecord();
            entitlement.setId("pro-entitlement-" + familyId);
            entitlement.setFamilyId(familyId);
            entitlement.setStartsAt(nowText);
            entitlement.setCreatedAt(nowText);
        } else if (StringUtils.hasText(entitlement.getExpiresAt())
                && isAfter(entitlement.getExpiresAt(), now.plus(redeemGrantDays, ChronoUnit.DAYS))) {
            grantedExpiry = entitlement.getExpiresAt();
        }
        entitlement.setEnabled("true");
        entitlement.setPlanCode(StringUtils.hasText(planCode) ? planCode : "internal-trial");
        entitlement.setExpiresAt(grantedExpiry);
        entitlement.setUpdatedAt(nowText);
        entitlementService.saveOrUpdate(entitlement);
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
}
