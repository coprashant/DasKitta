package com.meroshare.backend.service;

import com.meroshare.backend.entity.CdscResultCache;
import com.meroshare.backend.entity.IpoApplication;
import com.meroshare.backend.entity.MeroshareAccount;
import com.meroshare.backend.repository.CdscResultCacheRepository;
import com.meroshare.backend.repository.IpoApplicationRepository;
import com.meroshare.backend.repository.MeroshareAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpoApplicationStore {

    private final IpoApplicationRepository ipoApplicationRepository;
    private final MeroshareAccountRepository accountRepository;
    private final CdscResultCacheRepository cdscResultCacheRepository;

    @Transactional
    public IpoApplication savePending(MeroshareAccount account, String companyName,
                                      String shareId, int kitta) {
        IpoApplication application = IpoApplication.builder()
                .companyName(companyName)
                .shareId(shareId)
                .appliedKitta(kitta)
                .status(IpoApplication.ApplicationStatus.PENDING)
                .meroshareAccount(account)
                .build();
        return ipoApplicationRepository.save(application);
    }

    @Transactional
    public void finalize(Long applicationId, IpoApplication.ApplicationStatus status, String message) {
        ipoApplicationRepository.findById(applicationId).ifPresent(app -> {
            app.setStatus(status);
            app.setStatusMessage(message);
            ipoApplicationRepository.save(app);
        });
    }

    @Transactional
    public void saveAccount(MeroshareAccount account) {
        accountRepository.save(account);
    }

    @Transactional
    public String saveResult(Long accountId, String shareId, IpoApplication.ResultStatus status,
                             int allottedKitta, String companyName) {
        IpoApplication app = ipoApplicationRepository
                .findByMeroshareAccountIdAndShareId(accountId, shareId)
                .orElse(null);

        if (app == null) return companyName;

        app.setResultStatus(status);
        app.setAllottedKitta(allottedKitta);
        if (!companyName.isBlank() && (app.getCompanyName() == null || app.getCompanyName().isBlank())) {
            app.setCompanyName(companyName);
        }
        app.setResultCheckedAt(LocalDateTime.now());
        ipoApplicationRepository.save(app);

        return app.getCompanyName() != null ? app.getCompanyName() : companyName;
    }

    @Transactional
    public void upsertCache(CdscResultCache existing, MeroshareAccount account,
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