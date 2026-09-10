package com.meroshare.backend.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
public class VapidConfig {

    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public VapidConfig(
            @Value("${vapid.public.key:${VAPID_PUBLIC_KEY:}}") String publicKey,
            @Value("${vapid.private.key:${VAPID_PRIVATE_KEY:}}") String privateKey,
            @Value("${vapid.subject:${VAPID_SUBJECT:}}") String subject
    ) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }
}