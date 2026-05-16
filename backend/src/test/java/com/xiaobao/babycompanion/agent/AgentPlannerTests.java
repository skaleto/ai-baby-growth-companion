package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

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
}
