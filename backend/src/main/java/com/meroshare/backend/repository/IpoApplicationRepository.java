package com.meroshare.backend.repository;

import com.meroshare.backend.entity.IpoApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpoApplicationRepository extends JpaRepository<IpoApplication, Long> {

    List<IpoApplication> findByMeroshareAccountId(Long accountId);

    Optional<IpoApplication> findByMeroshareAccountIdAndShareId(Long accountId, String shareId);

    @Query("""
        SELECT i FROM IpoApplication i
        JOIN FETCH i.meroshareAccount ma
        JOIN FETCH ma.appUser au
        WHERE au.id = :userId
        ORDER BY i.appliedAt DESC
        """)
    List<IpoApplication> findAllByAppUserId(@Param("userId") Long userId);

    boolean existsByMeroshareAccountIdAndShareId(Long accountId, String shareId);
}