package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RecordDiaperEventTool extends AgentActionToolSupport {

    public RecordDiaperEventTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "record_diaper_event";
    }

    @Override
    public String displayName() {
        return "记录尿布";
    }

    @Override
    public String runningMessage() {
        return "正在记录尿布";
    }

    @Override
    String description() {
        return "记录一次便便、尿尿或尿布更换。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "date", stringProperty("发生日期，YYYY-MM-DD"),
                        "time", stringProperty("发生时间，HH:mm；未知可为空字符串"),
                        "diaperType", Map.of("type", "string", "enum", List.of("poop", "pee", "mixed", "diaper"), "description", "尿布事件类型"),
                        "description", stringProperty("便便形态或补充说明"),
                        "idempotencyKey", stringProperty("稳定去重键")
                ),
                List.of("date", "diaperType", "idempotencyKey")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String date = text(args, "date", "");
        String diaperType = text(args, "diaperType", "");
        if (!StringUtils.hasText(date)) return AgentActionResult.needsInput(id(), "care_log", "这次尿布记录是哪一天发生的？", List.of("date"));
        if (!StringUtils.hasText(diaperType)) return AgentActionResult.needsInput(id(), "care_log", "这次是便便、尿尿，还是换尿布？", List.of("diaperType"));
        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("date", date);
        String description = text(args, "description", diaperLabel(diaperType));
        if ("poop".equals(diaperType) || "mixed".equals(diaperType)) patch.put("poop", description);
        else patch.putArray("notes").add(description);
        ObjectNode event = patch.putArray("events").addObject();
        event.put("type", "poop".equals(diaperType) || "mixed".equals(diaperType) ? "poop" : "note");
        event.put("date", date);
        putIfText(event, "time", text(args, "time", ""));
        event.put("title", "poop".equals(diaperType) || "mixed".equals(diaperType) ? "便便" : "尿布");
        event.put("note", description);
        event.putArray("tags").add("尿布");
        return mutationService.applyCareLogPatch(context, id(), text(args, "idempotencyKey", call.callId()), patch);
    }

    private String diaperLabel(String type) {
        return switch (type) {
            case "poop" -> "便便";
            case "pee" -> "尿尿";
            case "mixed" -> "便便和尿尿";
            default -> "换尿布";
        };
    }
}
