package com.xiaobao.babycompanion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.agent")
public class AgentRuntimeProperties {

    private int streamCoreThreads = 2;
    private int streamMaxThreads = 8;
    private int streamQueueCapacity = 32;

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
}
