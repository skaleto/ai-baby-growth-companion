package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

public record SkillDefinition(
        String id,
        String name,
        String description,
        Map<String, Object> disclosurePolicy,
        List<SkillSection> sections,
        List<String> sourceAnchors,
        List<String> copyrightBoundary
) {
    public SkillDefinition {
        disclosurePolicy = disclosurePolicy == null ? Map.of() : Map.copyOf(disclosurePolicy);
        sections = sections == null ? List.of() : List.copyOf(sections);
        sourceAnchors = sourceAnchors == null ? List.of() : List.copyOf(sourceAnchors);
        copyrightBoundary = copyrightBoundary == null ? List.of() : List.copyOf(copyrightBoundary);
    }

    public boolean progressiveDisclosure() {
        return "progressive".equals(String.valueOf(disclosurePolicy.getOrDefault("mode", "")));
    }

    public int maxSections() {
        return intPolicy("maxSections", 4);
    }

    public int maxTotalChars() {
        return intPolicy("maxTotalChars", 1200);
    }

    private int intPolicy(String key, int fallback) {
        Object value = disclosurePolicy.get(key);
        if (value instanceof Number number) {
            return Math.max(1, number.intValue());
        }
        try {
            return Math.max(1, Integer.parseInt(String.valueOf(value)));
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }
}
