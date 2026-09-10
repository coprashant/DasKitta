package com.meroshare.backend.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        String type,
        String title,
        String body,
        String detail,
        String targetUrl,
        boolean isRead,
        LocalDateTime createdAt
) {}