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

    private static final String OTP_KEY_PREFIX      = "otp:code:";
    private static final String COOLDOWN_KEY_PREFIX = "otp:cooldown:";

    public OtpService(RedisConnectionFactory connectionFactory,
                      @Value("${otp.ttl-seconds:300}") long otpTtlSeconds,
                      @Value("${otp.resend-cooldown-seconds:60}") long resendCooldownSeconds) {

        // 1. Instantiate StringRedisTemplate directly
        StringRedisTemplate template = new StringRedisTemplate(connectionFactory);

        // 2. FORCE StringRedisSerializer on all operations to override Spring Cache/Context defaults
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setValueSerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setHashValueSerializer(stringSerializer);
        template.afterPropertiesSet();

        this.redisTemplate = template;
        this.otpTtl         = Duration.ofSeconds(otpTtlSeconds);
        this.resendCooldown = Duration.ofSeconds(resendCooldownSeconds);
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

    public void storeOtp(String email, String otpCode) {
        Boolean coolingDown = redisTemplate.hasKey(cooldownKey(email));
        if (Boolean.TRUE.equals(coolingDown)) {
            throw new RuntimeException("Please wait a bit before requesting another code");
        }

        String key = otpKey(email);
        String sanitizedCode = otpCode != null ? otpCode.trim() : "";

        redisTemplate.opsForValue().set(key, sanitizedCode, otpTtl);
        redisTemplate.opsForValue().set(cooldownKey(email), "1", resendCooldown);
    }

    public void verifyOtp(String email, String code) {
        String key = otpKey(email);
        String stored = redisTemplate.opsForValue().get(key);
        String sanitizedCode = code != null ? code.trim() : "";

        if (stored == null) {
            throw new RuntimeException("Invalid or expired verification code");
        }
        if (!stored.equals(sanitizedCode)) {
            throw new RuntimeException("Incorrect verification code");
        }
        redisTemplate.delete(key);
    }

    public void clearOtp(String email) {
        redisTemplate.delete(otpKey(email));
        redisTemplate.delete(cooldownKey(email));
    }
}