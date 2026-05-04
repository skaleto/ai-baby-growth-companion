package com.xiaobao.babycompanion.agent;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SkillDisclosureService {

    private static final String DEFAULT_SKILL_ID = "default-baby-companion";

    private final SkillRegistry skillRegistry;

    public SkillDisclosureService(SkillRegistry skillRegistry) {
        this.skillRegistry = skillRegistry;
    }

    public SkillDisclosureResult disclose(AgentPlan plan, RecordSignals signals, String userMessage) {
        List<String> disclosedSkillIds = new ArrayList<>();
        List<Map<String, Object>> contexts = new ArrayList<>();

        for (SkillDefinition definition : skillRegistry.definitions()) {
            if (!definition.progressiveDisclosure() || definition.sections().isEmpty()) continue;
            SkillDisclosureResult disclosure = discloseSkill(definition, plan, signals, userMessage);
            if (!disclosure.contexts().isEmpty()) {
                disclosedSkillIds.addAll(disclosure.disclosedSkillIds());
                contexts.addAll(disclosure.contexts());
            }
        }

        return new SkillDisclosureResult(disclosedSkillIds.stream().distinct().toList(), contexts);
    }

    public List<String> disclosedSkillIds(AgentPlan plan, RecordSignals signals, String userMessage) {
        return disclose(plan, signals, userMessage).disclosedSkillIds();
    }

    public boolean shouldCountAsUsed(String skillId, List<String> disclosedSkillIds) {
        return DEFAULT_SKILL_ID.equals(skillId)
                || !skillRegistry.progressiveDisclosure(skillId)
                || disclosedSkillIds.contains(skillId);
    }

    private SkillDisclosureResult discloseSkill(
            SkillDefinition definition,
            AgentPlan plan,
            RecordSignals signals,
            String userMessage
    ) {
        if (pureStructuredRecord(plan, signals, userMessage)) {
            return new SkillDisclosureResult(List.of(), List.of());
        }

        List<RankedSection> rankedSections = definition.sections().stream()
                .map((section) -> new RankedSection(section, score(section, plan, signals, userMessage)))
                .filter((ranked) -> ranked.score() > 0)
                .sorted(Comparator.comparingInt(RankedSection::score).reversed())
                .limit(definition.maxSections())
                .toList();

        if (rankedSections.isEmpty()) {
            return new SkillDisclosureResult(List.of(), List.of());
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("skillId", definition.id());
        context.put("name", definition.name());
        context.put("description", definition.description());
        context.put("disclosureMode", "progressive");
        if (!definition.copyrightBoundary().isEmpty()) {
            context.put("copyrightBoundary", definition.copyrightBoundary());
        }
        if (!definition.sourceAnchors().isEmpty()) {
            context.put("sourceAnchors", definition.sourceAnchors());
        }
        context.put("sections", disclosedSections(rankedSections, definition.maxTotalChars()));

        return new SkillDisclosureResult(List.of(definition.id()), List.of(context));
    }

    private List<Map<String, Object>> disclosedSections(List<RankedSection> rankedSections, int maxTotalChars) {
        List<Map<String, Object>> sections = new ArrayList<>();
        int remainingChars = Math.max(1, maxTotalChars);

        for (RankedSection ranked : rankedSections) {
            SkillSection section = ranked.section();
            String content = truncate(String.join("\n", section.content()), Math.min(section.sectionMaxChars(), remainingChars));
            if (!StringUtils.hasText(content)) continue;

            Map<String, Object> values = new LinkedHashMap<>();
            values.put("id", section.id());
            values.put("title", section.title());
            values.put("content", content);
            sections.add(values);

            remainingChars -= content.length();
            if (remainingChars <= 0) break;
        }

        return sections;
    }

    private int score(SkillSection section, AgentPlan plan, RecordSignals signals, String userMessage) {
        int score = 0;
        String message = userMessage == null ? "" : userMessage;

        if (hasAny(section.topics(), planTopics(plan))) score += 5;
        if (signals != null && hasAny(section.topics(), signals.topics())) score += 3;
        if (hasAny(section.riskHints(), planRiskHints(plan))) score += 8;
        if (signals != null && hasAny(section.riskHints(), signals.riskHints())) score += 8;
        if (matchesAnyTrigger(section.triggers(), message)) score += 4;

        if (plan != null && plan.contextNeeds() != null && plan.contextNeeds().contains("web")
                && hasAny(section.topics(), List.of("vaccine", "policy"))) {
            score += 4;
        }
        if (asksQuestion(message) && hasAny(section.topics(), List.of("feeding", "sleep", "growth", "temperature", "poop", "vaccine", "policy"))) {
            score += 2;
        }
        if (score > 0 && hasAny(section.riskHints(), List.of("fever", "medicine", "vaccine", "allergy", "breathing", "injury"))) {
            score += 1;
        }

        return score;
    }

    private boolean pureStructuredRecord(AgentPlan plan, RecordSignals signals, String userMessage) {
        if (plan == null || signals == null) return false;
        String message = userMessage == null ? "" : userMessage;
        boolean recordIntent = "record".equals(plan.intent());
        boolean noQuestion = !asksQuestion(message);
        boolean noRisk = safeRisks(plan.riskHints()).isEmpty() && safeRisks(signals.riskHints()).isEmpty();
        boolean noWeb = plan.contextNeeds() == null || !plan.contextNeeds().contains("web");
        return recordIntent && signals.concreteCareLog() && noQuestion && noRisk && noWeb;
    }

    private boolean asksQuestion(String message) {
        return message.matches(".*(吗|么|怎么办|怎么处理|怎么回事|为什么|正常|可以|能不能|要不要|需要|会不会|注意什么|查一下|查询|政策|指南|建议|\\?).*");
    }

    private boolean matchesAnyTrigger(List<String> triggers, String message) {
        if (!StringUtils.hasText(message) || triggers == null || triggers.isEmpty()) return false;
        return triggers.stream().anyMatch((trigger) -> triggerMatches(trigger, message));
    }

    private boolean triggerMatches(String trigger, String message) {
        if (!StringUtils.hasText(trigger)) return false;
        try {
            return Pattern.compile(trigger).matcher(message).find();
        } catch (PatternSyntaxException ignored) {
            return message.contains(trigger);
        }
    }

    private List<String> planTopics(AgentPlan plan) {
        return plan == null || plan.topics() == null ? List.of() : plan.topics();
    }

    private List<String> planRiskHints(AgentPlan plan) {
        return plan == null ? List.of() : safeRisks(plan.riskHints());
    }

    private List<String> safeRisks(List<String> risks) {
        if (risks == null) return List.of();
        return risks.stream()
                .filter(StringUtils::hasText)
                .filter((risk) -> !"none".equals(risk))
                .toList();
    }

    private boolean hasAny(List<String> values, List<String> candidates) {
        if (values == null || candidates == null || values.isEmpty() || candidates.isEmpty()) return false;
        return values.stream().anyMatch(candidates::contains);
    }

    private String truncate(String value, int maxChars) {
        if (value == null) return "";
        if (value.length() <= maxChars) return value;
        return value.substring(0, Math.max(0, maxChars - 1)).trim() + "…";
    }

    private record RankedSection(
            SkillSection section,
            int score
    ) {
    }
}
