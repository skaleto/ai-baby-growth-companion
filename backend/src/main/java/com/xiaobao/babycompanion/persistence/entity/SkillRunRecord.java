package com.xiaobao.babycompanion.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("skill_run")
public class SkillRunRecord {

    @TableId(type = IdType.INPUT)
    private String id;
    private String traceId;
    private String agentRunId;
    private String skillId;
    private String mode;
    private String status;
    private String modelProfile;
    private String model;
    private Integer batchCount;
    private String attachmentIdsJson;
    private String inputSummaryJson;
    private String resultSummaryJson;
    private String effectCandidateSummaryJson;
    private String userFacingError;
    private String errorCode;
    private Long latencyMs;
    private String startedAt;
    private String completedAt;
    private String createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getAgentRunId() {
        return agentRunId;
    }

    public void setAgentRunId(String agentRunId) {
        this.agentRunId = agentRunId;
    }

    public String getSkillId() {
        return skillId;
    }

    public void setSkillId(String skillId) {
        this.skillId = skillId;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getModelProfile() {
        return modelProfile;
    }

    public void setModelProfile(String modelProfile) {
        this.modelProfile = modelProfile;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public Integer getBatchCount() {
        return batchCount;
    }

    public void setBatchCount(Integer batchCount) {
        this.batchCount = batchCount;
    }

    public String getAttachmentIdsJson() {
        return attachmentIdsJson;
    }

    public void setAttachmentIdsJson(String attachmentIdsJson) {
        this.attachmentIdsJson = attachmentIdsJson;
    }

    public String getInputSummaryJson() {
        return inputSummaryJson;
    }

    public void setInputSummaryJson(String inputSummaryJson) {
        this.inputSummaryJson = inputSummaryJson;
    }

    public String getResultSummaryJson() {
        return resultSummaryJson;
    }

    public void setResultSummaryJson(String resultSummaryJson) {
        this.resultSummaryJson = resultSummaryJson;
    }

    public String getEffectCandidateSummaryJson() {
        return effectCandidateSummaryJson;
    }

    public void setEffectCandidateSummaryJson(String effectCandidateSummaryJson) {
        this.effectCandidateSummaryJson = effectCandidateSummaryJson;
    }

    public String getUserFacingError() {
        return userFacingError;
    }

    public void setUserFacingError(String userFacingError) {
        this.userFacingError = userFacingError;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public Long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(Long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public String getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(String startedAt) {
        this.startedAt = startedAt;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
