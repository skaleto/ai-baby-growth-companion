package com.xiaobao.babycompanion.dto.auth;

import java.util.List;

public record AuthInviteRolesResponse(
        String familyName,
        List<String> occupiedRoles,
        List<String> uniqueRoles,
        List<String> repeatableRoles,
        boolean existingMember,
        AuthMemberDto member
) {
}
