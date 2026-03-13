package com.meroshare.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MeroshareAccountRequest {

    @NotBlank(message = "DP ID is required")
    private String dpId;

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;
}