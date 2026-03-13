package com.meroshare.backend.service;

import com.meroshare.backend.dto.IpoApplyRequest;
import com.meroshare.backend.dto.IpoApplyResult;
import com.meroshare.backend.dto.IpoApplicationResponse;
import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.IpoApplication;
import com.meroshare.backend.entity.MeroshareAccount;
import com.meroshare.backend.repository.AppUserRepository;
import com.meroshare.backend.repository.IpoApplicationRepository;
import com.meroshare.backend.repository.MeroshareAccountRepository;
import com.meroshare.backend.security.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpoService {

    private final IpoApplicationRepository ipoApplicationRepository;
    private final MeroshareAccountRepository accountRepository;
    private final AppUserRepository appUserRepository;
    private final MeroshareApiService meroshareApiService;
    private final EncryptionUtil encryptionUtil;

    public List<IpoApplyResult> applyForAll(IpoApplyRequest request, String username) {
        List<IpoApplyResult> results = new ArrayList<>();

        for (Long accountId : request.getAccountIds()) {
            MeroshareAccount account = accountRepository.findById(accountId).orElse(null);

            if (account == null) {
                results.add(buildResult(accountId, null, null, "FAILED", "Account not found"));
                continue;
            }

            if (ipoApplicationRepository.existsByMeroshareAccountIdAndShareId(
                    accountId, request.getShareId())) {
                results.add(buildResult(accountId, account.getUsername(),
                        account.getFullName(), "ALREADY_APPLIED", "Already applied for this IPO"));
                continue;
            }

            results.add(applySingleAccount(account, request));
        }

        return results;
    }

    private IpoApplyResult applySingleAccount(MeroshareAccount account, IpoApplyRequest request) {
        IpoApplication application = IpoApplication.builder()
                .companyName(request.getCompanyName())
                .shareId(request.getShareId())
                .appliedKitta(request.getKitta())
                .status(IpoApplication.ApplicationStatus.PENDING)
                .meroshareAccount(account)
                .build();

        try {
            String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
            String token = meroshareApiService.login(
                    account.getDpId(), account.getUsername(), decryptedPassword);

            String message = meroshareApiService.applyIpo(
                    token, request.getShareId(), account.getBoid(),
                    account.getBankId(), request.getKitta());

            application.setStatus(IpoApplication.ApplicationStatus.SUCCESS);
            application.setStatusMessage(message);
            ipoApplicationRepository.save(application);

            return buildResult(account.getId(), account.getUsername(),
                    account.getFullName(), "SUCCESS", message);

        } catch (Exception e) {
            log.error("IPO apply failed for {}: {}", account.getUsername(), e.getMessage());
            application.setStatus(IpoApplication.ApplicationStatus.FAILED);
            application.setStatusMessage(e.getMessage());
            ipoApplicationRepository.save(application);

            return buildResult(account.getId(), account.getUsername(),
                    account.getFullName(), "FAILED", e.getMessage());
        }
    }

    public List<IpoApplicationResponse> checkResults(String shareId, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }

        List<IpoApplicationResponse> responses = new ArrayList<>();

        for (MeroshareAccount account : accounts) {
            try {
                String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
                String token = meroshareApiService.login(
                        account.getDpId(), account.getUsername(), decryptedPassword);

                MeroshareApiService.ResultInfo result =
                        meroshareApiService.checkResult(token, account.getBoid(), shareId);

                IpoApplication.ResultStatus mappedStatus = mapResultStatus(result.getStatus());

                IpoApplication application = ipoApplicationRepository
                        .findByMeroshareAccountIdAndShareId(account.getId(), shareId)
                        .orElse(IpoApplication.builder()
                                .meroshareAccount(account)
                                .shareId(shareId)
                                .companyName("")
                                .appliedKitta(10)
                                .status(IpoApplication.ApplicationStatus.SUCCESS)
                                .build());

                application.setResultStatus(mappedStatus);
                application.setAllottedKitta(result.getAllottedKitta());
                application.setResultCheckedAt(LocalDateTime.now());
                ipoApplicationRepository.save(application);

                responses.add(IpoApplicationResponse.builder()
                        .shareId(shareId)
                        .companyName(application.getCompanyName())
                        .resultStatus(mappedStatus.name())
                        .allottedKitta(result.getAllottedKitta())
                        .resultCheckedAt(application.getResultCheckedAt())
                        .accountUsername(account.getUsername())
                        .accountFullName(account.getFullName())
                        .build());

            } catch (Exception e) {
                log.warn("Result check failed for {}: {}", account.getUsername(), e.getMessage());
                responses.add(IpoApplicationResponse.builder()
                        .shareId(shareId)
                        .resultStatus(IpoApplication.ResultStatus.UNKNOWN.name())
                        .accountUsername(account.getUsername())
                        .accountFullName(account.getFullName())
                        .build());
            }
        }

        return responses;
    }

    public List<IpoApplicationResponse> checkResultByBoid(String shareId, String boid) {
        List<MeroshareAccount> accounts = accountRepository.findAll();
        if (accounts.isEmpty()) {
            throw new RuntimeException("No accounts available to perform result check");
        }

        MeroshareAccount account = accounts.get(0);
        String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
        String token = meroshareApiService.login(
                account.getDpId(), account.getUsername(), decryptedPassword);

        MeroshareApiService.ResultInfo result =
                meroshareApiService.checkResult(token, boid, shareId);

        IpoApplicationResponse response = IpoApplicationResponse.builder()
                .shareId(shareId)
                .resultStatus(mapResultStatus(result.getStatus()).name())
                .allottedKitta(result.getAllottedKitta())
                .accountUsername(boid)
                .build();

        return List.of(response);
    }

    public List<IpoApplicationResponse> getHistory(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ipoApplicationRepository.findAllByAppUserId(appUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List getOpenIpos(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }

        MeroshareAccount account = accounts.get(0);
        String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
        String token = meroshareApiService.login(
                account.getDpId(), account.getUsername(), decryptedPassword);

        return meroshareApiService.getOpenIpos(token);
    }

    public List getClosedIpos(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }

        MeroshareAccount account = accounts.get(0);
        String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
        String token = meroshareApiService.login(
                account.getDpId(), account.getUsername(), decryptedPassword);

        return meroshareApiService.getClosedIpos(token);
    }

    private IpoApplication.ResultStatus mapResultStatus(String status) {
        if (status == null) return IpoApplication.ResultStatus.UNKNOWN;
        return switch (status.toUpperCase()) {
            case "ALLOTED" -> IpoApplication.ResultStatus.ALLOTTED;
            case "NOT ALLOTED" -> IpoApplication.ResultStatus.NOT_ALLOTTED;
            default -> IpoApplication.ResultStatus.UNKNOWN;
        };
    }

    private IpoApplyResult buildResult(Long accountId, String username,
                                        String fullName, String status, String message) {
        return IpoApplyResult.builder()
                .accountId(accountId)
                .username(username)
                .fullName(fullName)
                .status(status)
                .message(message)
                .build();
    }

    private IpoApplicationResponse toResponse(IpoApplication app) {
        return IpoApplicationResponse.builder()
                .id(app.getId())
                .companyName(app.getCompanyName())
                .shareId(app.getShareId())
                .appliedKitta(app.getAppliedKitta())
                .status(app.getStatus().name())
                .statusMessage(app.getStatusMessage())
                .resultStatus(app.getResultStatus() != null ? app.getResultStatus().name() : null)
                .allottedKitta(app.getAllottedKitta())
                .appliedAt(app.getAppliedAt())
                .resultCheckedAt(app.getResultCheckedAt())
                .accountUsername(app.getMeroshareAccount().getUsername())
                .accountFullName(app.getMeroshareAccount().getFullName())
                .build();
    }
}