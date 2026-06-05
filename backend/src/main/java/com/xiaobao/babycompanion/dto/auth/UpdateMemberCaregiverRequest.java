package com.xiaobao.babycompanion.dto.auth;

import jakarta.validation.constraints.NotNull;

/** 调整某成员的照护权限（true=照护人可记录修改, false=仅查看）。 */
public record UpdateMemberCaregiverRequest(
        @NotNull Boolean caregiver
) {
}
