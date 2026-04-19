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

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private AppUser getAppUser(String username) {
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    private MeroshareAccount getFirstAccount(String username) {
        AppUser appUser = getAppUser(username);
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }
        return accounts.get(0);
    }

    /**
     * Decrypts the stored password and logs the Meroshare account in.
     * Uses cached token when available; only retries fresh login on
     * confirmed auth-failure responses (401/403), not on all errors.
     */
    private String loginAccount(MeroshareAccount account) {
        String decryptedPassword = decryptField(account.getPassword(),
                "password", account.getUsername());

        if (decryptedPassword.isBlank()) {
            throw new RuntimeException(
                    "Decrypted password is empty for account '" + account.getUsername() +
                    "'. Please remove and re-add this Meroshare account.");
        }

        return meroshareApiService.login(
                account.getDpId(), account.getUsername(), decryptedPassword);
    }

    /**
     * Forces a fresh login — only call after receiving a confirmed 401/403
     * from a subsequent API call (not just any exception).
     */
    private String loginAccountFresh(MeroshareAccount account) {
        String decryptedPassword = decryptField(account.getPassword(),
                "password", account.getUsername());
        return meroshareApiService.loginFresh(
                account.getDpId(), account.getUsername(), decryptedPassword);
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

    // ─── Public endpoints ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map> getPublicShareList() {
        return meroshareApiService.getPublicShareList();
    }

    /**
     * Returns open + closed IPO lists using a SINGLE login (shared token).
     * Uses @Transactional(readOnly=true) since this is a read-only operation.
     */
    public Map<String, List> getIpoLists(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        List<Map> open = meroshareApiService.getOpenIpos(token);
        List<Map> closed = meroshareApiService.getApplicationReport(token);
        // Return typed map to avoid raw-type issues with Jackson serialization
        Map<String, List> result = new java.util.HashMap<>();
        result.put("open", open);
        result.put("closed", closed);
        return result;
    }

    public List getOpenIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getOpenIpos(token);
    }

    public List getClosedIpos(String username) {
        MeroshareAccount account = getFirstAccount(username);
        String token = loginAccount(account);
        return meroshareApiService.getApplicationReport(token);
    }

    // ─── Apply ────────────────────────────────────────────────────────────────

    /**
     * Applies for an IPO across multiple accounts.
     * NOT @Transactional at this level — each account's application is saved
     * independently so partial successes are preserved (don't rollback
     * account 1's success just because account 2 failed).
     */
    public List<IpoApplyResult> applyForAll(IpoApplyRequest request, String username) {
        AppUser appUser = getAppUser(username);
        List<IpoApplyResult> results = new ArrayList<>();

        for (Long accountId : request.getAccountIds()) {
            MeroshareAccount account = accountRepository.findById(accountId).orElse(null);

            if (account == null) {
                results.add(buildResult(accountId, null, null, "FAILED", "Account not found"));
                continue;
            }

            // Security: ensure this account belongs to the requesting user
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
        }

        return results;
    }

    /**
     * Each application is saved in its own transaction so a failure in one
     * account doesn't roll back another account's successful application.
     */
    @Transactional
    public IpoApplyResult applySingleAccount(MeroshareAccount account, IpoApplyRequest request) {
        // Save a PENDING record first so we don't lose track of the attempt
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

            String decryptedPin = "";
            if (account.getPin() != null && !account.getPin().isBlank()) {
                try {
                    decryptedPin = encryptionUtil.decrypt(account.getPin());
                } catch (Exception e) {
                    log.warn("[APPLY] Could not decrypt PIN for {}: {}", account.getUsername(), e.getMessage());
                    // Non-fatal — some IPOs don't require a PIN
                }
            }

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

    // ─── Result Checking ──────────────────────────────────────────────────────

    /**
     * Check results for all accounts of the authenticated user.
     *
     * Strategy:
     * 1. Login and fetch the application report.
     * 2. If the share is in the report with a terminal status, fetch the
     *    detail endpoint (which has allottedKitta / receivedKitta).
     * 3. If NOT in the report, fall back to public BOID check ONLY IF the
     *    user previously applied via this system (has an IpoApplication record).
     *    We do NOT create orphan records for applications we didn't make.
     */
    @Transactional
    public List<IpoApplicationResponse> checkResults(String shareId, String username) {
        AppUser appUser = getAppUser(username);
        List<MeroshareAccount> accounts = accountRepository.findByAppUserId(appUser.getId());
        if (accounts.isEmpty()) {
            throw new RuntimeException("Add at least one Meroshare account first");
        }

        List<IpoApplicationResponse> responses = new ArrayList<>();

        for (MeroshareAccount account : accounts) {
            responses.add(checkResultForAccount(account, shareId));
        }

        return responses;
    }

    private IpoApplicationResponse checkResultForAccount(MeroshareAccount account, String shareId) {
        try {
            String token = loginAccount(account);
            List<Map> report = meroshareApiService.getApplicationReport(token);

            log.info("[CHECK_RESULT] account={} reportSize={}", account.getUsername(), report.size());

            Map<String, Object> matchingApp = findInReport(report, shareId);

            IpoApplication.ResultStatus mappedStatus;
            int allottedKitta = 0;
            String companyName = "";

            if (matchingApp != null) {
                companyName = safeStr(matchingApp.get("companyName"),
                        safeStr(matchingApp.get("scrip"), ""));
                String statusName = safeStr(matchingApp.get("statusName"), "UNKNOWN");
                log.info("[CHECK_RESULT] account={} statusName={}", account.getUsername(), statusName);

                if (isTerminalStatus(statusName)) {
                    // Fetch detailed result (has allottedKitta / receivedKitta)
                    Object formIdObj = matchingApp.get("applicantFormId");
                    if (formIdObj != null) {
                        MeroshareApiService.ResultInfo detail =
                                meroshareApiService.checkResult(token, String.valueOf(formIdObj));
                        log.info("[CHECK_RESULT] detail status={} kitta={}",
                                detail.getStatus(), detail.getAllottedKitta());
                        mappedStatus = mapResultStatus(detail.getStatus());
                        allottedKitta = detail.getAllottedKitta();
                    } else {
                        // No form ID — use the report status directly
                        mappedStatus = mapResultStatus(statusName);
                    }
                } else {
                    // Application in progress (PENDING, PROCESSING, etc.)
                    mappedStatus = mapResultStatus(statusName);
                }
            } else {
                // Not found in the application report.
                // Only fall back to public BOID check if we have a record of
                // this user applying via our system. Don't create orphan records.
                log.info("[CHECK_RESULT] account={} not in report, checking local DB",
                        account.getUsername());

                boolean appliedViaSystem = ipoApplicationRepository
                        .existsByMeroshareAccountIdAndShareId(account.getId(), shareId);

                if (appliedViaSystem && account.getBoid() != null && !account.getBoid().isBlank()) {
                    MeroshareApiService.ResultInfo result =
                            meroshareApiService.checkResultPublic(account.getBoid(), shareId);
                    log.info("[CHECK_RESULT_PUBLIC] boid={} status={} kitta={}",
                            account.getBoid(), result.getStatus(), result.getAllottedKitta());
                    mappedStatus = mapResultStatus(result.getStatus());
                    allottedKitta = result.getAllottedKitta();
                } else {
                    // Not applied via our system and not in report — nothing to show
                    return IpoApplicationResponse.builder()
                            .shareId(shareId)
                            .resultStatus(IpoApplication.ResultStatus.NOT_PUBLISHED.name())
                            .statusMessage("No application found for this IPO in this account")
                            .accountUsername(account.getUsername())
                            .accountFullName(account.getFullName())
                            .build();
                }
            }

            // Upsert the IpoApplication record — only for applications we know exist
            IpoApplication application = ipoApplicationRepository
                    .findByMeroshareAccountIdAndShareId(account.getId(), shareId)
                    .orElse(null);

            if (application != null) {
                application.setResultStatus(mappedStatus);
                application.setAllottedKitta(allottedKitta);
                if (!companyName.isBlank() && application.getCompanyName().isBlank()) {
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

    /**
     * Guest result check via public CDSC endpoint.
     */
    public List<IpoApplicationResponse> checkResultByBoid(String shareId, String boid) {
        try {
            MeroshareApiService.ResultInfo result =
                    meroshareApiService.checkResultPublic(boid, shareId);

            log.info("[GUEST_RESULT] boid={} shareId={} status={} kitta={}",
                    boid, shareId, result.getStatus(), result.getAllottedKitta());

            IpoApplication.ResultStatus status = mapResultStatus(result.getStatus());
            String message = null;
            if (status == IpoApplication.ResultStatus.UNKNOWN) {
                message = "Result check is currently unavailable — the CDSC server may be " +
                          "blocking automated requests. Please check directly at " +
                          "iporesult.cdsc.com.np";
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
                    .companyName("")
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
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Status mapping ───────────────────────────────────────────────────────

    /**
     * Terminal statuses are those where the application has been fully processed
     * and a result detail endpoint call is appropriate.
     * NON-terminal statuses (PENDING, PROCESSING) should NOT trigger a detail call.
     */
    private boolean isTerminalStatus(String status) {
        if (status == null) return false;
        String normalized = status.toUpperCase().trim()
                .replace(" ", "_").replace("-", "_");
        return switch (normalized) {
            case "TRANSACTION_SUCCESS", "APPROVED", "SUCCESS", "COMPLETE",
                 "ALLOTED", "ALLOTTED", "NOT_ALLOTED", "NOT_ALLOTTED",
                 "SHARE_ALLOTED", "SHARE_ALLOTTED", "SHARE_NOT_ALLOTED", "SHARE_NOT_ALLOTTED" -> true;
            default -> false;
        };
    }

    /**
     * Maps all known CDSC status strings to our internal ResultStatus enum.
     */
    private IpoApplication.ResultStatus mapResultStatus(String status) {
        if (status == null) return IpoApplication.ResultStatus.NOT_PUBLISHED;

        String normalized = status.toUpperCase().trim()
                .replace(" ", "_")
                .replace("-", "_");

        return switch (normalized) {
            // Allotted variants (CDSC is inconsistent with spelling)
            case "ALLOTED", "ALLOTTED", "ALLOCATE", "SHARE_ALLOTED", "SHARE_ALLOTTED" ->
                    IpoApplication.ResultStatus.ALLOTTED;

            // Not allotted variants
            case "NOT_ALLOTED", "NOT_ALLOTTED", "NOT_ALLOTED_",
                 "SHARE_NOT_ALLOTED", "SHARE_NOT_ALLOTTED" ->
                    IpoApplication.ResultStatus.NOT_ALLOTTED;

            // Result not yet published
            case "NOT_PUBLISHED", "RESULT_NOT_PUBLISHED", "PENDING",
                 "PROCESSING", "SUBMITTED", "RECEIVED" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;

            // Terminal statuses from application report — STILL need detail check.
            // These appear in getApplicationReport() and mean "application was processed",
            // but the actual allotment result needs checkResult() to determine.
            // Returning NOT_PUBLISHED here causes a detail check to be attempted.
            case "TRANSACTION_SUCCESS", "APPROVED", "SUCCESS", "COMPLETE" ->
                    IpoApplication.ResultStatus.NOT_PUBLISHED;

            case "UNKNOWN" -> IpoApplication.ResultStatus.UNKNOWN;

            default -> {
                log.warn("[MAP_STATUS] Unrecognised status: '{}'", status);
                yield IpoApplication.ResultStatus.UNKNOWN;
            }
        };
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> findInReport(List<Map> report, String shareId) {
        return (Map<String, Object>) report.stream()
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