package com.xiaobao.babycompanion.agent;

public record ExpenseSignal(
        String title,
        Double amount,
        String date,
        String category,
        String sourceText
) {
}
