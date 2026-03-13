package com.meroshare.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class IpoApplyRequest {

    @NotBlank(message = "Share ID is required")
    private String shareId;

    @NotBlank(message = "Company name is required")
    private String companyName;

    @Min(value = 10, message = "Minimum 10 kitta")
    private int kitta;

    @NotEmpty(message = "Select at least one account")
    private List<Long> accountIds;
}