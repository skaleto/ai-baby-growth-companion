package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import org.junit.jupiter.api.Test;

class SkillRouterTests {

    private final SkillRegistry registry = new SkillRegistry();
    private final SkillDisclosureService disclosureService = new SkillDisclosureService(registry);
    private final SkillRouter router = new SkillRouter(disclosureService);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(objectMapper);

    @Test
    void routesCurrentExpenseImagesToExecuteMode() {
        AgentChatRequest request = request("帮我识别这几张小票花费并记到账本", List.of(image("attachment-1")));
        RecordSignals signals = extractor.extract(request.message());
        AgentPlan plan = new AgentPlan("record", List.of("expense"), List.of(), List.of("profile"), List.of(), List.of("none"), null);

        SkillPlan skillPlan = router.plan(request, plan, signals);

        assertThat(skillPlan.entries()).anySatisfy((entry) -> {
            assertThat(entry.skillId()).isEqualTo("expense-recognition");
            assertThat(entry.mode()).isEqualTo(SkillMode.EXECUTE);
        });
    }

    @Test
    void routesPreviousExpenseImageRetryWhenAttachmentsAreForwarded() {
        AgentChatRequest request = request("把刚才上面的这些花费再记录一遍", List.of(image("attachment-prior-1")));
        RecordSignals signals = extractor.extract(request.message());
        AgentPlan plan = new AgentPlan("record", List.of("expense"), List.of(), List.of("profile"), List.of(), List.of("none"), null);

        SkillPlan skillPlan = router.plan(request, plan, signals);

        assertThat(skillPlan.executes("expense-recognition")).isTrue();
    }

    @Test
    void doesNotTreatKnowledgeDisclosureAsExecutedWorker() {
        AgentChatRequest request = request("宝宝今天喝奶比昨天少，正常吗", List.of());
        RecordSignals signals = extractor.extract(request.message());
        AgentPlan plan = new AgentPlan("question", List.of("feeding"), List.of(), List.of("profile"), List.of(), List.of("none"), null);

        SkillPlan skillPlan = router.plan(request, plan, signals);

        assertThat(skillPlan.entries()).anySatisfy((entry) -> {
            assertThat(entry.skillId()).isEqualTo("pediatric-care-guide");
            assertThat(entry.mode()).isEqualTo(SkillMode.DISCLOSE);
        });
        assertThat(skillPlan.executes("pediatric-care-guide")).isFalse();
    }

    @Test
    void suppressesPediatricDisclosureForPureStructuredCareRecord() {
        AgentChatRequest request = request("今天 18:30 喝奶 120ml", List.of());
        RecordSignals signals = extractor.extract(request.message());
        AgentPlan plan = new AgentPlan("record", List.of("feeding"), List.of(), List.of("profile", "careHistory"), List.of(), List.of("none"), null);

        SkillPlan skillPlan = router.plan(request, plan, signals);

        assertThat(skillPlan.entries())
                .extracting(SkillPlanEntry::skillId)
                .doesNotContain("pediatric-care-guide");
    }

    private AgentChatRequest request(String message, List<AgentAttachment> attachments) {
        return new AgentChatRequest(message, null, null, List.of(), List.of(), List.of(), attachments, null, false);
    }

    private AgentAttachment image(String id) {
        return new AgentAttachment(id, id + ".jpg", "image", null, "data:image/jpeg;base64,AAAA");
    }
}
