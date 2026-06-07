package com.xiaobao.babycompanion.agent.action;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class AgentActionResponseGuardTests {

    private final AgentActionResponseGuard guard = new AgentActionResponseGuard();

    @Test
    void successWordingFallsBackToMissingFieldQuestionWhenNoAppliedResultExists() {
        String text = guard.groundFinalText(
                "好的，已经记到今天的喂养记录里了。",
                List.of(new AgentActionResult(
                        "needs_input",
                        "record_feeding_event",
                        "care_log",
                        List.of(),
                        null,
                        Map.of(),
                        "这次喝的是母乳还是配方奶？",
                        List.of("feedingType"),
                        List.of()
                ))
        );

        assertThat(text).isEqualTo("这次喝的是母乳还是配方奶？");
    }

    @Test
    void pendingWordingFallsBackWhenNoPendingEffectWasCreated() {
        String text = guard.groundFinalText(
                "我已经整理成待确认的成长测量草稿了。",
                List.of(new AgentActionResult(
                        "failed",
                        "create_growth_measurement_pending",
                        "pending_effect",
                        List.of(),
                        null,
                        Map.of(),
                        "成长测量暂时没有保存成功，可以稍后再试一次。",
                        List.of(),
                        List.of("sqlite temporarily unavailable")
                ))
        );

        assertThat(text).contains("没有保存成功");
        assertThat(text).doesNotContain("待确认");
    }

    @Test
    void keepsSuccessWordingWhenAppliedResultExists() {
        String text = guard.groundFinalText(
                "好的，已经记到今天的喂养记录里了。",
                List.of(new AgentActionResult(
                        "applied",
                        "record_feeding_event",
                        "care_log",
                        List.of("care-2026-06-06"),
                        null,
                        Map.of("date", "2026-06-06", "amountMl", 120),
                        "已记录 120ml 配方奶。",
                        List.of(),
                        List.of()
                ))
        );

        assertThat(text).isEqualTo("好的，已经记到今天的喂养记录里了。");
    }
}
