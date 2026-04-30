package com.xiaobao.babycompanion.exception;

public class AgentResponseParseException extends RuntimeException {

    public AgentResponseParseException(String message) {
        super(message);
    }

    public AgentResponseParseException(String message, Throwable cause) {
        super(message, cause);
    }
}
