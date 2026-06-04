package com.xiaobao.babycompanion.service;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.dto.clienterror.ClientErrorReport;
import com.xiaobao.babycompanion.persistence.entity.ClientErrorRecord;
import com.xiaobao.babycompanion.persistence.service.ClientErrorRecordService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * REQ-OBS-001 (R0.5): minimal client crash / white-screen / OTA-failure ingestion.
 *
 * <p>The frontend error boundary reports only technical failure metadata here so we can detect
 * release regressions early. To stay reportable when a crash happens before or during login, the
 * endpoint is {@code permitAll}; when a valid session is present we attach familyId/userId, and when
 * it is not we still persist the report with those identifiers left empty.
 *
 * <p>This channel deliberately accepts ONLY the fields below (kind, message, page, app/bundle
 * version, deviceInfo). It never receives chat content or media. Free-text fields are truncated to
 * bounded lengths so an oversized payload cannot bloat the store.
 */
@Service
public class ClientErrorService {

    public static final Set<String> SUPPORTED_KINDS = Set.of(
            "crash",
            "whitescreen",
            "ota_fail",
            "api_fail"
    );

    /** Fallback bucket for unrecognized kinds so the stored value is never arbitrary client input. */
    public static final String UNKNOWN_KIND = "unknown";

    public static final int MAX_MESSAGE_LENGTH = 2000;
    public static final int MAX_DEVICE_INFO_LENGTH = 500;
    static final int MAX_PAGE_LENGTH = 500;
    static final int MAX_VERSION_LENGTH = 100;

    private final ClientErrorRecordService recordService;

    public ClientErrorService(ClientErrorRecordService recordService) {
        this.recordService = recordService;
    }

    public void record(ClientErrorReport report) {
        AuthPrincipal principal = optionalPrincipal();
        ClientErrorRecord record = new ClientErrorRecord();
        record.setId("cerr-" + UUID.randomUUID());
        record.setFamilyId(principal == null ? null : principal.familyId());
        record.setUserId(principal == null ? null : principal.userId());
        record.setKind(normalizeKind(report == null ? null : report.kind()));
        record.setMessage(truncate(report == null ? null : report.message(), MAX_MESSAGE_LENGTH));
        record.setPage(truncate(report == null ? null : report.page(), MAX_PAGE_LENGTH));
        record.setAppVersion(truncate(report == null ? null : report.appVersion(), MAX_VERSION_LENGTH));
        record.setBundleVersion(truncate(report == null ? null : report.bundleVersion(), MAX_VERSION_LENGTH));
        record.setDeviceInfo(truncate(report == null ? null : report.deviceInfo(), MAX_DEVICE_INFO_LENGTH));
        record.setCreatedAt(Instant.now().toString());
        recordService.save(record);
    }

    private String normalizeKind(String kind) {
        if (kind == null) {
            return UNKNOWN_KIND;
        }
        String normalized = kind.trim().toLowerCase();
        return SUPPORTED_KINDS.contains(normalized) ? normalized : UNKNOWN_KIND;
    }

    private String truncate(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private AuthPrincipal optionalPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal;
        }
        return null;
    }
}
