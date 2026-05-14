package com.xiaobao.babycompanion.dto.pro;

public record MissingItemDto(
        String id,
        String type,
        String scope,
        String title,
        String message,
        String action
) {
}
