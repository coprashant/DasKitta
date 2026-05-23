package com.meroshare.backend.repository;

import com.meroshare.backend.entity.CdscResultCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface CdscResultCacheRepository extends JpaRepository<CdscResultCache, Long> {

    List<CdscResultCache> findByMeroshareAccountId(Long meroshareAccountId);

    @Query("SELECT c FROM CdscResultCache c WHERE c.meroshareAccount.id = :accountId " +
           "AND c.resultStatus NOT IN ('ALLOTTED', 'NOT_ALLOTTED')")
    List<CdscResultCache> findUnresolvedByAccountId(@Param("accountId") Long accountId);

    @Modifying
    @Transactional
    @Query(value = """
        INSERT INTO cdsc_result_cache
            (meroshare_account_id, applicant_form_id, company_share_id,
             company_name, scrip, share_type_name, result_status, allotted_kitta, fetched_at)
        VALUES
            (:accountId, :applicantFormId, :companyShareId,
             :companyName, :scrip, :shareTypeName, :resultStatus, :allottedKitta, NOW())
        ON CONFLICT (meroshare_account_id, applicant_form_id)
        DO UPDATE SET
            result_status    = EXCLUDED.result_status,
            allotted_kitta   = EXCLUDED.allotted_kitta,
            company_name     = EXCLUDED.company_name,
            scrip            = EXCLUDED.scrip,
            share_type_name  = EXCLUDED.share_type_name,
            company_share_id = EXCLUDED.company_share_id,
            fetched_at       = EXCLUDED.fetched_at
        """, nativeQuery = true)
    void upsert(
        @Param("accountId")       Long   accountId,
        @Param("applicantFormId") String applicantFormId,
        @Param("companyShareId")  String companyShareId,
        @Param("companyName")     String companyName,
        @Param("scrip")           String scrip,
        @Param("shareTypeName")   String shareTypeName,
        @Param("resultStatus")    String resultStatus,
        @Param("allottedKitta")   int    allottedKitta
    );
}