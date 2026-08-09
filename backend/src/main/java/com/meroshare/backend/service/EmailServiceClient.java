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

    @Value("${email.service.url:https://otp-by-email.onrender.com/api/v1/send-email}")
    private String emailServiceUrl;

    @Value("${email.service.api-key:my_super_secret_otp_key_12345}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public void sendEmail(String to, String subject, String body, String senderName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);

        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("to", to);
        requestBody.put("subject", subject);
        requestBody.put("body", body);
        requestBody.put("senderName", senderName);

        HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

        try {
            restTemplate.postForEntity(emailServiceUrl, request, String.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send email via microservice: " + e.getMessage(), e);
        }
    }
}