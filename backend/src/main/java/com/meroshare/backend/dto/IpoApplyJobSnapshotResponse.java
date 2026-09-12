package com.meroshare.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class IpoApplyJobSnapshotResponse {
    private String jobId;
    private boolean completed;
    private boolean cancelled;
    private long lastSequence;

    private int totalCount;
    private int processedCount;
    private int successCount;
    private int failedCount;
    private int cancelledCount;
    private int pendingCount;

    private List<IpoApplyJobAccountState> accounts;
}
