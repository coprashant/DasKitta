package com.meroshare.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/*
 Lets the server revoke tokens that were already issued.

 When a user logs out or changes their password we store the current
 time as their valid after point in Redis. Any token issued before
 that point is rejected in JwtAuthFilter even if it has not expired
 yet. This gives real logout and stolen token mitigation without
 needing a session store for every request.
*/
@Service
public class TokenValidityService {

    private static final String KEY_PREFIX = "token:valid-after:";

    private final StringRedisTemplate redisTemplate;
    private final Duration maxTokenLifetime;

    public TokenValidityService(StringRedisTemplate redisTemplate,
                                 @Value("${app.jwt.expiration-ms}") long jwtExpirationMs) {
        this.redisTemplate = redisTemplate;
        this.maxTokenLifetime = Duration.ofMillis(jwtExpirationMs);
    }

    private String key(String username) {
        return KEY_PREFIX + username;
    }

    /*
     Marks all tokens issued before now as no longer valid for this user.
     The key expires on its own after the longest a token can live for.
    */
    public void invalidateTokensBefore(String username) {
        String value = String.valueOf(Instant.now().toEpochMilli());
        redisTemplate.opsForValue().set(key(username), value, maxTokenLifetime);
    }

    /*
     True unless the token was issued before the last invalidation point.
    */
    public boolean isIssuedAtValid(String username, long issuedAtMillis) {
        String stored = redisTemplate.opsForValue().get(key(username));
        if (stored == null) {
            return true;
        }
        try {
            long validAfter = Long.parseLong(stored);
            return issuedAtMillis >= validAfter;
        } catch (NumberFormatException e) {
            return true;
        }
    }
}
