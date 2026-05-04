package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SkillRegistryTests {

    private final SkillRegistry registry = new SkillRegistry();

    @Test
    void loadsSkillDefinitionsFromResources() {
        assertThat(registry.definitions()).extracting(SkillDefinition::id)
                .contains("default-baby-companion", "pediatric-care-guide");

        SkillDefinition pediatric = registry.findById("pediatric-care-guide").orElseThrow();
        assertThat(pediatric.name()).isEqualTo("育儿基础知识底座");
        assertThat(pediatric.progressiveDisclosure()).isTrue();
        assertThat(pediatric.sections()).extracting(SkillSection::id)
                .contains("feeding", "sleep", "growth", "temperature", "poop", "vaccine", "safety", "redFlags");
        assertThat(pediatric.copyrightBoundary()).isNotEmpty();
        assertThat(pediatric.sourceAnchors()).isNotEmpty();
    }

    @Test
    void exposesOnlySkillCatalogForPlannerAndRuntime() {
        assertThat(registry.selectSkills(null)).extracting(Skill::id)
                .containsExactly("default-baby-companion", "pediatric-care-guide");
        assertThat(registry.selectSkills(null).get(1).description()).contains("渐进式披露");
    }
}
