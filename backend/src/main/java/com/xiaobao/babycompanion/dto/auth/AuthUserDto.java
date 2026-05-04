package com.xiaobao.babycompanion.dto.auth;

public record AuthUserDto(
        String id,
        String phone,
        String createdAt,
        String lastLoginAt
) {
}
