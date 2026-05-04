package com.xiaobao.babycompanion.auth;

public record AuthPrincipal(
        String userId,
        String phone,
        String sessionId,
        String familyId,
        String familyName,
        String roleName,
        boolean caregiver
) {
}
