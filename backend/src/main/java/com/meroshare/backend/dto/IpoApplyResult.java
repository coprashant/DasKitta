package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IpoApplyResult {

    private Long accountId;
    private String username;
    private String fullName;
    private String status;
    private String message;
}