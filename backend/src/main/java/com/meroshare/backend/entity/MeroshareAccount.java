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

    @Column(nullable = false)
    private String dpId;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    private String fullName;

    private String boid;

    private String demat;

    private String bankId;

    private String accountNumber;

    private String accountBranchId;

    private String accountTypeId;

    private String customerId;

    private String crn;

    private String pin;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

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