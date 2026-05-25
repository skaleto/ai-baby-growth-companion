package com.xiaobao.babycompanion.service;

import java.util.List;

import com.xiaobao.babycompanion.dto.pro.FindingDto;

@FunctionalInterface
public interface DailySummaryAiClient {
    /**
     * Calls the configured model with the given JSON context and returns parsed findings.
     * Implementations MUST throw on timeout, network failure, or unparseable JSON —
     * the caller relies on exception → fallback path.
     */
    List<FindingDto> call(String contextJson) throws DailySummaryAiException;

    final class DailySummaryAiException extends Exception {
        public DailySummaryAiException(String message) { super(message); }
        public DailySummaryAiException(String message, Throwable cause) { super(message, cause); }
    }
}
