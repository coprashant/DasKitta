// UnverifiedAccountException.java
package com.meroshare.backend.exception;

public class UnverifiedAccountException extends RuntimeException {
    private final String email;

    public UnverifiedAccountException(String message, String email) {
        super(message);
        this.email = email;
    }

    public String getEmail() {
        return email;
    }
}