package com.meroshare.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Username or email is required")
    private String loginIdentifier;

    @NotBlank(message = "Password is required")
    private String password;

    private boolean rememberMe;
}