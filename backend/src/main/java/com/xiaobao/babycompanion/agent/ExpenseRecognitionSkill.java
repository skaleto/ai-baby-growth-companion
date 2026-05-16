package com.xiaobao.babycompanion.agent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.dto.agent.AgentEffectDecision;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekMessage;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ExpenseRecognitionSkill {

    static final String SKILL_ID = SkillRouter.EXPENSE_RECOGNITION_SKILL_ID;
    private static final int DEFAULT_BATCH_SIZE = 4;
    private static final Set<String> EXPENSE_CATEGORIES = Set.of(
            "formula",
            "diaper",
            "food",
            "clothing",
            "toy",
            "health",
            "vaccine",
            "daily",
            "education",
            "other"
    );

    private final ObjectMapper objectMapper;

    public ExpenseRecognitionSkill(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ExpenseRecognitionResult execute(
            ExpenseRecognitionInput input,
            ExpenseRecognitionModelClient modelClient,
            SkillStatusSink statusSink
    ) {
        Instant startedAt = Instant.now();
        RuntimeModel runtimeModel = input.runtimeModel();
        int batchSize = configuredBatchSize(input);
        if (input.visualInputs().isEmpty()) {
            return failure(
                    input,
                    startedAt,
                    "missing_attachment",
                    "没找到可识别的支出图片，可以重新发送订单、小票或付款截图后再试。",
                    0,
                    List.of(),
                    List.of()
            );
        }
        if (runtimeModel == null || !runtimeModel.supportsImageInput()) {
            return failure(
                    input,
                    startedAt,
                    "unsupported_visual_model",
                    "当前模型暂不支持图片支出识别，请切换到支持图片的模型后再试。",
                    0,
                    input.visualInputs().stream().map(VisualAttachmentInput::metadata).toList(),
                    List.of()
            );
        }

        List<List<VisualAttachmentInput>> batches = batches(input.visualInputs(), batchSize);
        sendStatus(statusSink, batches.size() > 1
                ? "正在分批识别 " + input.visualInputs().size() + " 张支出图片"
                : "正在识别支出图片");
        List<BatchResult> batchResults = new ArrayList<>();
        List<VisualAnalysisResult> visualSummaries = new ArrayList<>();

        for (int index = 0; index < batches.size(); index += 1) {
            int batchNumber = index + 1;
            List<VisualAttachmentInput> batch = batches.get(index);
            if (batches.size() > 1) {
                sendStatus(statusSink, "正在识别第 " + batchNumber + "/" + batches.size() + " 批支出图片");
            }
            try {
                ExpenseRecognitionModelResponse response = modelClient.call(
                        buildModelRequest(input, batch, batchNumber, batches.size()),
                        batchNumber,
                        batches.size()
                );
                String content = response == null ? "" : response.content();
                BatchResult parsed = parseBatchResult(content, batch, batchNumber, batches.size());
                batchResults.add(parsed);
                visualSummaries.add(new VisualAnalysisResult(
                        batchNumber,
                        batches.size(),
                        batch.size(),
                        batch.stream().map(VisualAttachmentInput::metadata).toList(),
                        StringUtils.hasText(content) ? content : parsed.summary()
                ));
            } catch (RuntimeException exception) {
                String code = errorCode(exception);
                return failure(
                        input,
                        startedAt,
                        code,
                        userFacingError(code),
                        batches.size(),
                        input.visualInputs().stream().map(VisualAttachmentInput::metadata).toList(),
                        visualSummaries
                );
            }
        }

        List<Map<String, Object>> evidence = new ArrayList<>();
        List<String> clarifications = new ArrayList<>();
        List<AgentEffectDecision> candidates = new ArrayList<>();
        for (BatchResult result : batchResults) {
            evidence.addAll(result.evidence());
            clarifications.addAll(result.clarifications().stream()
                    .filter(this::isActionableClarification)
                    .toList());
            for (JsonNode expense : result.expenses()) {
                AgentEffectDecision candidate = effectCandidate(expense, input, result.evidence());
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
        }

        String status;
        String aiTextDraft;
        String userFacingError = null;
        if (!candidates.isEmpty()) {
            status = "complete";
            aiTextDraft = "我已从图片里识别出支出，并整理成待确认的账本草稿。";
        } else if (!clarifications.isEmpty()) {
            status = "needs_clarification";
            aiTextDraft = clarifications.get(0);
        } else {
            status = "no_recognizable_amount";
            aiTextDraft = "我看到了图片，但没有识别到可用于记账的实际支付金额。可以补充更清晰的付款截图或直接告诉我金额。";
            userFacingError = aiTextDraft;
        }

        Instant completedAt = Instant.now();
        SkillTraceSummary traceSummary = new SkillTraceSummary(
                SKILL_ID,
                SkillMode.EXECUTE,
                status,
                "expenseRecognition",
                runtimeModel.id(),
                batches.size(),
                input.visualInputs().stream().map(VisualAttachmentInput::id).filter(StringUtils::hasText).toList(),
                inputSummary(input),
                resultSummary(status, candidates, clarifications, evidence),
                candidates,
                userFacingError,
                null,
                completedAt.toEpochMilli() - startedAt.toEpochMilli(),
                startedAt,
                completedAt
        );
        return new ExpenseRecognitionResult(status, aiTextDraft, userFacingError, candidates, clarifications, evidence, visualSummaries, traceSummary);
    }

    DeepSeekChatRequest buildModelRequest(
            ExpenseRecognitionInput input,
            List<VisualAttachmentInput> batch,
            int batchNumber,
            int batchCount
    ) {
        RuntimeModel runtimeModel = input.runtimeModel();
        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt(input, batch, batchNumber, batchCount)));
        batch.forEach((visual) -> content.add(Map.of(
                "type", "image_url",
                "image_url", Map.of("url", visual.dataUrl())
        )));
        return new DeepSeekChatRequest(
                runtimeModel.apiModel(),
                List.of(
                        new DeepSeekMessage("system", systemPrompt()),
                        new DeepSeekMessage("user", content, null, null)
                ),
                false,
                configuredMaxTokens(input),
                configuredTemperature(input),
                null,
                Map.of("type", "disabled"),
                null,
                null,
                null
        );
    }

    private String systemPrompt() {
        return """
                你是“小宝记”的支出图片识别 skill worker。你只做订单、小票、收据、发票、付款截图的事实抽取。
                禁止联网搜索、禁止查询参考价格、禁止猜测不可读字段、禁止把标价当作实际支付金额。
                只有图片或用户文字里能看到实际支付金额、宝宝相关用途/商品、日期和证据时，才输出可记账 expenses。
                分类不确定时必须自己按商品名/用途推断，仍不确定就填 other；不要因为分类向用户澄清。
                输出必须是严格 JSON 对象，不要输出 Markdown。schema:
                {
                  "status": "complete|needs_clarification|no_recognizable_amount",
                  "aiTextDraft": "中文草稿",
                  "userFacingError": null,
                  "expenses": [{
                    "title": "商品或用途",
                    "amount": 12.34,
                    "currency": "CNY",
                    "category": "formula|diaper|food|clothing|toy|health|daily|education|other",
                    "date": "YYYY-MM-DD",
                    "quantity": null,
                    "unitPrice": null,
                    "merchant": null,
                    "note": "证据说明",
                    "brand": null,
                    "spec": null,
                    "attachmentIds": ["attachment-id"]
                  }],
                  "clarifications": ["自然中文澄清"],
                  "evidence": [{"attachmentId":"id","visibleFacts":["看见的事实"],"confidence":0.0}]
                }
                """;
    }

    private String prompt(ExpenseRecognitionInput input, List<VisualAttachmentInput> batch, int batchNumber, int batchCount) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", input.traceId());
        context.put("batch", batchNumber + "/" + batchCount);
        context.put("userMessage", input.request().message());
        context.put("targetDates", input.signals() == null ? List.of() : input.signals().targetDates());
        context.put("attachmentOrder", batch.stream().map(VisualAttachmentInput::metadata).toList());
        context.put("rule", "每个识别字段都必须来自图片或用户文字；如果金额、用途或日期缺失，返回 clarification，不要造完整账本。分类不作为阻断条件：月子鞋/月子服归 clothing，摇奶器/恒温壶/暖奶器/奶瓶/洗衣机等宝宝日用设备归 daily，仍不确定填 other，不要追问分类。");
        try {
            return "请识别本批支出图片并返回 JSON。\n上下文:\n%s".formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build expense recognition prompt", exception);
        }
    }

    private BatchResult parseBatchResult(String content, List<VisualAttachmentInput> batch, int batchNumber, int batchCount) {
        try {
            JsonNode root = objectMapper.readTree(extractJsonObject(content));
            List<JsonNode> expenses = arrayValues(root.path("expenses"));
            List<String> clarifications = textArray(root.path("clarifications"));
            List<Map<String, Object>> evidence = evidenceValues(root.path("evidence"));
            if (evidence.isEmpty()) {
                evidence = batch.stream()
                        .map((input) -> Map.<String, Object>of("attachmentId", input.id(), "visibleFacts", List.of("模型未返回结构化证据"), "confidence", 0.3))
                        .toList();
            }
            return new BatchResult(
                    batchNumber,
                    batchCount,
                    root.path("status").asText("needs_clarification"),
                    root.path("aiTextDraft").asText(""),
                    expenses,
                    clarifications,
                    evidence,
                    content
            );
        } catch (Exception exception) {
            List<Map<String, Object>> evidence = batch.stream()
                    .map((input) -> Map.<String, Object>of("attachmentId", input.id(), "visibleFacts", List.of("模型返回了非 JSON 摘要"), "confidence", 0.25))
                    .toList();
            return new BatchResult(batchNumber, batchCount, "needs_clarification", "", List.of(), List.of("图片内容我没有稳定解析出来，可以换一张更清晰的付款截图。"), evidence, content);
        }
    }

    private AgentEffectDecision effectCandidate(JsonNode expense, ExpenseRecognitionInput input, List<Map<String, Object>> evidence) {
        if (expense == null || !expense.isObject()) return null;
        String title = text(expense, "title");
        Double amount = positiveDouble(expense, "amount");
        String date = text(expense, "date");
        if (!StringUtils.hasText(date) && input.signals() != null && !input.signals().targetDates().isEmpty()) {
            date = input.signals().targetDates().get(0);
        }
        String category = normalizedCategory(text(expense, "category"), title + " " + text(expense, "note"));
        if (!StringUtils.hasText(title) || amount == null || !StringUtils.hasText(date)) {
            return null;
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.putNull("id");
        payload.put("title", title);
        payload.put("amount", roundMoney(amount));
        payload.put("currency", StringUtils.hasText(text(expense, "currency")) ? text(expense, "currency") : "CNY");
        payload.put("category", category);
        payload.put("date", date);
        putNullableNumber(payload, "quantity", positiveDouble(expense, "quantity"));
        putNullableNumber(payload, "unitPrice", positiveDouble(expense, "unitPrice"));
        putNullableText(payload, "merchant", text(expense, "merchant"));
        putNullableText(payload, "note", text(expense, "note"));
        putNullableText(payload, "brand", text(expense, "brand"));
        putNullableText(payload, "spec", text(expense, "spec"));
        ArrayNode attachmentIds = objectMapper.createArrayNode();
        textArray(expense.path("attachmentIds")).stream()
                .filter(StringUtils::hasText)
                .forEach(attachmentIds::add);
        if (attachmentIds.isEmpty()) {
            input.visualInputs().stream().map(VisualAttachmentInput::id).filter(StringUtils::hasText).forEach(attachmentIds::add);
        }
        payload.set("attachmentIds", attachmentIds);
        payload.put("source", "agent");
        payload.put("sourceSkill", SKILL_ID);
        payload.set("evidence", objectMapper.valueToTree(evidence));
        payload.putNull("createdAt");
        payload.putNull("updatedAt");
        return new AgentEffectDecision(
                "decision-" + UUID.randomUUID(),
                "pending",
                "expenseItem",
                payload,
                0.86,
                "支出识别 skill 已从图片中整理出待确认账本草稿。",
                SKILL_ID
        );
    }

    private ExpenseRecognitionResult failure(
            ExpenseRecognitionInput input,
            Instant startedAt,
            String errorCode,
            String userFacingError,
            int batchCount,
            List<Map<String, String>> attachmentSummaries,
            List<VisualAnalysisResult> visualSummaries
    ) {
        Instant completedAt = Instant.now();
        SkillTraceSummary traceSummary = new SkillTraceSummary(
                SKILL_ID,
                SkillMode.EXECUTE,
                "failed",
                "expenseRecognition",
                input.runtimeModel() == null ? "" : input.runtimeModel().id(),
                batchCount,
                input.visualInputs().stream().map(VisualAttachmentInput::id).filter(StringUtils::hasText).toList(),
                inputSummary(input),
                Map.of("errorCode", errorCode, "attachments", attachmentSummaries),
                List.of(),
                userFacingError,
                errorCode,
                completedAt.toEpochMilli() - startedAt.toEpochMilli(),
                startedAt,
                completedAt
        );
        return new ExpenseRecognitionResult("failed", userFacingError, userFacingError, List.of(), List.of(userFacingError), List.of(), visualSummaries, traceSummary);
    }

    private Map<String, Object> inputSummary(ExpenseRecognitionInput input) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("traceId", input.traceId());
        values.put("userMessage", input.request() == null ? "" : input.request().message());
        values.put("targetDates", input.signals() == null ? List.of() : input.signals().targetDates());
        values.put("visualCount", input.visualInputs().size());
        values.put("attachments", input.visualInputs().stream().map(VisualAttachmentInput::metadata).toList());
        return values;
    }

    private Map<String, Object> resultSummary(
            String status,
            List<AgentEffectDecision> candidates,
            List<String> clarifications,
            List<Map<String, Object>> evidence
    ) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("status", status);
        values.put("candidateCount", candidates.size());
        values.put("clarificationCount", clarifications.size());
        values.put("evidenceCount", evidence.size());
        return values;
    }

    private List<List<VisualAttachmentInput>> batches(List<VisualAttachmentInput> visualInputs, int batchSize) {
        if (visualInputs == null || visualInputs.isEmpty()) return List.of();
        List<List<VisualAttachmentInput>> values = new ArrayList<>();
        for (int index = 0; index < visualInputs.size(); index += batchSize) {
            values.add(visualInputs.subList(index, Math.min(index + batchSize, visualInputs.size())));
        }
        return values;
    }

    private int configuredBatchSize(ExpenseRecognitionInput input) {
        Integer value = input.profile().getBatchSize();
        return value == null || value <= 0 ? DEFAULT_BATCH_SIZE : Math.min(8, value);
    }

    private int configuredMaxTokens(ExpenseRecognitionInput input) {
        Integer value = input.profile().getMaxTokens();
        return value == null || value <= 0 ? 1400 : value;
    }

    private double configuredTemperature(ExpenseRecognitionInput input) {
        Double value = input.profile().getTemperature();
        if (value == null || value < 0) return 0.0;
        return Math.max(0.0, Math.min(1.0, value));
    }

    private List<JsonNode> arrayValues(JsonNode node) {
        if (!(node instanceof ArrayNode array)) return List.of();
        List<JsonNode> values = new ArrayList<>();
        array.forEach(values::add);
        return values;
    }

    private List<String> textArray(JsonNode node) {
        if (!(node instanceof ArrayNode array)) return List.of();
        List<String> values = new ArrayList<>();
        array.forEach((item) -> {
            if (item.isTextual() && StringUtils.hasText(item.asText())) values.add(item.asText().trim());
        });
        return values;
    }

    private List<Map<String, Object>> evidenceValues(JsonNode node) {
        if (!(node instanceof ArrayNode array)) return List.of();
        List<Map<String, Object>> values = new ArrayList<>();
        for (JsonNode item : array) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            if (StringUtils.hasText(text(item, "attachmentId"))) evidence.put("attachmentId", text(item, "attachmentId"));
            List<String> visibleFacts = textArray(item.path("visibleFacts"));
            if (!visibleFacts.isEmpty()) evidence.put("visibleFacts", visibleFacts);
            if (item.path("confidence").isNumber()) evidence.put("confidence", item.path("confidence").asDouble());
            if (!evidence.isEmpty()) values.add(evidence);
        }
        return values;
    }

    private String extractJsonObject(String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").trim();
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("expense recognition output did not contain JSON");
        }
        return trimmed.substring(start, end + 1);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.asText().trim() : "";
    }

    private Double positiveDouble(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isNumber() || value.asDouble() <= 0) return null;
        return value.asDouble();
    }

    private void putNullableText(ObjectNode payload, String field, String value) {
        if (StringUtils.hasText(value)) payload.put(field, value.trim());
        else payload.putNull(field);
    }

    private void putNullableNumber(ObjectNode payload, String field, Double value) {
        if (value == null) payload.putNull(field);
        else payload.put(field, roundMoney(value));
    }

    private double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String categoryFromText(String raw) {
        String text = raw == null ? "" : raw;
        if (text.matches(".*(奶粉|配方奶|水奶|液态奶).*")) return "formula";
        if (text.matches(".*(尿裤|纸尿裤|拉拉裤|尿不湿).*")) return "diaper";
        if (text.matches(".*(辅食|米粉|果泥|肉泥|零食).*")) return "food";
        if (text.matches(".*(月子鞋|月子服|孕妇装|哺乳衣|衣服|裤子|帽子|袜|鞋|围兜|睡袋).*")) return "clothing";
        if (text.matches(".*(玩具|绘本|摇铃|积木).*")) return "toy";
        if (text.matches(".*(疫苗|接种).*")) return "vaccine";
        if (text.matches(".*(体检|挂号|医院|药|护理|退烧|体温计|检查).*")) return "health";
        if (text.matches(".*(摇奶器|恒温壶|奶瓶|奶瓶刷|消毒柜|消毒器|温奶器|吸奶器|湿巾|棉柔巾|洗护|沐浴|润肤|日用|洗衣机).*")) return "daily";
        if (text.matches(".*(早教|课程|摄影|游泳|娱乐).*")) return "education";
        return "other";
    }

    private String normalizedCategory(String category, String fallbackText) {
        if (StringUtils.hasText(category) && EXPENSE_CATEGORIES.contains(category)) return category;
        return categoryFromText(fallbackText);
    }

    private boolean isActionableClarification(String clarification) {
        if (!StringUtils.hasText(clarification)) return false;
        boolean categoryOnly = clarification.matches(".*(分类|类别|归类).*")
                && !clarification.matches(".*(金额|实付|付款|支付|日期|时间|哪天|商品|用途|看不清|不清晰|截图).*");
        return !categoryOnly;
    }

    private String errorCode(RuntimeException exception) {
        String message = exception == null ? "" : String.valueOf(exception.getMessage());
        if (message.matches("(?is).*(timeout|timed out|超时).*")) return "timeout";
        if (message.matches("(?is).*(provider|api|http|状态|status).*")) return "provider_error";
        return "provider_error";
    }

    private String userFacingError(String code) {
        return switch (code) {
            case "timeout" -> "支出图片分析超时了：我正在分析图片里的实际支付金额，但模型没有及时返回。请稍后重试，或先分开发送图片。";
            case "missing_attachment" -> "没找到可识别的支出图片，可以重新发送订单、小票或付款截图后再试。";
            default -> "支出图片分析暂时失败了，可以稍后重试；如果图片较多，也可以分开发送。";
        };
    }

    private void sendStatus(SkillStatusSink sink, String message) {
        if (sink != null && StringUtils.hasText(message)) {
            sink.send(message);
        }
    }

    @FunctionalInterface
    public interface SkillStatusSink {
        void send(String message);
    }

    private record BatchResult(
            int batchIndex,
            int batchCount,
            String status,
            String aiTextDraft,
            List<JsonNode> expenses,
            List<String> clarifications,
            List<Map<String, Object>> evidence,
            String summary
    ) {
    }
}
