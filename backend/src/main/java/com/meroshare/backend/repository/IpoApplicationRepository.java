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

    boolean existsByMeroshareAccountIdAndShareId(Long meroshareAccountId, String shareId);

    Optional<IpoApplication> findByMeroshareAccountIdAndShareId(Long meroshareAccountId, String shareId);

    @Query("SELECT ia FROM IpoApplication ia " +
           "JOIN FETCH ia.meroshareAccount ma " +
           "WHERE ma.appUser.id = :appUserId " +
           "ORDER BY ia.appliedAt DESC")
    List<IpoApplication> findAllByAppUserId(@Param("appUserId") Long appUserId);
}