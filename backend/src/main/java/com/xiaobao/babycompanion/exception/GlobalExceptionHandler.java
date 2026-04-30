package com.xiaobao.babycompanion.exception;

import java.time.Instant;

import com.xiaobao.babycompanion.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Invalid request");
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_ERROR", message, Instant.now()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("SERVICE_UNAVAILABLE", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(DeepSeekApiException.class)
    public ResponseEntity<ErrorResponse> handleDeepSeek(DeepSeekApiException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("DEEPSEEK_API_ERROR", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(AgentResponseParseException.class)
    public ResponseEntity<ErrorResponse> handleAgentResponseParse(AgentResponseParseException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("AGENT_RESPONSE_PARSE_ERROR", exception.getMessage(), Instant.now()));
    }
}
