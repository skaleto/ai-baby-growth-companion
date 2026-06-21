package com.xiaobao.babycompanion.exception;

import java.time.Instant;

import com.xiaobao.babycompanion.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException exception) {
        return error(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return error(HttpStatus.BAD_REQUEST, "BAD_REQUEST", exception.getMessage());
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ErrorResponse> handleAuth(AuthException exception) {
        return error(HttpStatus.UNAUTHORIZED, "AUTH_FAILED", exception.getMessage());
    }

    @ExceptionHandler(ProQuotaExceededException.class)
    public ResponseEntity<ErrorResponse> handleProQuota(ProQuotaExceededException exception) {
        return error(HttpStatus.FORBIDDEN, "PRO_QUOTA_EXCEEDED", exception.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException exception) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", exception.getMessage());
    }

    @ExceptionHandler(ModelApiException.class)
    public ResponseEntity<ErrorResponse> handleModelApi(ModelApiException exception) {
        return error(HttpStatus.BAD_GATEWAY, "MODEL_API_ERROR", exception.getMessage());
    }

    @ExceptionHandler(AgentResponseParseException.class)
    public ResponseEntity<ErrorResponse> handleAgentResponseParse(AgentResponseParseException exception) {
        return error(HttpStatus.BAD_GATEWAY, "AGENT_RESPONSE_PARSE_ERROR", exception.getMessage());
    }

    private ResponseEntity<ErrorResponse> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse(code, message, Instant.now()));
    }
}
