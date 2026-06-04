package com.xiaobao.babycompanion.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * 产品能力矩阵（单一事实源）的 Java 映射。内容来自
 * {@code resources/agent/capability-manifest.json}。随产品迭代只需更新该 JSON，
 * agent 运行时感知、benchmark 覆盖检查、文档三处即同步。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CapabilityManifest(
        String version,
        List<Capability> capabilities,
        List<GlobalBoundary> globalBoundaries,
        ImageBoundary imageBoundary,
        List<String> replyRules
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Capability(
            String id,
            String name,
            String effectType,
            String eventType,
            String trigger,
            String summary,
            List<String> requiredFields,
            List<String> modes,
            List<String> can,
            List<String> cannot,
            boolean enabled,
            List<String> benchmark
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GlobalBoundary(
            String id,
            String rule,
            String userMessage
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ImageBoundary(
            String photoDescription,
            String albumAdmission,
            List<String> ignoredImages,
            String careRecordBoundary
    ) {
    }
}
