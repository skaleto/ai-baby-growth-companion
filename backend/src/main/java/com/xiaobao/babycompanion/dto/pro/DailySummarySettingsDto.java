package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record DailySummarySettingsDto(
        boolean enabled,
        String reminderTime,
        List<String> mutedMissingTypes
) {
}
