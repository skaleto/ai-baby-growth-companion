package com.xiaobao.babycompanion.agent.action;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AgentActionResponseGuard {

    public String groundFinalText(String aiText, List<AgentActionResult> results) {
        List<AgentActionResult> actionResults = results == null ? List.of() : results;
        boolean hasApplied = actionResults.stream().anyMatch((result) -> "applied".equals(result.status()));
        boolean hasPending = actionResults.stream().anyMatch((result) -> "pending_created".equals(result.status()));
        boolean claimsApplied = containsAny(aiText, List.of("已记录", "已经记录", "已保存", "已经保存", "记到今天", "记到账本", "记到喂养记录", "记好了"));
        boolean claimsPending = containsAny(aiText, List.of("待确认", "草稿"));

        if (claimsApplied && !hasApplied) {
            return preferredFallback(actionResults, "这条记录还没有保存成功，可以补充信息后我再试一次。");
        }
        if (claimsPending && !hasPending) {
            return preferredFallback(actionResults, "这条待确认草稿还没有保存成功，可以稍后再试一次。");
        }
        return aiText;
    }

    private String preferredFallback(List<AgentActionResult> results, String fallback) {
        return results.stream()
                .filter((result) -> List.of("needs_input", "unsupported", "failed", "rejected").contains(result.status()))
                .map(AgentActionResult::userMessage)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(fallback);
    }

    private boolean containsAny(String text, List<String> needles) {
        if (!StringUtils.hasText(text)) return false;
        return needles.stream().anyMatch(text::contains);
    }
}
