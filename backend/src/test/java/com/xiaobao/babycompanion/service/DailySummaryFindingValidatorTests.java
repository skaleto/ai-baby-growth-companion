package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;

import com.xiaobao.babycompanion.dto.pro.FindingAction;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.junit.jupiter.api.Test;

class DailySummaryFindingValidatorTests {

    private final DailySummaryFindingValidator validator = new DailySummaryFindingValidator();

    @Test
    void acceptsValidFinding() {
        FindingDto valid = new FindingDto(
                "family_action_continuity",
                "妈妈用白噪音哄睡了 25 分钟",
                new FindingRelated(
                        List.of("evt-1"), List.of(), List.of(), List.of(),
                        List.of(), List.of("member-mom"), List.of(), List.of()
                ),
                null
        );
        List<FindingDto> result = validator.validate(
                List.of(valid),
                knownIds(Set.of("evt-1"), Set.of(), Set.of(), Set.of(), Set.of(), Set.of("member-mom"), Set.of())
        );
        assertEquals(1, result.size());
    }

    @Test
    void rejectsUnknownType() {
        FindingDto invalid = new FindingDto(
                "totally_made_up",
                "some text",
                FindingRelated.empty(),
                null
        );
        List<FindingDto> result = validator.validate(List.of(invalid), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsFindingWithBannedWord() {
        FindingDto banned = new FindingDto(
                "trend_anomaly",
                "宝宝奶量异常，建议去医院",
                FindingRelated.empty(),
                null
        );
        List<FindingDto> result = validator.validate(List.of(banned), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsFindingReferencingUnknownIds() {
        FindingDto hallucinated = new FindingDto(
                "cross_domain_link",
                "今天买的奶粉今天就用了",
                new FindingRelated(
                        List.of(), List.of(), List.of(), List.of("expense-fake-99"),
                        List.of(), List.of(), List.of(), List.of()
                ),
                null
        );
        List<FindingDto> result = validator.validate(
                List.of(hallucinated),
                knownIds(Set.of(), Set.of(), Set.of(), Set.of("expense-1"), Set.of(), Set.of(), Set.of())
        );
        assertTrue(result.isEmpty());
    }

    @Test
    void rejectsActionWithInvalidTargetFormat() {
        FindingDto badAction = new FindingDto(
                "media_milestone_candidate",
                "可能是第一次站立",
                new FindingRelated(
                        List.of(), List.of(), List.of("alb-1"), List.of(),
                        List.of(), List.of(), List.of(), List.of()
                ),
                new FindingAction("标记里程碑", "not-a-valid-target")
        );
        List<FindingDto> result = validator.validate(
                List.of(badAction),
                knownIds(Set.of(), Set.of(), Set.of("alb-1"), Set.of(), Set.of(), Set.of(), Set.of())
        );
        assertEquals(1, result.size());
        assertNull(result.get(0).action(), "invalid action should be stripped, finding kept");
    }

    @Test
    void rejectsTextTooLong() {
        String longText = "今天".repeat(40);
        FindingDto tooLong = new FindingDto("trend_anomaly", longText, FindingRelated.empty(), null);
        List<FindingDto> result = validator.validate(List.of(tooLong), DailySummaryFindingValidator.KnownIds.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void normalizesNullRelatedToEmpty() {
        FindingDto withNull = new FindingDto("family_action_continuity", "妈妈给宝宝换了尿布", null, null);
        List<FindingDto> result = validator.validate(List.of(withNull), DailySummaryFindingValidator.KnownIds.empty());
        assertEquals(1, result.size());
        assertNotNull(result.get(0).related());
    }

    private DailySummaryFindingValidator.KnownIds knownIds(
            Set<String> careLog, Set<String> growth, Set<String> album,
            Set<String> expense, Set<String> reminder, Set<String> member, Set<String> memory
    ) {
        return new DailySummaryFindingValidator.KnownIds(careLog, growth, album, expense, reminder, member, memory);
    }
}
