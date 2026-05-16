package com.meroshare.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "cdsc_result_cache",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"meroshare_account_id", "applicant_form_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CdscResultCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meroshare_account_id", nullable = false)
    private MeroshareAccount meroshareAccount;

    @Column(name = "applicant_form_id", nullable = false)
    private String applicantFormId;

    @Column(name = "company_share_id")
    private String companyShareId;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "scrip")
    private String scrip;

    @Column(name = "share_type_name")
    private String shareTypeName;

    @Column(name = "result_status")
    private String resultStatus;

    @Column(name = "allotted_kitta")
    private int allottedKitta;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.fetchedAt = LocalDateTime.now();
    }
}