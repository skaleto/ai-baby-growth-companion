package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RecordTemperatureEventTool extends AgentActionToolSupport {

    public RecordTemperatureEventTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "record_temperature_event";
    }

    @Override
    public String displayName() {
        return "记录体温";
    }

    @Override
    public String runningMessage() {
        return "正在记录体温";
    }

    @Override
    String description() {
        return "记录一次体温。高热、低温或需要照护人确认的健康观察创建待确认草稿，不直接自动落库。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "date", stringProperty("发生日期，YYYY-MM-DD"),
                        "time", stringProperty("发生时间，HH:mm；未知可为空字符串"),
                        "temperatureC", numberProperty("摄氏体温"),
                        "note", stringProperty("补充说明"),
                        "idempotencyKey", stringProperty("稳定去重键")
                ),
                List.of("date", "temperatureC", "idempotencyKey")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String date = text(args, "date", "");
        double temperature = number(args, "temperatureC", -1);
        if (!StringUtils.hasText(date)) return AgentActionResult.needsInput(id(), "care_log", "这次体温是哪一天测的？", List.of("date"));
        if (temperature < 35.0 || temperature > 42.0) {
            return AgentActionResult.needsInput(id(), "care_log", "这个体温数值看起来不太对，可以再确认一下是多少度吗？", List.of("temperatureC"));
        }
        ObjectNode patch = temperaturePatch(args, date, temperature);
        if (temperature >= 38.0 || temperature <= 36.0) {
            ObjectNode effect = objectMapper.createObjectNode();
            effect.set("careLogPatch", patch);
            effect.putArray("safetyAlerts").addObject()
                    .put("level", "warning")
                    .put("category", "health")
                    .put("message", "体温异常时请结合宝宝精神状态观察，必要时联系医生。");
            return mutationService.createPendingEffect(
                    context,
                    id(),
                    text(args, "idempotencyKey", call.callId()),
                    "health_observation",
                    effect,
                    Map.of("date", date, "temperatureC", temperature)
            );
        }
        return mutationService.applyCareLogPatch(context, id(), text(args, "idempotencyKey", call.callId()), patch);
    }

    private ObjectNode temperaturePatch(ObjectNode args, String date, double temperature) {
        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("date", date);
        patch.put("temperature", temperature);
        ObjectNode event = patch.putArray("events").addObject();
        event.put("type", "temperature");
        event.put("date", date);
        putIfText(event, "time", text(args, "time", ""));
        event.put("title", "体温");
        event.put("temperature", temperature);
        putIfText(event, "note", text(args, "note", ""));
        event.putArray("tags").add("体温");
        return patch;
    }
}
