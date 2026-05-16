package com.xiaobao.babycompanion.service;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public record ExpensePersistenceResult(
        List<JsonNode> saved,
        List<JsonNode> duplicates,
        List<JsonNode> needsInput,
        List<JsonNode> readOnly
) {
    public ExpensePersistenceResult {
        saved = saved == null ? List.of() : List.copyOf(saved);
        duplicates = duplicates == null ? List.of() : List.copyOf(duplicates);
        needsInput = needsInput == null ? List.of() : List.copyOf(needsInput);
        readOnly = readOnly == null ? List.of() : List.copyOf(readOnly);
    }

    public static ExpensePersistenceResult empty() {
        return new ExpensePersistenceResult(List.of(), List.of(), List.of(), List.of());
    }

    public boolean hasFacts() {
        return !saved.isEmpty() || !duplicates.isEmpty() || !needsInput.isEmpty() || !readOnly.isEmpty();
    }
}
