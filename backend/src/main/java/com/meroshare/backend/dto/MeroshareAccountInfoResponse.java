package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MeroshareAccountInfoResponse {
    private Long id;
    private String dpId;
    private String dpCode;
    private String username;
    private String fullName;
    private String boid;
    private String demat;
    private String dematExpiryDate;
    private String accountExpiryDate;
    private String passwordExpiryDate;
    private String crn;
    private String bankId;
    private String bankName;
    private String branchName;
    private String accountNumber;
    private String accountBranchId;
    private String customerId;
    private Integer accountTypeId;
    private LocalDateTime createdAt;
    // true if we successfully refreshed from CDSC just now, false if we're showing cached/stored data
    private boolean liveDataAvailable;
}