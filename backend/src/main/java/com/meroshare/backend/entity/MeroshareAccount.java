package com.meroshare.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "meroshare_accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeroshareAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // DPID is the depository participant ID (e.g. 13200, 13300)
    @Column(nullable = false)
    private String dpId;

    @Column(nullable = false)
    private String username;

    // Stored encrypted
    @Column(nullable = false)
    private String password;

    // Full name as registered in Meroshare
    private String fullName;

    // BOID fetched after login
    private String boid;

    // Bank ID fetched after login, needed for IPO application
    private String bankId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Many Meroshare accounts belong to one app user
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_user_id", nullable = false)
    private AppUser appUser;

    @OneToMany(mappedBy = "meroshareAccount", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<IpoApplication> ipoApplications;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}