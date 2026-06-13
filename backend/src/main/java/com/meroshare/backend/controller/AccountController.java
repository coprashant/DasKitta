package com.meroshare.backend.controller;
import com.meroshare.backend.dto.MeroshareAccountRequest;
import com.meroshare.backend.dto.MeroshareAccountResponse;
import com.meroshare.backend.dto.MeroshareAccountUpdateRequest;
import com.meroshare.backend.dto.PortfolioResponse;
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
    @GetMapping("/bank-by-dp/{dpId}")
    public ResponseEntity<Map<String, Object>> getBankByDp(@PathVariable Integer dpId) {
        return ResponseEntity.ok(meroshareApiService.getBankByDp(dpId));
    }
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
    @PatchMapping("/{id}")
    public ResponseEntity<MeroshareAccountResponse> updateAccount(
            @PathVariable Long id,
            @RequestBody MeroshareAccountUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(accountService.updateAccount(id, request, userDetails.getUsername()));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAccount(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        accountService.deleteAccount(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/portfolio")
    public ResponseEntity<PortfolioResponse> getPortfolio(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(accountService.getPortfolio(id, userDetails.getUsername()));
    }

}