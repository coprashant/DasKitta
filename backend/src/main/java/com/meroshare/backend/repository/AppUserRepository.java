package com.meroshare.backend.repository;

import com.meroshare.backend.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
    Optional<AppUser> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<AppUser> findByEnabledFalseAndCreatedAtBefore(LocalDateTime cutoff);
}