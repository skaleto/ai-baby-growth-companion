package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentChatMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekResponseFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AgentPlanner {

    private static final String PLANNER_SYSTEM_PROMPT = """
            你是“小宝记”的 agent planner。你只负责理解用户输入，不生成最终回复。
            输出必须是严格 JSON 对象，schema:
            {
              "intent": "record|question|reminder|mixed|smalltalk",
              "topics": ["feeding|sleep|poop|temperature|vaccine|growth|memory|reminder|expense|policy|general"],
              "targetDates": ["YYYY-MM-DD"],
              "contextNeeds": ["profile|careHistory|growthHistory|reminders|memories|web"],
              "toolRequests": [{"toolId":"web_search","query":"string","reason":"string"}],
              "riskHints": ["fever|medicine|vaccine|allergy|breathing|injury|none"],
              "mediaAction": null | {
                "intent": "save_to_album|describe|none",
                "targetScope": "current|previous|recent|unspecified",
                "targetKind": "image|video|media|any",
                "refHint": "string",
                "category": "growth|feeding|sleep|health|reminder|daily",
                "confidence": 0.0,
                "reason": "string"
              }
            }
            需要最新政策、地点信息、官方通知、疫苗政策、办事流程、天气等外部资料时，加入 web_search。
            需要查询商品信息或参考价格时，加入 web_search，但实际记账金额必须由用户确认。
            如果用户上传订单、小票、收据、发票、支付或付款截图，并要求识别花费、支出或记账，不要加入 web_search；这类任务应依赖上传图片中的实际付款信息。
            日常记录优先保留目标日期和主题，不要编造用户没说的事实。
            selectedSkills 只是可用技能目录。若看到 pediatric-care-guide，只代表系统可在后续最终回复中按需渐进式加载育儿基础知识；planner 不要把技能目录当成已经执行或已经加载的事实。
            用户可能用 12 小时制描述时间；没有上午/下午时，结合 currentTime 判断今天最近已经发生过的候选时间。
            “每隔 N 小时提醒喂奶、每半小时提醒喂奶、每 N 分钟喂奶闹钟、定时喂奶”是 reminder intent，并且 topics 应包含 feeding 和 reminder。
            用户要求撤销、删除、修改历史记录时，不要规划成已完成动作；当前只能提示能力边界。
            上传图片或视频本身不能规划成照护记录；App 截图、网页截图、聊天截图、记录页截图只属于附件描述问题，不要推导喂养、睡眠、便便、体温等记录意图。
            如果用户说“保存到相册、存进相册、收藏、留念、刚才的视频/照片保存”等，识别为 mediaAction.intent=save_to_album。
            mediaAction 只表达意图和目标线索，不代表已经保存；具体附件匹配、截图过滤和写入由系统执行。
            保存媒体到相册是独立动作；除非用户同一句明确要求记录成长、照护、提醒或记忆，否则不要把历史失败记录或最近上下文里的其他事件一起规划出来。
            """;

    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AgentPlanner(ObjectMapper objectMapper) {
        this(objectMapper, Clock.system(ZoneId.of("Asia/Shanghai")));
    }

    @Autowired
    public AgentPlanner(ObjectMapper objectMapper, Clock clock) {
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public DeepSeekChatRequest buildRequest(
            String model,
            AgentChatRequest request,
            List<Skill> selectedSkills,
            RecordSignals signals,
            boolean jsonResponseFormat
    ) {
        return new DeepSeekChatRequest(
                model,
                List.of(
                        new DeepSeekMessage("system", PLANNER_SYSTEM_PROMPT),
                        new DeepSeekMessage("user", buildPrompt(request, selectedSkills, signals))
                ),
                false,
                700,
                0.0,
                jsonResponseFormat ? new DeepSeekResponseFormat("json_object") : null,
                Map.of("type", "disabled"),
                null,
                null,
                null
        );
    }

    public AgentPlan parse(String content, AgentChatRequest request, RecordSignals signals) {
        try {
            AgentPlan parsed = objectMapper.readValue(extractJsonObject(content), AgentPlan.class);
            return normalize(parsed, request, signals);
        } catch (Exception ignored) {
            return heuristic(request, signals);
        }
    }

    public AgentPlan heuristic(AgentChatRequest request, RecordSignals signals) {
        String message = request.message() == null ? "" : request.message();
        boolean needsWeb = likelyNeedsExternalLookup(message) && !shouldSuppressWebForExpense(request, signals);
        boolean reminder = message.matches(".*(提醒|闹钟|记得|定时|每隔\\s*[\\d一二两三四五六七八九十半]+\\s*(分钟|分|小时)).*");
        boolean record = signals.concreteCareLog() ||
                signals.topics().stream().anyMatch((topic) -> List.of("feeding", "sleep", "poop", "temperature", "growth", "memory", "expense").contains(topic));
        String intent = reminder && record ? "mixed" : reminder ? "reminder" : record ? "record" : needsWeb ? "question" : "smalltalk";
        List<String> topics = signals.topics().isEmpty() ? List.of("general") : signals.topics();
        List<String> contextNeeds = needsWeb
                ? List.of("profile", "careHistory", "memories", "web")
                : record
                        ? List.of("profile", "careHistory", "memories")
                        : List.of("profile", "memories");
        List<AgentToolRequest> tools = needsWeb
                ? List.of(new AgentToolRequest("web_search", message, "用户问题需要外部资料验证"))
                : List.of();
        List<String> risks = signals.riskHints().isEmpty() ? List.of("none") : signals.riskHints();
        return new AgentPlan(intent, topics, signals.targetDates(), contextNeeds, tools, risks, null);
    }

    private String buildPrompt(AgentChatRequest request, List<Skill> selectedSkills, RecordSignals signals) {
        Map<String, Object> context = new LinkedHashMap<>();
        LocalDateTime now = LocalDateTime.now(clock);
        context.put("today", now.toLocalDate().toString());
        context.put("currentDateTime", now.truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("currentTime", now.toLocalTime().truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("capabilities", AgentCapabilityContract.promptContext());
        context.put("imageBoundaryPolicy", AgentCapabilityContract.imageBoundaryPolicy());
        context.put("selectedSkills", selectedSkills);
        context.put("babyProfile", request.babyProfile());
        context.put("ruleSignals", signals);
        context.put("attachments", attachmentSummaries(request.attachments()));
        context.put("recentMediaCandidates", recentMediaCandidates(request.recentMessages()));
        context.put("recentMessages", tail(request.recentMessages(), 4));
        context.put("userMessage", request.message());
        try {
            return "请为下面输入生成 AgentPlan JSON。\n上下文:\n%s".formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build planner prompt", exception);
        }
    }

    private AgentPlan normalize(AgentPlan parsed, AgentChatRequest request, RecordSignals signals) {
        AgentPlan fallback = heuristic(request, signals);
        String intent = oneOf(parsed.intent(), List.of("record", "question", "reminder", "mixed", "smalltalk"), fallback.intent());
        List<String> topics = clean(parsed.topics()).isEmpty() ? fallback.topics() : clean(parsed.topics());
        List<String> targetDates = clean(parsed.targetDates()).isEmpty() ? fallback.targetDates() : clean(parsed.targetDates());
        List<String> contextNeeds = clean(parsed.contextNeeds()).isEmpty() ? fallback.contextNeeds() : clean(parsed.contextNeeds());
        List<String> riskHints = clean(parsed.riskHints()).isEmpty() ? fallback.riskHints() : clean(parsed.riskHints());
        boolean suppressExpenseWeb = shouldSuppressWebForExpense(request, signals);
        if (suppressExpenseWeb) {
            contextNeeds = contextNeeds.stream().filter((need) -> !"web".equals(need)).toList();
        }
        List<AgentToolRequest> toolRequests = parsed.toolRequests() == null ? fallback.toolRequests() : parsed.toolRequests().stream()
                .filter((tool) -> tool != null && StringUtils.hasText(tool.toolId()) && StringUtils.hasText(tool.query()))
                .filter((tool) -> !suppressExpenseWeb || !"web_search".equals(tool.toolId()))
                .limit(3)
                .toList();
        if ((toolRequests == null || toolRequests.isEmpty()) && fallback.toolRequests() != null && !fallback.toolRequests().isEmpty()) {
            toolRequests = fallback.toolRequests();
        }
        return new AgentPlan(intent, topics, targetDates, contextNeeds, toolRequests, riskHints, normalizeMediaAction(parsed.mediaAction()));
    }

    private boolean likelyNeedsExternalLookup(String message) {
        if (!StringUtils.hasText(message)) return false;
        return message.matches(".*(查|查询|搜|搜索|联网|最新|政策|规定|官方|通知|天气|哪里|地址|电话|办理|流程|价格|多少钱).*")
                || message.matches(".*(现在|当前|今天).*(天气|政策|规定|价格|新闻|通知).*");
    }

    private boolean shouldSuppressWebForExpense(AgentChatRequest request, RecordSignals signals) {
        String message = request.message() == null ? "" : request.message();
        if (message.matches(".*(参考价|参考价格|比价|商品信息|哪里买|官网|最新价格|价格趋势).*")) return false;
        boolean hasVisualAttachment = request.attachments() != null && request.attachments().stream()
                .anyMatch((attachment) -> attachment != null && List.of("image", "video").contains(attachment.kind()));
        boolean expenseTopic = signals.expenseSignal() != null || signals.topics().contains("expense");
        boolean expenseImageTask = message.matches(".*(识别|看一下|帮我|整理|记录|记账).*(花费|支出|账本|订单|小票|收据|发票|支付|付款|金额).*")
                || message.matches(".*(订单|小票|收据|发票|支付截图|付款截图|支付凭证|付款凭证).*(记账|账本|花费|支出|金额).*");
        return expenseTopic && (expenseImageTask || hasVisualAttachment && message.matches(".*(花费|支出|账本|记账|订单|小票|收据|发票|支付|付款|金额).*"));
    }

    private List<Map<String, String>> attachmentSummaries(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .map((attachment) -> {
                    Map<String, String> summary = new LinkedHashMap<>();
                    if (StringUtils.hasText(attachment.id())) summary.put("id", attachment.id());
                    if (StringUtils.hasText(attachment.name())) summary.put("name", attachment.name());
                    if (StringUtils.hasText(attachment.kind())) summary.put("kind", attachment.kind());
                    if (StringUtils.hasText(attachment.dataUrl())) summary.put("contentStatus", "visual-bytes-attached");
                    return summary;
                })
                .toList();
    }

    private List<Map<String, String>> recentMediaCandidates(List<AgentChatMessage> messages) {
        if (messages == null || messages.isEmpty()) return List.of();
        List<Map<String, String>> candidates = new java.util.ArrayList<>();
        for (int messageIndex = messages.size() - 1; messageIndex >= 0 && candidates.size() < 8; messageIndex -= 1) {
            AgentChatMessage message = messages.get(messageIndex);
            if (message == null || message.attachments() == null) continue;
            for (int attachmentIndex = message.attachments().size() - 1; attachmentIndex >= 0 && candidates.size() < 8; attachmentIndex -= 1) {
                AgentAttachment attachment = message.attachments().get(attachmentIndex);
                if (attachment == null || !List.of("image", "video").contains(attachment.kind())) continue;
                Map<String, String> candidate = new LinkedHashMap<>();
                if (StringUtils.hasText(message.id())) candidate.put("messageId", message.id());
                if (StringUtils.hasText(message.createdAt())) candidate.put("messageCreatedAt", message.createdAt());
                if (StringUtils.hasText(message.text())) candidate.put("messageText", message.text());
                if (StringUtils.hasText(attachment.id())) candidate.put("attachmentId", attachment.id());
                if (StringUtils.hasText(attachment.name())) candidate.put("name", attachment.name());
                if (StringUtils.hasText(attachment.kind())) candidate.put("kind", attachment.kind());
                candidates.add(candidate);
            }
        }
        return candidates;
    }

    private AgentMediaAction normalizeMediaAction(AgentMediaAction action) {
        if (action == null) return null;
        String intent = oneOf(action.intent(), List.of("save_to_album", "describe", "none"), "none");
        if (!"save_to_album".equals(intent)) return null;
        String targetScope = oneOf(action.targetScope(), List.of("current", "previous", "recent", "unspecified"), "unspecified");
        String targetKind = oneOf(action.targetKind(), List.of("image", "video", "media", "any"), "media");
        String category = oneOf(action.category(), List.of("growth", "feeding", "sleep", "health", "reminder", "daily"), "daily");
        double confidence = action.confidence() == null ? 0.7 : Math.max(0.0, Math.min(1.0, action.confidence()));
        return new AgentMediaAction(
                intent,
                targetScope,
                targetKind,
                StringUtils.hasText(action.refHint()) ? action.refHint().trim() : "",
                category,
                confidence,
                StringUtils.hasText(action.reason()) ? action.reason().trim() : "用户表达了保存媒体到相册的意图"
        );
    }

    private String oneOf(String value, List<String> allowed, String fallback) {
        return allowed.contains(value) ? value : fallback;
    }

    private List<String> clean(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .limit(8)
                .toList();
    }

    private <T> List<T> tail(List<T> items, int limit) {
        if (items == null || items.isEmpty()) return List.of();
        int start = Math.max(0, items.size() - limit);
        return items.subList(start, items.size());
    }

    private String extractJsonObject(String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("planner output did not contain JSON");
        }
        return trimmed.substring(start, end + 1);
    }
}
