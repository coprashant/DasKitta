package com.meroshare.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ipo_applications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IpoApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String companyName;

    @Column(nullable = false)
    private String shareId;

    private int appliedKitta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status;

    // Message returned from CDSC API (success or error detail)
    private String statusMessage;

    // Result after IPO result is published
    @Enumerated(EnumType.STRING)
    private ResultStatus resultStatus;

    private int allottedKitta;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "result_checked_at")
    private LocalDateTime resultCheckedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meroshare_account_id", nullable = false)
    private MeroshareAccount meroshareAccount;

    @PrePersist
    public void prePersist() {
        this.appliedAt = LocalDateTime.now();
    }

    public enum ApplicationStatus {
        SUCCESS,
        FAILED,
        ALREADY_APPLIED,
        PENDING
    }

    public enum ResultStatus {
        ALLOTTED,
        NOT_ALLOTTED,
        NOT_PUBLISHED,
        UNKNOWN
    }
}