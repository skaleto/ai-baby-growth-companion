package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.AuthService;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.auth.AuthInviteRolesResponse;
import com.xiaobao.babycompanion.dto.auth.AuthFamilyDto;
import com.xiaobao.babycompanion.dto.auth.AuthFamilyUpdateRequest;
import com.xiaobao.babycompanion.dto.auth.AuthLoginRequest;
import com.xiaobao.babycompanion.dto.auth.AuthLoginResponse;
import com.xiaobao.babycompanion.dto.auth.AuthMeResponse;
import com.xiaobao.babycompanion.dto.auth.FamilyMemberDto;
import com.xiaobao.babycompanion.dto.auth.FamilyMembersResponse;
import com.xiaobao.babycompanion.dto.auth.ResetInviteCodeResponse;
import com.xiaobao.babycompanion.dto.auth.UpdateMemberCaregiverRequest;
import com.xiaobao.babycompanion.service.AppStateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final AppStateService appStateService;

    public AuthController(AuthService authService, CurrentUser currentUser, AppStateService appStateService) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.appStateService = appStateService;
    }

    @PostMapping("/login")
    public AuthLoginResponse login(@Valid @RequestBody AuthLoginRequest request, HttpServletRequest httpRequest) {
        return authService.login(request.phone(), request.inviteCode(), request.roleName(), request.caregiver(), remoteKey(httpRequest));
    }

    @GetMapping("/invite/roles")
    public AuthInviteRolesResponse inviteRoles(
            @RequestParam String inviteCode,
            @RequestParam(required = false) String phone
    ) {
        return authService.inviteRoles(inviteCode, phone);
    }

    @GetMapping("/me")
    public AuthMeResponse me() {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return new AuthMeResponse(
                authService.currentUser(principal),
                authService.currentFamily(principal),
                authService.currentMember(principal),
                true,
                appStateService.isOnboardingRequired(principal.familyId())
        );
    }

    @PutMapping("/family")
    public AuthFamilyDto updateFamily(@Valid @RequestBody AuthFamilyUpdateRequest request) {
        return authService.updateFamilyName(currentUser.requirePrincipal(), request.name());
    }

    @PostMapping("/refresh")
    public AuthLoginResponse refresh() {
        return authService.refresh(currentUser.requirePrincipal());
    }

    @PostMapping("/logout")
    public void logout() {
        authService.logout(currentUser.requirePrincipal().sessionId());
    }

    @GetMapping("/family/members")
    public FamilyMembersResponse familyMembers() {
        return authService.listFamilyMembers(currentUser.requirePrincipal());
    }

    @DeleteMapping("/family/members/{userId}")
    public void removeFamilyMember(@PathVariable String userId) {
        authService.removeFamilyMember(currentUser.requirePrincipal(), userId);
    }

    @PutMapping("/family/members/{userId}/caregiver")
    public FamilyMemberDto updateMemberCaregiver(
            @PathVariable String userId,
            @Valid @RequestBody UpdateMemberCaregiverRequest request
    ) {
        return authService.updateMemberCaregiver(currentUser.requirePrincipal(), userId, request.caregiver());
    }

    @PostMapping("/family/invite-code/reset")
    public ResetInviteCodeResponse resetInviteCode() {
        return authService.resetFamilyInviteCode(currentUser.requirePrincipal());
    }

    private String remoteKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
