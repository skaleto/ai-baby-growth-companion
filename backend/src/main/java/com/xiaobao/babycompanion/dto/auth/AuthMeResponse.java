package com.xiaobao.babycompanion.dto.auth;

public record AuthMeResponse(
        AuthUserDto user,
        AuthFamilyDto family,
        AuthMemberDto member,
        boolean authenticated,
        boolean onboardingRequired
) {
}
