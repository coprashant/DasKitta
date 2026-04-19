package com.meroshare.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MeroshareAccountRequest {

    @NotBlank(message = "DP ID is required")
    @Pattern(regexp = "\\d+", message = "DP ID must be numeric")
    private String dpId;

    @NotBlank(message = "Meroshare username is required")
    @Size(min = 1, max = 50, message = "Username must be between 1 and 50 characters")
    private String username;

    @NotBlank(message = "Meroshare password is required")
    @Size(min = 1, max = 100, message = "Password must not be empty")
    private String password;

    // CRN and PIN are optional (not required for all banks)
    private String crn;

    @Size(max = 10, message = "PIN must not exceed 10 characters")
    private String pin;
}