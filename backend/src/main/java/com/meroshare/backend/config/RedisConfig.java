package com.meroshare.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.SslOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableCaching
public class RedisConfig {

    public static final String CACHE_CDSC_STATIC = "cdscStatic";

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.username:default}")
    private String redisUsername;

    @Value("${spring.data.redis.password:}")
    private String redisPassword;

    @Value("${spring.data.redis.ssl.enabled:false}")
    private boolean sslEnabled;

    @Value("${cache.nepse.live-ttl-seconds:10}")
    private long liveTtlSeconds;

    @Value("${cache.cdsc.static-ttl-hours:24}")
    private long staticTtlHours;

    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        RedisStandaloneConfiguration redisConfig = new RedisStandaloneConfiguration(redisHost, redisPort);

        // Explicitly set BOTH username and password for Upstash ACL support
        if (redisUsername != null && !redisUsername.isBlank()) {
            redisConfig.setUsername(redisUsername);
        }
        if (redisPassword != null && !redisPassword.isBlank()) {
            redisConfig.setPassword(RedisPassword.of(redisPassword));
        }

        SocketOptions socketOptions = SocketOptions.builder()
                .connectTimeout(Duration.ofSeconds(15))
                .keepAlive(true)
                .build();

        SslOptions sslOptions = SslOptions.builder()
                .jdkSslProvider()
                .build();

        ClientOptions clientOptions = ClientOptions.builder()
                .socketOptions(socketOptions)
                .sslOptions(sslOptions)
                .build();

        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder = LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(15))
                .clientOptions(clientOptions);

        if (sslEnabled) {
            builder.useSsl();
        }

        return new LettuceConnectionFactory(redisConfig, builder.build());
    }

    private ObjectMapper redisObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    private RedisSerializer<Object> jsonValueSerializer() {
        return new Jackson2JsonRedisSerializer<>(redisObjectMapper(), Object.class);
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(factory);
        // Explicitly enforce raw String serialization (NO JSON QUOTES)
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(jsonValueSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(jsonValueSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public ReactiveRedisTemplate<String, Object> reactiveRedisTemplate(
            ReactiveRedisConnectionFactory factory) {
        RedisSerializer<Object> valueSerializer = jsonValueSerializer();
        RedisSerializationContext<String, Object> context = RedisSerializationContext
                .<String, Object>newSerializationContext(new StringRedisSerializer())
                .value(valueSerializer)
                .hashValue(valueSerializer)
                .build();
        return new ReactiveRedisTemplate<>(factory, context);
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(liveTtlSeconds))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(jsonValueSerializer()))
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> perCacheConfig = new HashMap<>();
        perCacheConfig.put(CACHE_CDSC_STATIC, defaultConfig.entryTtl(Duration.ofHours(staticTtlHours)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(perCacheConfig)
                .build();
    }
}