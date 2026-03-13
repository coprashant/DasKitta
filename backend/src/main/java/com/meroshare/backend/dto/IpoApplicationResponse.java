package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class IpoApplicationResponse {

    private Long id;
    private String companyName;
    private String shareId;
    private int appliedKitta;
    private String status;
    private String statusMessage;
    private String resultStatus;
    private int allottedKitta;
    private LocalDateTime appliedAt;
    private LocalDateTime resultCheckedAt;
    private String accountUsername;
    private String accountFullName;
}