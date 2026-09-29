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

    // unverified login, frontend uses the code to open the otp screen
    @ExceptionHandler(UnverifiedAccountException.class)
    public ResponseEntity<Map<String, Object>> handleUnverified(UnverifiedAccountException ex) {
        log.warn("[EXCEPTION] Unverified account login attempt", ex);
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("code", "UNVERIFIED_ACCOUNT");
        body.put("message", "Account verification required");
        body.put("email", ex.getEmail());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    // input errors with a message that is safe to show
    @ExceptionHandler(UserInputException.class)
    public ResponseEntity<Map<String, Object>> handleUserInput(UserInputException ex) {
        log.debug("[EXCEPTION] Invalid input: {}", ex.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_INPUT", ex.getMessage());
    }

    // all other untyped business errors, message stays hidden
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex) {
        log.warn("[EXCEPTION] RuntimeException", ex);
        return buildResponse(HttpStatus.BAD_REQUEST, "REQUEST_FAILED", "Request could not be completed");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        // wrong passwords are expected so no error log
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

    // valid failures return field errors for inline messages
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex) {

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            // keep the first error per field
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

    // catch all for unexpected errors
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