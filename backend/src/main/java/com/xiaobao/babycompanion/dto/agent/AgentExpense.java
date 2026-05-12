package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AgentExpense(
        String id,
        String title,
        Double amount,
        String currency,
        String category,
        String date,
        Double quantity,
        Double unitPrice,
        String merchant,
        String note,
        String brand,
        String spec,
        List<String> attachmentIds,
        String source,
        String createdAt,
        String updatedAt
) {
}
