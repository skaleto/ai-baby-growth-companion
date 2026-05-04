package com.xiaobao.babycompanion.auth;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.AuthProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class JwtService {

    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final AuthProperties properties;
    private final ObjectMapper objectMapper;
    private final byte[] secret;

    public JwtService(AuthProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.secret = loadOrCreateSecret(properties.getJwt().getSecretFile());
    }

    public String issue(String userId, String phone, String sessionId) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.getJwt().getTtl());
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("sub", userId);
        claims.put("phone", phone);
        claims.put("sid", sessionId);
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", expiresAt.getEpochSecond());

        String unsigned = encodeJson(header) + "." + encodeJson(claims);
        return unsigned + "." + sign(unsigned);
    }

    public JwtClaims verify(String token) {
        if (!StringUtils.hasText(token)) {
            throw new IllegalArgumentException("登录已失效，请重新登录。");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("登录已失效，请重新登录。");
        }
        String unsigned = parts[0] + "." + parts[1];
        if (!constantTimeEquals(parts[2], sign(unsigned))) {
            throw new IllegalArgumentException("登录已失效，请重新登录。");
        }
        try {
            Map<String, Object> claims = objectMapper.readValue(URL_DECODER.decode(parts[1]), new TypeReference<>() {});
            long exp = ((Number) claims.getOrDefault("exp", 0)).longValue();
            if (Instant.now().getEpochSecond() >= exp) {
                throw new IllegalArgumentException("登录已过期，请重新登录。");
            }
            String userId = stringClaim(claims, "sub");
            String phone = stringClaim(claims, "phone");
            String sessionId = stringClaim(claims, "sid");
            if (!StringUtils.hasText(userId) || !StringUtils.hasText(sessionId)) {
                throw new IllegalArgumentException("登录已失效，请重新登录。");
            }
            return new JwtClaims(userId, phone, sessionId, Instant.ofEpochSecond(exp));
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("登录已失效，请重新登录。", exception);
        }
    }

    private String encodeJson(Object value) {
        try {
            return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to encode token", exception);
        }
    }

    private String sign(String unsigned) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return URL_ENCODER.encodeToString(mac.doFinal(unsigned.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign token", exception);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        return MessageDigestHelper.equals(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    private String stringClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        return value instanceof String text ? text : "";
    }

    private byte[] loadOrCreateSecret(String secretFile) {
        try {
            Path path = Path.of(secretFile).toAbsolutePath().normalize();
            if (Files.exists(path)) {
                String text = Files.readString(path).trim();
                if (StringUtils.hasText(text)) return text.getBytes(StandardCharsets.UTF_8);
            }
            Files.createDirectories(path.getParent());
            byte[] bytes = new byte[48];
            new SecureRandom().nextBytes(bytes);
            String secretText = HexFormat.of().formatHex(bytes);
            Files.writeString(path, secretText, StandardCharsets.UTF_8);
            return secretText.getBytes(StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to load auth JWT secret", exception);
        }
    }

    public record JwtClaims(String userId, String phone, String sessionId, Instant expiresAt) {
    }

    private static final class MessageDigestHelper {
        private static boolean equals(byte[] left, byte[] right) {
            if (left.length != right.length) return false;
            int result = 0;
            for (int index = 0; index < left.length; index += 1) {
                result |= left[index] ^ right[index];
            }
            return result == 0;
        }
    }
}
