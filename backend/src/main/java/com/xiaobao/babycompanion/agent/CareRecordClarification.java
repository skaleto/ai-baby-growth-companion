package com.xiaobao.babycompanion.agent;

import java.util.List;

public record CareRecordClarification(
        String topic,
        List<String> missingFields,
        String question
) {
}
