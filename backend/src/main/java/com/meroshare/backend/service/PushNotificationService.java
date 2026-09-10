package com.meroshare.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.meroshare.backend.config.VapidConfig;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.PushSubscription;
import com.meroshare.backend.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final VapidConfig vapidConfig;
    private final ObjectMapper objectMapper;

    private PushService pushService;

    @PostConstruct
    public void init() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        if (hasText(vapidConfig.getPublicKey()) && hasText(vapidConfig.getPrivateKey())) {
            try {
                this.pushService = new PushService(
                        vapidConfig.getPublicKey(),
                        vapidConfig.getPrivateKey(),
                        hasText(vapidConfig.getSubject()) ? vapidConfig.getSubject() : null
                );
            } catch (Exception e) {
                throw new IllegalStateException("Unable to initialize web push service", e);
            }
        }
    }

    public void sendPushToUser(AppUser user, String title, String body, String targetUrl) {
        if (pushService == null || user == null) {
            return;
        }

        List<PushSubscription> subscriptions = pushSubscriptionRepository.findAllByAppUser(user);
        if (subscriptions.isEmpty()) {
            return;
        }

        String payload = buildPayload(title, body, targetUrl);
        for (PushSubscription subscription : subscriptions) {
            try {
                Notification notification = Notification.builder()
                        .endpoint(subscription.getEndpoint())
                        .userPublicKey(subscription.getP256dh())
                        .userAuth(subscription.getAuth())
                        .payload(payload.getBytes(StandardCharsets.UTF_8))
                        .ttl((int) java.time.Duration.ofDays(7).getSeconds())
                        .build();

                HttpResponse response = pushService.send(notification, Encoding.AES128GCM);
                int status = response.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    pushSubscriptionRepository.delete(subscription);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private String buildPayload(String title, String body, String targetUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        payload.put("targetUrl", targetUrl);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return "{}";
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}