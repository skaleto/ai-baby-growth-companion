package com.xiaobao.babycompanion.agent;

import java.util.ArrayList;
import java.util.List;

import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SkillRouter {

    public static final String EXPENSE_RECOGNITION_SKILL_ID = "expense-recognition";

    private final SkillDisclosureService skillDisclosureService;

    public SkillRouter(SkillDisclosureService skillDisclosureService) {
        this.skillDisclosureService = skillDisclosureService;
    }

    public SkillPlan plan(
            AgentChatRequest request,
            AgentPlan agentPlan,
            RecordSignals signals
    ) {
        List<SkillPlanEntry> entries = new ArrayList<>();
        if (shouldExecuteExpenseRecognition(request, agentPlan, signals)) {
            entries.add(new SkillPlanEntry(
                    EXPENSE_RECOGNITION_SKILL_ID,
                    SkillMode.EXECUTE,
                    "当前请求包含支出图片识别或历史支出图片重试"
            ));
        }

        for (String skillId : skillDisclosureService.disclosedSkillIds(agentPlan, signals, request == null ? "" : request.message())) {
            if (entries.stream().noneMatch((entry) -> skillId.equals(entry.skillId()))) {
                entries.add(new SkillPlanEntry(skillId, SkillMode.DISCLOSE, "按上下文渐进式注入知识"));
            }
        }

        if (entries.stream().noneMatch((entry) -> "default-baby-companion".equals(entry.skillId()))) {
            entries.add(new SkillPlanEntry("default-baby-companion", SkillMode.GUARD, "默认能力边界和安全规则"));
        }

        return new SkillPlan(entries);
    }

    boolean shouldExecuteExpenseRecognition(AgentChatRequest request, AgentPlan agentPlan, RecordSignals signals) {
        if (request == null || !hasVisualAttachment(request.attachments())) return false;
        String message = request.message() == null ? "" : request.message().trim();
        boolean expenseTopic = signals != null && (signals.expenseSignal() != null || signals.topics().contains("expense"));
        boolean planExpenseTopic = agentPlan != null && agentPlan.topics() != null && agentPlan.topics().contains("expense");
        boolean currentExpenseImageTask = message.matches(".*(识别|看一下|帮我|整理|记录|记账).*(花费|支出|账本|订单|小票|收据|发票|支付|付款|金额).*")
                || message.matches(".*(订单|小票|收据|发票|支付截图|付款截图|支付凭证|付款凭证).*(记账|账本|花费|支出|金额).*");
        boolean previousExpenseRetry = referencesPreviousExpenseEvidence(message);
        return (expenseTopic || planExpenseTopic || currentExpenseImageTask || previousExpenseRetry)
                && (currentExpenseImageTask || previousExpenseRetry || message.matches(".*(花费|支出|账本|记账|订单|小票|收据|发票|支付|付款|金额).*"));
    }

    private boolean hasVisualAttachment(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return false;
        return attachments.stream().anyMatch((attachment) ->
                attachment != null
                        && List.of("image", "video").contains(attachment.kind())
                        && StringUtils.hasText(attachment.dataUrl())
        );
    }

    private boolean referencesPreviousExpenseEvidence(String text) {
        if (!StringUtils.hasText(text)) return false;
        boolean expenseIntent = text.matches(".*(花费|支出|账本|记账|费用|记录).*");
        boolean previousReference = text.matches(".*(上面|上面的|前面|之前|上一条|这些|那几张|刚才.*(图|图片|照片|截图|订单|小票|收据|花费)).*");
        boolean repeatIntent = text.matches(".*(重新|再|一遍|再记|再记录|重记).*");
        boolean directRecordReference = text.matches(".*(上面|上面的|前面|之前|上一条|这些|那几张).*记录.*");
        return expenseIntent && previousReference && (repeatIntent || directRecordReference);
    }
}
