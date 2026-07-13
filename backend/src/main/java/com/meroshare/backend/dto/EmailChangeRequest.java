package com.meroshare.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EmailChangeRequest {

    @NotBlank(message = "New email is required")
    @Email(message = "New email must be valid")
    private String newEmail;
}