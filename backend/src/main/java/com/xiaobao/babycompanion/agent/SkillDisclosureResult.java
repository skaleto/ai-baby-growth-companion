package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

public record SkillDisclosureResult(
        List<String> disclosedSkillIds,
        List<Map<String, Object>> contexts
) {
    public SkillDisclosureResult {
        disclosedSkillIds = disclosedSkillIds == null ? List.of() : List.copyOf(disclosedSkillIds);
        contexts = contexts == null ? List.of() : List.copyOf(contexts);
    }
}
