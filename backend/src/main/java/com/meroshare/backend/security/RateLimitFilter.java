package com.meroshare.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;
    private final Map<String, LimitRule> rules;

    private static final String KEY_PREFIX = "ratelimit:";

    public RateLimitFilter(StringRedisTemplate redisTemplate,
                           @Value("${ratelimit.login.max-requests:5}") int loginMax,
                           @Value("${ratelimit.login.window-seconds:60}") long loginWindowSeconds,
                           @Value("${ratelimit.resend-otp.max-requests:3}") int resendOtpMax,
                           @Value("${ratelimit.resend-otp.window-seconds:60}") long resendOtpWindowSeconds,
                           @Value("${ratelimit.ipo-apply.max-requests:10}") int ipoApplyMax,
                           @Value("${ratelimit.ipo-apply.window-seconds:60}") long ipoApplyWindowSeconds,
                           @Value("${ratelimit.otp-verify.max-requests:8}") int otpVerifyMax,
                           @Value("${ratelimit.otp-verify.window-seconds:300}") long otpVerifyWindowSeconds,
                           @Value("${ratelimit.refresh.max-requests:20}") int refreshMax,
                           @Value("${ratelimit.refresh.window-seconds:300}") long refreshWindowSeconds) {
        this.redisTemplate = redisTemplate;
        this.rules = Map.of(
                "/api/auth/login", new LimitRule(loginMax, Duration.ofSeconds(loginWindowSeconds)),
                "/api/auth/resend-otp", new LimitRule(resendOtpMax, Duration.ofSeconds(resendOtpWindowSeconds)),
                "/api/ipo/apply", new LimitRule(ipoApplyMax, Duration.ofSeconds(ipoApplyWindowSeconds)),
                "/api/auth/verify-otp", new LimitRule(otpVerifyMax, Duration.ofSeconds(otpVerifyWindowSeconds)),
                "/api/auth/email/confirm-change", new LimitRule(otpVerifyMax, Duration.ofSeconds(otpVerifyWindowSeconds)),
                "/api/auth/refresh", new LimitRule(refreshMax, Duration.ofSeconds(refreshWindowSeconds))
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Skip CORS preflight OPTIONS requests from consuming rate limits
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String requestPath = request.getRequestURI();

        // rule paths are plain literal paths, a direct lookup is enough
        // strip one trailing slash so path and path/ both match the same rule
        String lookupPath = (requestPath.length() > 1 && requestPath.endsWith("/"))
                ? requestPath.substring(0, requestPath.length() - 1)
                : requestPath;

        LimitRule rule = rules.get(lookupPath);

        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        String key = KEY_PREFIX + lookupPath + ":" + clientIp;

        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, rule.window());
            }

            if (count != null && count > rule.maxRequests()) {
                log.warn("[RATE_LIMIT] Blocked request to {} from IP: {}", requestPath, clientIp);
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
                return;
            }
        } catch (Exception e) {
            log.error("[RATE_LIMIT] Redis connection failed during rate limiting check: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    // behind a proxy remoteAddr is the proxy ip for every request
    // use the first hop in x forwarded for so limits apply per real client
    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String firstIp = forwardedFor.split(",")[0].trim();
            if (!firstIp.isEmpty()) {
                return firstIp;
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private record LimitRule(int maxRequests, Duration window) {}
}