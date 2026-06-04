package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.privacy.DataRightsRequestDto;
import com.xiaobao.babycompanion.persistence.entity.DataRightsRequestRecord;
import com.xiaobao.babycompanion.persistence.service.DataRightsRequestRecordService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * REQ-PRIV-002 (R0.5): minimal manual channel for data rights requests
 * (export / delete / account deletion). Requests are only registered with a
 * requestId, a persisted record and a status; the actual deletion or export is
 * handled manually out of band. Nothing is executed automatically here.
 */
@Service
public class DataRightsService {

    public static final String STATUS_PENDING = "pending";

    public static final Set<String> SUPPORTED_TYPES = Set.of(
            "export",
            "delete_family",
            "delete_media",
            "account_deletion"
    );

    private final DataRightsRequestRecordService recordService;
    private final CurrentUser currentUser;

    public DataRightsService(
            DataRightsRequestRecordService recordService,
            CurrentUser currentUser
    ) {
        this.recordService = recordService;
        this.currentUser = currentUser;
    }

    public DataRightsRequestDto submitRequest(String type, String reason) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        String normalizedType = StringUtils.hasText(type) ? type.trim() : null;
        if (normalizedType == null || !SUPPORTED_TYPES.contains(normalizedType)) {
            throw new IllegalArgumentException("不支持的数据权利请求类型。");
        }
        String now = Instant.now().toString();
        DataRightsRequestRecord record = new DataRightsRequestRecord();
        record.setId("dr-" + UUID.randomUUID());
        record.setFamilyId(principal.familyId());
        record.setUserId(principal.userId());
        record.setType(normalizedType);
        record.setStatus(STATUS_PENDING);
        record.setReason(StringUtils.hasText(reason) ? reason.trim() : null);
        record.setCreatedAt(now);
        recordService.save(record);
        return toDto(record);
    }

    public List<DataRightsRequestDto> listOwnRequests() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        QueryWrapper<DataRightsRequestRecord> query = new QueryWrapper<DataRightsRequestRecord>()
                .eq("user_id", principal.userId())
                .orderByDesc("created_at")
                .orderByDesc("id");
        return recordService.list(query).stream()
                .map(this::toDto)
                .toList();
    }

    private DataRightsRequestDto toDto(DataRightsRequestRecord record) {
        return new DataRightsRequestDto(
                record.getId(),
                record.getType(),
                record.getStatus(),
                record.getReason(),
                record.getCreatedAt(),
                record.getResolvedAt(),
                record.getResolutionNote()
        );
    }
}
