package com.meroshare.backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES encryption utility for storing Meroshare passwords and PINs.
 *
 * Format used for NEW encryptions:
 *   "CBC:" + Base64(IV[16] + ciphertext)
 *
 * Legacy ECB format (from before this fix) is still decryptable:
 *   plain Base64 with no prefix
 *
 * Root cause of the previous empty-password bug:
 *   - Old code stored passwords as raw ECB Base64 (16 bytes for short passwords)
 *   - New decrypt() tried CBC first: treated all 16 bytes as the IV, leaving
 *     0 bytes of ciphertext → cipher.doFinal(new byte[0]) = "" (no exception!)
 *   - ECB fallback was never reached
 *   - Result: empty string passed to Meroshare API → "Password cannot be empty"
 *
 * Fix: new encryptions are prefixed with "CBC:" so the format is unambiguous.
 *      Decrypt checks the prefix to decide which path to take.
 */
@Slf4j
@Component
public class EncryptionUtil {

    private static final int IV_LENGTH = 16;
    private static final String CBC_PREFIX = "CBC:";

    @Value("${app.jwt.secret}")
    private String secretKey;

    private SecretKeySpec buildKey() {
        // Trim to handle any leading/trailing whitespace in the property value,
        // then take exactly 32 bytes for AES-256.
        String trimmed = secretKey.trim();
        if (trimmed.length() < 32) {
            throw new IllegalStateException(
                "JWT secret is too short to derive an AES-256 key (need ≥32 chars after trimming)");
        }
        return new SecretKeySpec(trimmed.substring(0, 32).getBytes(), "AES");
    }

    /**
     * Encrypts using AES-256-CBC with a random IV.
     * Output: "CBC:" + Base64(IV + ciphertext)
     */
    public String encrypt(String plainText) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, buildKey(), new IvParameterSpec(iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes("UTF-8"));

            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

            return CBC_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed: " + e.getMessage(), e);
        }
    }

    /**
     * Decrypts a value that was encrypted by {@link #encrypt} (CBC prefix)
     * OR by the old ECB code (no prefix, legacy fallback).
     *
     * Throws RuntimeException if decryption fails or produces an empty result —
     * an empty decrypted password is always a bug and should never be silently
     * used to call the Meroshare API.
     */
    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank()) {
            throw new RuntimeException("Cannot decrypt: encrypted text is null or blank");
        }

        // ── New CBC format ────────────────────────────────────────────────────
        if (encryptedText.startsWith(CBC_PREFIX)) {
            String base64Part = encryptedText.substring(CBC_PREFIX.length());
            return decryptCBC(base64Part, "stored CBC");
        }

        // ── Legacy: try ECB first (original format for short passwords ≤ 16B) ─
        // ECB-encrypted 16-byte-block passwords produce exactly 16 raw bytes
        // → 24-character Base64. Try ECB first to avoid the "all-bytes-as-IV" trap.
        try {
            String result = decryptECB(encryptedText);
            if (!result.isEmpty()) {
                log.debug("[DECRYPT] Decrypted using legacy ECB path");
                return result;
            }
            // ECB gave empty result — not a valid decryption
            log.warn("[DECRYPT] ECB returned empty string, trying CBC fallback");
        } catch (Exception ecbEx) {
            log.debug("[DECRYPT] ECB failed ({}), trying CBC fallback", ecbEx.getMessage());
        }

        // ── Legacy: try CBC without prefix (shouldn't normally exist, but defensive) ─
        try {
            String result = decryptCBC(encryptedText, "legacy CBC");
            if (!result.isEmpty()) {
                return result;
            }
        } catch (Exception cbcEx) {
            log.debug("[DECRYPT] CBC fallback also failed: {}", cbcEx.getMessage());
        }

        throw new RuntimeException(
            "Decryption failed: unable to decrypt with any supported format. " +
            "The stored password may be corrupted or encrypted with a different key. " +
            "Please re-add the Meroshare account.");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String decryptCBC(String base64Data, String context) {
        try {
            byte[] combined = Base64.getDecoder().decode(base64Data);
            if (combined.length <= IV_LENGTH) {
                throw new IllegalArgumentException(
                    "Ciphertext too short for CBC (" + combined.length + " bytes)");
            }
            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            System.arraycopy(combined, IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, buildKey(), new IvParameterSpec(iv));
            return new String(cipher.doFinal(ciphertext), "UTF-8");
        } catch (Exception e) {
            throw new RuntimeException("CBC decrypt failed [" + context + "]: " + e.getMessage(), e);
        }
    }

    private String decryptECB(String base64Data) {
        try {
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, buildKey());
            byte[] decoded = Base64.getDecoder().decode(base64Data);
            return new String(cipher.doFinal(decoded), "UTF-8");
        } catch (Exception e) {
            throw new RuntimeException("ECB decrypt failed: " + e.getMessage(), e);
        }
    }
}