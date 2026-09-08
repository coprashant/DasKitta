package com.meroshare.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class OtpService {

    private final StringRedisTemplate redisTemplate;
    private final Duration otpTtl;
    private final Duration resendCooldown;
    private final int maxAttempts;

    private static final String OTP_KEY_PREFIX      = "otp:code:";
    private static final String COOLDOWN_KEY_PREFIX = "otp:cooldown:";
    private static final String ATTEMPT_KEY_PREFIX  = "otp:attempts:";

    public OtpService(RedisConnectionFactory connectionFactory,
                      @Value("${otp.ttl-seconds:300}") long otpTtlSeconds,
                      @Value("${otp.resend-cooldown-seconds:60}") long resendCooldownSeconds,
                      @Value("${otp.max-attempts:5}") int maxAttempts) {

        StringRedisTemplate template = new StringRedisTemplate(connectionFactory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setValueSerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setHashValueSerializer(stringSerializer);
        template.afterPropertiesSet();

        this.redisTemplate = template;
        this.otpTtl         = Duration.ofSeconds(otpTtlSeconds);
        this.resendCooldown = Duration.ofSeconds(resendCooldownSeconds);
        this.maxAttempts    = maxAttempts;
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new IllegalArgumentException("Email cannot be null");
        }
        return email.trim().toLowerCase();
    }

    private String otpKey(String email) {
        return OTP_KEY_PREFIX + normalizeEmail(email);
    }

    private String cooldownKey(String email) {
        return COOLDOWN_KEY_PREFIX + normalizeEmail(email);
    }

    private String attemptKey(String email) {
        return ATTEMPT_KEY_PREFIX + normalizeEmail(email);
    }

    public void storeOtp(String email, String otpCode) {
        Boolean coolingDown = redisTemplate.hasKey(cooldownKey(email));
        if (Boolean.TRUE.equals(coolingDown)) {
            throw new RuntimeException("Please wait a bit before requesting another code");
        }

        String key = otpKey(email);
        String sanitizedCode = otpCode != null ? otpCode.trim() : "";

        redisTemplate.opsForValue().set(key, sanitizedCode, otpTtl);
        redisTemplate.opsForValue().set(cooldownKey(email), "1", resendCooldown);
        redisTemplate.delete(attemptKey(email));
    }

    /*
     Counts failed tries per email on top of the per IP rate limit.
     Too many wrong codes burns the code so a new one must be requested,
     this keeps a brute force run from ever finishing inside the OTP TTL.
    */
    public void verifyOtp(String email, String code) {
        String key = otpKey(email);
        String stored = redisTemplate.opsForValue().get(key);
        String sanitizedCode = code != null ? code.trim() : "";

        if (stored == null) {
            throw new RuntimeException("Invalid or expired verification code");
        }

        if (!stored.equals(sanitizedCode)) {
            long attempts = registerFailedAttempt(email);
            if (attempts >= maxAttempts) {
                redisTemplate.delete(key);
                redisTemplate.delete(attemptKey(email));
                throw new RuntimeException("Too many incorrect attempts, please request a new code");
            }
            throw new RuntimeException("Incorrect verification code");
        }

        redisTemplate.delete(key);
        redisTemplate.delete(attemptKey(email));
    }

    private long registerFailedAttempt(String email) {
        String key = attemptKey(email);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, otpTtl);
        }
        return count != null ? count : 1L;
    }

    public void clearOtp(String email) {
        redisTemplate.delete(otpKey(email));
        redisTemplate.delete(cooldownKey(email));
        redisTemplate.delete(attemptKey(email));
    }
}
