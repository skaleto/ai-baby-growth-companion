package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RecordSleepEventTool extends AgentActionToolSupport {

    public RecordSleepEventTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "record_sleep_event";
    }

    @Override
    public String displayName() {
        return "记录睡眠";
    }

    @Override
    public String runningMessage() {
        return "正在记录睡眠";
    }

    @Override
    String description() {
        return "记录一次已经结束、且用户提供了时长的睡眠。只有入睡/睡着但没有时长时不要写入，应让工具追问。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "date", stringProperty("发生日期，YYYY-MM-DD"),
                        "time", stringProperty("开始时间，HH:mm；未知可为空字符串"),
                        "durationHours", numberProperty("睡眠时长，小时"),
                        "note", stringProperty("补充说明"),
                        "idempotencyKey", stringProperty("稳定去重键")
                ),
                List.of("date", "durationHours", "idempotencyKey")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String date = text(args, "date", "");
        double duration = number(args, "durationHours", -1);
        if (!StringUtils.hasText(date)) return AgentActionResult.needsInput(id(), "care_log", "这次睡眠是哪一天发生的？", List.of("date"));
        if (duration <= 0) return AgentActionResult.needsInput(id(), "care_log", "这次大概睡了多久？", List.of("durationHours"));
        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("date", date);
        patch.put("sleepHours", Math.round(duration * 10.0) / 10.0);
        ObjectNode event = patch.putArray("events").addObject();
        event.put("type", "sleep");
        event.put("date", date);
        putIfText(event, "time", text(args, "time", ""));
        event.put("title", "睡觉");
        event.put("durationHours", duration);
        putIfText(event, "note", text(args, "note", ""));
        event.putArray("tags").add("睡眠");
        return mutationService.applyCareLogPatch(context, id(), text(args, "idempotencyKey", call.callId()), patch);
    }
}
