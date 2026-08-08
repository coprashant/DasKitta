package com.meroshare.backend.service;

import com.meroshare.backend.dto.AuthResponse;
import com.meroshare.backend.dto.LoginRequest;
import com.meroshare.backend.dto.RegisterRequest;
import com.meroshare.backend.dto.UserDetailsResponse;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.EmailOtp;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.EmailOtpRepository;
import com.meroshare.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final EmailOtpRepository emailOtpRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final JavaMailSender mailSender;

    private final SecureRandom secureRandom = new SecureRandom();

    private static final long OTP_RESEND_COOLDOWN_SECONDS = 60;

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

    @Transactional
    public void sendRegistrationOtp(String email) {
        Optional<EmailOtp> existing = emailOtpRepository.findByEmail(email);

        if (existing.isPresent()) {
            LocalDateTime lastSent = existing.get().getLastSentAt();
            boolean tooSoon = lastSent != null
                    && lastSent.plusSeconds(OTP_RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now());

            if (tooSoon) {
                throw new RuntimeException("Please wait a bit before requesting another code");
            }
        }

        String otpCode = generateSecureOtp();

        emailOtpRepository.deleteByEmail(email);

        EmailOtp emailOtp = EmailOtp.builder()
                .email(email)
                .otpCode(otpCode)
                .expiryTime(LocalDateTime.now().plusMinutes(5))
                .lastSentAt(LocalDateTime.now())
                .build();

        emailOtpRepository.save(emailOtp);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("DasKitta Support <daskitta.support@gmail.com>");
        message.setTo(email);
        message.setSubject("DasKitta Verify Your Account");
        message.setText("Welcome to DasKitta\n\n" +
                "Your 6 digit verification code is: " + otpCode + "\n\n" +
                "This code is valid for 5 minutes. Do not share this code with anyone.\n"+
                "If you didn't request this, please ignore this message.");

        mailSender.send(message);
    }

    private String generateSecureOtp() {
        int number = secureRandom.nextInt(1000000);
        return String.format("%06d", number);
    }

    @Transactional
    public void verifyOtp(String email, String code) {
        EmailOtp emailOtp = emailOtpRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid or expired verification code"));

        if (emailOtp.isExpired()) {
            emailOtpRepository.deleteByEmail(email);
            throw new RuntimeException("Verification code has expired. Please request a new one.");
        }

        if (!emailOtp.getOtpCode().equals(code)) {
            throw new RuntimeException("Incorrect verification code");
        }

        AppUser user = appUserRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User profile not found"));

        user.setEnabled(true);
        appUserRepository.save(user);

        emailOtpRepository.deleteByEmail(email);
    }

    // Updates the password for a logged in user
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

    // Updates the username for a logged in user
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

    // Starts an email change by sending an otp to the new email
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

    // Sends an otp code to the new email for confirmation
    @Transactional
    public void sendEmailChangeOtp(String newEmail) {
        Optional<EmailOtp> existing = emailOtpRepository.findByEmail(newEmail);

        if (existing.isPresent()) {
            LocalDateTime lastSent = existing.get().getLastSentAt();
            boolean tooSoon = lastSent != null
                    && lastSent.plusSeconds(OTP_RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now());

            if (tooSoon) {
                throw new RuntimeException("Please wait a bit before requesting another code");
            }
        }

        String otpCode = generateSecureOtp();

        emailOtpRepository.deleteByEmail(newEmail);

        EmailOtp emailOtp = EmailOtp.builder()
                .email(newEmail)
                .otpCode(otpCode)
                .expiryTime(LocalDateTime.now().plusMinutes(5))
                .lastSentAt(LocalDateTime.now())
                .build();

        emailOtpRepository.save(emailOtp);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("DasKitta Support <daskitta.support@gmail.com>");
        message.setTo(newEmail);
        message.setSubject("DasKitta: Confirm Your New Email");
        message.setText("From DasKitta:\n\n" +
                "Your 6 digit code to confirm this new email is: " + otpCode + "\n\n" +
                "This code is valid for 5 minutes. Do not share this code with anyone.\n" +
                "If you didn't request this, please ignore this message.");

        mailSender.send(message);
    }

    // Confirms the email change once the correct otp is given
    @Transactional
    public void confirmEmailChange(String currentUsername, String newEmail, String code) {
        AppUser user = appUserRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        EmailOtp emailOtp = emailOtpRepository.findByEmail(newEmail)
                .orElseThrow(() -> new RuntimeException("Invalid or expired verification code"));

        if (emailOtp.isExpired()) {
            emailOtpRepository.deleteByEmail(newEmail);
            throw new RuntimeException("Verification code has expired. Please request a new one.");
        }

        if (!emailOtp.getOtpCode().equals(code)) {
            throw new RuntimeException("Incorrect verification code");
        }

        user.setEmail(newEmail);
        appUserRepository.save(user);

        emailOtpRepository.deleteByEmail(newEmail);
    }

    // Returns saved details for a logged in user
    public UserDetailsResponse getUserDetails(String username) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new UserDetailsResponse(user.getUsername(), user.getEmail(), user.isEnabled());
    }
}