package com.meroshare.backend.controller;

import com.meroshare.backend.dto.MeroshareAccountRequest;
import com.meroshare.backend.dto.MeroshareAccountResponse;
import com.meroshare.backend.service.MeroshareAccountService;
import com.meroshare.backend.service.MeroshareApiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final MeroshareAccountService accountService;
    private final MeroshareApiService meroshareApiService;

    @GetMapping("/dp-list")
    public ResponseEntity<List<Map>> getDpList() {
        return ResponseEntity.ok(meroshareApiService.getDpList());
    }

    @GetMapping
    public ResponseEntity<List<MeroshareAccountResponse>> getAccounts(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(accountService.getAccounts(userDetails.getUsername()));
    }

    @PostMapping
    public ResponseEntity<MeroshareAccountResponse> addAccount(
            @Valid @RequestBody MeroshareAccountRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(accountService.addAccount(request, userDetails.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAccount(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        accountService.deleteAccount(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}