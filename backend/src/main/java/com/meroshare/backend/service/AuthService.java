package com.meroshare.backend.service;

import com.meroshare.backend.dto.AuthResponse;
import com.meroshare.backend.dto.LoginRequest;
import com.meroshare.backend.dto.RegisterRequest;
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
}