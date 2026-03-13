package com.meroshare.backend.service;

import com.meroshare.backend.dto.MeroshareAccountRequest;
import com.meroshare.backend.dto.MeroshareAccountResponse;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.MeroshareAccount;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.MeroshareAccountRepository;
import com.meroshare.backend.security.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeroshareAccountService {

    private final MeroshareAccountRepository accountRepository;
    private final AppUserRepository appUserRepository;
    private final EncryptionUtil encryptionUtil;
    private final MeroshareApiService meroshareApiService;

    public MeroshareAccountResponse addAccount(MeroshareAccountRequest request, String username) {
        AppUser appUser = getAppUser(username);

        if (accountRepository.existsByUsernameAndAppUserId(request.getUsername(), appUser.getId())) {
            throw new RuntimeException("This Meroshare account is already added");
        }

        // Verify credentials are valid by attempting login with CDSC
        String meroshareToken = meroshareApiService.login(
                request.getDpId(),
                request.getUsername(),
                request.getPassword()
        );

        // Fetch BOID and bank details using the token
        MeroshareApiService.AccountDetails details =
                meroshareApiService.fetchAccountDetails(meroshareToken);

        MeroshareAccount account = MeroshareAccount.builder()
                .dpId(request.getDpId())
                .username(request.getUsername())
                .password(encryptionUtil.encrypt(request.getPassword()))
                .fullName(details.getFullName())
                .boid(details.getBoid())
                .bankId(details.getBankId())
                .appUser(appUser)
                .build();

        accountRepository.save(account);
        return toResponse(account);
    }

    public List<MeroshareAccountResponse> getAccounts(String username) {
        AppUser appUser = getAppUser(username);
        return accountRepository.findByAppUserId(appUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public void deleteAccount(Long accountId, String username) {
        AppUser appUser = getAppUser(username);
        MeroshareAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!account.getAppUser().getId().equals(appUser.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        accountRepository.delete(account);
    }

    private AppUser getAppUser(String username) {
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("App user not found"));
    }

    private MeroshareAccountResponse toResponse(MeroshareAccount account) {
        return MeroshareAccountResponse.builder()
                .id(account.getId())
                .dpId(account.getDpId())
                .username(account.getUsername())
                .fullName(account.getFullName())
                .boid(account.getBoid())
                .createdAt(account.getCreatedAt())
                .build();
    }
}