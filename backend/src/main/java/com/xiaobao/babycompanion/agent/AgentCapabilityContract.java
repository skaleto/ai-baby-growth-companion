package com.xiaobao.babycompanion.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Agent 能力契约。内容由单一事实源 {@code resources/agent/capability-manifest.json} 驱动；
 * 本类只负责把 manifest 派生成 prompt 注入结构和边界文案。新增或修改能力请改那份 JSON，
 * 不要在此硬编码——这样 agent 运行时感知、benchmark 覆盖、文档三处会一起更新。
 */
public final class AgentCapabilityContract {

    private static final String MANIFEST_RESOURCE = "/agent/capability-manifest.json";
    private static final CapabilityManifest MANIFEST = load();

    private AgentCapabilityContract() {
    }

    private static CapabilityManifest load() {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream input = AgentCapabilityContract.class.getResourceAsStream(MANIFEST_RESOURCE)) {
            if (input == null) {
                throw new IllegalStateException("Capability manifest not found on classpath: " + MANIFEST_RESOURCE);
            }
            return mapper.readValue(input, CapabilityManifest.class);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to load capability manifest", exception);
        }
    }

    /** 给 benchmark 覆盖 gate、渐进披露、未来 tool 化使用的原始能力矩阵。 */
    public static CapabilityManifest manifest() {
        return MANIFEST;
    }

    public static Map<String, Object> promptContext() {
        List<String> supported = new ArrayList<>();
        LinkedHashSet<String> unsupported = new LinkedHashSet<>();
        for (CapabilityManifest.Capability capability : MANIFEST.capabilities()) {
            if (!capability.enabled()) {
                continue;
            }
            supported.add(capability.name() + "：" + capability.summary());
            if (capability.cannot() != null) {
                unsupported.addAll(capability.cannot());
            }
        }
        for (CapabilityManifest.GlobalBoundary boundary : MANIFEST.globalBoundaries()) {
            if (boundary.rule() != null) {
                unsupported.add(boundary.rule());
            }
        }
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("supportedActions", List.copyOf(supported));
        context.put("unsupportedActions", List.copyOf(unsupported));
        context.put("replyRules", MANIFEST.replyRules());
        return context;
    }

    public static Map<String, Object> imageBoundaryPolicy() {
        CapabilityManifest.ImageBoundary boundary = MANIFEST.imageBoundary();
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("photoDescription", boundary.photoDescription());
        policy.put("albumAdmission", boundary.albumAdmission());
        policy.put("ignoredImages", boundary.ignoredImages());
        policy.put("careRecordBoundary", boundary.careRecordBoundary());
        return policy;
    }

    public static boolean unsupportedMutationRequest(String text) {
        String value = text == null ? "" : text;
        return value.matches(".*(撤销|删除|删掉|取消刚才|改掉|修改刚才|改一下刚才|回滚).*")
                || value.matches(".*(身高|身长|体重|重量|头围|成长数据|成长记录).*(改成|改为|修改|更新|设置成|更正为|修正为).*")
                || value.matches(".*(改成|改为|修改|更新|设置成|更正为|修正为).*(身高|身长|体重|重量|头围|成长数据|成长记录).*")
                || value.matches(".*(把|将)?(宝宝|小宝|孩子)?(昵称|名字|生日|出生日期|性别|喂养方式|资料|档案|profile).*(改成|改为|修改|更新|设置成).*")
                || value.matches(".*(改成|改为|修改|更新|设置成).*(宝宝|小宝|孩子)?(昵称|名字|生日|出生日期|性别|喂养方式|资料|档案|profile).*");
    }

    public static String unsupportedMutationMessage() {
        return boundaryMessage("no_history_mutation");
    }

    public static String privateStateShareMessage() {
        return boundaryMessage("no_private_share");
    }

    private static String boundaryMessage(String id) {
        return MANIFEST.globalBoundaries().stream()
                .filter(boundary -> id.equals(boundary.id()))
                .map(CapabilityManifest.GlobalBoundary::userMessage)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("");
    }
}
