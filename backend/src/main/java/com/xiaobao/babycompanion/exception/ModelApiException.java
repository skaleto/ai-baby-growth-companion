package com.xiaobao.babycompanion.exception;

public class ModelApiException extends RuntimeException {

    public ModelApiException(String message) {
        super(message);
    }

    public ModelApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
