package com.meroshare.backend.controller;

import com.meroshare.backend.dto.IpoApplyRequest;
import com.meroshare.backend.dto.IpoApplyResult;
import com.meroshare.backend.dto.IpoApplicationResponse;
import com.meroshare.backend.service.IpoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
public class IpoController {

    private final IpoService ipoService;

    /**
     * Public: returns all IPO share IDs available for result checking
     * (proxied from CDSC result site to avoid browser CORS issues)
     */
    @GetMapping("/shares")
    public ResponseEntity<List<Map>> getPublicShareList() {
        return ResponseEntity.ok(ipoService.getPublicShareList());
    }

    @GetMapping("/lists")
    public ResponseEntity<Map<String, List>> getIpoLists(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getIpoLists(userDetails.getUsername()));
    }

    @GetMapping("/open")
    public ResponseEntity<List> getOpenIpos(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getOpenIpos(userDetails.getUsername()));
    }

    @GetMapping("/closed")
    public ResponseEntity<List> getClosedIpos(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getClosedIpos(userDetails.getUsername()));
    }

    @PostMapping("/apply")
    public ResponseEntity<List<IpoApplyResult>> applyIpo(
            @Valid @RequestBody IpoApplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.applyForAll(request, userDetails.getUsername()));
    }

    /**
     * Result check endpoint — works for both authenticated users and guests.
     *
     * Authenticated:  GET /api/ipo/result/{shareId}
     *   → checks all saved accounts for this user
     *
     * Guest:          GET /api/ipo/result/{shareId}?boid=1234567890123456
     *   → checks a single BOID via the public CDSC endpoint
     */
    @GetMapping("/result/{shareId}")
    public ResponseEntity<List<IpoApplicationResponse>> checkResult(
            @PathVariable String shareId,
            @RequestParam(required = false) String boid,
            @AuthenticationPrincipal UserDetails userDetails) {

        if (userDetails != null) {
            // Authenticated user: check all their accounts
            return ResponseEntity.ok(ipoService.checkResults(shareId, userDetails.getUsername()));
        }

        if (boid != null && !boid.isBlank()) {
            // Guest user: check by BOID only
            return ResponseEntity.ok(ipoService.checkResultByBoid(shareId, boid));
        }

        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/history")
    public ResponseEntity<List<IpoApplicationResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ipoService.getHistory(userDetails.getUsername()));
    }
}