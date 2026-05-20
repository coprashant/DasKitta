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
import com.meroshare.backend.entity.CdscResultCache;
import com.meroshare.backend.repository.CdscResultCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.meroshare.backend.dto.CdscSummaryDto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpoService {

    private final IpoApplicationRepository ipoApplicationRepository;
    private final MeroshareAccountRepository accountRepository;
    private final CdscResultCacheRepository cdscResultCacheRepository;
    private final AppUserRepository appUserRepository;
    private final MeroshareApiService meroshareApiService;
    private final EncryptionUtil encryptionUtil;
    private final Random random = new Random();

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
                long jitter = 2000 + random.nextInt(3000);
                Thread.sleep(jitter);
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
        for (int i = 0; i < accounts.size(); i++) {
            responses.add(checkResultForAccount(accounts.get(i), shareId));
            if (i < accounts.size() - 1) {
                try { Thread.sleep(1500); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
            }
        }
        return responses;
    }

    private IpoApplicationResponse checkResultForAccount(MeroshareAccount account, String shareId) {
        try {
            String token = loginAccount(account);

            List<Map> history = meroshareApiService.getApplicationHistory(token);
            log.info("[CHECK_RESULT] account={} historySize={} shareId={}", account.getUsername(), history.size(), shareId);

            Map<String, Object> entry = findInHistory(history, shareId);

            if (entry == null) {
                return IpoApplicationResponse.builder()
                        .shareId(shareId)
                        .resultStatus(IpoApplication.ResultStatus.NOT_PUBLISHED.name())
                        .statusMessage("No application found for this IPO in this account")
                        .accountUsername(account.getUsername())
                        .accountFullName(account.getFullName())
                        .build();
            }

            String companyName = safeStr(entry.get("companyName"), safeStr(entry.get("scrip"), ""));
            String applicantFormId = safeStr(entry.get("applicantFormId"), null);

            IpoApplication.ResultStatus mappedStatus;
            int allottedKitta = 0;

            if (applicantFormId != null) {
                MeroshareApiService.ResultInfo detail =
                        meroshareApiService.checkResultDetail(token, applicantFormId);
                log.info("[CHECK_RESULT] account={} detailStatus={} kitta={}",
                        account.getUsername(), detail.getStatus(), detail.getAllottedKitta());
                mappedStatus = mapResultStatus(detail.getStatus());
                allottedKitta = detail.getAllottedKitta();
            } else {
                mappedStatus = mapResultStatus(safeStr(entry.get("statusName"), "UNKNOWN"));
            }

            IpoApplication application = ipoApplicationRepository
                    .findByMeroshareAccountIdAndShareId(account.getId(), shareId)
                    .orElse(null);

            if (application != null) {
                application.setResultStatus(mappedStatus);
                application.setAllottedKitta(allottedKitta);
                if (!companyName.isBlank() &&
                        (application.getCompanyName() == null || application.getCompanyName().isBlank())) {
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
                    .statusMessage(e.getMessage())
                    .accountUsername(account.getUsername())
                    .accountFullName(account.getFullName())
                    .build();
        }
    }

    public List<IpoApplicationResponse> checkResultByBoid(String shareId, String boid) {
        return List.of(IpoApplicationResponse.builder()
                .shareId(shareId)
                .resultStatus(IpoApplication.ResultStatus.UNKNOWN.name())
                .statusMessage("Guest result checking is disabled. Please sign in to check results.")
                .allottedKitta(0)
                .accountUsername(boid)
                .accountFullName("Guest")
                .build());
    }

    @Transactional(readOnly = true)
    public List<IpoApplicationResponse> getHistory(String username) {
        AppUser appUser = getAppUser(username);
        return ipoApplicationRepository.findAllByAppUserId(appUser.getId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private IpoApplication.ResultStatus mapResultStatus(String status) {
        if (status == null) return IpoApplication.ResultStatus.NOT_PUBLISHED;

        String n = status.toUpperCase().trim().replace(" ", "_").replace("-", "_");

        return switch (n) {
            case "ALLOTED", "ALLOTTED", "ALLOCATE", "SHARE_ALLOTED", "SHARE_ALLOTTED" ->
                    IpoApplication.ResultStatus.ALLOTTED;
            case "NOT_ALLOTED", "NOT_ALLOTTED", "SHARE_NOT_ALLOTED", "SHARE_NOT_ALLOTTED", "REJECTED" ->
                    IpoApplication.ResultStatus.NOT_ALLOTTED;
            case "NOT_PUBLISHED", "RESULT_NOT_PUBLISHED", "PENDING",
                 "PROCESSING", "SUBMITTED", "RECEIVED", "VERIFIED" ->
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

    @Transactional(readOnly = true)
    public List<Map<String, String>> getAppliedCompanies(String username) {
        AppUser appUser = getAppUser(username);
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) return List.of();

        MeroshareAccount account = accounts.get(0);
        try {
            String token = loginAccount(account);
            List<Map> history = meroshareApiService.getApplicationHistory(token);
            return history.stream()
                    .map(item -> {
                        Map<String, String> entry = new java.util.LinkedHashMap<>();
                        entry.put("companyShareId", safeStr(item.get("companyShareId"), ""));
                        entry.put("companyName",    safeStr(item.get("companyName"), safeStr(item.get("scrip"), "")));
                        entry.put("scrip",          safeStr(item.get("scrip"), ""));
                        return entry;
                    })
                    .filter(e -> !e.get("companyShareId").isBlank())
                    .distinct()
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("[APPLIED_COMPANIES] Failed: {}", e.getMessage());
            return List.of();
        }
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

    public CdscSummaryDto getCdscSummary(Long accountId, String username) {
        AppUser appUser = getAppUser(username);

        MeroshareAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!account.getAppUser().getId().equals(appUser.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        String token = loginAccount(account);
        List<Map> history = meroshareApiService.getApplicationHistory(token);

        Map<String, CdscResultCache> cacheByFormId = cdscResultCacheRepository
                .findByMeroshareAccountId(accountId)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        CdscResultCache::getApplicantFormId,
                        c -> c
                ));

        List<CdscSummaryDto.Item> items = new ArrayList<>();
        int allotted     = 0;
        int failed       = 0;
        int notPublished = 0;

        for (Map entry : history) {
            String applicantFormId = safeStr(entry.get("applicantFormId"), null);
            String companyName     = safeStr(entry.get("companyName"), safeStr(entry.get("scrip"), ""));
            String scrip           = safeStr(entry.get("scrip"), "");
            String shareTypeName   = safeStr(entry.get("shareTypeName"), "");
            String companyShareId  = safeStr(entry.get("companyShareId"), "");

            String resultStatus  = "NOT_PUBLISHED";
            int    allottedKitta = 0;

            if (applicantFormId != null) {
                CdscResultCache cached = cacheByFormId.get(applicantFormId);

                boolean alreadyResolved = cached != null &&
                        ("ALLOTTED".equals(cached.getResultStatus()) ||
                         "NOT_ALLOTTED".equals(cached.getResultStatus()));

                if (alreadyResolved) {
                    resultStatus  = cached.getResultStatus();
                    allottedKitta = cached.getAllottedKitta();
                    log.debug("[CDSC_SUMMARY] cache hit formId={} status={}", applicantFormId, resultStatus);
                } else {
                    try {
                        MeroshareApiService.ResultInfo detail =
                                meroshareApiService.checkResultDetail(token, applicantFormId);
                        IpoApplication.ResultStatus mapped = mapResultStatus(detail.getStatus());
                        resultStatus  = mapped.name();
                        allottedKitta = detail.getAllottedKitta();
                        log.debug("[CDSC_SUMMARY] fetched formId={} status={}", applicantFormId, resultStatus);
                    } catch (Exception e) {
                        log.warn("[CDSC_SUMMARY] detail fetch failed for formId={}: {}",
                                applicantFormId, e.getMessage());
                        resultStatus = cached != null ? cached.getResultStatus() : "NOT_PUBLISHED";
                    }

                    upsertCache(cached, account, applicantFormId, companyShareId,
                            companyName, scrip, shareTypeName, resultStatus, allottedKitta);
                }
            }

            switch (resultStatus) {
                case "ALLOTTED"     -> allotted++;
                case "NOT_ALLOTTED" -> failed++;
                default             -> notPublished++;
            }

            items.add(CdscSummaryDto.Item.builder()
                    .companyName(companyName)
                    .scrip(scrip)
                    .shareTypeName(shareTypeName)
                    .applicantFormId(applicantFormId)
                    .companyShareId(companyShareId)
                    .resultStatus(resultStatus)
                    .allottedKitta(allottedKitta)
                    .build());
        }

        return CdscSummaryDto.builder()
                .total(history.size())
                .allotted(allotted)
                .failed(failed)
                .notPublished(notPublished)
                .items(items)
                .build();
    }

    private void upsertCache(CdscResultCache existing, MeroshareAccount account,
                             String applicantFormId, String companyShareId,
                             String companyName, String scrip, String shareTypeName,
                             String resultStatus, int allottedKitta) {
        CdscResultCache row = existing != null
                ? existing
                : CdscResultCache.builder()
                        .meroshareAccount(account)
                        .applicantFormId(applicantFormId)
                        .build();

        row.setCompanyShareId(companyShareId);
        row.setCompanyName(companyName);
        row.setScrip(scrip);
        row.setShareTypeName(shareTypeName);
        row.setResultStatus(resultStatus);
        row.setAllottedKitta(allottedKitta);

        cdscResultCacheRepository.save(row);
    }
}