package com.meroshare.backend.repository;

import com.meroshare.backend.entity.MeroshareAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MeroshareAccountRepository extends JpaRepository<MeroshareAccount, Long> {

    List<MeroshareAccount> findByAppUserId(Long appUserId);

    boolean existsByUsernameAndAppUserId(String username, Long appUserId);
}