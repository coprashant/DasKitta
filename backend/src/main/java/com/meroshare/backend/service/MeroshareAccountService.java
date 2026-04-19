package com.meroshare.backend.service;

import com.meroshare.backend.dto.MeroshareAccountRequest;
import com.meroshare.backend.dto.MeroshareAccountResponse;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.MeroshareAccount;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.MeroshareAccountRepository;
import com.meroshare.backend.security.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeroshareAccountService {

    private final MeroshareAccountRepository accountRepository;
    private final AppUserRepository appUserRepository;
    private final MeroshareApiService meroshareApiService;
    private final EncryptionUtil encryptionUtil;

    @Transactional
    public MeroshareAccountResponse addAccount(MeroshareAccountRequest request, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        // Prevent duplicate accounts for the same Meroshare username under one app user
        if (accountRepository.existsByUsernameAndAppUserId(request.getUsername(), appUser.getId())) {
            throw new RuntimeException(
                    "A Meroshare account with username '" + request.getUsername() +
                    "' is already linked to your account.");
        }

        // Validate credentials by actually logging in — this also gives us the token
        // for fetching account details in the same session.
        String token = meroshareApiService.login(
                request.getDpId(), request.getUsername(), request.getPassword());

        MeroshareApiService.AccountDetails details =
                meroshareApiService.fetchAccountDetails(token);

        // Build DEMAT from DP ID + username if not returned by API
        String demat = (details.getDemat() != null && !details.getDemat().isBlank())
                ? details.getDemat()
                : "130" + request.getDpId() + request.getUsername();

        // Use BOID from API if available, otherwise fall back to username
        // (Meroshare uses username == BOID for most DPs)
        String boid = (details.getBoid() != null && !details.getBoid().isBlank())
                ? details.getBoid()
                : request.getUsername();

        MeroshareAccount account = MeroshareAccount.builder()
                .appUser(appUser)
                .dpId(request.getDpId())
                .username(request.getUsername())
                .password(encryptionUtil.encrypt(request.getPassword()))
                .fullName(details.getFullName())
                .boid(boid)
                .demat(demat)
                .bankId(details.getBankId())
                .accountNumber(details.getAccountNumber())
                .accountBranchId(details.getAccountBranchId())
                .accountTypeId(details.getAccountTypeId())
                .customerId(details.getCustomerId())
                .crn(request.getCrn())
                .pin(isPresent(request.getPin())
                        ? encryptionUtil.encrypt(request.getPin()) : null)
                .build();

        accountRepository.save(account);
        log.info("[ADD_ACCOUNT] Saved account for user={} meroshareUser={}",
                username, request.getUsername());

        return toResponse(account);
    }

    @Transactional(readOnly = true)
    public List<MeroshareAccountResponse> getAccounts(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        return accountRepository.findByAppUserId(appUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteAccount(Long accountId, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        MeroshareAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!account.getAppUser().getId().equals(appUser.getId())) {
            throw new RuntimeException("Unauthorized — this account does not belong to you");
        }

        accountRepository.delete(account);
        log.info("[DELETE_ACCOUNT] Deleted accountId={} for user={}", accountId, username);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    private MeroshareAccountResponse toResponse(MeroshareAccount account) {
        return MeroshareAccountResponse.builder()
                .id(account.getId())
                .dpId(account.getDpId())
                .username(account.getUsername())
                .fullName(account.getFullName())
                .boid(account.getBoid())
                .bankId(account.getBankId())
                .createdAt(account.getCreatedAt())
                .build();
    }
}