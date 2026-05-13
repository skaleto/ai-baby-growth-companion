package com.xiaobao.babycompanion.config;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableConfigurationProperties(AgentRuntimeProperties.class)
public class AgentExecutionConfig {

    @Bean(name = "agentStreamExecutor")
    public ThreadPoolTaskExecutor agentStreamExecutor(AgentRuntimeProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int coreThreads = Math.max(1, properties.getStreamCoreThreads());
        int maxThreads = Math.max(coreThreads, properties.getStreamMaxThreads());
        executor.setCorePoolSize(coreThreads);
        executor.setMaxPoolSize(maxThreads);
        executor.setQueueCapacity(Math.max(1, properties.getStreamQueueCapacity()));
        executor.setThreadNamePrefix("agent-stream-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        return executor;
    }
}
