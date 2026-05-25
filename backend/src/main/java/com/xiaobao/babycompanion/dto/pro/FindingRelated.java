package com.xiaobao.babycompanion.dto.pro;

import java.util.List;

public record FindingRelated(
        List<String> careLogEventIds,
        List<String> growthEventIds,
        List<String> albumItemIds,
        List<String> expenseIds,
        List<String> reminderIds,
        List<String> memberIds,
        List<String> memoryIds,
        List<String> comparedTo
) {
    public static FindingRelated empty() {
        return new FindingRelated(
                List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of()
        );
    }
}
