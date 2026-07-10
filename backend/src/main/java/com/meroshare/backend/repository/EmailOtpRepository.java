package com.meroshare.backend.repository;

import com.meroshare.backend.entity.EmailOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface EmailOtpRepository extends JpaRepository<EmailOtp, Long> {

    // Used to find the OTP record when the user tries to verify it
    Optional<EmailOtp> findByEmail(String email);

    // Used to clean up the entry after a successful verification
    void deleteByEmail(String email);
}