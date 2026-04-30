package com.xiaobao.babycompanion.asr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.DoubaoAsrProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class DoubaoAsrWebSocketHandlerTests {

    @Test
    void returnsConfigErrorWhenCredentialsAreMissing() throws Exception {
        DoubaoAsrProperties properties = new DoubaoAsrProperties();
        properties.setAccessKeyFile("/path/that/does/not/exist");
        DoubaoAsrWebSocketHandler handler = new DoubaoAsrWebSocketHandler(properties, new ObjectMapper());
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("test-session");
        when(session.isOpen()).thenReturn(true);

        handler.afterConnectionEstablished(session);
        handler.handleTextMessage(
                session,
                new TextMessage("""
                        {"type":"start","sampleRate":16000,"format":"pcm_s16le","traceId":"asr-test"}
                        """)
        );

        verify(session).sendMessage(argThat(message -> {
            if (!(message instanceof TextMessage textMessage)) {
                return false;
            }
            String payload = textMessage.getPayload();
            return payload.contains("\"type\":\"error\"") && payload.contains("\"code\":\"ASR_CONFIG_MISSING\"");
        }));
        assertThat(properties.getResolvedAccessKey()).isEmpty();
    }
}
