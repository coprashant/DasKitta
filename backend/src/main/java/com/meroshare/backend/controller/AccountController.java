package com.meroshare.backend.controller;

import com.meroshare.backend.dto.MeroshareAccountRequest;
import com.meroshare.backend.dto.MeroshareAccountResponse;
import com.meroshare.backend.service.MeroshareAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final MeroshareAccountService accountService;

    @PostMapping
    public ResponseEntity<MeroshareAccountResponse> addAccount(
            @Valid @RequestBody MeroshareAccountRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                accountService.addAccount(request, userDetails.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<MeroshareAccountResponse>> getAccounts(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
                accountService.getAccounts(userDetails.getUsername()));
    }

    @DeleteMapping("/{accountId}")
    public ResponseEntity<Void> deleteAccount(
            @PathVariable Long accountId,
            @AuthenticationPrincipal UserDetails userDetails) {

        accountService.deleteAccount(accountId, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}