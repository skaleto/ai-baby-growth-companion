package com.xiaobao.babycompanion.agent;

public record ReminderSignal(
        String kind,
        Integer intervalMinutes,
        String sourceText,
        String topic,
        boolean ringingRequested
) {
}
