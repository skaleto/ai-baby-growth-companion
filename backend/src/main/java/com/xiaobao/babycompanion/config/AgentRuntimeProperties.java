package com.xiaobao.babycompanion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.agent")
public class AgentRuntimeProperties {

    private int streamCoreThreads = 2;
    private int streamMaxThreads = 8;
    private int streamQueueCapacity = 32;
    private ModelProfiles models = new ModelProfiles();

    public int getStreamCoreThreads() {
        return streamCoreThreads;
    }

    public void setStreamCoreThreads(int streamCoreThreads) {
        this.streamCoreThreads = streamCoreThreads;
    }

    public int getStreamMaxThreads() {
        return streamMaxThreads;
    }

    public void setStreamMaxThreads(int streamMaxThreads) {
        this.streamMaxThreads = streamMaxThreads;
    }

    public int getStreamQueueCapacity() {
        return streamQueueCapacity;
    }

    public void setStreamQueueCapacity(int streamQueueCapacity) {
        this.streamQueueCapacity = streamQueueCapacity;
    }

    public ModelProfiles getModels() {
        return models;
    }

    public void setModels(ModelProfiles models) {
        this.models = models == null ? new ModelProfiles() : models;
    }

    public static class ModelProfiles {
        private ModelProfile planner = new ModelProfile();
        private ModelProfile finalComposer = new ModelProfile();
        private ModelProfile expenseRecognition = new ModelProfile();

        public ModelProfile getPlanner() {
            return planner;
        }

        public void setPlanner(ModelProfile planner) {
            this.planner = planner == null ? new ModelProfile() : planner;
        }

        public ModelProfile getFinalComposer() {
            return finalComposer;
        }

        public void setFinalComposer(ModelProfile finalComposer) {
            this.finalComposer = finalComposer == null ? new ModelProfile() : finalComposer;
        }

        public ModelProfile getExpenseRecognition() {
            return expenseRecognition;
        }

        public void setExpenseRecognition(ModelProfile expenseRecognition) {
            this.expenseRecognition = expenseRecognition == null ? new ModelProfile() : expenseRecognition;
        }
    }

    public static class ModelProfile {
        private String model = "";
        private Integer maxTokens;
        private Double temperature;
        private Boolean toolsEnabled;
        private Integer batchSize;
        private Integer retryAttempts;

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public Integer getMaxTokens() {
            return maxTokens;
        }

        public void setMaxTokens(Integer maxTokens) {
            this.maxTokens = maxTokens;
        }

        public Double getTemperature() {
            return temperature;
        }

        public void setTemperature(Double temperature) {
            this.temperature = temperature;
        }

        public Boolean getToolsEnabled() {
            return toolsEnabled;
        }

        public void setToolsEnabled(Boolean toolsEnabled) {
            this.toolsEnabled = toolsEnabled;
        }

        public Integer getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(Integer batchSize) {
            this.batchSize = batchSize;
        }

        public Integer getRetryAttempts() {
            return retryAttempts;
        }

        public void setRetryAttempts(Integer retryAttempts) {
            this.retryAttempts = retryAttempts;
        }
    }
}
