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
import org.springframework.transaction.annotation.Transactional;

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

    private AppUser getAppUser(String username) {
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    private MeroshareAccount getFirstAccount(String username) {
        AppUser appUser = getAppUser(username);
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) throw new RuntimeException("Add at least one Meroshare account first");
        return accounts.get(0);
    }

    private String loginAccount(MeroshareAccount account) {
        String plainPassword = decryptField(account.getPassword(), "password", account.getUsername());
        return meroshareApiService.login(account.getDpId(), account.getUsername(), plainPassword);
    }

    private String loginAccountFresh(MeroshareAccount account) {
        String plainPassword = decryptField(account.getPassword(), "password", account.getUsername());
        return meroshareApiService.loginFresh(account.getDpId(), account.getUsername(), plainPassword);
    }

    private String decryptField(String encryptedValue, String fieldName, String username) {
        if (encryptedValue == null || encryptedValue.isBlank()) {
            throw new RuntimeException("No encrypted " + fieldName + " stored for account: " + username);
        }
        try {
            return encryptionUtil.decrypt(encryptedValue);
        } catch (Exception e) {
            log.error("[DECRYPT] Failed for {} of '{}': {}", fieldName, username, e.getMessage());
            throw new RuntimeException(
                    "Could not decrypt " + fieldName + " for account '" + username +
                    "'. Please remove and re-add this Meroshare account.", e);
        }
    }

    @Transactional(readOnly = true)
    public List<Map> getPublicShareList() {
        return meroshareApiService.getPublicShareList();
    }

    public List getOpenIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getOpenIpos(token);
    }

    public List getClosedIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getApplicationHistory(token);
    }

    public Map<String, List> getIpoLists(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        Map<String, List> result = new java.util.HashMap<>();
        result.put("open", meroshareApiService.getOpenIpos(token));
        result.put("closed", meroshareApiService.getApplicationHistory(token));
        return result;
    }

    public List<IpoApplyResult> applyForAll(IpoApplyRequest request, String username) {
        AppUser appUser = getAppUser(username);
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
                        account.getFullName(), "ALREADY_APPLIED",
                        "Already applied for this IPO from this account"));
                continue;
            }

            results.add(applySingleAccount(account, request));

            try {
                Thread.sleep(1500);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }

        return results;
    }

    @Transactional
    public IpoApplyResult applySingleAccount(MeroshareAccount account, IpoApplyRequest request) {
        IpoApplication application = IpoApplication.builder()
                .companyName(request.getCompanyName())
                .shareId(request.getShareId())
                .appliedKitta(request.getKitta())
                .status(IpoApplication.ApplicationStatus.PENDING)
                .meroshareAccount(account)
                .build();
        application = ipoApplicationRepository.save(application);

        try {
            String token = loginAccount(account);

            if (account.getBoid() == null || account.getBoid().isBlank()) {
                MeroshareApiService.AccountDetails ownDetail = meroshareApiService.fetchAccountDetails(token);
                account.setBoid(ownDetail.getBoid());
                account.setDemat(ownDetail.getDemat());
                accountRepository.save(account);
            }

            if (account.getCustomerId() == null || account.getCustomerId().isBlank()) {
                List<Map> banks = meroshareApiService.getUserBanks(token);
                if (!banks.isEmpty()) {
                    String firstBankId = String.valueOf(banks.get(0).get("id"));
                    MeroshareApiService.BankDetails bankDetails = meroshareApiService.fetchBankDetails(token, firstBankId);
                    if (bankDetails != null) {
                        account.setBankId(bankDetails.getBankId());
                        account.setAccountNumber(bankDetails.getAccountNumber());
                        account.setAccountBranchId(bankDetails.getAccountBranchId());
                        account.setCustomerId(bankDetails.getCustomerId());
                        accountRepository.save(account);
                    }
                }
            }

            String decryptedPin = "";
            if (account.getPin() != null && !account.getPin().isBlank()) {
                try {
                    decryptedPin = encryptionUtil.decrypt(account.getPin());
                } catch (Exception e) {
                    log.warn("[APPLY] Could not decrypt PIN for {}: {}", account.getUsername(), e.getMessage());
                }
            }

            validateApplyFields(account);

            String message = meroshareApiService.applyIpo(
                    token,
                    Integer.parseInt(request.getShareId()),
                    account.getDemat(),
                    account.getBoid(),
                    account.getAccountNumber(),
                    account.getCustomerId(),
                    account.getAccountBranchId(),
                    account.getBankId(),
                    request.getKitta(),
                    account.getCrn(),
                    decryptedPin
            );

            application.setStatus(IpoApplication.ApplicationStatus.SUCCESS);
            application.setStatusMessage(message);
            ipoApplicationRepository.save(application);

            log.info("[APPLY] SUCCESS for {}: {}", account.getUsername(), message);
            return buildResult(account.getId(), account.getUsername(),
                    account.getFullName(), "SUCCESS", message);

        } catch (Exception e) {
            log.error("[APPLY] FAILED for {}: {}", account.getUsername(), e.getMessage());
            application.setStatus(IpoApplication.ApplicationStatus.FAILED);
            application.setStatusMessage(e.getMessage());
            ipoApplicationRepository.save(application);
            return buildResult(account.getId(), account.getUsername(),
                    account.getFullName(), "FAILED", e.getMessage());
        }
    }

    private void validateApplyFields(MeroshareAccount account) {
        if (account.getBoid() == null || account.getBoid().isBlank())
            throw new RuntimeException("BOID not set for account: " + account.getUsername());
        if (account.getDemat() == null || account.getDemat().isBlank())
            throw new RuntimeException("Demat not set for account: " + account.getUsername());
        if (account.getAccountNumber() == null || account.getAccountNumber().isBlank())
            throw new RuntimeException("Account number not set for account: " + account.getUsername());
        if (account.getCustomerId() == null || account.getCustomerId().isBlank())
            throw new RuntimeException("Customer ID not set for account: " + account.getUsername() + ". Please re-add the account.");
        if (account.getAccountBranchId() == null || account.getAccountBranchId().isBlank())
            throw new RuntimeException("Account branch ID not set for account: " + account.getUsername());
        if (account.getBankId() == null || account.getBankId().isBlank())
            throw new RuntimeException("Bank ID not set for account: " + account.getUsername());
    }

    @Transactional
    public List<IpoApplicationResponse> checkResults(String shareId, String username) {
        AppUser appUser = getAppUser(username);
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) throw new RuntimeException("Add at least one Meroshare account first");

        List<IpoApplicationResponse> responses = new ArrayList<>();
        for (MeroshareAccount account : accounts) {
            responses.add(checkResultForAccount(account, shareId));
        }
        return responses;
    }

    private IpoApplicationResponse checkResultForAccount(MeroshareAccount account, String shareId) {
        try {
            String token = loginAccount(account);
            List<Map> history = meroshareApiService.getApplicationHistory(token);

            log.info("[CHECK_RESULT] account={} historySize={}", account.getUsername(), history.size());

            Map<String, Object> matchingEntry = findInHistory(history, shareId);

            IpoApplication.ResultStatus mappedStatus;
            int allottedKitta = 0;
            String companyName = "";

            if (matchingEntry != null) {
                companyName = safeStr(matchingEntry.get("companyName"),
                        safeStr(matchingEntry.get("scrip"), ""));
                String statusName = safeStr(matchingEntry.get("statusName"), "UNKNOWN");
                log.info("[CHECK_RESULT] account={} statusName={}", account.getUsername(), statusName);

                if (isTerminalStatus(statusName)) {
                    Object formIdObj = matchingEntry.get("applicantFormId");
                    if (formIdObj != null) {
                        MeroshareApiService.ResultInfo detail =
                                meroshareApiService.checkResultDetail(token, String.valueOf(formIdObj));
                        mappedStatus = mapResultStatus(detail.getStatus());
                        allottedKitta = detail.getAllottedKitta();
                    } else {
                        mappedStatus = mapResultStatus(statusName);
                    }
                } else {
                    mappedStatus = mapResultStatus(statusName);
                }
            } else {
                boolean appliedViaSystem = ipoApplicationRepository
                        .existsByMeroshareAccountIdAndShareId(account.getId(), shareId);

                if (appliedViaSystem && account.getBoid() != null && !account.getBoid().isBlank()) {
                    MeroshareApiService.ResultInfo result =
                            meroshareApiService.checkResultPublic(account.getBoid(), shareId);
                    mappedStatus = mapResultStatus(result.getStatus());
                    allottedKitta = result.getAllottedKitta();
                } else {
                    return IpoApplicationResponse.builder()
                            .shareId(shareId)
                            .resultStatus(IpoApplication.ResultStatus.NOT_PUBLISHED.name())
                            .statusMessage("No application found for this IPO in this account")
                            .accountUsername(account.getUsername())
                            .accountFullName(account.getFullName())
                            .build();
                }
            }

            IpoApplication application = ipoApplicationRepository
                    .findByMeroshareAccountIdAndShareId(account.getId(), shareId)
                    .orElse(null);

            if (application != null) {
                application.setResultStatus(mappedStatus);
                application.setAllottedKitta(allottedKitta);
                if (!companyName.isBlank() && (application.getCompanyName() == null || application.getCompanyName().isBlank())) {
                    application.setCompanyName(companyName);
                }
                application.setResultCheckedAt(LocalDateTime.now());
                ipoApplicationRepository.save(application);
            }

            return IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .companyName(application != null ? application.getCompanyName() : companyName)
                    .resultStatus(mappedStatus.name())
                    .allottedKitta(allottedKitta)
                    .resultCheckedAt(LocalDateTime.now())
                    .accountUsername(account.getUsername())
                    .accountFullName(account.getFullName())
                    .build();

        } catch (Exception e) {
            log.warn("[CHECK_RESULT] Failed for {}: {}", account.getUsername(), e.getMessage());
            return IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .resultStatus(IpoApplication.ResultStatus.UNKNOWN.name())
                    .statusMessage("Error checking result: " + e.getMessage())
                    .accountUsername(account.getUsername())
                    .accountFullName(account.getFullName())
                    .build();
        }
    }

    public List<IpoApplicationResponse> checkResultByBoid(String shareId, String boid) {
        try {
            MeroshareApiService.ResultInfo result = meroshareApiService.checkResultPublic(boid, shareId);
            IpoApplication.ResultStatus status = mapResultStatus(result.getStatus());

            String message = null;
            if (status == IpoApplication.ResultStatus.UNKNOWN) {
                message = "Result check is currently unavailable. Please check directly at iporesult.cdsc.com.np";
            }

            return List.of(IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .companyName("")
                    .resultStatus(status.name())
                    .statusMessage(message)
                    .allottedKitta(result.getAllottedKitta())
                    .accountUsername(boid)
                    .accountFullName("Guest")
                    .build());

        } catch (Exception e) {
            log.error("[GUEST_RESULT] Failed for boid={}: {}", boid, e.getMessage());
            return List.of(IpoApplicationResponse.builder()
                    .shareId(shareId)
                    .resultStatus(IpoApplication.ResultStatus.UNKNOWN.name())
                    .statusMessage("Result check failed: " + e.getMessage())
                    .allottedKitta(0)
                    .accountUsername(boid)
                    .accountFullName("Guest")
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public List<IpoApplicationResponse> getHistory(String username) {
        AppUser appUser = getAppUser(username);
        return ipoApplicationRepository.findAllByAppUserId(appUser.getId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private boolean isTerminalStatus(String status) {
        if (status == null) return false;
        String n = status.toUpperCase().trim().replace(" ", "_").replace("-", "_");
        return switch (n) {
            case "TRANSACTION_SUCCESS", "APPROVED", "SUCCESS", "COMPLETE",
                 "ALLOTED", "ALLOTTED", "NOT_ALLOTED", "NOT_ALLOTTED",
                 "SHARE_ALLOTED", "SHARE_ALLOTTED", "SHARE_NOT_ALLOTED", "SHARE_NOT_ALLOTTED" -> true;
            default -> false;
        };
    }

    private IpoApplication.ResultStatus mapResultStatus(String status) {
        if (status == null) return IpoApplication.ResultStatus.NOT_PUBLISHED;

        String n = status.toUpperCase().trim().replace(" ", "_").replace("-", "_");

        return switch (n) {
            case "ALLOTED", "ALLOTTED", "ALLOCATE", "SHARE_ALLOTED", "SHARE_ALLOTTED" ->
                    IpoApplication.ResultStatus.ALLOTTED;
            case "NOT_ALLOTED", "NOT_ALLOTTED", "SHARE_NOT_ALLOTED", "SHARE_NOT_ALLOTTED" ->
                    IpoApplication.ResultStatus.NOT_ALLOTTED;
            case "NOT_PUBLISHED", "RESULT_NOT_PUBLISHED", "PENDING",
                 "PROCESSING", "SUBMITTED", "RECEIVED" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;
            case "TRANSACTION_SUCCESS", "APPROVED", "SUCCESS", "COMPLETE" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;
            case "UNKNOWN" -> IpoApplication.ResultStatus.UNKNOWN;
            default -> {
                log.warn("[MAP_STATUS] Unrecognised status: '{}'", status);
                yield IpoApplication.ResultStatus.UNKNOWN;
            }
        };
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findInHistory(List<Map> history, String shareId) {
        return (Map<String, Object>) history.stream()
                .filter(item -> shareId.equals(String.valueOf(item.get("companyShareId"))))
                .findFirst()
                .orElse(null);
    }

    private String safeStr(Object obj, String defaultValue) {
        if (obj == null) return defaultValue;
        String s = String.valueOf(obj);
        return s.equals("null") ? defaultValue : s;
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