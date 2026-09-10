package com.meroshare.backend.dto;

public record PushSubscriptionRequest(
        String endpoint,
        Keys keys
) {
    public record Keys(String p256dh, String auth) {}
}