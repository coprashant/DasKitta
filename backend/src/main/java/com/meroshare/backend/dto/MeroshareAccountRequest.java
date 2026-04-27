package com.meroshare.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MeroshareAccountRequest {

    @NotNull(message = "DP ID is required")
    @Min(value = 1, message = "DP ID must be a positive integer")
    private Integer dpId;

    @NotBlank(message = "DP code is required")
    private String dpCode;

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    @NotNull(message = "Bank ID is required")
    private Integer bankId;

    @NotBlank(message = "CRN is required")
    private String crn;

    private String pin;
}