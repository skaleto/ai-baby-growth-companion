package com.xiaobao.babycompanion.dto.app;

public record MobileUpdateCheckResponse(
        boolean enabled,
        boolean updateAvailable,
        String version,
        String url,
        String checksum,
        String minNativeVersion,
        String message
) {

    public static MobileUpdateCheckResponse disabled(String message) {
        return new MobileUpdateCheckResponse(false, false, null, null, null, null, message);
    }

    public static MobileUpdateCheckResponse upToDate(String version, String message) {
        return new MobileUpdateCheckResponse(true, false, version, null, null, null, message);
    }
}
