package com.xiaobao.babycompanion.agent;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Model-facing context harness. The human-editable source lives in
 * {@code harness/agent-model-context-harness.md}; the classpath copy is baked
 * into the backend JAR so ECS can load the same rules without depending on repo
 * files being present next to the service.
 */
public final class AgentModelContextHarness {

    private static final String HARNESS_RESOURCE = "/agent/model-context-harness.md";
    private static final byte[] RAW_BYTES = loadBytes();
    private static final String PROMPT_BLOCK = new String(RAW_BYTES, StandardCharsets.UTF_8).trim();
    private static final String VERSION = extractVersion(PROMPT_BLOCK);
    private static final String SHA256 = sha256Hex(RAW_BYTES);

    private AgentModelContextHarness() {
    }

    public static String promptBlock() {
        return PROMPT_BLOCK;
    }

    public static String resourcePath() {
        return HARNESS_RESOURCE;
    }

    public static String version() {
        return VERSION;
    }

    public static String sha256() {
        return SHA256;
    }

    public static int length() {
        return RAW_BYTES.length;
    }

    private static byte[] loadBytes() {
        try (InputStream input = AgentModelContextHarness.class.getResourceAsStream(HARNESS_RESOURCE)) {
            if (input == null) {
                throw new IllegalStateException("Model context harness not found on classpath: " + HARNESS_RESOURCE);
            }
            return input.readAllBytes();
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to load model context harness", exception);
        }
    }

    private static String extractVersion(String value) {
        for (String line : value.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("版本：")) {
                return trimmed.substring("版本：".length()).trim();
            }
        }
        return "unknown";
    }

    private static String sha256Hex(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to hash model context harness", exception);
        }
    }
}
