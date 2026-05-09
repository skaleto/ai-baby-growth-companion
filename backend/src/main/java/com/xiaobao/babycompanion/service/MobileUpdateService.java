package com.xiaobao.babycompanion.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.config.MobileUpdateProperties;
import com.xiaobao.babycompanion.dto.app.MobileUpdateCheckRequest;
import com.xiaobao.babycompanion.dto.app.MobileUpdateCheckResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@Service
public class MobileUpdateService {

    private final Path updateRoot;
    private final MobileUpdateProperties properties;
    private final ObjectMapper objectMapper;

    public MobileUpdateService(Path appDataDir, MobileUpdateProperties properties, ObjectMapper objectMapper) throws IOException {
        this.updateRoot = appDataDir.resolve(safeRelativeDirectory(properties.getDirectory())).normalize();
        this.properties = properties;
        this.objectMapper = objectMapper;
        Files.createDirectories(bundleRoot());
    }

    public MobileUpdateCheckResponse checkForUpdate(MobileUpdateCheckRequest request, HttpServletRequest servletRequest) {
        if (!properties.isEnabled()) {
            return MobileUpdateCheckResponse.disabled("移动端热更新已关闭。");
        }

        Manifest manifest = readManifest();
        if (manifest == null || !manifest.enabled()) {
            return MobileUpdateCheckResponse.disabled("暂无可用移动端热更新。");
        }

        if (!StringUtils.hasText(manifest.version()) || !StringUtils.hasText(manifest.fileName())) {
            return MobileUpdateCheckResponse.disabled("移动端热更新清单不完整。");
        }

        if (StringUtils.hasText(manifest.minNativeVersion())
                && StringUtils.hasText(request.nativeVersion())
                && compareVersions(request.nativeVersion(), manifest.minNativeVersion()) < 0) {
            return new MobileUpdateCheckResponse(
                    true,
                    false,
                    manifest.version(),
                    null,
                    null,
                    manifest.minNativeVersion(),
                    "当前安装包版本过低，需要重新安装新版 App 后才能使用热更新。"
            );
        }

        String currentVersion = normalizedVersion(request.currentBundleVersion());
        if (Objects.equals(currentVersion, normalizedVersion(manifest.version()))) {
            return MobileUpdateCheckResponse.upToDate(manifest.version(), "当前已是最新移动端资源。");
        }

        Path bundleFile = resolveBundleFile(manifest.fileName());
        if (!Files.isReadable(bundleFile)) {
            return MobileUpdateCheckResponse.disabled("移动端热更新包不存在或不可读。");
        }

        String url = StringUtils.hasText(manifest.url())
                ? manifest.url().trim()
                : buildBundleUrl(servletRequest, manifest.fileName());

        return new MobileUpdateCheckResponse(
                true,
                true,
                manifest.version(),
                url,
                emptyToNull(manifest.checksum()),
                emptyToNull(manifest.minNativeVersion()),
                emptyToNull(manifest.message())
        );
    }

    public Resource bundleResource(String fileName) {
        try {
            Path bundleFile = resolveBundleFile(fileName);
            Resource resource = new UrlResource(bundleFile.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Mobile update bundle not found: " + fileName);
            }
            return resource;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load mobile update bundle", exception);
        }
    }

    public Path bundlePath(String fileName) {
        return resolveBundleFile(fileName);
    }

    private Manifest readManifest() {
        Path manifestPath = updateRoot.resolve("manifest.json").normalize();
        if (!manifestPath.startsWith(updateRoot) || !Files.isReadable(manifestPath)) {
            return null;
        }
        try {
            return objectMapper.readValue(manifestPath.toFile(), Manifest.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read mobile update manifest", exception);
        }
    }

    private Path bundleRoot() {
        return updateRoot.resolve("bundles").normalize();
    }

    private Path resolveBundleFile(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            throw new IllegalArgumentException("Mobile update bundle file name is required");
        }
        Path bundleFile = bundleRoot().resolve(fileName).normalize();
        if (!bundleFile.startsWith(bundleRoot())) {
            throw new IllegalArgumentException("Invalid mobile update bundle file name");
        }
        return bundleFile;
    }

    private String buildBundleUrl(HttpServletRequest request, String fileName) {
        String base = StringUtils.hasText(properties.getPublicBaseUrl())
                ? properties.getPublicBaseUrl().trim()
                : ServletUriComponentsBuilder.fromRequestUri(request)
                        .replacePath(null)
                        .replaceQuery(null)
                        .build()
                        .toUriString();
        return trimTrailingSlash(base) + "/api/mobile-updates/bundles/" + fileName;
    }

    private static String safeRelativeDirectory(String value) {
        String next = StringUtils.hasText(value) ? value.trim() : "mobile-updates";
        Path relative = Path.of(next).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) {
            throw new IllegalArgumentException("app.mobile-updates.directory must be a relative directory name");
        }
        return relative.toString();
    }

    private static String trimTrailingSlash(String value) {
        return value.replaceAll("/+$", "");
    }

    private static String emptyToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String normalizedVersion(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private static int compareVersions(String left, String right) {
        String[] leftParts = left.split("[^0-9]+");
        String[] rightParts = right.split("[^0-9]+");
        int length = Math.max(leftParts.length, rightParts.length);
        for (int index = 0; index < length; index++) {
            int leftValue = partValue(leftParts, index);
            int rightValue = partValue(rightParts, index);
            if (leftValue != rightValue) {
                return Integer.compare(leftValue, rightValue);
            }
        }
        return 0;
    }

    private static int partValue(String[] parts, int index) {
        if (index >= parts.length || !StringUtils.hasText(parts[index])) return 0;
        try {
            return Integer.parseInt(parts[index]);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Manifest(
            boolean enabled,
            String version,
            String fileName,
            String url,
            String checksum,
            String minNativeVersion,
            String message
    ) {
    }
}
