package com.xiaobao.babycompanion.dto.pro;

public record ProTrialStatusDto(
        boolean enabled,
        ProTrialEntitlementDto entitlement,
        ProTrialApplicationDto application,
        String message
) {
}
