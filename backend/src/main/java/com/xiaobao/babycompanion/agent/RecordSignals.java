package com.xiaobao.babycompanion.agent;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public record RecordSignals(
        List<String> targetDates,
        List<String> topics,
        List<String> riskHints,
        JsonNode careLogPatch,
        boolean concreteCareLog,
        boolean explicitReminderTime,
        List<CareRecordClarification> clarifications,
        boolean unsupportedMutationRequest,
        ReminderSignal reminderSignal,
        ExpenseSignal expenseSignal,
        List<GrowthMeasurementSignal> growthMeasurements,
        List<MemorySignal> memorySignals,
        boolean explicitMemoryRequest,
        boolean readOnlyReminderQuery,
        boolean readOnlySummaryQuery,
        boolean privateStateShareRequest
) {
    public RecordSignals(
            List<String> targetDates,
            List<String> topics,
            List<String> riskHints,
            JsonNode careLogPatch,
            boolean concreteCareLog,
            boolean explicitReminderTime,
            List<CareRecordClarification> clarifications,
            boolean unsupportedMutationRequest,
            ReminderSignal reminderSignal,
            ExpenseSignal expenseSignal
    ) {
        this(targetDates, topics, riskHints, careLogPatch, concreteCareLog, explicitReminderTime, clarifications, unsupportedMutationRequest, reminderSignal, expenseSignal, List.of(), List.of(), false, false, false, false);
    }

    public RecordSignals(
            List<String> targetDates,
            List<String> topics,
            List<String> riskHints,
            JsonNode careLogPatch,
            boolean concreteCareLog,
            boolean explicitReminderTime,
            List<CareRecordClarification> clarifications,
            boolean unsupportedMutationRequest
    ) {
        this(targetDates, topics, riskHints, careLogPatch, concreteCareLog, explicitReminderTime, clarifications, unsupportedMutationRequest, null, null, List.of(), List.of(), false, false, false, false);
    }

    public RecordSignals {
        targetDates = targetDates == null ? List.of() : targetDates;
        topics = topics == null ? List.of() : topics;
        riskHints = riskHints == null ? List.of() : riskHints;
        clarifications = clarifications == null ? List.of() : clarifications;
        growthMeasurements = growthMeasurements == null ? List.of() : growthMeasurements;
        memorySignals = memorySignals == null ? List.of() : memorySignals;
    }

    public static RecordSignals empty() {
        return new RecordSignals(
                List.of(),
                List.of(),
                List.of(),
                null,
                false,
                false,
                List.of(),
                false,
                null,
                null,
                List.of(),
                List.of(),
                false,
                false,
                false,
                false
        );
    }
}
