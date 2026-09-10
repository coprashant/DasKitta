package com.meroshare.backend.service;

import com.meroshare.backend.dto.NotificationResponse;
import com.meroshare.backend.dto.PushSubscriptionRequest;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.Notification;
import com.meroshare.backend.entity.PushSubscription;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.NotificationRepository;
import com.meroshare.backend.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_NOTIFICATION_FEED_SIZE = 50;

    private final AppUserRepository appUserRepository;
    private final NotificationRepository notificationRepository;
    private final PushSubscriptionRepository pushSubscriptionRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(String username) {
        AppUser user = resolveUser(username);
        return notificationRepository.findByAppUserAndIsDeletedFalseOrderByCreatedAtDesc(
                        user,
                        PageRequest.of(0, MAX_NOTIFICATION_FEED_SIZE)
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void markAsRead(String username, Long notificationId) {
        AppUser user = resolveUser(username);
        int updated = notificationRepository.markAsRead(notificationId, user);
        if (updated == 0) {
            throw new RuntimeException("Notification not found");
        }
    }

    @Transactional
    public void markAllAsRead(String username) {
        AppUser user = resolveUser(username);
        notificationRepository.markAllAsRead(user);
    }

    @Transactional
    public void softDelete(String username, Long notificationId) {
        AppUser user = resolveUser(username);
        int updated = notificationRepository.softDelete(notificationId, user);
        if (updated == 0) {
            throw new RuntimeException("Notification not found");
        }
    }

    @Transactional
    public void softDeleteAll(String username) {
        AppUser user = resolveUser(username);
        notificationRepository.softDeleteAll(user);
    }

    @Transactional
    public void registerSubscription(String username, PushSubscriptionRequest request) {
        if (request == null || request.endpoint() == null || request.keys() == null) {
            throw new RuntimeException("Invalid push subscription");
        }

        AppUser user = resolveUser(username);
        PushSubscription subscription = pushSubscriptionRepository
                .findByAppUserAndEndpoint(user, request.endpoint())
                .orElseGet(PushSubscription::new);

        subscription.setAppUser(user);
        subscription.setEndpoint(request.endpoint());
        subscription.setP256dh(request.keys().p256dh());
        subscription.setAuth(request.keys().auth());
        pushSubscriptionRepository.save(subscription);
    }

    private AppUser resolveUser(String username) {
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getDetail(),
                notification.getTargetUrl(),
                notification.isRead(),
                notification.getCreatedAt()
        );
    }
}