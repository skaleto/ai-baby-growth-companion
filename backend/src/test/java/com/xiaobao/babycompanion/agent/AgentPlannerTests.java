package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import org.junit.jupiter.api.Test;

class AgentPlannerTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AgentPlanner planner = new AgentPlanner(objectMapper);
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(objectMapper);

    @Test
    void buildRequestIncludesModelContextHarnessAndLocalClock() {
        AgentPlanner midnightPlanner = new AgentPlanner(
                objectMapper,
                Clock.fixed(Instant.parse("2026-06-05T16:21:00Z"), ZoneId.of("Asia/Shanghai"))
        );
        RecordSignalExtractor midnightExtractor = new RecordSignalExtractor(
                objectMapper,
                Clock.fixed(Instant.parse("2026-06-05T16:21:00Z"), ZoneId.of("Asia/Shanghai"))
        );
        AgentChatRequest request = new AgentChatRequest("十二点喝了100毫升奶粉", null, null, List.of(), List.of(), List.of(), List.of(), null, false);

        String prompt = midnightPlanner
                .buildRequest("planner-test", request, List.of(), midnightExtractor.extract(request.message()), true)
                .messages()
                .get(1)
                .contentAsText();

        assertThat(prompt).contains("\"currentDateTime\":\"2026-06-06T00:21\"");
        assertThat(prompt).contains("\"currentTime\":\"00:21\"");
        assertThat(prompt).contains("\"timeZone\":\"Asia/Shanghai\"");
        assertThat(prompt).contains("\"modelContextHarness\"");
        assertThat(prompt).contains("刚才/刚刚/现在/这次");
        assertThat(prompt).contains("十二点/12点");
        assertThat(prompt).contains("00:00");
        assertThat(prompt).contains("当天汇总字段和时间线事件必须同步");
        assertThat(prompt).contains("不要把一次母乳/奶粉确认永久当成未来默认奶类");
    }

    @Test
    void parsesPlannerJsonAndNormalizesFields() {
        AgentChatRequest request = new AgentChatRequest("今天8点喝奶120ml", null, null, List.of(), List.of(), List.of(), List.of(), null, false);
        RecordSignals signals = extractor.extract(request.message());

        AgentPlan plan = planner.parse(
                """
                        {"intent":"record","topics":["feeding"],"targetDates":["2026-05-01"],"contextNeeds":["profile","careHistory"],"toolRequests":[],"riskHints":["none"]}
                        """,
                request,
                signals
        );

        assertThat(plan.intent()).isEqualTo("record");
        assertThat(plan.topics()).contains("feeding");
        assertThat(plan.contextNeeds()).contains("careHistory");
        assertThat(plan.mediaAction()).isNull();
    }

    @Test
    void parsesMediaSaveActionFromPlannerJson() {
        AgentChatRequest request = new AgentChatRequest(
                "刚才的视频保存到相册",
                null,
                null,
                List.of(new AgentChatMessage(
                        "msg-video",
                        "parent",
                        "这个视频看看",
                        "2026-05-03T22:46:00",
                        List.of(new AgentAttachment("att-video", "baby.mov", "video", null, null)),
                        List.of()
                )),
                List.of(),
                List.of(),
                List.of(),
                null,
                false
        );
        RecordSignals signals = extractor.extract(request.message());

        AgentPlan plan = planner.parse(
                """
                        {"intent":"question","topics":["growth"],"targetDates":[],"contextNeeds":["profile"],"toolRequests":[],"riskHints":["none"],"mediaAction":{"intent":"save_to_album","targetScope":"previous","targetKind":"video","refHint":"刚才的视频","category":"growth","confidence":0.86,"reason":"用户要求保存上一条视频"}}
                        """,
                request,
                signals
        );

        assertThat(plan.mediaAction()).isNotNull();
        assertThat(plan.mediaAction().intent()).isEqualTo("save_to_album");
        assertThat(plan.mediaAction().targetKind()).isEqualTo("video");
        assertThat(plan.mediaAction().category()).isEqualTo("growth");
    }

    @Test
    void heuristicRequestsWebForPolicyQuestion() {
        AgentChatRequest request = new AgentChatRequest("查一下杭州新生儿疫苗政策", null, null, List.of(), List.of(), List.of(), List.of(), null, false);

        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));

        assertThat(plan.intent()).isIn("question", "record");
        assertThat(plan.toolRequests()).hasSize(1);
        assertThat(plan.toolRequests().get(0).toolId()).isEqualTo("web_search");
    }

    @Test
    void heuristicDoesNotRequestWebForExpenseImageRecognition() {
        AgentChatRequest request = expenseImageRequest("帮我识别这几张小票花费并记到账本");

        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));

        assertThat(plan.intent()).isEqualTo("record");
        assertThat(plan.topics()).contains("expense");
        assertThat(plan.contextNeeds()).doesNotContain("web");
        assertThat(plan.toolRequests()).isEmpty();
    }

    @Test
    void parseFiltersPlannerWebSearchForExpenseImageRecognition() {
        AgentChatRequest request = expenseImageRequest("帮我识别这几张小票花费并记到账本");
        RecordSignals signals = extractor.extract(request.message());

        AgentPlan plan = planner.parse(
                """
                        {"intent":"record","topics":["expense"],"targetDates":["2026-05-01"],"contextNeeds":["profile","web"],"toolRequests":[{"toolId":"web_search","query":"小票花费","reason":"查询价格"}],"riskHints":["none"]}
                        """,
                request,
                signals
        );

        assertThat(plan.contextNeeds()).doesNotContain("web");
        assertThat(plan.toolRequests()).isEmpty();
    }

    @Test
    void parsesPlannerSelectedExpenseSkillForPreviousImageRetry() {
        AgentChatRequest request = previousImageRetryRequest("把刚才我上传的图片对应的花费再记录一下");
        RecordSignals signals = extractor.extract(request.message());

        AgentPlan plan = planner.parse(
                """
                        {"intent":"record","topics":["expense"],"targetDates":[],"contextNeeds":["profile","careHistory"],"toolRequests":[],"riskHints":["none"],"skillRequests":[{"skillId":"expense-recognition","mode":"execute","reason":"用户引用上一轮支出图片并要求入账"}]}
                        """,
                request,
                signals
        );

        assertThat(plan.skillRequests()).hasSize(1);
        assertThat(plan.skillRequests().get(0).skillId()).isEqualTo("expense-recognition");
        assertThat(plan.skillRequests().get(0).mode()).isEqualTo(SkillMode.EXECUTE);
        assertThat(plan.toolRequests()).isEmpty();
    }

    @Test
    void heuristicFallbackCanRequestExpenseSkillForRecentImageRetryWithoutCurrentAttachments() {
        AgentChatRequest request = previousImageRetryRequest("把刚才我上传的图片对应的花费再记录一下");

        AgentPlan plan = planner.heuristic(request, extractor.extract(request.message()));

        assertThat(plan.skillRequests()).anySatisfy((entry) -> {
            assertThat(entry.skillId()).isEqualTo("expense-recognition");
            assertThat(entry.mode()).isEqualTo(SkillMode.EXECUTE);
        });
        assertThat(plan.toolRequests()).isEmpty();
    }

    private AgentChatRequest expenseImageRequest(String message) {
        return new AgentChatRequest(
                message,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(new AgentAttachment("attachment-1", "receipt.jpg", "image", null, "data:image/jpeg;base64,abc")),
                null,
                false
        );
    }

    private AgentChatRequest previousImageRetryRequest(String message) {
        return new AgentChatRequest(
                message,
                null,
                null,
                List.of(new AgentChatMessage(
                        "msg-prior",
                        "parent",
                        "这几张购物截图帮我看看宝宝花费",
                        "2026-05-16T19:58:00",
                        List.of(new AgentAttachment("attachment-prior-1", "receipt.jpg", "image", null, null)),
                        List.of()
                )),
                List.of(),
                List.of(),
                List.of(),
                null,
                false
        );
    }
}
