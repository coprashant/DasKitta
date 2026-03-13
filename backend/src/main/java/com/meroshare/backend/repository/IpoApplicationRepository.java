package com.meroshare.backend.repository;

import com.meroshare.backend.entity.IpoApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IpoApplicationRepository extends JpaRepository<IpoApplication, Long> {

    List<IpoApplication> findByMeroshareAccountId(Long accountId);

    // Get full history for all accounts belonging to an app user
    @Query("SELECT i FROM IpoApplication i WHERE i.meroshareAccount.appUser.id = :userId ORDER BY i.appliedAt DESC")
    List<IpoApplication> findAllByAppUserId(@Param("userId") Long userId);

    // Check if an account already applied for a specific IPO
    boolean existsByMeroshareAccountIdAndShareId(Long accountId, String shareId);
}