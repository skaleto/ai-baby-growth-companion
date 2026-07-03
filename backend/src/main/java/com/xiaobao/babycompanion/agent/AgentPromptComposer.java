package com.xiaobao.babycompanion.agent;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.dto.agent.AgentAttachment;
import com.xiaobao.babycompanion.dto.agent.AgentBabyProfile;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.agent.action.AgentActionResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Prompt / context assembly extracted verbatim from {@link AgentRuntime} (P3 phase 4).
 *
 * <p>Owns the pure prompt/context-building cluster: the final-composer user prompt/content, the
 * tool-router user prompt, and the shared context fragments (baby profile enrichment, base context,
 * requester context, current-time, model-context-harness, attachment summaries). All method bodies
 * were moved byte-for-byte from {@code AgentRuntime} with no logic change.
 *
 * <p>These are mostly pure string/map builders. They depend only on {@link ObjectMapper} (JSON
 * serialization), {@link SkillDisclosureService} (disclosed skill contexts) and {@link Clock}
 * (time/age derivation) — everything else (principal, context snapshot, plan, tool results, …) is
 * passed in by the caller. No model/REST/usage plumbing lives here.
 */
@Component
public class AgentPromptComposer {

    private final ObjectMapper objectMapper;
    private final SkillDisclosureService skillDisclosureService;
    private final Clock clock;

    @Autowired
    public AgentPromptComposer(
            ObjectMapper objectMapper,
            SkillDisclosureService skillDisclosureService,
            Clock clock
    ) {
        this.objectMapper = objectMapper;
        this.skillDisclosureService = skillDisclosureService;
        this.clock = clock;
    }

    // ---------------------------------------------------------------------------------------------
    // Prompt / context assembly — moved verbatim from AgentRuntime.
    // ---------------------------------------------------------------------------------------------

