package com.xiaobao.babycompanion.agent.action;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.service.AgentMutationService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CreateMilestonePendingTool extends AgentActionToolSupport {

    public CreateMilestonePendingTool(ObjectMapper objectMapper, AgentMutationService mutationService) {
        super(objectMapper, mutationService);
    }

    @Override
    public String id() {
        return "create_milestone_pending";
    }

    @Override
    public String displayName() {
        return "整理里程碑";
    }

    @Override
    public String runningMessage() {
        return "正在整理里程碑";
    }

    @Override
    String description() {
        return "把第一次翻身、会笑、会坐等成长里程碑整理成待确认草稿。";
    }

    @Override
    Map<String, Object> parameters() {
        return objectSchema(
                Map.of(
                        "idempotencyKey", stringProperty("稳定去重键"),
                        "date", stringProperty("发生日期，YYYY-MM-DD"),
                        "title", stringProperty("里程碑标题"),
                        "summary", stringProperty("一句话摘要"),
                        "type", stringProperty("类型，如 milestone 或 growth")
                ),
                List.of("idempotencyKey", "date", "title", "summary")
        );
    }

    @Override
    public AgentActionResult executeAction(AgentActionCall call, AgentActionContext context) {
        ObjectNode args = parseArguments(call.arguments());
        String date = text(args, "date", "");
        String title = text(args, "title", "");
        String summary = text(args, "summary", "");
        if (!StringUtils.hasText(date) || !StringUtils.hasText(title) || !StringUtils.hasText(summary)) {
            return AgentActionResult.needsInput(id(), "pending_effect", "这个里程碑还缺日期或具体内容，可以再补充一下吗？", List.of("date", "title", "summary"));
        }
        ObjectNode growthEvent = objectMapper.createObjectNode();
        growthEvent.put("id", "growth-" + text(args, "idempotencyKey", call.callId()));
        growthEvent.put("type", text(args, "type", "milestone"));
        growthEvent.put("title", title);
        growthEvent.put("date", date);
        growthEvent.put("summary", summary);
        growthEvent.put("firstTime", true);
        growthEvent.putArray("tags").add("里程碑");
        ObjectNode effect = objectMapper.createObjectNode();
        effect.set("growthEvent", growthEvent);
        return mutationService.createPendingEffect(
                context,
                id(),
                text(args, "idempotencyKey", call.callId()),
                "milestone",
                effect,
                Map.of("date", date, "title", title)
        );
    }
}
