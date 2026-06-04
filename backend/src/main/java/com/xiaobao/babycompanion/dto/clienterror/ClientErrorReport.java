package com.xiaobao.babycompanion.dto.clienterror;

public record ClientErrorReport(
        String kind,
        String message,
        String page,
        String appVersion,
        String bundleVersion,
        String deviceInfo
) {
}
