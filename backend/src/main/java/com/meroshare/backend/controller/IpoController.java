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

@RestController
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
public class IpoController {

    private final IpoService ipoService;

    @GetMapping("/open")
    public ResponseEntity<List> getOpenIpos(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                ipoService.getOpenIpos(userDetails.getUsername()));
    }

    @GetMapping("/closed")
    public ResponseEntity<List> getClosedIpos(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                ipoService.getClosedIpos(userDetails.getUsername()));
    }

    @PostMapping("/apply")
    public ResponseEntity<List<IpoApplyResult>> applyIpo(
            @Valid @RequestBody IpoApplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                ipoService.applyForAll(request, userDetails.getUsername()));
    }

    @GetMapping("/result/{shareId}")
    public ResponseEntity<List<IpoApplicationResponse>> checkResult(
            @PathVariable String shareId,
            @RequestParam(required = false) String boid,
            @AuthenticationPrincipal UserDetails userDetails) {

        if (userDetails != null) {
            return ResponseEntity.ok(
                    ipoService.checkResults(shareId, userDetails.getUsername()));
        }

        if (boid != null && !boid.isBlank()) {
            return ResponseEntity.ok(
                    ipoService.checkResultByBoid(shareId, boid));
        }

        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/history")
    public ResponseEntity<List<IpoApplicationResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                ipoService.getHistory(userDetails.getUsername()));
    }
}