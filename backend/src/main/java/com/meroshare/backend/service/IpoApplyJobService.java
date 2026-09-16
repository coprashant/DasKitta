package com.meroshare.backend.service;

import com.meroshare.backend.dto.IpoApplyJobAccountState;
import com.meroshare.backend.dto.IpoApplyJobSnapshotResponse;
import com.meroshare.backend.dto.IpoApplyJobStartResponse;
import com.meroshare.backend.dto.IpoApplyProgressEvent;
import com.meroshare.backend.dto.IpoApplyRequest;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.Notification;
import com.meroshare.backend.exception.FastRuntimeException;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.NotificationRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpoApplyJobService {

    private static final Duration COMPLETED_JOB_RETENTION = Duration.ofMinutes(15);

    private final IpoService ipoService;
    private final AppUserRepository appUserRepository;
    private final NotificationRepository notificationRepository;

    private final Map<String, JobState> jobs = new ConcurrentHashMap<>();

    public IpoApplyJobStartResponse startJob(IpoApplyRequest request, String username) {
        String jobId = UUID.randomUUID().toString();

        List<AccountState> seeded = new ArrayList<>();
        for (Long accountId : request.getAccountIds()) {
            seeded.add(AccountState.builder()
                    .accountId(accountId)
                    .status("PENDING")
                    .message("Queued")
                    .build());
        }

        JobState state = JobState.builder()
                .jobId(jobId)
                .ownerUsername(username)
                .request(cloneRequest(request))
                .accounts(new CopyOnWriteArrayList<>(seeded))
                .events(new CopyOnWriteArrayList<>())
                .listeners(new ConcurrentHashMap<>())
                .lastSequence(0)
                .completed(false)
                .cancelled(false)
                .cancelRequested(false)
                .totalCount(request.getAccountIds().size())
                .processedCount(0)
                .successCount(0)
                .failedCount(0)
                .cancelledCount(0)
                .pendingCount(request.getAccountIds().size())
                .completedAt(null)
                .build();

        jobs.put(jobId, state);
        Thread.ofVirtual().name("ipo-apply-job-" + jobId).start(() -> runJob(state));

        return IpoApplyJobStartResponse.builder().jobId(jobId).build();
    }

    public String subscribe(String jobId, String username, long fromSequence, Consumer<IpoApplyProgressEvent> onEvent) {
        JobState state = getOwnedJob(jobId, username);

        for (IpoApplyProgressEvent event : state.getEvents()) {
            if (event.getSequence() > fromSequence) {
                onEvent.accept(event);
            }
        }

        String listenerId = UUID.randomUUID().toString();
        state.getListeners().put(listenerId, onEvent);
        return listenerId;
    }

    public void unsubscribe(String jobId, String username, String listenerId) {
        JobState state = getOwnedJob(jobId, username);
        state.getListeners().remove(listenerId);
    }

    public IpoApplyJobSnapshotResponse getSnapshot(String jobId, String username) {
        JobState state = getOwnedJob(jobId, username);

        List<IpoApplyJobAccountState> accounts = state.getAccounts().stream()
                .map(acc -> IpoApplyJobAccountState.builder()
                        .accountId(acc.getAccountId())
                        .username(acc.getUsername())
                        .fullName(acc.getFullName())
                        .status(acc.getStatus())
                        .message(acc.getMessage())
                        .build())
                .toList();

        return IpoApplyJobSnapshotResponse.builder()
                .jobId(state.getJobId())
                .completed(state.isCompleted())
                .cancelled(state.isCancelled())
                .lastSequence(state.getLastSequence())
                .totalCount(state.getTotalCount())
                .processedCount(state.getProcessedCount())
                .successCount(state.getSuccessCount())
                .failedCount(state.getFailedCount())
                .cancelledCount(state.getCancelledCount())
                .pendingCount(state.getPendingCount())
                .accounts(accounts)
                .build();
    }

    public IpoApplyJobStartResponse retryFailed(String jobId, String username) {
        JobState state = getOwnedJob(jobId, username);

        List<Long> failedIds = state.getAccounts().stream()
                .filter(a -> "FAILED".equals(a.getStatus()))
                .map(a -> a.getAccountId())
                .filter(id -> id != null)
                .toList();

        if (failedIds.isEmpty()) {
            throw new FastRuntimeException("No failed accounts to retry");
        }

        IpoApplyRequest retryRequest = cloneRequest(state.getRequest());
        retryRequest.setAccountIds(failedIds);

        return startJob(retryRequest, username);
    }

    public IpoApplyJobSnapshotResponse cancelJob(String jobId, String username) {
        JobState state = getOwnedJob(jobId, username);
        state.setCancelRequested(true);
        return getSnapshot(jobId, username);
    }

    @Scheduled(fixedRate = 300000)
    public void evictCompletedJobs() {
        Instant cutoff = Instant.now().minus(COMPLETED_JOB_RETENTION);
        int before = jobs.size();

        jobs.entrySet().removeIf(entry -> {
            JobState state = entry.getValue();
            Instant completedAt = state.getCompletedAt();
            return state.isCompleted() && completedAt != null && completedAt.isBefore(cutoff);
        });

        int removed = before - jobs.size();
        if (removed > 0) {
            log.info("[APPLY_JOB] Evicted {} completed job snapshots", removed);
        }
    }

    private void runJob(JobState state) {
        try {
            ipoService.applyForAllStream(
                    state.getRequest(),
                    state.getOwnerUsername(),
                    event -> publish(state, event),
                    () -> !state.isCancelRequested()
            );
        } catch (Exception e) {
            log.error("[APPLY_JOB] job {} failed {}", state.getJobId(), e.getMessage());
            long seq = state.getLastSequence() + 1;
            publish(state, IpoApplyProgressEvent.builder()
                    .eventType("job_completed")
                    .sequence(seq)
                    .totalCount(state.getTotalCount())
                    .processedCount(state.getProcessedCount())
                    .successCount(state.getSuccessCount())
                    .failedCount(state.getFailedCount())
                    .cancelledCount(state.getCancelledCount())
                    .pendingCount(Math.max(0, state.getTotalCount() - state.getProcessedCount()))
                    .build());
        }
    }

    private void publish(JobState state, IpoApplyProgressEvent event) {
        state.setLastSequence(Math.max(state.getLastSequence(), event.getSequence()));
        state.setTotalCount(event.getTotalCount());
        state.setProcessedCount(event.getProcessedCount());
        state.setSuccessCount(event.getSuccessCount());
        state.setFailedCount(event.getFailedCount());
        state.setCancelledCount(event.getCancelledCount());
        state.setPendingCount(event.getPendingCount());
        state.getEvents().add(event);

        if (event.getAccountId() != null) {
            int idx = findAccountIndex(state.getAccounts(), event.getAccountId());
            AccountState next = AccountState.builder()
                    .accountId(event.getAccountId())
                    .username(event.getUsername())
                    .fullName(event.getFullName())
                    .status(event.getStatus())
                    .message(event.getMessage())
                    .build();
            if (idx >= 0) {
                state.getAccounts().set(idx, mergeState(state.getAccounts().get(idx), next));
            } else {
                state.getAccounts().add(next);
            }
        }

        if ("job_cancelled".equals(event.getEventType())) {
            state.setCancelled(true);
            markRemainingCancelled(state);
        }

        if ("job_completed".equals(event.getEventType()) || "job_cancelled".equals(event.getEventType())) {
            state.setCompleted(true);
            state.setCompletedAt(Instant.now());
            createCompletionNotification(state);
        }

        state.getListeners().values().forEach(listener -> {
            try {
                listener.accept(event);
            } catch (Exception ignored) {
            }
        });
    }

    private void markRemainingCancelled(JobState state) {
        int pending = 0;
        for (int i = 0; i < state.getAccounts().size(); i++) {
            AccountState acc = state.getAccounts().get(i);
            if ("PENDING".equals(acc.getStatus())) {
                pending++;
                state.getAccounts().set(i, AccountState.builder()
                        .accountId(acc.getAccountId())
                        .username(acc.getUsername())
                        .fullName(acc.getFullName())
                        .status("CANCELLED")
                        .message("Cancelled by user")
                        .build());
            }
        }

        if (pending > 0) {
            state.setCancelledCount(Math.max(state.getCancelledCount(), pending));
        }
        state.setPendingCount(0);
    }

    private void createCompletionNotification(JobState state) {
        AppUser user = appUserRepository.findByUsername(state.getOwnerUsername()).orElse(null);
        if (user == null) {
            return;
        }

        String title;
        String body;
        String detail;
        String type;

        if (state.isCancelled()) {
            type = "APP_FAILED";
            title = "IPO apply cancelled";
            body = "Remaining accounts were cancelled";
            detail = "Success " + state.getSuccessCount()
                    + " Failed " + state.getFailedCount()
                    + " Cancelled " + state.getCancelledCount();
        } else if (state.getFailedCount() > 0) {
            type = "APP_FAILED";
            title = "IPO apply finished with errors";
            body = "Some accounts failed during apply";
            detail = "Success " + state.getSuccessCount()
                    + " Failed " + state.getFailedCount();
        } else {
            type = "NEW_IPO";
            title = "IPO apply completed";
            body = "All selected accounts were processed";
            detail = "Success " + state.getSuccessCount();
        }

        Notification notification = Notification.builder()
                .appUser(user)
                .type(type)
                .title(title)
                .body(body)
                .detail(detail)
                .targetUrl("/ipo/apply")
                .isRead(false)
                .isDeleted(false)
                .build();

        notificationRepository.save(notification);
    }

    private int findAccountIndex(List<AccountState> accounts, Long accountId) {
        for (int i = 0; i < accounts.size(); i++) {
            if (accountId.equals(accounts.get(i).getAccountId())) {
                return i;
            }
        }
        return -1;
    }

    private AccountState mergeState(AccountState current, AccountState next) {
        return AccountState.builder()
                .accountId(current.getAccountId())
                .username(next.getUsername() != null ? next.getUsername() : current.getUsername())
                .fullName(next.getFullName() != null ? next.getFullName() : current.getFullName())
                .status(next.getStatus() != null ? next.getStatus() : current.getStatus())
                .message(next.getMessage() != null ? next.getMessage() : current.getMessage())
                .build();
    }

    private JobState getOwnedJob(String jobId, String username) {
        JobState state = jobs.get(jobId);
        if (state == null) {
            throw new FastRuntimeException("Apply job not found");
        }
        if (!state.getOwnerUsername().equals(username)) {
            throw new FastRuntimeException("Unauthorized");
        }
        return state;
    }

    private IpoApplyRequest cloneRequest(IpoApplyRequest request) {
        IpoApplyRequest clone = new IpoApplyRequest();
        clone.setShareId(request.getShareId());
        clone.setCompanyName(request.getCompanyName());
        clone.setKitta(request.getKitta());
        clone.setAccountIds(new ArrayList<>(request.getAccountIds()));
        return clone;
    }

    @Data
    @Builder
    private static class JobState {
        private String jobId;
        private String ownerUsername;
        private IpoApplyRequest request;
        private CopyOnWriteArrayList<AccountState> accounts;
        private CopyOnWriteArrayList<IpoApplyProgressEvent> events;
        private ConcurrentHashMap<String, Consumer<IpoApplyProgressEvent>> listeners;

        private long lastSequence;
        private boolean completed;
        private boolean cancelled;
        private boolean cancelRequested;

        private int totalCount;
        private int processedCount;
        private int successCount;
        private int failedCount;
        private int cancelledCount;
        private int pendingCount;
        private Instant completedAt;
    }

    @Data
    @Builder
    private static class AccountState {
        private Long accountId;
        private String username;
        private String fullName;
        private String status;
        private String message;
    }
}
