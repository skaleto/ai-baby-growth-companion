package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class SkillDisclosureServiceTests {

    private final SkillRegistry registry = new SkillRegistry();
    private final SkillDisclosureService disclosureService = new SkillDisclosureService(registry);

    @Test
    void doesNotDiscloseForPureStructuredRecord() {
        AgentPlan plan = new AgentPlan(
                "record",
                List.of("feeding"),
                List.of("2026-05-04"),
                List.of("profile", "careHistory"),
                List.of(),
                List.of("none"),
                null
        );
        RecordSignals signals = new RecordSignals(
                List.of("2026-05-04"),
                List.of("feeding"),
                List.of(),
                null,
                true,
                false,
                List.of(),
                false
        );

        SkillDisclosureResult result = disclosureService.disclose(plan, signals, "今天 18:30 喝奶 120ml");

        assertThat(result.contexts()).isEmpty();
        assertThat(result.disclosedSkillIds()).doesNotContain("pediatric-care-guide");
    }

    @Test
    void disclosesFeedingSectionForCareQuestion() {
        AgentPlan plan = new AgentPlan(
                "question",
                List.of("feeding"),
                List.of(),
                List.of("profile", "careHistory"),
                List.of(),
                List.of("none"),
                null
        );

        SkillDisclosureResult result = disclosureService.disclose(
                plan,
                new RecordSignals(List.of(), List.of("feeding"), List.of(), null, false, false, List.of(), false),
                "宝宝今天喝奶比昨天少，正常吗"
        );

        assertThat(result.disclosedSkillIds()).contains("pediatric-care-guide");
        assertThat(result.contexts().toString()).contains("feeding");
        assertThat(result.contexts().toString()).contains("尿量");
    }

    @Test
    void disclosesTemperatureAndSafetySectionsForFeverQuestion() {
        AgentPlan plan = new AgentPlan(
                "question",
                List.of("temperature"),
                List.of(),
                List.of("profile"),
                List.of(),
                List.of("fever"),
                null
        );

        SkillDisclosureResult result = disclosureService.disclose(
                plan,
                new RecordSignals(List.of(), List.of("temperature"), List.of("fever"), null, false, false, List.of(), false),
                "宝宝发烧 39 度怎么办"
        );

        String text = result.contexts().toString();
        assertThat(text).contains("temperature");
        assertThat(text).contains("redFlags");
        assertThat(text).contains("不要给出退烧药剂量");
    }

    @Test
    void disclosesVaccineSectionWhenWebPolicyIsNeeded() {
        AgentPlan plan = new AgentPlan(
                "question",
                List.of("vaccine", "policy"),
                List.of(),
                List.of("profile", "web"),
                List.of(new AgentToolRequest("web_search", "杭州新生儿疫苗政策", "需要本地官方信息")),
                List.of("vaccine"),
                null
        );

        SkillDisclosureResult result = disclosureService.disclose(
                plan,
                new RecordSignals(List.of(), List.of("vaccine"), List.of("vaccine"), null, false, false, List.of(), false),
                "查一下杭州新生儿疫苗政策"
        );

        assertThat(result.contexts().toString()).contains("vaccine");
        assertThat(result.contexts().toString()).contains("联网查询");
    }

    @Test
    void disclosureRespectsSectionAndCharacterLimits() {
        AgentPlan plan = new AgentPlan(
                "mixed",
                List.of("feeding", "sleep", "growth", "temperature", "poop", "vaccine", "policy"),
                List.of(),
                List.of("profile", "web"),
                List.of(new AgentToolRequest("web_search", "疫苗政策", "需要外部资料")),
                List.of("fever", "medicine", "vaccine", "allergy", "breathing", "injury"),
                null
        );

        SkillDisclosureResult result = disclosureService.disclose(
                plan,
                new RecordSignals(List.of(), List.of("feeding", "sleep", "temperature", "poop"), List.of("fever", "allergy"), null, false, false, List.of(), false),
                "宝宝发烧39度还吐奶，睡不好，疫苗政策也想查一下，怎么办"
        );

        String text = result.contexts().toString();
        assertThat(text.length()).isLessThanOrEqualTo(1700);
        assertThat(text.split("title=").length - 1).isLessThanOrEqualTo(4);
    }
}
