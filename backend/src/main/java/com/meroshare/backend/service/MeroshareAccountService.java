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
import java.util.Map;
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
    public MeroshareAccountResponse addAccount(MeroshareAccountRequest request, String appUsername) {
        AppUser appUser = appUserRepository.findByUsername(appUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + appUsername));

        if (accountRepository.existsByUsernameAndAppUserId(request.getUsername(), appUser.getId())) {
            throw new RuntimeException("Account '" + request.getUsername() + "' already exists");
        }

        String dpId = String.valueOf(request.getDpId());
        String plainPassword = request.getPassword();

        String token = meroshareApiService.login(dpId, request.getUsername(), plainPassword);

        MeroshareApiService.AccountDetails ownDetail = meroshareApiService.fetchAccountDetails(token);

        List<Map> banks = meroshareApiService.getUserBanks(token);
        MeroshareApiService.BankDetails bankDetails = null;

        if (!banks.isEmpty()) {
            String firstBankId = String.valueOf(banks.get(0).get("id"));
            bankDetails = meroshareApiService.fetchBankDetails(token, firstBankId);
        }

        MeroshareAccount account = MeroshareAccount.builder()
                .dpId(dpId)
                .dpCode(request.getDpCode())
                .username(request.getUsername())
                .password(encryptionUtil.encrypt(plainPassword))
                .fullName(ownDetail.getFullName())
                .boid(ownDetail.getBoid())
                .demat(ownDetail.getDemat())
                .crn(request.getCrn())
                .pin(request.getPin() != null && !request.getPin().isBlank()
                        ? encryptionUtil.encrypt(request.getPin()) : null)
                .appUser(appUser)
                .build();

        if (bankDetails != null) {
            account.setBankId(bankDetails.getBankId());
            account.setAccountNumber(bankDetails.getAccountNumber());
            account.setAccountBranchId(bankDetails.getAccountBranchId());
            account.setCustomerId(bankDetails.getCustomerId());
        } else if (request.getBankId() != null) {
            account.setBankId(String.valueOf(request.getBankId()));
        }

        accountRepository.save(account);
        log.info("[ADD_ACCOUNT] Saved account for user={} boid={}", request.getUsername(), ownDetail.getBoid());

        return toResponse(account);
    }

    @Transactional(readOnly = true)
    public List<MeroshareAccountResponse> getAccounts(String appUsername) {
        AppUser appUser = appUserRepository.findByUsername(appUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + appUsername));
        return accountRepository.findByAppUserId(appUser.getId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public void deleteAccount(Long accountId, String appUsername) {
        AppUser appUser = appUserRepository.findByUsername(appUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + appUsername));
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
                .dpCode(account.getDpCode())
                .username(account.getUsername())
                .fullName(account.getFullName())
                .boid(account.getBoid())
                .bankId(account.getBankId())
                .createdAt(account.getCreatedAt())
                .build();
    }
}