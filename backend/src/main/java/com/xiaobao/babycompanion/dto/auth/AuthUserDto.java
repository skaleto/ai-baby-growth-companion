package com.xiaobao.babycompanion.dto.auth;

/**
 * Client-facing auth user view. Per REQ-AUTH-004 this DTO never carries a full phone number:
 * both {@code phone} and {@code maskedPhone} hold the masked form (e.g. {@code 138****8888}).
 * The full number stays server-side on {@code AuthUserRecord}/{@code AuthPrincipal} and is only
 * used internally (login credential, JWT subject, Pro trial contact persistence).
 */
public record AuthUserDto(
        String id,
        String phone,
        String maskedPhone,
        String createdAt,
        String lastLoginAt
) {
}
