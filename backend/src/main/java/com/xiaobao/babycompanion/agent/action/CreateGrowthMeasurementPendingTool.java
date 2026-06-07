package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CreateGrowthMeasurementPendingTool extends AgentActionToolSupport {

    public CreateGrowthMeasurementPendingTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "create_growth_measurement_pending";
    }

    @Override
    public String displayName() {
        return "整理成长测量";
    }

    @Override
    public String runningMessage() {
        return "正在整理成长测量";
    }

    @Override
    String description() {
        return "把身高、体重、头围等成长测量整理成后端持久化的待确认草稿。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "idempotencyKey", stringProperty("稳定去重键"),
                        "measurements", Map.of(
                                "type", "array",
                                "description", "成长测量数组",
                                "items", objectSchema(
                                        Map.of(
                                                "type", Map.of("type", "string", "enum", List.of("height", "weight", "headCircumference")),
                                                "value", numberProperty("测量值"),
                                                "unit", stringProperty("单位，如 cm 或 kg"),
                                                "date", stringProperty("测量日期，YYYY-MM-DD")
                                        ),
                                        List.of("type", "value", "unit", "date")
                                )
                        )
                ),
                List.of("idempotencyKey", "measurements")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        JsonNode measurements = args.get("measurements");
        if (!(measurements instanceof ArrayNode array) || array.isEmpty()) {
            return AgentActionResult.needsInput(id(), "pending_effect", "这次要记录的是身高、体重还是头围？数值是多少？", List.of("measurements"));
        }
        ArrayNode normalized = objectMapper.createArrayNode();
        for (JsonNode item : array) {
            String type = text(item, "type", "");
            String unit = text(item, "unit", "");
            String date = text(item, "date", "");
            double value = number(item, "value", -1);
            if (!StringUtils.hasText(type) || !StringUtils.hasText(unit) || !StringUtils.hasText(date) || value <= 0) {
                return AgentActionResult.needsInput(id(), "pending_effect", "成长测量还缺类型、日期、数值或单位，补充后我再整理。", List.of("measurements"));
            }
            ObjectNode measurement = objectMapper.createObjectNode();
            measurement.put("id", "growthMeasurement-" + text(args, "idempotencyKey", call.callId()) + "-" + normalized.size());
            measurement.put("type", type);
            measurement.put("value", value);
            measurement.put("unit", unit);
            measurement.put("date", date);
            normalized.add(measurement);
        }
        ObjectNode effect = objectMapper.createObjectNode();
        effect.set("growthMeasurements", normalized);
        return mutationService.createPendingEffect(
                context,
                id(),
                text(args, "idempotencyKey", call.callId()),
                "growth_measurement",
                effect,
                Map.of("measurementCount", normalized.size())
        );
    }
}
