package com.xiaobao.babycompanion.dto.auth;

/** 重置家庭邀请码后返回的新明文码（仅此一次展示，旧码已作废）。 */
public record ResetInviteCodeResponse(
        String inviteCode
) {
}
