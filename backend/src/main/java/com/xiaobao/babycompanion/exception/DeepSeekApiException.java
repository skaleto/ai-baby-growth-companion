package com.xiaobao.babycompanion.exception;

public class DeepSeekApiException extends ModelApiException {

    public DeepSeekApiException(String message) {
        super(message);
    }

    public DeepSeekApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
