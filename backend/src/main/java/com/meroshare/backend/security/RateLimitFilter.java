package com.meroshare.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;
    private final Map<String, LimitRule> rules;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    private static final String KEY_PREFIX = "ratelimit:";

    public RateLimitFilter(StringRedisTemplate redisTemplate,
                           @Value("${ratelimit.login.max-requests:5}") int loginMax,
                           @Value("${ratelimit.login.window-seconds:60}") long loginWindowSeconds,
                           @Value("${ratelimit.resend-otp.max-requests:3}") int resendOtpMax,
                           @Value("${ratelimit.resend-otp.window-seconds:60}") long resendOtpWindowSeconds,
                           @Value("${ratelimit.ipo-apply.max-requests:10}") int ipoApplyMax,
                           @Value("${ratelimit.ipo-apply.window-seconds:60}") long ipoApplyWindowSeconds) {
        this.redisTemplate = redisTemplate;
        this.rules = Map.of(
                "/api/auth/login", new LimitRule(loginMax, Duration.ofSeconds(loginWindowSeconds)),
                "/api/auth/resend-otp", new LimitRule(resendOtpMax, Duration.ofSeconds(resendOtpWindowSeconds)),
                "/api/ipo/apply", new LimitRule(ipoApplyMax, Duration.ofSeconds(ipoApplyWindowSeconds))
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

        Map.Entry<String, LimitRule> matchedRule = rules.entrySet().stream()
                .filter(entry -> pathMatcher.match(entry.getKey(), requestPath) || 
                                 pathMatcher.match(entry.getKey() + "/", requestPath))
                .findFirst()
                .orElse(null);

        if (matchedRule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        LimitRule rule = matchedRule.getValue();
        String clientIp = resolveClientIp(request);
        String key = KEY_PREFIX + matchedRule.getKey() + ":" + clientIp;

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

    private String resolveClientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private record LimitRule(int maxRequests, Duration window) {}
}