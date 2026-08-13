package com.meroshare.backend.service;

import com.meroshare.backend.dto.AuthResponse;
import com.meroshare.backend.dto.LoginRequest;
import com.meroshare.backend.dto.RegisterRequest;
import com.meroshare.backend.dto.UserDetailsResponse;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final OtpService otpService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final EmailServiceClient emailServiceClient;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        Optional<AppUser> existingByEmail = appUserRepository.findByEmail(request.getEmail());

        if (existingByEmail.isPresent()) {
            AppUser existing = existingByEmail.get();

            if (existing.isEnabled()) {
                throw new RuntimeException("Email already registered");
            }

            boolean usernameTakenByOther = appUserRepository.existsByUsername(request.getUsername())
                    && !existing.getUsername().equals(request.getUsername());
            if (usernameTakenByOther) {
                throw new RuntimeException("Username already taken");
            }

            existing.setUsername(request.getUsername());
            existing.setPassword(passwordEncoder.encode(request.getPassword()));
            appUserRepository.save(existing);

            sendRegistrationOtp(existing.getEmail());
            return new AuthResponse(null, existing.getUsername(), existing.getEmail());
        }

        if (appUserRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username already taken");
        }

        AppUser user = AppUser.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .enabled(false)
                .build();

        appUserRepository.save(user);

        sendRegistrationOtp(user.getEmail());

        return new AuthResponse(null, user.getUsername(), user.getEmail());
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(),
                        request.getPassword()
                )
        );

        AppUser user = appUserRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.isEnabled()) {
            throw new RuntimeException("Account is not verified. Please verify your email.");
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }

    @Transactional
    public void resendOtp(String email) {
        AppUser user = appUserRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No pending registration found for this email"));

        if (user.isEnabled()) {
            throw new RuntimeException("Account is already verified");
        }

        sendRegistrationOtp(email);
    }

    public void sendRegistrationOtp(String email) {
        String otpCode = generateSecureOtp();
        otpService.storeOtp(email, otpCode);

        String subject = "DasKitta Verify Your Account";
        String textBody = "Welcome to DasKitta\n\n"
                + "Your 6 digit verification code is: " + otpCode + "\n\n"
                + "This code is valid for 5 minutes. Do not share this code with anyone.\n"
                + "If you did not request this, please ignore this message.";
        String htmlBody = buildOtpEmailHtml(
                "Verify your account",
                "Welcome to DasKitta. Enter the code below to verify your email address.",
                otpCode);

        emailServiceClient.sendEmail(email, subject, textBody, htmlBody, "DasKitta Support");
    }

    private String generateSecureOtp() {
        int number = secureRandom.nextInt(1000000);
        return String.format("%06d", number);
    }

    @Transactional
    public void verifyOtp(String email, String code) {
        otpService.verifyOtp(email, code);

        AppUser user = appUserRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User profile not found"));

        user.setEnabled(true);
        appUserRepository.save(user);
    }

    // updates the password for a logged in user
    @Transactional
    public void updatePassword(String username, String oldPassword, String newPassword) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean matches = passwordEncoder.matches(oldPassword, user.getPassword());
        if (!matches) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }

    // updates the username for a logged in user
    @Transactional
    public void updateUsername(String currentUsername, String newUsername) {
        AppUser user = appUserRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (currentUsername.equals(newUsername)) {
            throw new RuntimeException("New username must be different from current username");
        }

        if (appUserRepository.existsByUsername(newUsername)) {
            throw new RuntimeException("Username already taken");
        }

        user.setUsername(newUsername);
        appUserRepository.save(user);
    }

    // starts an email change by sending an otp to the new email
    @Transactional
    public void requestEmailChange(String currentUsername, String newEmail) {
        AppUser user = appUserRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getEmail().equals(newEmail)) {
            throw new RuntimeException("New email must be different from current email");
        }

        boolean emailTakenByOther = appUserRepository.findByEmail(newEmail)
                .filter(AppUser::isEnabled)
                .isPresent();
        if (emailTakenByOther) {
            throw new RuntimeException("Email already registered");
        }

        sendEmailChangeOtp(newEmail);
    }

    // sends an otp code to the new email for confirmation
    public void sendEmailChangeOtp(String newEmail) {
        String otpCode = generateSecureOtp();
        otpService.storeOtp(newEmail, otpCode);

        String subject = "DasKitta Confirm Your New Email";
        String textBody = "From DasKitta\n\n"
                + "Your 6 digit code to confirm this new email is: " + otpCode + "\n\n"
                + "This code is valid for 5 minutes. Do not share this code with anyone.\n"
                + "If you did not request this, please ignore this message.";
        String htmlBody = buildOtpEmailHtml(
                "Confirm your new email",
                "Enter the code below to confirm this email change on your DasKitta account.",
                otpCode);

        emailServiceClient.sendEmail(newEmail, subject, textBody, htmlBody, "DasKitta Support");
    }

    // confirms the email change once the correct otp is given
    @Transactional
    public void confirmEmailChange(String currentUsername, String newEmail, String code) {
        AppUser user = appUserRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        otpService.verifyOtp(newEmail, code);

        user.setEmail(newEmail);
        appUserRepository.save(user);
    }

    // returns saved details for a logged in user
    public UserDetailsResponse getUserDetails(String username) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new UserDetailsResponse(user.getUsername(), user.getEmail(), user.isEnabled());
    }

    // deletes the logged in user and all related data via cascade
    @Transactional
    public void deleteAccount(String username, String password) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean matches = passwordEncoder.matches(password, user.getPassword());
        if (!matches) {
            throw new RuntimeException("Password is incorrect");
        }

        otpService.clearOtp(user.getEmail());
        appUserRepository.delete(user);
    }

    // builds the html otp email template used for registration and email change
    private String buildOtpEmailHtml(String heading, String introText, String otpCode) {
        return "<!DOCTYPE html>"
                + "<html><body style=\"margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f5f7;padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);\">"
                + "<tr><td style=\"background-color:#111827;padding:24px 32px;\">"
                + "<span style=\"color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;\">DasKitta</span>"
                + "</td></tr>"
                + "<tr><td style=\"padding:32px;\">"
                + "<h1 style=\"margin:0 0 12px;font-size:20px;color:#111827;\">" + heading + "</h1>"
                + "<p style=\"margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;\">" + introText + "</p>"
                + "<div style=\"text-align:center;margin:0 0 24px;\">"
                + "<span style=\"display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;background-color:#f4f5f7;padding:16px 24px;border-radius:8px;\">" + otpCode + "</span>"
                + "</div>"
                + "<p style=\"margin:0 0 8px;font-size:13px;color:#6b7280;\">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>"
                + "<p style=\"margin:0;font-size:13px;color:#9ca3af;\">If you did not request this, you can safely ignore this email.</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;\">"
                + "<p style=\"margin:0;font-size:12px;color:#9ca3af;\">Sent by DasKitta Support. This is an automated message.</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }
}