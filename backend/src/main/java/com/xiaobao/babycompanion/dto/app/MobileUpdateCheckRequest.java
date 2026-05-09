package com.xiaobao.babycompanion.dto.app;

public record MobileUpdateCheckRequest(
        String appId,
        String platform,
        String nativeVersion,
        String currentBundleId,
        String currentBundleVersion
) {
}
