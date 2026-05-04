package com.xiaobao.babycompanion.dto.auth;

public record AuthLoginResponse(
        String accessToken,
        AuthUserDto user,
        AuthFamilyDto family,
        AuthMemberDto member,
        boolean onboardingRequired,
        boolean legacyImportAllowed
) {
}
