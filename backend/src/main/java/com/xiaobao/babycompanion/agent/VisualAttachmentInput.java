package com.xiaobao.babycompanion.agent;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.util.StringUtils;

record VisualAttachmentInput(
        String id,
        String name,
        String kind,
        String dataUrl
) {
    Map<String, String> metadata() {
        Map<String, String> values = new LinkedHashMap<>();
        if (StringUtils.hasText(id)) values.put("id", id);
        if (StringUtils.hasText(name)) values.put("name", name);
        if (StringUtils.hasText(kind)) values.put("kind", kind);
        return values;
    }
}
