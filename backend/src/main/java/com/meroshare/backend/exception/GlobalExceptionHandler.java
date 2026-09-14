// GlobalExceptionHandler.java
package com.meroshare.backend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // unverified account trying to login, frontend uses code to route to otp screen
    @ExceptionHandler(UnverifiedAccountException.class)
    public ResponseEntity<Map<String, Object>> handleUnverified(UnverifiedAccountException ex) {
        log.warn("[EXCEPTION] Unverified account login attempt", ex);
        return buildResponse(HttpStatus.FORBIDDEN, "UNVERIFIED_ACCOUNT", "Account verification required");
    }

    /**
     * Handles all untyped business logic errors (RuntimeException).
     * We log at WARN since these are expected error paths (duplicate user, etc.)
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex) {
        log.warn("[EXCEPTION] RuntimeException", ex);
        return buildResponse(HttpStatus.BAD_REQUEST, "REQUEST_FAILED", "Request could not be completed");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        // Don't log at ERROR — wrong passwords are expected
        log.debug("[EXCEPTION] BadCredentials", ex);
        return buildResponse(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<Map<String, Object>> handleDisabled(DisabledException ex) {
        log.warn("[EXCEPTION] Disabled account", ex);
        return buildResponse(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "Your account has been disabled");
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<Map<String, Object>> handleLocked(LockedException ex) {
        log.warn("[EXCEPTION] Locked account", ex);
        return buildResponse(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED", "Your account is locked");
    }

    /**
     * Handles @Valid failures — returns field-level errors so the frontend
     * can display inline validation messages.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex) {

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            // Keep the first error per field (don't overwrite with subsequent ones)
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("code", "VALIDATION_ERROR");
        body.put("message", "Validation failed");
        body.put("errors", fieldErrors);

        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(
            MissingServletRequestParameterException ex) {
        log.warn("[EXCEPTION] Missing request parameter: {}", ex.getParameterName(), ex);
        return buildResponse(HttpStatus.BAD_REQUEST, "MISSING_PARAMETER", "Missing required request parameter");
    }

    /**
     * Catch-all for unexpected exceptions — log at ERROR for investigation.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("[EXCEPTION] Unexpected error", ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR", "An unexpected error occurred. Please try again later.");
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String code, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("code", code != null ? code : "UNKNOWN_ERROR");
        body.put("message", message != null ? message : "An error occurred");
        return ResponseEntity.status(status).body(body);
    }
}