package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord;
import com.xiaobao.babycompanion.persistence.mapper.ExpenseItemRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class ExpenseItemRecordService extends ServiceImpl<ExpenseItemRecordMapper, ExpenseItemRecord> {

    public record SimilarExpense(
            String id,
            String title,
            double amount,
            String date
    ) {}

    public java.util.List<SimilarExpense> getRecentSimilarExpenses(String familyId, String productName, int months) {
        if (productName == null || productName.isBlank() || months <= 0) return java.util.List.of();

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate windowStart = today.minusDays(months * 30L);

        java.util.List<com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord> all =
                list(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord>()
                        .eq("family_id", familyId)
                        .ge("sort_key", windowStart.toString())
                        .le("sort_key", today.toString()));

        if (all.isEmpty()) return java.util.List.of();

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        String needle = normalize(productName);
        java.util.List<SimilarExpense> matches = new java.util.ArrayList<>();

        for (com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord rec : all) {
            try {
                com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(rec.getPayloadJson());
                String title = node.path("title").asText("");
                if (title.isBlank()) continue;
                String haystack = normalize(title);
                if (!haystack.contains(needle) && !needle.contains(haystack)) continue;
                matches.add(new SimilarExpense(
                        node.path("id").asText(""),
                        title,
                        node.path("amount").asDouble(0),
                        node.path("date").asText("")
                ));
            } catch (Exception ignore) {
                // skip malformed
            }
        }

        matches.sort((a, b) -> b.date().compareTo(a.date()));
        return matches;
    }

    private static String normalize(String s) {
        return s.replaceAll("\\s+", "").toLowerCase();
    }
}
