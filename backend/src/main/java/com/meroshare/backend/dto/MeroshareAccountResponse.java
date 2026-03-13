package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class MeroshareAccountResponse {

    private Long id;
    private String dpId;
    private String username;
    private String fullName;
    private String boid;
    private LocalDateTime createdAt;

    // Password is never sent back to the frontend
}