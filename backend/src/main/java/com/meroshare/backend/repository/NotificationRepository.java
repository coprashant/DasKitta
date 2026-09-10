package com.meroshare.backend.repository;

import com.meroshare.backend.entity.AppUser;
import com.meroshare.backend.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByAppUserAndIsDeletedFalseOrderByCreatedAtDesc(AppUser appUser, Pageable pageable);

    @Modifying
    @Query("update Notification n set n.isRead = true where n.id = :id and n.appUser = :appUser and n.isDeleted = false")
    int markAsRead(@Param("id") Long id, @Param("appUser") AppUser appUser);

    @Modifying
    @Query("update Notification n set n.isRead = true where n.appUser = :appUser and n.isDeleted = false and n.isRead = false")
    int markAllAsRead(@Param("appUser") AppUser appUser);

    @Modifying
    @Query("update Notification n set n.isDeleted = true where n.id = :id and n.appUser = :appUser and n.isDeleted = false")
    int softDelete(@Param("id") Long id, @Param("appUser") AppUser appUser);

    @Modifying
    @Query("update Notification n set n.isDeleted = true where n.appUser = :appUser and n.isDeleted = false")
    int softDeleteAll(@Param("appUser") AppUser appUser);
}