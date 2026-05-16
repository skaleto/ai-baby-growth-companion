package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.AgentRuntimeProperties;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import org.junit.jupiter.api.Test;

class ExpenseRecognitionSkillTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExpenseRecognitionSkill skill = new ExpenseRecognitionSkill(objectMapper);
    private final RecordSignalExtractor extractor = new RecordSignalExtractor(objectMapper);

    @Test
    void producesPendingCandidateFromOneImageWithoutTools() {
        ExpenseRecognitionInput input = input(
                "帮我识别这张奶粉订单花费并记账",
                List.of(image("attachment-1")),
                4
        );

        ExpenseRecognitionResult result = skill.execute(input, (request, batchNumber, batchCount) -> {
            assertThat(request.tools()).isNull();
            assertThat(request.toolChoice()).isNull();
            assertThat(request.temperature()).isEqualTo(0.0);
            assertThat(json(request)).contains("禁止联网搜索");
            return new ExpenseRecognitionModelResponse("req-1", "doubao", completeJson("attachment-1"), null);
        }, null);

        assertThat(result.status()).isEqualTo("complete");
        assertThat(result.effectCandidates()).hasSize(1);
        assertThat(result.effectCandidates().get(0).mode()).isEqualTo("pending");
        assertThat(result.effectCandidates().get(0).payload().path("amount").asDouble()).isEqualTo(268.0);
        assertThat(result.effectCandidates().get(0).source()).isEqualTo("expense-recognition");
    }

    @Test
    void splitsEightImagesIntoTwoExpenseModelBatches() {
        ExpenseRecognitionInput input = input(
                "帮我识别这 8 张小票花费并记账",
                java.util.stream.IntStream.rangeClosed(1, 8).mapToObj((index) -> image("attachment-" + index)).toList(),
                4
        );
        List<Integer> batches = new ArrayList<>();

        ExpenseRecognitionResult result = skill.execute(input, (request, batchNumber, batchCount) -> {
            batches.add(batchNumber);
            return new ExpenseRecognitionModelResponse(
                    "req-" + batchNumber,
                    "doubao",
                    batchNumber == 1 ? completeJson("attachment-1") : noExpenseJson(),
                    null
            );
        }, null);

        assertThat(batches).containsExactly(1, 2);
        assertThat(result.traceSummary().batchCount()).isEqualTo(2);
        assertThat(result.visualAnalysisResults()).hasSize(2);
        assertThat(result.effectCandidates()).hasSize(1);
    }

    @Test
    void canRunMultipleExpenseModelBatchesConcurrently() {
        ExpenseRecognitionInput input = input(
                "帮我识别这 8 张小票花费并记账",
                java.util.stream.IntStream.rangeClosed(1, 8).mapToObj((index) -> image("attachment-" + index)).toList(),
                4
        );
        CountDownLatch started = new CountDownLatch(2);
        var executor = Executors.newFixedThreadPool(2);
        try {
            ExpenseRecognitionResult result = skill.execute(input, (request, batchNumber, batchCount) -> {
                started.countDown();
                try {
                    assertThat(started.await(1, TimeUnit.SECONDS)).isTrue();
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException(exception);
                }
                return new ExpenseRecognitionModelResponse(
                        "req-" + batchNumber,
                        "doubao",
                        batchNumber == 1 ? completeJson("attachment-1") : noExpenseJson(),
                        null
                );
            }, null, executor);

            assertThat(result.status()).isEqualTo("complete");
            assertThat(result.traceSummary().batchCount()).isEqualTo(2);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void returnsExpenseSpecificTimeoutFailure() {
        ExpenseRecognitionInput input = input("帮我识别这些花费", List.of(image("attachment-1")), 4);

        ExpenseRecognitionResult result = skill.execute(input, (request, batchNumber, batchCount) -> {
            throw new RuntimeException("request timed out");
        }, null);

        assertThat(result.status()).isEqualTo("failed");
        assertThat(result.userFacingError()).contains("支出图片分析超时");
        assertThat(result.traceSummary().errorCode()).isEqualTo("timeout");
    }

    @Test
    void categoryOnlyUncertaintyDoesNotBlockCompleteExpenses() {
        ExpenseRecognitionInput input = input(
                "把月子鞋、摇奶器这些花费记到账本",
                List.of(image("attachment-1")),
                4
        );

        ExpenseRecognitionResult result = skill.execute(
                input,
                (request, batchNumber, batchCount) -> new ExpenseRecognitionModelResponse("req-1", "doubao", categoryUnclearJson(), null),
                null
        );

        assertThat(result.status()).isEqualTo("complete");
        assertThat(result.clarifications()).isEmpty();
        assertThat(result.effectCandidates()).hasSize(2);
        assertThat(result.effectCandidates().get(0).payload().path("category").asText()).isEqualTo("clothing");
        assertThat(result.effectCandidates().get(1).payload().path("category").asText()).isEqualTo("daily");
    }

    private ExpenseRecognitionInput input(String message, List<AgentAttachment> attachments, int batchSize) {
        AgentRuntimeProperties.ModelProfile profile = new AgentRuntimeProperties.ModelProfile();
        profile.setBatchSize(batchSize);
        profile.setMaxTokens(1400);
        profile.setTemperature(0.0);
        AgentChatRequest request = new AgentChatRequest(message, null, null, List.of(), List.of(), List.of(), attachments, null, false);
        RuntimeModel runtimeModel = new RuntimeModel(
                "doubao-seed-2.0-pro",
                Provider.DOUBAO,
                "doubao-seed-2-0-pro-260215",
                true,
                true,
                false,
                "https://example.test",
                "/chat/completions",
                Duration.ofSeconds(30),
                "DOUBAO_API_KEY"
        );
        List<VisualAttachmentInput> visualInputs = attachments.stream()
                .map((attachment) -> new VisualAttachmentInput(attachment.id(), attachment.name(), attachment.kind(), attachment.dataUrl()))
                .toList();
        return new ExpenseRecognitionInput(request, extractor.extract(message), "trace-test", runtimeModel, profile, visualInputs);
    }

    private AgentAttachment image(String id) {
        return new AgentAttachment(id, id + ".jpg", "image", null, "data:image/jpeg;base64,AAAA");
    }

    private String completeJson(String attachmentId) {
        return """
                {
                  "status": "complete",
                  "aiTextDraft": "已识别出奶粉 268 元。",
                  "userFacingError": null,
                  "expenses": [{
                    "title": "奶粉",
                    "amount": 268,
                    "currency": "CNY",
                    "category": "formula",
                    "date": "2026-05-16",
                    "merchant": "京东",
                    "note": "订单截图显示实付款 268 元",
                    "attachmentIds": ["%s"]
                  }],
                  "clarifications": [],
                  "evidence": [{"attachmentId":"%s","visibleFacts":["实付款 268 元"],"confidence":0.92}]
                }
                """.formatted(attachmentId, attachmentId);
    }

    private String noExpenseJson() {
        return """
                {
                  "status": "no_recognizable_amount",
                  "aiTextDraft": "未识别到金额",
                  "expenses": [],
                  "clarifications": [],
                  "evidence": []
                }
                """;
    }

    private String categoryUnclearJson() {
        return """
                {
                  "status": "needs_clarification",
                  "aiTextDraft": "需要确认分类",
                  "expenses": [{
                    "title": "月子鞋",
                    "amount": 59.9,
                    "currency": "CNY",
                    "category": "unknown",
                    "date": "2026-05-16",
                    "merchant": "淘宝",
                    "note": "截图显示月子鞋实付款 59.9 元",
                    "attachmentIds": ["attachment-1"]
                  }, {
                    "title": "摇奶器",
                    "amount": 129,
                    "currency": "CNY",
                    "category": "",
                    "date": "2026-05-16",
                    "merchant": "京东",
                    "note": "截图显示摇奶器实付款 129 元",
                    "attachmentIds": ["attachment-1"]
                  }],
                  "clarifications": ["请确认月子鞋和摇奶器分别属于什么分类？"],
                  "evidence": [{"attachmentId":"attachment-1","visibleFacts":["月子鞋 59.9 元","摇奶器 129 元"],"confidence":0.9}]
                }
                """;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
