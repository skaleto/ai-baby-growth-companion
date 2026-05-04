package com.xiaobao.babycompanion.auth;

import com.xiaobao.babycompanion.exception.ForbiddenException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {

    public String requireUserId() {
        return requirePrincipal().userId();
    }

    public String requireFamilyId() {
        return requirePrincipal().familyId();
    }

    public void requireCaregiver() {
        if (!requirePrincipal().caregiver()) {
            throw new ForbiddenException("当前身份仅可查看，不能记录或修改。");
        }
    }

    public AuthPrincipal requirePrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new IllegalStateException("AUTH_REQUIRED");
        }
        return principal;
    }
}
