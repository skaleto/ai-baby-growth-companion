package com.xiaobao.babycompanion.dto.auth;

import java.util.List;

/** 家庭成员列表。canManage = 当前用户是否 caregiver（可踢人/撤权/重置邀请码）。 */
public record FamilyMembersResponse(
        List<FamilyMemberDto> members,
        boolean canManage
) {
}
