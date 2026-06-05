package com.xiaobao.babycompanion.dto.auth;

/**
 * 家庭成员管理视图（REQ-AUTH，R1）。maskedPhone 已脱敏（REQ-AUTH-004）；
 * self 标记当前登录用户，前端据此禁用"移除自己/撤销自己权限"。
 */
public record FamilyMemberDto(
        String userId,
        String roleName,
        boolean caregiver,
        String maskedPhone,
        String lastSeenAt,
        boolean self
) {
}
