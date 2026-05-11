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
        ExpenseSignal expenseSignal
) {
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
        this(targetDates, topics, riskHints, careLogPatch, concreteCareLog, explicitReminderTime, clarifications, unsupportedMutationRequest, null, null);
    }

    public RecordSignals {
        targetDates = targetDates == null ? List.of() : targetDates;
        topics = topics == null ? List.of() : topics;
        riskHints = riskHints == null ? List.of() : riskHints;
        clarifications = clarifications == null ? List.of() : clarifications;
    }
}
