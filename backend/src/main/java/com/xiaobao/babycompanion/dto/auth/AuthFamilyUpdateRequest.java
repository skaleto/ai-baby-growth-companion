package com.xiaobao.babycompanion.dto.auth;

import jakarta.validation.constraints.Size;

public record AuthFamilyUpdateRequest(
        @Size(max = 60, message = "family name must be at most 60 characters")
        String name
) {
}
