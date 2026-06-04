package com.xiaobao.babycompanion.agent;

public record GrowthMeasurementSignal(
        String type,
        Double value,
        String date,
        String note,
        boolean needsClarification,
        String clarificationField,
        String clarificationQuestion
) {
    public GrowthMeasurementSignal(String type, Double value, String date, String note) {
        this(type, value, date, note, false, "", "");
    }

    public GrowthMeasurementSignal(String type, Double value, String date, String note, boolean needsClarification) {
        this(type, value, date, note, needsClarification, needsClarification ? "unit" : "", "");
    }
}
