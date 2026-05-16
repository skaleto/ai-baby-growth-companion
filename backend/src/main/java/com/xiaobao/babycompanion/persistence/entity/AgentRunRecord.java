package com.xiaobao.babycompanion.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("agent_run")
public class AgentRunRecord {

    @TableId(type = IdType.INPUT)
    private String id;
    private String traceId;
    private String familyId;
    private String userId;
    private String messageId;
    private String status;
    private String inputType;
    private String plannerModel;
    private String finalModel;
    private String plannerResultJson;
    private String skillPlanJson;
    private String effectSummaryJson;
    private String errorCode;
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

    public String getFamilyId() {
        return familyId;
    }

    public void setFamilyId(String familyId) {
        this.familyId = familyId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getInputType() {
        return inputType;
    }

    public void setInputType(String inputType) {
        this.inputType = inputType;
    }

    public String getPlannerModel() {
        return plannerModel;
    }

    public void setPlannerModel(String plannerModel) {
        this.plannerModel = plannerModel;
    }

    public String getFinalModel() {
        return finalModel;
    }

    public void setFinalModel(String finalModel) {
        this.finalModel = finalModel;
    }

    public String getPlannerResultJson() {
        return plannerResultJson;
    }

    public void setPlannerResultJson(String plannerResultJson) {
        this.plannerResultJson = plannerResultJson;
    }

    public String getSkillPlanJson() {
        return skillPlanJson;
    }

    public void setSkillPlanJson(String skillPlanJson) {
        this.skillPlanJson = skillPlanJson;
    }

    public String getEffectSummaryJson() {
        return effectSummaryJson;
    }

    public void setEffectSummaryJson(String effectSummaryJson) {
        this.effectSummaryJson = effectSummaryJson;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
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
