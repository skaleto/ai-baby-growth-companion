package com.xiaobao.babycompanion.service;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.springframework.stereotype.Component;

@Component
public class DailySummaryFindingValidator {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "family_action_continuity",
            "cross_domain_link",
            "expense_price_compare",
            "trend_anomaly",
            "media_milestone_candidate",
            "memory_recall"
    );

    private static final List<String> BANNED_PHRASES = List.of(
            "应该", "建议", "可能是病", "异常", "需要去医院", "需要就医",
            "推荐", "诊断", "处方", "治疗"
    );

    private static final Pattern ACTION_TARGET_PATTERN =
            Pattern.compile("^(ledger|album|milestone|reminder):[A-Za-z0-9_\\-]+$");

    private static final int MAX_TEXT_LENGTH = 60;

    public List<FindingDto> validate(List<FindingDto> findings, KnownIds knownIds) {
        if (findings == null) return List.of();
        return findings.stream()
                .map(finding -> sanitize(finding, knownIds))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private FindingDto sanitize(FindingDto finding, KnownIds knownIds) {
        if (finding == null) return null;
        if (finding.type() == null || !ALLOWED_TYPES.contains(finding.type())) return null;
        if (finding.text() == null || finding.text().isBlank()) return null;
        if (finding.text().length() > MAX_TEXT_LENGTH) return null;
        if (containsBannedPhrase(finding.text())) return null;

        FindingRelated related = finding.related() == null ? FindingRelated.empty() : finding.related();
        if (!idsAreKnown(related, knownIds)) return null;

        FindingAction action = sanitizeAction(finding.action());
        return new FindingDto(finding.type(), finding.text(), related, action);
    }

    private boolean containsBannedPhrase(String text) {
        for (String phrase : BANNED_PHRASES) {
            if (text.contains(phrase)) return true;
        }
        return false;
    }

    private boolean idsAreKnown(FindingRelated related, KnownIds known) {
        return known.contains(related.careLogEventIds(), known.careLogEventIds())
                && known.contains(related.growthEventIds(), known.growthEventIds())
                && known.contains(related.albumItemIds(), known.albumItemIds())
                && known.contains(related.expenseIds(), known.expenseIds())
                && known.contains(related.reminderIds(), known.reminderIds())
                && known.contains(related.memberIds(), known.memberIds())
                && known.contains(related.memoryIds(), known.memoryIds());
    }

    private FindingAction sanitizeAction(FindingAction action) {
        if (action == null) return null;
        if (action.target() == null) return null;
        if (!ACTION_TARGET_PATTERN.matcher(action.target()).matches()) return null;
        if (action.label() == null || action.label().isBlank()) return null;
        return action;
    }

    public record KnownIds(
            Set<String> careLogEventIds,
            Set<String> growthEventIds,
            Set<String> albumItemIds,
            Set<String> expenseIds,
            Set<String> reminderIds,
            Set<String> memberIds,
            Set<String> memoryIds
    ) {
        public static KnownIds empty() {
            return new KnownIds(Set.of(), Set.of(), Set.of(), Set.of(), Set.of(), Set.of(), Set.of());
        }

        public boolean contains(List<String> requested, Set<String> known) {
            if (requested == null || requested.isEmpty()) return true;
            return known.containsAll(requested);
        }
    }
}
