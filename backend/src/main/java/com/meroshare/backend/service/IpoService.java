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

    private MeroshareAccount getFirstAccount(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }
        return accounts.get(0);
    }

    private String loginAccount(MeroshareAccount account) {
        String decryptedPassword = encryptionUtil.decrypt(account.getPassword());
        return meroshareApiService.login(account.getDpId(), account.getUsername(), decryptedPassword);
    }

    public List<Map> getPublicShareList() {
        return meroshareApiService.getPublicShareList();
    }

    public Map<String, List> getIpoLists(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        List open = meroshareApiService.getOpenIpos(token);
        List closed = meroshareApiService.getClosedIpos(token);
        return Map.of("open", open, "closed", closed);
    }

    public List getOpenIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getOpenIpos(token);
    }

    public List getClosedIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getClosedIpos(token);
    }

    public List<IpoApplyResult> applyForAll(IpoApplyRequest request, String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<IpoApplyResult> results = new ArrayList<>();

        for (Long accountId : request.getAccountIds()) {
            MeroshareAccount account = accountRepository.findById(accountId).orElse(null);

            if (account == null) {
                results.add(buildResult(accountId, null, null, "FAILED", "Account not found"));
                continue;
            }

            if (!account.getAppUser().getId().equals(appUser.getId())) {
                results.add(buildResult(accountId, account.getUsername(),
                        account.getFullName(), "FAILED", "Unauthorized"));
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
            String token = loginAccount(account);
            String decryptedPin = account.getPin() != null
                    ? encryptionUtil.decrypt(account.getPin()) : "";

            String message = meroshareApiService.applyIpo(
                    token,
                    request.getShareId(),
                    account.getDemat(),
                    account.getBoid(),
                    account.getAccountNumber(),
                    account.getCustomerId(),
                    account.getAccountBranchId(),
                    account.getAccountTypeId(),
                    account.getBankId(),
                    request.getKitta(),
                    account.getCrn(),
                    decryptedPin
            );

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
                String token = loginAccount(account);

                List<Map> report = meroshareApiService.getApplicationReport(token);
                Map matchingApp = report.stream()
                        .filter(item -> shareId.equals(String.valueOf(item.get("companyShareId"))))
                        .findFirst()
                        .orElse(null);

                IpoApplication.ResultStatus mappedStatus;
                int allottedKitta = 0;

                if (matchingApp != null) {
                    String statusName = (String) matchingApp.get("statusName");
                    if ("TRANSACTION_SUCCESS".equals(statusName) || "APPROVED".equals(statusName)) {
                        String applicationFormId = String.valueOf(matchingApp.get("applicantFormId"));
                        MeroshareApiService.ResultInfo result =
                                meroshareApiService.checkResult(token, applicationFormId);
                        mappedStatus = mapResultStatus(result.getStatus());
                        allottedKitta = result.getAllottedKitta();
                    } else {
                        mappedStatus = mapResultStatus(statusName);
                    }
                } else {
                    // No application found in report — check via public CDSC endpoint
                    String boid = account.getBoid();
                    if (boid != null && !boid.isBlank()) {
                        MeroshareApiService.ResultInfo result =
                                meroshareApiService.checkResultPublic(boid, shareId);
                        mappedStatus = mapResultStatus(result.getStatus());
                        allottedKitta = result.getAllottedKitta();
                    } else {
                        mappedStatus = IpoApplication.ResultStatus.UNKNOWN;
                    }
                }

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
                application.setAllottedKitta(allottedKitta);
                application.setResultCheckedAt(LocalDateTime.now());
                ipoApplicationRepository.save(application);

                responses.add(IpoApplicationResponse.builder()
                        .shareId(shareId)
                        .companyName(application.getCompanyName())
                        .resultStatus(mappedStatus.name())
                        .allottedKitta(allottedKitta)
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

    /**
     * Guest result check — uses public CDSC API via backend proxy.
     * Returns a single result for the given BOID.
     */
    public List<IpoApplicationResponse> checkResultByBoid(String shareId, String boid) {
        try {
            MeroshareApiService.ResultInfo result =
                    meroshareApiService.checkResultPublic(boid, shareId);

            IpoApplication.ResultStatus status = mapResultStatus(result.getStatus());

            return List.of(IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .companyName("")
                    .resultStatus(status.name())
                    .allottedKitta(result.getAllottedKitta())
                    .accountUsername(boid)
                    .accountFullName("Guest")
                    .build());
        } catch (Exception e) {
            log.error("[GUEST_RESULT] Failed for boid={}: {}", boid, e.getMessage());
            return List.of(IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .companyName("")
                    .resultStatus(IpoApplication.ResultStatus.UNKNOWN.name())
                    .allottedKitta(0)
                    .accountUsername(boid)
                    .accountFullName("Guest")
                    .build());
        }
    }

    public List<IpoApplicationResponse> getHistory(String username) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ipoApplicationRepository.findAllByAppUserId(appUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private IpoApplication.ResultStatus mapResultStatus(String status) {
        if (status == null) return IpoApplication.ResultStatus.NOT_PUBLISHED;
        return switch (status.toUpperCase().trim()) {
            case "ALLOTED", "ALLOCATE", "SHARE_ALLOTED", "ALLOTTED" ->
                    IpoApplication.ResultStatus.ALLOTTED;
            case "NOT ALLOTED", "NOT_ALLOTED", "SHARE_NOT_ALLOTED", "NOT ALLOTTED" ->
                    IpoApplication.ResultStatus.NOT_ALLOTTED;
            case "NOT_PUBLISHED" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;
            case "UNKNOWN" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;
            default ->
                    IpoApplication.ResultStatus.UNKNOWN;
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