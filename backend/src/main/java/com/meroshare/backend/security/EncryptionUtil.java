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

/*
 AES 256 CBC encryption for stored Meroshare passwords and PINs.

 There are two keys. The primary key comes from app.encryption.secret
 and is used for all new encryption. The legacy key comes from
 app.jwt.secret, this used to double as the encryption key before the
 two secrets were split apart. Old rows were encrypted with the legacy
 key so decrypt still tries it as a fallback, this means existing user
 data keeps working with no manual migration and no downtime.

 decryptDetailed tells the caller which key actually worked, callers
 that touch a row during normal use can reencrypt it under the primary
 key at that point, so data moves to the new key over time on its own.
*/
@Slf4j
@Component
public class EncryptionUtil {

    private static final int IV_LENGTH = 16;
    private static final String CBC_PREFIX = "CBC:";
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final String ECB_ALGORITHM = "AES/ECB/PKCS5Padding";

    @Value("${app.encryption.secret}")
    private String primarySecret;

    @Value("${app.jwt.secret}")
    private String legacySecret;

    public record DecryptResult(String plainText, boolean legacyKey) {}

    private SecretKeySpec deriveKey(String secret) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(secret.trim().getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive AES key " + e.getMessage(), e);
        }
    }

    private SecretKeySpec primaryKey() {
        return deriveKey(primarySecret);
    }

    private SecretKeySpec legacyKey() {
        return deriveKey(legacySecret);
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            throw new IllegalArgumentException("Cannot encrypt null or blank text");
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, primaryKey(), new IvParameterSpec(iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

            return CBC_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed " + e.getMessage(), e);
        }
    }

    /*
     Plain decrypt for callers that only need the value, most call sites
     use this. It tries the primary key first then the legacy key.
    */
    public String decrypt(String encryptedText) {
        return decryptDetailed(encryptedText).plainText();
    }

    /*
     Same as decrypt but also reports whether the legacy key was needed,
     use this where you can reencrypt the value once you have it.
    */
    public DecryptResult decryptDetailed(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank()) {
            throw new RuntimeException("Cannot decrypt encrypted text is null or blank");
        }

        if (encryptedText.startsWith(CBC_PREFIX)) {
            String base64Part = encryptedText.substring(CBC_PREFIX.length());

            try {
                String result = decryptCBC(base64Part, primaryKey());
                if (!result.isEmpty()) {
                    return new DecryptResult(result, false);
                }
            } catch (Exception e) {
                log.debug("Primary key CBC decrypt failed, trying legacy key");
            }

            try {
                String result = decryptCBC(base64Part, legacyKey());
                if (!result.isEmpty()) {
                    log.debug("Decrypted with legacy key, value should be reencrypted");
                    return new DecryptResult(result, true);
                }
            } catch (Exception e) {
                log.debug("Legacy key CBC decrypt also failed {}", e.getMessage());
            }

            throw new RuntimeException(
                    "Decryption produced an empty string, the stored value may be corrupted. " +
                    "Please re-add the Meroshare account.");
        }

        try {
            String result = decryptECB(encryptedText, legacyKey());
            if (!result.isEmpty()) {
                log.debug("Decrypted using legacy ECB format, value should be reencrypted");
                return new DecryptResult(result, true);
            }
        } catch (Exception ecbEx) {
            log.debug("ECB failed {}, trying legacy CBC with no prefix", ecbEx.getMessage());
        }

        try {
            String result = decryptCBC(encryptedText, legacyKey());
            if (!result.isEmpty()) {
                log.debug("Decrypted using legacy CBC with no prefix");
                return new DecryptResult(result, true);
            }
        } catch (Exception cbcEx) {
            log.debug("Legacy CBC with no prefix also failed {}", cbcEx.getMessage());
        }

        throw new RuntimeException(
                "Decryption failed, unable to decrypt with any supported format or key. " +
                "The stored value may be corrupted. " +
                "Please remove and re-add the Meroshare account.");
    }

    private String decryptCBC(String base64Data, SecretKeySpec key) {
        try {
            byte[] combined = Base64.getDecoder().decode(base64Data);
            if (combined.length <= IV_LENGTH) {
                throw new IllegalArgumentException(
                        "Data too short for CBC only " + combined.length + " bytes need more than " + IV_LENGTH);
            }
            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            System.arraycopy(combined, IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("CBC decryption failed " + e.getMessage(), e);
        }
    }

    private String decryptECB(String base64Data, SecretKeySpec key) {
        try {
            Cipher cipher = Cipher.getInstance(ECB_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key);
            byte[] decoded = Base64.getDecoder().decode(base64Data);
            return new String(cipher.doFinal(decoded), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("ECB decryption failed " + e.getMessage(), e);
        }
    }
}
