package com.meroshare.backend.controller;
import com.meroshare.backend.dto.AuthResponse;
import com.meroshare.backend.dto.DeleteAccountRequest;
import com.meroshare.backend.dto.EmailChangeConfirmRequest;
import com.meroshare.backend.dto.EmailChangeRequest;
import com.meroshare.backend.dto.LoginRequest;
import com.meroshare.backend.dto.OtpRequest;
import com.meroshare.backend.dto.RegisterRequest;
import com.meroshare.backend.dto.ResendOtpRequest;
import com.meroshare.backend.dto.UpdatePasswordRequest;
import com.meroshare.backend.dto.UpdateUsernameRequest;
import com.meroshare.backend.dto.UserDetailsResponse;
import com.meroshare.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
    @PostMapping("/verify-otp")
    public ResponseEntity<String> verifyOtp(@Valid @RequestBody OtpRequest request) {
        authService.verifyOtp(request.getEmail(), request.getCode());
        return ResponseEntity.ok("Account verified successfully! You can now log in.");
    }
    @PostMapping("/resend-otp")
    public ResponseEntity<String> resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        authService.resendOtp(request.getEmail());
        return ResponseEntity.ok("A new verification code has been sent.");
    }
    // Updates password for the logged in user
    @PatchMapping("/password")
    public ResponseEntity<String> updatePassword(
            @Valid @RequestBody UpdatePasswordRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        authService.updatePassword(userDetails.getUsername(), request.getOldPassword(), request.getNewPassword());
        return ResponseEntity.ok("Password updated successfully");
    }
    // Updates username for the logged in user
    @PatchMapping("/username")
    public ResponseEntity<String> updateUsername(
            @Valid @RequestBody UpdateUsernameRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        authService.updateUsername(userDetails.getUsername(), request.getNewUsername());
        return ResponseEntity.ok("Username updated successfully");
    }
    // Sends an otp to the new email to start the change
    @PostMapping("/email/request-change")
    public ResponseEntity<String> requestEmailChange(
            @Valid @RequestBody EmailChangeRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        authService.requestEmailChange(userDetails.getUsername(), request.getNewEmail());
        return ResponseEntity.ok("A verification code has been sent to the new email");
    }
    // Confirms the new email using the otp sent to it
    @PostMapping("/email/confirm-change")
    public ResponseEntity<String> confirmEmailChange(
            @Valid @RequestBody EmailChangeConfirmRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        authService.confirmEmailChange(userDetails.getUsername(), request.getNewEmail(), request.getCode());
        return ResponseEntity.ok("Email updated successfully");
    }
    // Fetches details for the logged in user
    @GetMapping("/me")
    public ResponseEntity<UserDetailsResponse> getUserDetails(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(authService.getUserDetails(userDetails.getUsername()));
    }
    // Deletes the logged in user's account permanently
    @DeleteMapping("/delete-account")
    public ResponseEntity<String> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        authService.deleteAccount(userDetails.getUsername(), request.getPassword());
        return ResponseEntity.ok("Account deleted successfully");
    }
}