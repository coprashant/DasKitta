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

    private String cleanEmail(String email) {
        if (email == null) return null;
        return email.trim().toLowerCase();
    }

    private String cleanInput(String input) {
        if (input == null) return null;
        return input.trim();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String sanitizedEmail = cleanEmail(request.getEmail());
        String sanitizedUsername = cleanInput(request.getUsername());

        Optional<AppUser> existingByEmail = appUserRepository.findByEmail(sanitizedEmail);

        if (existingByEmail.isPresent()) {
            AppUser existing = existingByEmail.get();

            if (existing.isEnabled()) {
                throw new RuntimeException("Email already registered");
            }

            boolean usernameTakenByOther = appUserRepository.existsByUsername(sanitizedUsername)
                    && !existing.getUsername().equalsIgnoreCase(sanitizedUsername);
            if (usernameTakenByOther) {
                throw new RuntimeException("Username already taken");
            }

            existing.setUsername(sanitizedUsername);
            existing.setPassword(passwordEncoder.encode(request.getPassword()));
            appUserRepository.save(existing);

            sendRegistrationOtp(sanitizedEmail);
            return new AuthResponse(null, existing.getUsername(), existing.getEmail());
        }

        if (appUserRepository.existsByUsername(sanitizedUsername)) {
            throw new RuntimeException("Username already taken");
        }

        AppUser user = AppUser.builder()
                .username(sanitizedUsername)
                .email(sanitizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .enabled(false)
                .build();

        appUserRepository.save(user);

        sendRegistrationOtp(sanitizedEmail);

        return new AuthResponse(null, user.getUsername(), user.getEmail());
    }

    public AuthResponse login(LoginRequest request) {
        String sanitizedUsername = cleanInput(request.getUsername());

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        sanitizedUsername,
                        request.getPassword()
                )
        );

        AppUser user = appUserRepository.findByUsername(sanitizedUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.isEnabled()) {
            throw new RuntimeException("Account is not verified. Please verify your email.");
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }

    @Transactional
    public void resendOtp(String email) {
        String sanitizedEmail = cleanEmail(email);

        AppUser user = appUserRepository.findByEmail(sanitizedEmail)
                .orElseThrow(() -> new RuntimeException("No pending registration found for this email"));

        if (user.isEnabled()) {
            throw new RuntimeException("Account is already verified");
        }

        sendRegistrationOtp(sanitizedEmail);
    }

    public void sendRegistrationOtp(String email) {
        String sanitizedEmail = cleanEmail(email);
        String otpCode = generateSecureOtp();
        otpService.storeOtp(sanitizedEmail, otpCode);

        String subject = "Verify your DasKitta account";
        String textBody = "Welcome to DasKitta!\n\n"
                + "Your 6-digit verification code is: " + otpCode + "\n\n"
                + "This code expires in 5 minutes. Do not share this code with anyone.\n"
                + "If you did not request this, please ignore this message.";

        String htmlBody = buildOtpEmailHtml(
                "Verify your account",
                "Welcome to DasKitta! Use the verification code below to complete your registration.",
                otpCode);

        emailServiceClient.sendEmail(sanitizedEmail, subject, textBody, htmlBody, "DasKitta Support");
    }

    private String generateSecureOtp() {
        int number = secureRandom.nextInt(1000000);
        return String.format("%06d", number);
    }

    @Transactional
    public void verifyOtp(String email, String code) {
        String sanitizedEmail = cleanEmail(email);

        otpService.verifyOtp(sanitizedEmail, code);

        AppUser user = appUserRepository.findByEmail(sanitizedEmail)
                .orElseThrow(() -> new RuntimeException("User profile not found"));

        user.setEnabled(true);
        appUserRepository.save(user);
    }

    @Transactional
    public void updatePassword(String username, String oldPassword, String newPassword) {
        AppUser user = appUserRepository.findByUsername(cleanInput(username))
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean matches = passwordEncoder.matches(oldPassword, user.getPassword());
        if (!matches) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }

    @Transactional
    public void updateUsername(String currentUsername, String newUsername) {
        String sanitizedCurrent = cleanInput(currentUsername);
        String sanitizedNew = cleanInput(newUsername);

        AppUser user = appUserRepository.findByUsername(sanitizedCurrent)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (sanitizedCurrent.equalsIgnoreCase(sanitizedNew)) {
            throw new RuntimeException("New username must be different from current username");
        }

        if (appUserRepository.existsByUsername(sanitizedNew)) {
            throw new RuntimeException("Username already taken");
        }

        user.setUsername(sanitizedNew);
        appUserRepository.save(user);
    }

    @Transactional
    public void requestEmailChange(String currentUsername, String newEmail) {
        String sanitizedNewEmail = cleanEmail(newEmail);

        AppUser user = appUserRepository.findByUsername(cleanInput(currentUsername))
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getEmail().equalsIgnoreCase(sanitizedNewEmail)) {
            throw new RuntimeException("New email must be different from current email");
        }

        boolean emailTakenByOther = appUserRepository.findByEmail(sanitizedNewEmail)
                .filter(AppUser::isEnabled)
                .isPresent();
        if (emailTakenByOther) {
            throw new RuntimeException("Email already registered");
        }

        sendEmailChangeOtp(sanitizedNewEmail);
    }

    public void sendEmailChangeOtp(String newEmail) {
        String sanitizedNewEmail = cleanEmail(newEmail);
        String otpCode = generateSecureOtp();
        otpService.storeOtp(sanitizedNewEmail, otpCode);

        String subject = "Confirm your new DasKitta email address";
        String textBody = "DasKitta Security Notification\n\n"
                + "Your 6-digit code to confirm this email address is: " + otpCode + "\n\n"
                + "This code expires in 5 minutes. Do not share this code with anyone.\n"
                + "If you did not request this change, please contact support immediately.";

        String htmlBody = buildOtpEmailHtml(
                "Confirm your new email",
                "You requested to update your DasKitta account email address. Use the code below to complete this change.",
                otpCode);

        emailServiceClient.sendEmail(sanitizedNewEmail, subject, textBody, htmlBody, "DasKitta Support");
    }

    @Transactional
    public void confirmEmailChange(String currentUsername, String newEmail, String code) {
        String sanitizedNewEmail = cleanEmail(newEmail);

        AppUser user = appUserRepository.findByUsername(cleanInput(currentUsername))
                .orElseThrow(() -> new RuntimeException("User not found"));

        otpService.verifyOtp(sanitizedNewEmail, code);

        user.setEmail(sanitizedNewEmail);
        appUserRepository.save(user);
    }

    public UserDetailsResponse getUserDetails(String username) {
        AppUser user = appUserRepository.findByUsername(cleanInput(username))
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new UserDetailsResponse(user.getUsername(), user.getEmail(), user.isEnabled());
    }

    @Transactional
    public void deleteAccount(String username, String password) {
        AppUser user = appUserRepository.findByUsername(cleanInput(username))
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean matches = passwordEncoder.matches(password, user.getPassword());
        if (!matches) {
            throw new RuntimeException("Password is incorrect");
        }

        otpService.clearOtp(user.getEmail());
        appUserRepository.delete(user);
    }

    private String buildOtpEmailHtml(String heading, String introText, String otpCode) {
        return "<!DOCTYPE html>"
                + "<html lang=\"en\">"
                + "<head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
                + "<title>" + heading + "</title>"
                + "</head>"
                + "<body style=\"margin:0; padding:0; background-color:#F3F4F6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#F3F4F6; padding:40px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:512px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E5E7EB; box-shadow:0 10px 15px -3px rgba(0, 0, 0, 0.05);\">"
                + "<tr><td style=\"background-color:#0F172A; padding:28px 36px; text-align:left;\">"
                + "<span style=\"color:#FFFFFF; font-size:22px; font-weight:800; letter-spacing:-0.5px;\">DasKitta</span>"
                + "</td></tr>"
                + "<tr><td style=\"padding:40px 36px 32px 36px;\">"
                + "<h1 style=\"margin:0 0 12px 0; font-size:22px; font-weight:700; color:#0F172A; line-height:1.3;\">" + heading + "</h1>"
                + "<p style=\"margin:0 0 28px 0; font-size:15px; line-height:1.6; color:#475569;\">" + introText + "</p>"
                + "<div style=\"text-align:center; margin:0 0 28px 0; background-color:#F8FAFC; border:1px dashed #CBD5E1; border-radius:12px; padding:20px;\">"
                + "<span style=\"display:block; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#64748B; margin-bottom:8px;\">Verification Code</span>"
                + "<span style=\"display:inline-block; font-family: 'Courier New', Courier, monospace; font-size:36px; font-weight:800; letter-spacing:10px; color:#0F172A;\">" + otpCode + "</span>"
                + "</div>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#FEF2F2; border-left:4px solid #EF4444; border-radius:4px; margin-bottom:24px;\">"
                + "<tr><td style=\"padding:12px 16px;\">"
                + "<p style=\"margin:0; font-size:13px; line-height:1.5; color:#991B1B;\">"
                + "⏱️ Code expires in <strong>5 minutes</strong>. Never share this code with anyone."
                + "</p>"
                + "</td></tr>"
                + "</table>"
                + "<p style=\"margin:20px 0 0 0; font-size:13px; line-height:1.5; color:#94A3B8;\">"
                + "If you did not request this code, please ignore this email or reach out to support if you have concerns."
                + "</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:24px 36px; background-color:#F8FAFC; border-top:1px solid #F1F5F9; text-align:center;\">"
                + "<p style=\"margin:0 0 4px 0; font-size:12px; font-weight:500; color:#64748B;\">&copy; " + java.time.Year.now().getValue() + " DasKitta. All rights reserved.</p>"
                + "<p style=\"margin:0; font-size:12px; color:#94A3B8;\">Automated transactional email. Please do not reply directly to this message.</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }
}