package com.meroshare.backend.controller;

import com.meroshare.backend.dto.IpoApplyRequest;
import com.meroshare.backend.dto.IpoApplyJobSnapshotResponse;
import com.meroshare.backend.dto.IpoApplyJobStartResponse;
import com.meroshare.backend.dto.IpoApplicationResponse;
import com.meroshare.backend.dto.IpoApplyResult;
import com.meroshare.backend.service.IpoService;
import com.meroshare.backend.service.IpoApplyJobService;
import com.meroshare.backend.dto.CdscSummaryDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
public class IpoController {

    private final IpoService ipoService;
    private final IpoApplyJobService ipoApplyJobService;

    @GetMapping("/applied-companies")
    public ResponseEntity<List<Map<String, String>>> getAppliedCompanies(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getAppliedCompanies(userDetails.getUsername()));
    }

    @GetMapping("/shares")
    public ResponseEntity<List<Map>> getPublicShares() {
        return ResponseEntity.ok(ipoService.getPublicShareList());
    }

    @GetMapping("/open")
    public ResponseEntity<List> getOpenIpos(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getOpenIpos(userDetails.getUsername()));
    }

    @PostMapping("/apply")
    public ResponseEntity<List<IpoApplyResult>> applyForAll(
            @Valid @RequestBody IpoApplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.applyForAll(request, userDetails.getUsername()));
    }

    @PostMapping("/apply/jobs")
    public ResponseEntity<IpoApplyJobStartResponse> startApplyJob(
            @Valid @RequestBody IpoApplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoApplyJobService.startJob(request, userDetails.getUsername()));
    }

    @GetMapping(value = "/apply/jobs/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamApplyJob(
            @PathVariable String jobId,
            @RequestParam(defaultValue = "0") long fromSequence,
            @AuthenticationPrincipal UserDetails userDetails) {

        SseEmitter emitter = new SseEmitter(0L);

        if (userDetails == null) {
            emitter.completeWithError(new RuntimeException("Login required"));
            return emitter;
        }

        String username = userDetails.getUsername();

        try {
            String listenerId = ipoApplyJobService.subscribe(jobId, username, fromSequence, event -> {
                try {
                    emitter.send(SseEmitter.event().name("progress").id(String.valueOf(event.getSequence())).data(event));
                    if ("job_completed".equals(event.getEventType())) {
                        emitter.complete();
                    }
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
            });

            emitter.onCompletion(() -> ipoApplyJobService.unsubscribe(jobId, username, listenerId));
            emitter.onTimeout(() -> ipoApplyJobService.unsubscribe(jobId, username, listenerId));
            emitter.onError(err -> ipoApplyJobService.unsubscribe(jobId, username, listenerId));
        } catch (Exception e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    @GetMapping("/apply/jobs/{jobId}")
    public ResponseEntity<IpoApplyJobSnapshotResponse> getApplyJobSnapshot(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoApplyJobService.getSnapshot(jobId, userDetails.getUsername()));
    }

    @PostMapping("/apply/jobs/{jobId}/retry-failed")
    public ResponseEntity<IpoApplyJobStartResponse> retryFailedApplyJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoApplyJobService.retryFailed(jobId, userDetails.getUsername()));
    }

    @PostMapping("/apply/jobs/{jobId}/cancel")
    public ResponseEntity<IpoApplyJobSnapshotResponse> cancelApplyJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoApplyJobService.cancelJob(jobId, userDetails.getUsername()));
    }

    @PostMapping(value = "/apply/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter applyForAllStream(
            @Valid @RequestBody IpoApplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        SseEmitter emitter = new SseEmitter(0L);

        if (userDetails == null) {
            emitter.completeWithError(new RuntimeException("Login required"));
            return emitter;
        }

        String username = userDetails.getUsername();

        Thread.ofVirtual().name("ipo-apply-stream-" + username).start(() -> {
            try {
                ipoService.applyForAllStream(request, username, event -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(event));
                    } catch (IOException e) {
                        log.warn("SSE send failed for user {} reason {}", username, e.getMessage());
                        emitter.completeWithError(e);
                    }
                });
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE apply stream failed for user {} reason {}", username, e.getMessage());
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // sends one result per account as soon as it is checked
    // security config requires auth here so userDetails should not be null
    @GetMapping(value = "/result/{shareId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter checkResultStream(
            @PathVariable String shareId,
            @AuthenticationPrincipal UserDetails userDetails) {

        SseEmitter emitter = new SseEmitter(0L);

        if (userDetails == null) {
            emitter.completeWithError(new RuntimeException("Login required"));
            return emitter;
        }

        String username = userDetails.getUsername();

        // virtual thread instead of a raw platform thread per stream
        Thread.ofVirtual().name("ipo-result-stream-" + username).start(() -> {
            try {
                ipoService.checkResultsStream(shareId, username, result -> {
                    try {
                        emitter.send(SseEmitter.event().name("result").data(result));
                    } catch (IOException e) {
                        log.warn("SSE send failed for user {} reason {}", username, e.getMessage());
                        emitter.completeWithError(e);
                    }
                });
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE stream failed for user {} reason {}", username, e.getMessage());
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @GetMapping("/history")
    public ResponseEntity<List<IpoApplicationResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getHistory(userDetails.getUsername()));
    }

    @GetMapping("/cdsc-summary")
    public ResponseEntity<CdscSummaryDto> getCdscSummary(
            @RequestParam Long accountId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getCdscSummary(accountId, userDetails.getUsername()));
    }
}