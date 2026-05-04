package com.xiaobao.babycompanion.agent;

import java.util.List;

public record SkillSection(
        String id,
        String title,
        List<String> topics,
        List<String> riskHints,
        List<String> triggers,
        List<String> content,
        Integer maxChars
) {
    public SkillSection {
        topics = topics == null ? List.of() : List.copyOf(topics);
        riskHints = riskHints == null ? List.of() : List.copyOf(riskHints);
        triggers = triggers == null ? List.of() : List.copyOf(triggers);
        content = content == null ? List.of() : List.copyOf(content);
    }

    public int sectionMaxChars() {
        return maxChars == null || maxChars < 1 ? 420 : maxChars;
    }
}
