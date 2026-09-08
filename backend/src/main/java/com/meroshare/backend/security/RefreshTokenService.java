package com.meroshare.backend.security;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;

/*
 Refresh tokens let a user stay signed in without reentering a
 password, similar to how most large apps keep you signed in on a
 device until you sign out. The access token issued at login stays
 short lived, the refresh token lives in an httpOnly cookie the page
 script can never read, so a stolen access token expires quickly even
 if a refresh token cookie also exists.

 If rememberMe was true at login the refresh token lasts PERSIST_TTL
 and keeps renewing itself on each use, this choice is remembered
 alongside the token so every rotation keeps the same behaviour
 without the caller repeating it. If not it lasts only SESSION_TTL as
 a backstop, the cookie itself is also set with no max age so most
 browsers drop it when the browser closes.

 Only a hash of the raw token is stored, so reading Redis alone does
 not give a usable token. Each successful refresh rotates the token,
 a captured old token stops working once the real user refreshes.
*/
@Service
public class RefreshTokenService {

    private static final String TOKEN_PREFIX = "refresh:token:";
    private static final String REMEMBER_PREFIX = "refresh:remember:";
    private static final String USER_INDEX_PREFIX = "refresh:user:";

    private static final Duration PERSIST_TTL = Duration.ofDays(60);
    private static final Duration SESSION_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public record Issued(String rawToken, Duration ttl) {}
    public record Rotated(String username, Issued issued) {}

    public Issued issue(String username, boolean rememberMe) {
        Duration ttl = rememberMe ? PERSIST_TTL : SESSION_TTL;
        String rawToken = generateRawToken();
        String hash = hash(rawToken);

        redisTemplate.opsForValue().set(TOKEN_PREFIX + hash, username, ttl);
        if (rememberMe) {
            redisTemplate.opsForValue().set(REMEMBER_PREFIX + hash, "1", ttl);
        }
        redisTemplate.opsForSet().add(USER_INDEX_PREFIX + username, hash);
        redisTemplate.expire(USER_INDEX_PREFIX + username, PERSIST_TTL);

        return new Issued(rawToken, ttl);
    }

    /*
     Looks up the token, if it is still valid a new one is issued for
     the same user with the same remember choice and the old one is
     deleted. Returns null if the token is missing, expired, or
     already used once.
    */
    public Rotated validateAndRotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return null;
        }
        String hash = hash(rawToken);
        String username = redisTemplate.opsForValue().get(TOKEN_PREFIX + hash);
        if (username == null) {
            return null;
        }
        boolean wasRemembered = Boolean.TRUE.equals(redisTemplate.hasKey(REMEMBER_PREFIX + hash));

        redisTemplate.delete(TOKEN_PREFIX + hash);
        redisTemplate.delete(REMEMBER_PREFIX + hash);
        redisTemplate.opsForSet().remove(USER_INDEX_PREFIX + username, hash);

        Issued issued = issue(username, wasRemembered);
        return new Rotated(username, issued);
    }

    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        String hash = hash(rawToken);
        String username = redisTemplate.opsForValue().get(TOKEN_PREFIX + hash);
        redisTemplate.delete(TOKEN_PREFIX + hash);
        redisTemplate.delete(REMEMBER_PREFIX + hash);
        if (username != null) {
            redisTemplate.opsForSet().remove(USER_INDEX_PREFIX + username, hash);
        }
    }

    /*
     Revokes every refresh token issued to this user, used on password
     change so every signed in device needs a fresh login.
    */
    public void revokeAllForUser(String username) {
        String indexKey = USER_INDEX_PREFIX + username;
        Set<String> hashes = redisTemplate.opsForSet().members(indexKey);
        if (hashes != null) {
            for (String hash : hashes) {
                redisTemplate.delete(TOKEN_PREFIX + hash);
                redisTemplate.delete(REMEMBER_PREFIX + hash);
            }
        }
        redisTemplate.delete(indexKey);
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash refresh token " + e.getMessage(), e);
        }
    }
}
