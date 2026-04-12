package com.meroshare.backend.repository;

import com.meroshare.backend.entity.MeroshareAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MeroshareAccountRepository extends JpaRepository<MeroshareAccount, Long> {

    @Query("SELECT ma FROM MeroshareAccount ma JOIN FETCH ma.appUser WHERE ma.appUser.id = :appUserId")
    List<MeroshareAccount> findByAppUserId(@Param("appUserId") Long appUserId);

    boolean existsByUsernameAndAppUserId(String username, Long appUserId);
}