    private Map<String, Object> requesterContext(AuthPrincipal principal) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (principal == null) return values;
        values.put("roleName", principal.roleName());
        values.put("caregiver", principal.caregiver());
        values.put("familyName", principal.familyName());
        return values;
    }

    private Map<String, Object> baseContext(
            AgentChatRequest request,
            AuthPrincipal principal,
            AgentContextSnapshot contextSnapshot
    ) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("requester", requesterContext(principal));
        values.put("babyProfile", enrichedBabyProfile(request.babyProfile()));
        values.put("storedBabyProfile", contextSnapshot.babyProfile());
        values.put("conversationSummary", contextSnapshot.conversationSummary());
        values.put("recordContext", contextSnapshot.recordContext());
        return values;
    }

    private Map<String, Object> enrichedBabyProfile(AgentBabyProfile profile) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (profile == null) {
            return values;
        }

        values.put("nickname", profile.nickname());
        values.put("stage", profile.stage());
        values.put("gender", profile.gender());
        values.put("expectedDate", profile.expectedDate());
        values.put("birthDate", profile.birthDate());
        values.put("region", profile.region());
        values.put("feeding", profile.feeding());
        values.put("birthWeight", profile.birthWeight());
        values.put("birthHeight", profile.birthHeight());
        values.put("allergies", profile.allergies());
        values.put("caregivers", profile.caregivers());

        Integer ageDays = profile.ageDays();
        Integer ageWeeks = profile.ageWeeks();
        Integer ageMonths = profile.ageMonths();
        String ageLabel = profile.ageLabel();
        Boolean fullMonth = profile.fullMonth();
        Integer daysUntilFullMonth = profile.daysUntilFullMonth();

        if ("born".equals(profile.stage()) && StringUtils.hasText(profile.birthDate())) {
            try {
                LocalDate birthDate = LocalDate.parse(profile.birthDate().trim());
                long days = ChronoUnit.DAYS.between(birthDate, LocalDate.now(clock));
                if (days >= 0 && days <= 3660) {
                    ageDays = Math.toIntExact(days);
                    ageWeeks = ageDays / 7;
                    ageMonths = ageDays / 30;
                    fullMonth = ageDays >= 30;
                    daysUntilFullMonth = Math.max(0, 30 - ageDays);
                    ageLabel = fullMonth
                            ? "出生%s天，约%s个月%s天".formatted(ageDays, ageMonths, ageDays % 30)
                            : "出生%s天，未满月，还差%s天满30天".formatted(ageDays, daysUntilFullMonth);
                }
            } catch (RuntimeException ignored) {
                // Keep client-provided derived fields when birthDate is not parseable.
            }
        } else if ("pregnancy".equals(profile.stage()) && !StringUtils.hasText(ageLabel)) {
            ageLabel = StringUtils.hasText(profile.expectedDate())
                    ? "孕期，预产期 " + profile.expectedDate()
                    : "孕期，预产期待设置";
        }

        values.put("ageDays", ageDays);
        values.put("ageWeeks", ageWeeks);
        values.put("ageMonths", ageMonths);
        values.put("ageLabel", ageLabel);
        values.put("fullMonth", fullMonth);
        values.put("daysUntilFullMonth", daysUntilFullMonth);
        return values;
    }

    String buildToolRouterPrompt(AgentChatRequest request, List<Skill> selectedSkills, String traceId) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        putCurrentTime(context);
        putModelContextHarness(context);
        context.put("capabilities", AgentCapabilityContract.promptContext());
        context.put("imageBoundaryPolicy", AgentCapabilityContract.imageBoundaryPolicy());
        context.put("selectedSkills", selectedSkills);
        context.put("babyProfile", enrichedBabyProfile(request.babyProfile()));
        context.put("recentMessages", tail(request.recentMessages(), 6));
        context.put("userMessage", request.message());

        try {
            return """
                    请判断是否需要调用工具。若需要，使用 tools 参数中的函数；若不需要，直接返回一句 no tool 即可。
                    上下文:
                    %s
                    """.formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build tool router context", exception);
        }
    }

    private String buildUserPrompt(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            String traceId,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal,
            List<VisualAnalysisResult> visualAnalysisResults,
            boolean visualInputsAttachedToFinalRequest,
            SkillPlan skillPlan,
            ExpenseRecognitionResult expenseRecognitionResult,
            List<AgentActionResult> actionResults
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("traceId", traceId);
        putCurrentTime(context);
        putModelContextHarness(context);
        context.put("capabilities", AgentCapabilityContract.promptContext());
        context.put("imageBoundaryPolicy", AgentCapabilityContract.imageBoundaryPolicy());
        context.put("selectedSkills", selectedSkills);
        SkillDisclosureResult skillDisclosure = skillDisclosureService.disclose(plan, signals, request.message());
        if (!skillDisclosure.contexts().isEmpty()) {
            context.put("disclosedSkillContexts", skillDisclosure.contexts());
        }
        context.put("requester", requesterContext(principal));
        context.put("baseContext", baseContext(request, principal, contextSnapshot));
        context.put("agentPlan", plan);
        context.put("skillPlan", skillPlan == null ? SkillPlan.empty() : skillPlan);
        context.put("recordSignals", signals);
        context.put("toolResults", toolResults);
        context.put("babyProfile", contextSnapshot.babyProfile());
        context.put("retrievedContext", contextSnapshot);
        context.put("conversationSummary", contextSnapshot.conversationSummary());
        context.put("recordContext", contextSnapshot.recordContext());
        context.put("actionResults", listOrEmpty(actionResults));
        context.put(
                "actionResultUsageRule",
                "actionResults 是本轮已执行工具/受控写入的事实来源。只有 status=applied 才能说已记录/已保存；只有 status=pending_created 才能说已整理成待确认草稿；status=needs_input 时要追问 missingFields。"
        );
        context.put("attachments", attachmentSummaries(request.attachments()));
        context.put("visualInputsAttachedToFinalRequest", visualInputsAttachedToFinalRequest);
        if (visualAnalysisResults != null && !visualAnalysisResults.isEmpty()) {
            context.put("visualAnalysisResults", visualAnalysisResults);
            context.put(
                    "visualAnalysisUsageRule",
                    "图片较多时已由前置模型分批完成 OCR/视觉摘要；最终回复应优先使用 visualAnalysisResults，不要重新要求用户确认已经识别到的金额。若多张图属于同一订单或支付链路，注意去重并保留相关 attachment id。"
            );
        }
        if (expenseRecognitionResult != null) {
            Map<String, Object> skillResult = new LinkedHashMap<>();
            skillResult.put("skillId", SkillRouter.EXPENSE_RECOGNITION_SKILL_ID);
            skillResult.put("status", expenseRecognitionResult.status());
            skillResult.put("aiTextDraft", expenseRecognitionResult.aiTextDraft());
            skillResult.put("userFacingError", expenseRecognitionResult.userFacingError());
            skillResult.put("clarifications", expenseRecognitionResult.clarifications());
            skillResult.put("evidence", expenseRecognitionResult.evidence());
            skillResult.put("effectCandidateCount", expenseRecognitionResult.effectCandidates().size());
            skillResult.put("effectCandidates", expenseRecognitionResult.effectCandidates());
            context.put("executedSkillResults", List.of(skillResult));
            context.put(
                    "skillResultUsageRule",
                    "expense-recognition 是已执行的能力模块；最终回复必须尊重该 skill 的 status、证据和 effectCandidates。若 effectCandidates 已包含实际支付金额，不要再追问实际花了多少钱。若 skill 失败，应说明真实失败阶段。"
            );
        }
        context.put("userMessage", request.message());

        try {
            return """
                    请根据下面的上下文生成一次 agent 输出。输出必须是 system prompt 中规定的 JSON 对象。
                    上下文:
                    %s
                    """.formatted(objectMapper.writeValueAsString(context));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to build agent context", exception);
        }
    }

    Object buildUserContent(
            AgentChatRequest request,
            List<Skill> selectedSkills,
            List<AgentToolResult> toolResults,
            String traceId,
            AgentPlan plan,
            AgentContextSnapshot contextSnapshot,
            RecordSignals signals,
            AuthPrincipal principal,
            List<VisualAttachmentInput> visualInputs,
            List<VisualAnalysisResult> visualAnalysisResults,
            SkillPlan skillPlan,
            ExpenseRecognitionResult expenseRecognitionResult,
            List<AgentActionResult> actionResults
    ) {
        String prompt = buildUserPrompt(
                request,
                selectedSkills,
                toolResults,
                traceId,
                plan,
                contextSnapshot,
                signals,
                principal,
                visualAnalysisResults,
                visualInputs != null && !visualInputs.isEmpty(),
                skillPlan,
                expenseRecognitionResult,
                actionResults
        );
        if (visualInputs == null || visualInputs.isEmpty()) return prompt;

        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt));
        visualInputs.forEach((input) -> {
            if ("video".equals(input.kind()) && input.dataUrl().startsWith("data:video/")) {
                content.add(Map.of(
                        "type", "video_url",
                        "video_url", Map.of("url", input.dataUrl())
                ));
            } else {
                content.add(Map.of(
                        "type", "image_url",
                        "image_url", Map.of("url", input.dataUrl())
                ));
            }
        });
        return content;
    }

    private void putCurrentTime(Map<String, Object> context) {
        LocalDateTime now = LocalDateTime.now(clock);
        context.put("today", now.toLocalDate().toString());
        context.put("currentDateTime", now.truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("currentTime", now.toLocalTime().truncatedTo(ChronoUnit.MINUTES).toString());
        context.put("timeZone", clock.getZone().getId());
    }

    private void putModelContextHarness(Map<String, Object> context) {
        context.put("modelContextHarness", AgentModelContextHarness.promptBlock());
    }

    private List<Map<String, String>> attachmentSummaries(List<AgentAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .map((attachment) -> {
                    Map<String, String> summary = new LinkedHashMap<>();
                    if (StringUtils.hasText(attachment.id())) summary.put("id", attachment.id());
                    if (StringUtils.hasText(attachment.name())) summary.put("name", attachment.name());
                    if (StringUtils.hasText(attachment.kind())) summary.put("kind", attachment.kind());
                    if (StringUtils.hasText(attachment.dataUrl())) {
                        summary.put("contentStatus", "video".equals(attachment.kind()) && attachment.dataUrl().startsWith("data:image/")
                                ? "video-thumbnail-attached"
                                : "visual-bytes-attached");
                    }
                    return summary;
                })
                .toList();
    }

    // ---------------------------------------------------------------------------------------------
    // Local list helpers — mirror AgentRuntime's (trivial, not a shared concern).
    // ---------------------------------------------------------------------------------------------

    private <T> List<T> tail(List<T> items, int limit) {
        if (items == null || items.isEmpty()) return List.of();
        int start = Math.max(0, items.size() - limit);
        return items.subList(start, items.size());
    }

    private <T> List<T> listOrEmpty(List<T> items) {
        return items == null ? List.of() : items;
    }
}
