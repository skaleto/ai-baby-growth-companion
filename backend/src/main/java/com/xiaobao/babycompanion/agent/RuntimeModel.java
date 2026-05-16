package com.xiaobao.babycompanion.agent;

import java.time.Duration;

record RuntimeModel(
        String id,
        Provider provider,
        String apiModel,
        boolean supportsImageInput,
        boolean supportsVideoInput,
        boolean lowLatencyEnabled,
        String baseUrl,
        String chatPath,
        Duration readTimeout,
        String apiKeyHelp
) {
}
