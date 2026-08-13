package com.meroshare.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Stores one time verification codes in Redis instead of Postgres.
 * The redis key ttl acts as the expiry, so no manual expiry checks
 * or cleanup jobs are needed. A short lived cooldown key blocks
 * repeated resend requests for the same email.
 */
@Service
public class OtpService {

    private final StringRedisTemplate redisTemplate;
    private final Duration otpTtl;
    private final Duration resendCooldown;

    private static final String OTP_KEY_PREFIX      = "otp:code:";
    private static final String COOLDOWN_KEY_PREFIX  = "otp:cooldown:";

    public OtpService(StringRedisTemplate redisTemplate,
                      @Value("${otp.ttl-seconds:300}") long otpTtlSeconds,
                      @Value("${otp.resend-cooldown-seconds:60}") long resendCooldownSeconds) {
        this.redisTemplate  = redisTemplate;
        this.otpTtl         = Duration.ofSeconds(otpTtlSeconds);
        this.resendCooldown = Duration.ofSeconds(resendCooldownSeconds);
    }

    private String otpKey(String email) {
        return OTP_KEY_PREFIX + email;
    }

    private String cooldownKey(String email) {
        return COOLDOWN_KEY_PREFIX + email;
    }

    // Stores a new otp code for the email. Throws if a resend was just sent
    public void storeOtp(String email, String otpCode) {
        Boolean coolingDown = redisTemplate.hasKey(cooldownKey(email));
        if (Boolean.TRUE.equals(coolingDown)) {
            throw new RuntimeException("Please wait a bit before requesting another code");
        }
        redisTemplate.opsForValue().set(otpKey(email), otpCode, otpTtl);
        redisTemplate.opsForValue().set(cooldownKey(email), "1", resendCooldown);
    }

    // Verifies the code. Deletes the stored code only on a successful match,
    // so the caller can retry a wrong code until it expires
    public void verifyOtp(String email, String code) {
        String stored = redisTemplate.opsForValue().get(otpKey(email));
        if (stored == null) {
            throw new RuntimeException("Invalid or expired verification code");
        }
        if (!stored.equals(code)) {
            throw new RuntimeException("Incorrect verification code");
        }
        redisTemplate.delete(otpKey(email));
    }

    // Clears any pending otp and cooldown state for the email
    public void clearOtp(String email) {
        redisTemplate.delete(otpKey(email));
        redisTemplate.delete(cooldownKey(email));
    }
}