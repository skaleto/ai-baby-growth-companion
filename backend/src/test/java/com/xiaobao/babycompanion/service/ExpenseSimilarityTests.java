package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService;
import com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService.SimilarExpense;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ExpenseSimilarityTests {

    @Autowired
    ExpenseItemRecordService expenseService;

    @Test
    void returnsEmptyWhenNoMatch() {
        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                "family-empty", "完全不存在的商品名", 3);
        assertTrue(result.isEmpty());
    }

    @Test
    void matchesPartialProductName() {
        String familyId = "family-sim-" + System.currentTimeMillis();
        seedExpense(familyId, daysAgo(40), "飞鹤1段奶粉", 268.0);
        seedExpense(familyId, daysAgo(20), "飞鹤1段奶粉 6罐装", 280.0);
        seedExpense(familyId, daysAgo(10), "好奇尿不湿 L 码", 158.0);

        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                familyId, "飞鹤1段", 3);
        assertEquals(2, result.size());
        assertTrue(result.get(0).date().compareTo(result.get(1).date()) >= 0);
    }

    @Test
    void respectsMonthWindow() {
        String familyId = "family-window-exp-" + System.currentTimeMillis();
        seedExpense(familyId, daysAgo(100), "飞鹤1段奶粉", 240.0);
        seedExpense(familyId, daysAgo(50), "飞鹤1段奶粉", 268.0);
        seedExpense(familyId, daysAgo(10), "飞鹤1段奶粉", 280.0);

        List<SimilarExpense> result = expenseService.getRecentSimilarExpenses(
                familyId, "飞鹤", 3);
        assertEquals(2, result.size());
    }

    private String daysAgo(int days) {
        return java.time.LocalDate.now().minusDays(days).toString();
    }

    private void seedExpense(String familyId, String date, String title, double amount) {
        com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord rec =
                new com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord();
        String id = "seed-exp-" + familyId + "-" + System.nanoTime();
        rec.setId(id);
        rec.setFamilyId(familyId);
        rec.setSortKey(date);
        rec.setPayloadJson(String.format(java.util.Locale.US,
                "{\"id\":\"%s\",\"date\":\"%s\",\"title\":\"%s\",\"amount\":%.2f,\"category\":\"formula\"}",
                id, date, title.replace("\"", "\\\""), amount));
        expenseService.save(rec);
    }
}
