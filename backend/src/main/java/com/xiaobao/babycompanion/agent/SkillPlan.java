package com.xiaobao.babycompanion.agent;

import java.util.List;

public record SkillPlan(
        List<SkillPlanEntry> entries
) {
    public SkillPlan {
        entries = entries == null ? List.of() : List.copyOf(entries);
    }

    public static SkillPlan empty() {
        return new SkillPlan(List.of());
    }

    public boolean executes(String skillId) {
        return entries.stream().anyMatch((entry) ->
                skillId.equals(entry.skillId()) && SkillMode.EXECUTE.equals(entry.mode())
        );
    }

    public List<String> usedSkillIds() {
        return entries.stream()
                .filter((entry) -> entry.mode() != null)
                .map(SkillPlanEntry::skillId)
                .distinct()
                .toList();
    }
}
