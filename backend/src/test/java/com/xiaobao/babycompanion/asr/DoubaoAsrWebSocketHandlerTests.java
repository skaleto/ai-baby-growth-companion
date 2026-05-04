package com.xiaobao.babycompanion.asr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.AuthService;
import com.xiaobao.babycompanion.config.DoubaoAsrProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class DoubaoAsrWebSocketHandlerTests {

    @Test
    void returnsConfigErrorWhenCredentialsAreMissing() throws Exception {
        DoubaoAsrProperties properties = new DoubaoAsrProperties();
        properties.setApiKeyFile("/path/that/does/not/exist");
        AuthService authService = mock(AuthService.class);
        when(authService.authenticateToken(anyString())).thenReturn(new AuthPrincipal(
                "user-test",
                "13800000000",
                "session-test",
                "family-default",
                "小宝家",
                "妈妈",
                true
        ));
        DoubaoAsrWebSocketHandler handler = new DoubaoAsrWebSocketHandler(properties, new ObjectMapper(), authService);
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("test-session");
        when(session.isOpen()).thenReturn(true);

        handler.afterConnectionEstablished(session);
        handler.handleTextMessage(
                session,
                new TextMessage("""
                        {"type":"start","sampleRate":16000,"format":"pcm_s16le","traceId":"asr-test","token":"test-token"}
                        """)
        );

        verify(session).sendMessage(argThat(message -> {
            if (!(message instanceof TextMessage textMessage)) {
                return false;
            }
            String payload = textMessage.getPayload();
            return payload.contains("\"type\":\"error\"") && payload.contains("\"code\":\"ASR_CONFIG_MISSING\"");
        }));
        assertThat(properties.getResolvedApiKey()).isEmpty();
    }
}
