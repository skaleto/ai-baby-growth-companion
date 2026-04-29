package com.xiaobao.babycompanion.dto;

import java.time.Instant;

public record ChatResponse(
        String reply,
        String model,
        String requestId,
        Instant createdAt
) {
}
