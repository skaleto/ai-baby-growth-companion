package com.xiaobao.babycompanion.agent;

import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.yaml.snakeyaml.Yaml;

@Component
public class SkillRegistry {

    private static final Logger log = LoggerFactory.getLogger(SkillRegistry.class);
    private static final String SKILL_RESOURCE_PATTERN = "classpath*:agent-skills/*.yml";

    private final List<SkillDefinition> definitions;
    private final Map<String, SkillDefinition> byId;

    public SkillRegistry() {
        this(new PathMatchingResourcePatternResolver());
    }

    SkillRegistry(ResourcePatternResolver resourceResolver) {
        this.definitions = loadDefinitions(resourceResolver);
        Map<String, SkillDefinition> values = new LinkedHashMap<>();
        definitions.forEach((definition) -> values.put(definition.id(), definition));
        this.byId = Map.copyOf(values);
    }

    public List<Skill> selectSkills(AgentChatRequest request) {
        return definitions.stream()
                .map((definition) -> new Skill(definition.id(), definition.name(), definition.description()))
                .toList();
    }

    public List<SkillDefinition> definitions() {
        return definitions;
    }

    public Optional<SkillDefinition> findById(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    public boolean progressiveDisclosure(String skillId) {
        return findById(skillId).map(SkillDefinition::progressiveDisclosure).orElse(false);
    }

    @SuppressWarnings("unchecked")
    private List<SkillDefinition> loadDefinitions(ResourcePatternResolver resourceResolver) {
        try {
            Resource[] resources = resourceResolver.getResources(SKILL_RESOURCE_PATTERN);
            if (resources.length == 0) {
                throw new IllegalStateException("No agent skill definitions found at " + SKILL_RESOURCE_PATTERN);
            }

            Yaml yaml = new Yaml();
            return java.util.Arrays.stream(resources)
                    .sorted(Comparator.comparing(this::resourceName))
                    .map((resource) -> parseDefinition(resource, yaml))
                    .toList();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load agent skill definitions", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private SkillDefinition parseDefinition(Resource resource, Yaml yaml) {
        try (InputStream inputStream = resource.getInputStream()) {
            Object loaded = yaml.load(inputStream);
            if (!(loaded instanceof Map<?, ?> raw)) {
                throw new IllegalStateException("Agent skill definition is not a map: " + resourceName(resource));
            }
            Map<String, Object> values = (Map<String, Object>) raw;
            String id = requiredText(values, "id", resource);
            String name = requiredText(values, "name", resource);
            String description = requiredText(values, "description", resource);
            List<SkillSection> sections = listOfMaps(values.get("sections")).stream()
                    .map(this::parseSection)
                    .toList();
            SkillDefinition definition = new SkillDefinition(
                    id,
                    name,
                    description,
                    mapValue(values.get("disclosurePolicy")),
                    sections,
                    stringList(values.get("sourceAnchors")),
                    stringList(values.get("copyrightBoundary"))
            );
            log.info("Loaded agent skill {} with {} section(s)", definition.id(), definition.sections().size());
            return definition;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read agent skill definition: " + resourceName(resource), exception);
        }
    }

    private SkillSection parseSection(Map<String, Object> values) {
        return new SkillSection(
                requiredText(values, "id"),
                textValue(values.get("title"), requiredText(values, "id")),
                stringList(values.get("topics")),
                stringList(values.get("riskHints")),
                stringList(values.get("triggers")),
                stringList(values.get("content")),
                integerValue(values.get("maxChars"))
        );
    }

    private String requiredText(Map<String, Object> values, String key, Resource resource) {
        String value = textValue(values.get(key), "");
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Agent skill definition missing " + key + ": " + resourceName(resource));
        }
        return value;
    }

    private String requiredText(Map<String, Object> values, String key) {
        String value = textValue(values.get(key), "");
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Agent skill section missing " + key);
        }
        return value;
    }

    private String textValue(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : fallback;
    }

    private Integer integerValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        if (value == null) return null;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return new LinkedHashMap<>((Map<String, Object>) map);
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listOfMaps(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream()
                .filter((item) -> item instanceof Map<?, ?>)
                .<Map<String, Object>>map((item) -> new LinkedHashMap<>((Map<String, Object>) item))
                .toList();
    }

    private List<String> stringList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream()
                .map(String::valueOf)
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    private String resourceName(Resource resource) {
        String filename = resource.getFilename();
        return StringUtils.hasText(filename) ? filename : resource.getDescription();
    }
}
