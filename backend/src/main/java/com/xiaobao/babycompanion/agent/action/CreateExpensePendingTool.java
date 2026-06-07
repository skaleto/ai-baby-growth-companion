package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CreateExpensePendingTool extends AgentActionToolSupport {

    public CreateExpensePendingTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "create_expense_pending";
    }

    @Override
    public String displayName() {
        return "整理账本草稿";
    }

    @Override
    public String runningMessage() {
        return "正在整理账本草稿";
    }

    @Override
    String description() {
        return "把用户明确说明的宝宝真实支出整理成后端持久化的账本待确认草稿。没有实际支付金额时不要调用。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "idempotencyKey", stringProperty("稳定去重键"),
                        "title", stringProperty("支出标题"),
                        "amount", numberProperty("实际支付金额"),
                        "currency", stringProperty("币种，默认 CNY"),
                        "category", stringProperty("分类，如 formula/diaper/food/clothing/toy/health/vaccine/daily/education/other"),
                        "date", stringProperty("支出日期，YYYY-MM-DD"),
                        "merchant", stringProperty("商家，可为空"),
                        "note", stringProperty("补充说明，可为空")
                ),
                List.of("idempotencyKey", "title", "amount", "date")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String title = text(args, "title", "");
        String date = text(args, "date", "");
        double amount = number(args, "amount", -1);
        if (!StringUtils.hasText(title) || !StringUtils.hasText(date) || amount <= 0) {
            return AgentActionResult.needsInput(id(), "pending_effect", "记账还缺用途、金额或日期，补充后我再整理账本草稿。", List.of("title", "amount", "date"));
        }
        ObjectNode expense = objectMapper.createObjectNode();
        expense.put("id", "expense-" + text(args, "idempotencyKey", call.callId()));
        expense.put("title", title);
        expense.put("amount", amount);
        expense.put("currency", text(args, "currency", "CNY"));
        expense.put("category", text(args, "category", "other"));
        expense.put("date", date);
        putIfText(expense, "merchant", text(args, "merchant", ""));
        putIfText(expense, "note", text(args, "note", ""));
        expense.put("source", "agent");
        ObjectNode effect = objectMapper.createObjectNode();
        effect.putArray("expenses").add(expense);
        return mutationService.createPendingEffect(
                context,
                id(),
                text(args, "idempotencyKey", call.callId()),
                "expense",
                effect,
                Map.of("date", date, "amount", amount, "title", title)
        );
    }
}
