package com.meroshare.backend.service.nepse;

import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import javax.net.ssl.SSLException;

/**
 * Builds a WebClient with TLS verification disabled for nepalstock.com.
 * NEPSE uses a self-signed / non-standard certificate chain that Java's
 * default truststore rejects — mirroring the Python lib's setTLSVerification(False).
 */
public class NepseHttpClientFactory {

    private static final String BASE_URL = "https://www.nepalstock.com";

    public static WebClient create() {
        try {
            SslContext sslContext = SslContextBuilder.forClient()
                    .trustManager(InsecureTrustManagerFactory.INSTANCE)
                    .build();

            HttpClient httpClient = HttpClient.create()
                    .secure(spec -> spec.sslContext(sslContext));

            return WebClient.builder()
                    .baseUrl(BASE_URL)
                    .clientConnector(new ReactorClientHttpConnector(httpClient))
                    .defaultHeader("User-Agent", "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0")
                    .defaultHeader("Accept", "application/json, text/plain, */*")
                    .defaultHeader("Accept-Language", "en-US,en;q=0.5")
                    .defaultHeader("Connection", "close")
                    .defaultHeader("Pragma", "no-cache")
                    .defaultHeader("Cache-Control", "no-cache")
                    .defaultHeader("Referer", "nepalstock.com")
                    .defaultHeader("Host", "www.nepalstock.com")
                    .build();

        } catch (SSLException e) {
            throw new RuntimeException("Failed to create NEPSE SSL context", e);
        }
    }
}