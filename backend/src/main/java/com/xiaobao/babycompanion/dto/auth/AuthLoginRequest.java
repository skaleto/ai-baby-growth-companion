package com.xiaobao.babycompanion.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record AuthLoginRequest(
        @NotBlank String phone,
        @NotBlank String inviteCode,
        String roleName,
        Boolean caregiver
) {
}
