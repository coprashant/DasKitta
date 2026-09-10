package com.meroshare.backend.repository;

import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findAllByAppUser(AppUser appUser);

    Optional<PushSubscription> findByAppUserAndEndpoint(AppUser appUser, String endpoint);

    Optional<PushSubscription> findByEndpoint(String endpoint);
}