package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IpoApplyProgressEvent {

    private String eventType;
    private long sequence;

    private int totalCount;
    private int processedCount;
    private int successCount;
    private int failedCount;
    private int cancelledCount;
    private int pendingCount;

    private Long accountId;
    private String username;
    private String fullName;
    private String status;
    private String message;
}
