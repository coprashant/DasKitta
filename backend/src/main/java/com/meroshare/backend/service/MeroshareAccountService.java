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

    public MeroshareAccountResponse addAccount(MeroshareAccountRequest request, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String token = meroshareApiService.login(request.getDpId(), request.getUsername(), request.getPassword());
        MeroshareApiService.AccountDetails details = meroshareApiService.fetchAccountDetails(token);

        String demat = details.getDemat() != null
                ? details.getDemat()
                : "130" + request.getDpId() + request.getUsername();

        MeroshareAccount account = MeroshareAccount.builder()
                .appUser(appUser)
                .dpId(request.getDpId())
                .username(request.getUsername())
                .password(encryptionUtil.encrypt(request.getPassword()))
                .fullName(details.getFullName())
                .boid(details.getBoid() != null ? details.getBoid() : request.getUsername())
                .demat(demat)
                .bankId(details.getBankId())
                .accountNumber(details.getAccountNumber())
                .accountBranchId(details.getAccountBranchId())
                .accountTypeId(details.getAccountTypeId())
                .customerId(details.getCustomerId())
                .crn(request.getCrn())
                .pin(request.getPin() != null && !request.getPin().isBlank()
                        ? encryptionUtil.encrypt(request.getPin()) : null)
                .build();

        accountRepository.save(account);
        return toResponse(account);
    }

    public List<MeroshareAccountResponse> getAccounts(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return accountRepository.findByAppUserId(appUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public void deleteAccount(Long accountId, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        MeroshareAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!account.getAppUser().getId().equals(appUser.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        accountRepository.delete(account);
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