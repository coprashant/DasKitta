package com.meroshare.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class EmailServiceClient {

    @Value("${email.service.url}")
    private String emailServiceUrl;

    @Value("${email.service.api-key}")
    private String apiKey;

    @Value("${email.service.account}")
    private String defaultAccount;

    private final RestTemplate restTemplate = new RestTemplate();

    // Primary send method using the configured default account
    public void sendEmail(String to, String subject, String textBody, String htmlBody, String senderName) {
        sendEmail(this.defaultAccount, to, subject, textBody, htmlBody, senderName);
    }

    // Overloaded method allowing explicit account targeting
    public void sendEmail(String accountKey, String to, String subject, String textBody, String htmlBody, String senderName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);

        Map<String, String> requestBody = new HashMap<>();
        if (accountKey != null && !accountKey.trim().isEmpty()) {
            requestBody.put("account", accountKey);
        }
        requestBody.put("to", to);
        requestBody.put("subject", subject);
        requestBody.put("body", textBody);
        requestBody.put("html", htmlBody);
        requestBody.put("senderName", senderName);

        HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

        try {
            restTemplate.postForEntity(emailServiceUrl, request, String.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send email via microservice: " + e.getMessage(), e);
        }
    }
}