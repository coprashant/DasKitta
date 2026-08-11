package com.meroshare.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeleteAccountRequest {
    // Current password required to confirm deletion
    @NotBlank(message = "Password is required")
    private String password;
}