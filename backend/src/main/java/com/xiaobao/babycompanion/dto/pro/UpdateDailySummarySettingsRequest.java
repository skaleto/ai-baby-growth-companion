package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record UpdateDailySummarySettingsRequest(
        Boolean enabled,
        String reminderTime,
        List<String> mutedMissingTypes
) {
}
