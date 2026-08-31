package com.meroshare.backend.service;

import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountCleanupService {

    private final AppUserRepository appUserRepository;
    private final OtpService otpService;

    @Value("${account.unverified-expiry-hours:24}")
    private long unverifiedExpiryHours;

    // runs every hour on the hour, removes accounts that never got verified
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void removeStaleUnverifiedAccounts() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(unverifiedExpiryHours);
        List<AppUser> staleUsers = appUserRepository.findByEnabledFalseAndCreatedAtBefore(cutoff);

        if (staleUsers.isEmpty()) {
            return;
        }

        for (AppUser user : staleUsers) {
            otpService.clearOtp(user.getEmail());
        }
        appUserRepository.deleteAll(staleUsers);

        log.info("removed stale unverified accounts count {}", staleUsers.size());
    }
}