package com.meroshare.backend.repository;

import com.meroshare.backend.entity.CdscResultCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CdscResultCacheRepository extends JpaRepository<CdscResultCache, Long> {

    List<CdscResultCache> findByMeroshareAccountId(Long meroshareAccountId);

    Optional<CdscResultCache> findByMeroshareAccountIdAndApplicantFormId(
            Long meroshareAccountId, String applicantFormId);

    @Query("SELECT c FROM CdscResultCache c WHERE c.meroshareAccount.id = :accountId " +
           "AND c.resultStatus NOT IN ('ALLOTTED', 'NOT_ALLOTTED')")
    List<CdscResultCache> findUnresolvedByAccountId(@Param("accountId") Long accountId);
}