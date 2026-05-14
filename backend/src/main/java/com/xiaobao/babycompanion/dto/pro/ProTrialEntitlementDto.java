package com.xiaobao.babycompanion.dto.pro;

public record ProTrialEntitlementDto(
        boolean enabled,
        String planCode,
        String startsAt,
        String expiresAt
) {
}
