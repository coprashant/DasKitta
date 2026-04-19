package com.meroshare.backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-CBC encryption utility for storing Meroshare passwords and PINs.
 *
 * Key derivation: SHA-256 of the JWT secret → always produces a valid 32-byte
 * AES-256 key regardless of the secret's length or character set.
 * This replaces the old `substring(0, 32)` approach which:
 *   (a) failed if the secret was shorter than 32 characters, and
 *   (b) produced a low-entropy key if the secret was a short passphrase.
 *
 * Wire format for NEW encryptions:
 *   "CBC:" + Base64(IV[16] + ciphertext)
 *
 * Legacy ECB format (no prefix, plain Base64) is still decryptable as a
 * migration path — once a user re-adds their account it will be re-encrypted
 * in the new format.
 *
 * IMPORTANT: If you change the JWT secret, all stored passwords and PINs
 * become unreadable. Users will need to re-add their Meroshare accounts.
 * Consider using a dedicated, stable encryption key in production.
 */
@Slf4j
@Component
public class EncryptionUtil {

    private static final int IV_LENGTH = 16;
    private static final String CBC_PREFIX = "CBC:";
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final String ECB_ALGORITHM = "AES/ECB/PKCS5Padding";

    @Value("${app.jwt.secret}")
    private String secretKey;

    /**
     * Derives a stable 32-byte AES-256 key from the JWT secret using SHA-256.
     * This works correctly regardless of the secret's length.
     */
    private SecretKeySpec buildKey() {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(secretKey.trim().getBytes(StandardCharsets.UTF_8));
            // SHA-256 always produces exactly 32 bytes — perfect for AES-256
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive AES key: " + e.getMessage(), e);
        }
    }

    /**
     * Encrypts using AES-256-CBC with a random IV.
     * Output: "CBC:" + Base64(IV[16] + ciphertext)
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            throw new IllegalArgumentException("Cannot encrypt null or blank text");
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, buildKey(), new IvParameterSpec(iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

            return CBC_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed: " + e.getMessage(), e);
        }
    }

    /**
     * Decrypts a value encrypted by {@link #encrypt(String)} (CBC: prefix)
     * or by the legacy ECB code (no prefix).
     *
     * Throws RuntimeException if decryption fails or produces an empty string —
     * an empty decrypted password must never be silently used.
     */
    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank()) {
            throw new RuntimeException("Cannot decrypt: encrypted text is null or blank");
        }

        // ── New CBC format ────────────────────────────────────────────────────
        if (encryptedText.startsWith(CBC_PREFIX)) {
            String base64Part = encryptedText.substring(CBC_PREFIX.length());
            String result = decryptCBC(base64Part);
            if (result.isEmpty()) {
                throw new RuntimeException(
                        "Decryption produced an empty string — the stored value may be corrupted. " +
                        "Please re-add the Meroshare account.");
            }
            return result;
        }

        // ── Legacy ECB format ─────────────────────────────────────────────────
        // Try ECB first (original format; short passwords ≤ 16 bytes produce
        // exactly 16 raw bytes = 24-char Base64 with no IV overhead)
        try {
            String result = decryptECB(encryptedText);
            if (!result.isEmpty()) {
                log.debug("[DECRYPT] Decrypted using legacy ECB path — consider re-adding this account");
                return result;
            }
            log.warn("[DECRYPT] ECB returned empty string, trying legacy CBC fallback");
        } catch (Exception ecbEx) {
            log.debug("[DECRYPT] ECB failed ({}), trying legacy CBC", ecbEx.getMessage());
        }

        // ── Legacy CBC without prefix (defensive — shouldn't normally exist) ──
        try {
            String result = decryptCBC(encryptedText);
            if (!result.isEmpty()) {
                log.debug("[DECRYPT] Decrypted using legacy CBC (no prefix) path");
                return result;
            }
        } catch (Exception cbcEx) {
            log.debug("[DECRYPT] Legacy CBC also failed: {}", cbcEx.getMessage());
        }

        throw new RuntimeException(
                "Decryption failed: unable to decrypt with any supported format. " +
                "The stored value may be corrupted or encrypted with a different key. " +
                "Please remove and re-add the Meroshare account.");
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private String decryptCBC(String base64Data) {
        try {
            byte[] combined = Base64.getDecoder().decode(base64Data);
            if (combined.length <= IV_LENGTH) {
                throw new IllegalArgumentException(
                        "Data too short for CBC — only " + combined.length + " bytes (need >" + IV_LENGTH + ")");
            }
            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            System.arraycopy(combined, IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, buildKey(), new IvParameterSpec(iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("CBC decryption failed: " + e.getMessage(), e);
        }
    }

    private String decryptECB(String base64Data) {
        try {
            Cipher cipher = Cipher.getInstance(ECB_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, buildKey());
            byte[] decoded = Base64.getDecoder().decode(base64Data);
            return new String(cipher.doFinal(decoded), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("ECB decryption failed: " + e.getMessage(), e);
        }
    }
}