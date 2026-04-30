package com.xiaobao.babycompanion.config;

import com.xiaobao.babycompanion.asr.DoubaoAsrWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class AsrWebSocketConfig implements WebSocketConfigurer {

    private final DoubaoAsrWebSocketHandler asrWebSocketHandler;
    private final CorsProperties corsProperties;

    public AsrWebSocketConfig(DoubaoAsrWebSocketHandler asrWebSocketHandler, CorsProperties corsProperties) {
        this.asrWebSocketHandler = asrWebSocketHandler;
        this.corsProperties = corsProperties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(asrWebSocketHandler, "/api/asr/stream")
                .setAllowedOrigins(corsProperties.getAllowedOrigins().toArray(String[]::new));
    }
}
