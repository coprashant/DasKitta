package com.meroshare.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateUsernameRequest {

    @NotBlank(message = "New username is required")
    private String newUsername;
}