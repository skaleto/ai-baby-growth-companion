package com.xiaobao.babycompanion.auth;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.xiaobao.babycompanion.config.AuthProperties;
import com.xiaobao.babycompanion.dto.auth.AuthFamilyDto;
import com.xiaobao.babycompanion.dto.auth.AuthInviteRolesResponse;
import com.xiaobao.babycompanion.dto.auth.AuthLoginResponse;
import com.xiaobao.babycompanion.dto.auth.AuthMemberDto;
import com.xiaobao.babycompanion.dto.auth.AuthUserDto;
import com.xiaobao.babycompanion.exception.AuthException;
import com.xiaobao.babycompanion.persistence.DatabaseInitializer;
import com.xiaobao.babycompanion.persistence.entity.AuthFamilyMemberRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthFamilyRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthInviteCodeRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthSessionRecord;
import com.xiaobao.babycompanion.persistence.entity.AuthUserRecord;
import com.xiaobao.babycompanion.persistence.service.AuthFamilyMemberRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthFamilyRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthInviteCodeRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthSessionRecordService;
import com.xiaobao.babycompanion.persistence.service.AuthUserRecordService;
import com.xiaobao.babycompanion.service.AppStateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);
    private static final Pattern CHINA_PHONE = Pattern.compile("^1[3-9]\\d{9}$");
    private static final List<String> UNIQUE_FAMILY_ROLES = List.of("爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆");
    private static final List<String> REPEATABLE_FAMILY_ROLES = List.of("月嫂", "保姆", "亲友", "其他");
    private static final Set<String> UNIQUE_FAMILY_ROLE_SET = Set.copyOf(UNIQUE_FAMILY_ROLES);

    private final AuthProperties properties;
    private final AuthUserRecordService userService;
    private final AuthFamilyRecordService familyService;
    private final AuthFamilyMemberRecordService familyMemberService;
    private final AuthInviteCodeRecordService inviteCodeService;
    private final AuthSessionRecordService sessionService;
    private final JwtService jwtService;
    private final AppStateService appStateService;
    private final Map<String, LoginAttemptBucket> attempts = new ConcurrentHashMap<>();

    public AuthService(
            AuthProperties properties,
            AuthUserRecordService userService,
            AuthFamilyRecordService familyService,
            AuthFamilyMemberRecordService familyMemberService,
            AuthInviteCodeRecordService inviteCodeService,
            AuthSessionRecordService sessionService,
            JwtService jwtService,
            AppStateService appStateService
    ) {
        this.properties = properties;
        this.userService = userService;
        this.familyService = familyService;
        this.familyMemberService = familyMemberService;
        this.inviteCodeService = inviteCodeService;
        this.sessionService = sessionService;
        this.jwtService = jwtService;
        this.appStateService = appStateService;
    }

    public void ensureInviteCodesImported() {
        AuthFamilyRecord defaultFamily = null;
        List<String> codes = readOrCreateInviteCodes();
        String now = Instant.now().toString();
        for (int index = 0; index < codes.size(); index += 1) {
            String code = AuthHashing.normalizedInviteCode(codes.get(index));
            if (!StringUtils.hasText(code) || code.startsWith("#")) continue;
            String hash = AuthHashing.sha256Hex(code);
            AuthInviteCodeRecord existing = inviteCodeByHash(hash);
            if (existing != null) {
                boolean changed = false;
                if (!StringUtils.hasText(existing.getFamilyId()) && !isUnclaimedInvite(existing)) {
                    if (defaultFamily == null) defaultFamily = ensureDefaultFamily();
                    existing.setFamilyId(defaultFamily.getId());
                    changed = true;
                }
                if (changed) inviteCodeService.updateById(existing);
                if (defaultFamily != null
                        && !StringUtils.hasText(defaultFamily.getDefaultInviteCodeId())
                        && defaultFamily.getId().equals(existing.getFamilyId())) {
                    defaultFamily.setDefaultInviteCodeId(existing.getId());
                    familyService.updateById(defaultFamily);
                }
                continue;
            }

            AuthInviteCodeRecord record = new AuthInviteCodeRecord();
            record.setId("invite-" + UUID.randomUUID());
            record.setCodeHash(hash);
            record.setLabel("本地邀请码 " + (index + 1));
            record.setActive("true");
            record.setCreatedAt(now);
            inviteCodeService.save(record);
        }
    }

    @Transactional
    public AuthLoginResponse login(String phone, String inviteCode, String roleName, Boolean caregiver, String remoteKey) {
        ensureInviteCodesImported();
        String normalizedPhone = normalizePhone(phone);
        checkRateLimit(remoteKey, normalizedPhone);
        String normalizedCode = AuthHashing.normalizedInviteCode(inviteCode);
        if (!StringUtils.hasText(normalizedCode)) {
            recordFailedAttempt(remoteKey, normalizedPhone);
            throw new AuthException("邀请码不正确，请确认后再试。");
        }

        String codeHash = AuthHashing.sha256Hex(normalizedCode);
        AuthInviteCodeRecord invite = inviteCodeByHash(codeHash);
        if (!isActiveFamilyInvite(invite)) {
            recordFailedAttempt(remoteKey, normalizedPhone);
            throw new AuthException("邀请码不正确，请确认后再试。");
        }
        AuthUserRecord user = userByPhone(normalizedPhone);
        if (user == null) {
            requireMemberSelection(roleName, caregiver);
        }
        boolean firstLocalUser = user == null && userService.count() == 0;
        Instant now = Instant.now();
        AuthFamilyRecord family;
        AuthFamilyMemberRecord member;

        if (user == null) {
            family = familyForNewUserInvite(invite, now);
            validateRoleAvailable(family.getId(), roleName, null);
            user = new AuthUserRecord();
            user.setId("user-" + UUID.randomUUID());
            user.setPhone(normalizedPhone);
            user.setInviteCodeHash(codeHash);
            user.setCreatedAt(now.toString());
            user.setLastLoginAt(now.toString());
            userService.save(user);

            member = createFamilyMember(family.getId(), user.getId(), invite.getId(), roleName, caregiver, now);
            markInviteUsedForCompatibility(invite, user.getId(), now);
        } else {
            member = memberByUser(user.getId());
            if (member == null) {
                requireMemberSelection(roleName, caregiver);
                family = familyForNewUserInvite(invite, now);
                validateRoleAvailable(family.getId(), roleName, user.getId());
                member = createFamilyMember(family.getId(), user.getId(), invite.getId(), roleName, caregiver, now);
            } else {
                try {
                    family = familyForJoinedMemberInvite(invite, member);
                } catch (AuthException exception) {
                    recordFailedAttempt(remoteKey, normalizedPhone);
                    throw exception;
                }
                fillPlaceholderMemberIdentity(member, roleName, caregiver);
                member.setLastSeenAt(now.toString());
                familyMemberService.updateById(member);
            }
            user.setLastLoginAt(now.toString());
            userService.updateById(user);
        }

        attempts.remove(rateKey(remoteKey, normalizedPhone));
        if (firstLocalUser) {
            appStateService.claimOwnerlessData(family.getId(), user.getId());
        }

        AuthSessionRecord session = new AuthSessionRecord();
        session.setId("session-" + UUID.randomUUID());
        session.setUserId(user.getId());
        session.setCreatedAt(now.toString());
        session.setExpiresAt(now.plus(properties.getJwt().getTtl()).toString());
        sessionService.save(session);

        return new AuthLoginResponse(
                jwtService.issue(user.getId(), user.getPhone(), session.getId()),
                toDto(user),
                toFamilyDto(family),
                toMemberDto(member),
                appStateService.isOnboardingRequired(family.getId()),
                firstLocalUser
        );
    }

    public AuthInviteRolesResponse inviteRoles(String inviteCode) {
        ensureInviteCodesImported();
        String normalizedCode = AuthHashing.normalizedInviteCode(inviteCode);
        if (!StringUtils.hasText(normalizedCode)) {
            throw new AuthException("邀请码不正确，请确认后再试。");
        }
        AuthInviteCodeRecord invite = inviteCodeByHash(AuthHashing.sha256Hex(normalizedCode));
        if (!isActiveFamilyInvite(invite)) {
            throw new AuthException("邀请码不正确，请确认后再试。");
        }
        String familyId = invite.getFamilyId();
        String familyName = DatabaseInitializer.DEFAULT_FAMILY_NAME;
        List<String> occupiedRoles = List.of();
        if (StringUtils.hasText(familyId)) {
            AuthFamilyRecord family = familyService.getById(familyId);
            if (family != null && StringUtils.hasText(family.getName())) {
                familyName = family.getName();
            }
            occupiedRoles = occupiedUniqueRoles(familyId, null);
        }
        return new AuthInviteRolesResponse(
                familyName,
                occupiedRoles,
                UNIQUE_FAMILY_ROLES,
                REPEATABLE_FAMILY_ROLES
        );
    }

    public AuthPrincipal authenticateToken(String token) {
        try {
            JwtService.JwtClaims claims = jwtService.verify(token);
            AuthSessionRecord session = sessionService.getById(claims.sessionId());
            if (session == null || StringUtils.hasText(session.getRevokedAt()) || Instant.now().isAfter(Instant.parse(session.getExpiresAt()))) {
                throw new AuthException("登录已过期，请重新登录。");
            }
            AuthUserRecord user = userService.getById(claims.userId());
            if (user == null) {
                throw new AuthException("登录已失效，请重新登录。");
            }
            AuthFamilyMemberRecord member = memberByUser(user.getId());
            if (member == null) {
                member = createFamilyMember(DatabaseInitializer.DEFAULT_FAMILY_ID, user.getId(), null, "家庭照护人", true, Instant.now());
            }
            AuthFamilyRecord family = familyService.getById(member.getFamilyId());
            if (family == null) {
                family = ensureDefaultFamily();
                member.setFamilyId(family.getId());
                familyMemberService.updateById(member);
            }
            return new AuthPrincipal(
                    user.getId(),
                    user.getPhone(),
                    session.getId(),
                    family.getId(),
                    family.getName(),
                    member.getRoleName(),
                    "true".equalsIgnoreCase(member.getIsCaregiver())
            );
        } catch (AuthException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new AuthException("登录已失效，请重新登录。");
        }
    }

    @Transactional
    public void logout(String sessionId) {
        if (!StringUtils.hasText(sessionId)) return;
        AuthSessionRecord session = sessionService.getById(sessionId);
        if (session == null || StringUtils.hasText(session.getRevokedAt())) return;
        session.setRevokedAt(Instant.now().toString());
        sessionService.updateById(session);
    }

    public AuthUserDto currentUser(AuthPrincipal principal) {
        AuthUserRecord user = userService.getById(principal.userId());
        if (user == null) throw new AuthException("登录已失效，请重新登录。");
        return toDto(user);
    }

    public AuthUserDto toDto(AuthUserRecord user) {
        return new AuthUserDto(user.getId(), user.getPhone(), user.getCreatedAt(), user.getLastLoginAt());
    }

    public AuthFamilyDto currentFamily(AuthPrincipal principal) {
        return new AuthFamilyDto(principal.familyId(), principal.familyName());
    }

    public AuthMemberDto currentMember(AuthPrincipal principal) {
        return new AuthMemberDto(principal.roleName(), principal.caregiver());
    }

    public AuthFamilyDto toFamilyDto(AuthFamilyRecord family) {
        return new AuthFamilyDto(family.getId(), family.getName());
    }

    public AuthMemberDto toMemberDto(AuthFamilyMemberRecord member) {
        return new AuthMemberDto(member.getRoleName(), "true".equalsIgnoreCase(member.getIsCaregiver()));
    }

    private AuthFamilyRecord ensureDefaultFamily() {
        AuthFamilyRecord existing = familyService.getById(DatabaseInitializer.DEFAULT_FAMILY_ID);
        if (existing != null) return existing;
        AuthFamilyRecord family = new AuthFamilyRecord();
        family.setId(DatabaseInitializer.DEFAULT_FAMILY_ID);
        family.setName(DatabaseInitializer.DEFAULT_FAMILY_NAME);
        family.setCreatedAt(Instant.now().toString());
        familyService.save(family);
        return family;
    }

    private List<String> readOrCreateInviteCodes() {
        try {
            Path path = Path.of(properties.getInviteCodesFile()).toAbsolutePath().normalize();
            if (Files.exists(path)) {
                return Files.readAllLines(path, StandardCharsets.UTF_8);
            }
            if (path.getParent() != null) {
                Files.createDirectories(path.getParent());
            }
            String code = randomCode();
            Files.writeString(path, """
                    # 小宝成长伙伴本地邀请码，一行一个。
                    # 第一版使用“手机号 + 邀请码”登录，不接真实短信。
                    %s
                    """.formatted(code), StandardCharsets.UTF_8);
            LOGGER.warn("Created local baby companion invite code file at {}. Open this file on the server to read the generated code.", path);
            return List.of(code);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to load local invite codes", exception);
        }
    }

    private String randomCode() {
        return "%06d".formatted(100000 + new SecureRandom().nextInt(900000));
    }

    private AuthInviteCodeRecord inviteCodeByHash(String hash) {
        return inviteCodeService.getOne(new QueryWrapper<AuthInviteCodeRecord>().eq("code_hash", hash), false);
    }

    private AuthFamilyRecord familyForNewUserInvite(AuthInviteCodeRecord invite, Instant now) {
        if (isUnclaimedInvite(invite)) {
            return createFamilyForInvite(invite, now);
        }
        return familyForExistingUserInvite(invite);
    }

    private AuthFamilyRecord familyForExistingUserInvite(AuthInviteCodeRecord invite) {
        if (shouldCreateDedicatedFamily(invite)) {
            return createFamilyForInvite(invite, Instant.now());
        }
        String familyId = StringUtils.hasText(invite.getFamilyId()) ? invite.getFamilyId() : DatabaseInitializer.DEFAULT_FAMILY_ID;
        AuthFamilyRecord family = familyService.getById(familyId);
        if (family == null) {
            family = ensureDefaultFamily();
            familyId = family.getId();
        }
        if (!familyId.equals(invite.getFamilyId())) {
            invite.setFamilyId(familyId);
            inviteCodeService.updateById(invite);
        }
        return family;
    }

    private AuthFamilyRecord familyForJoinedMemberInvite(AuthInviteCodeRecord invite, AuthFamilyMemberRecord member) {
        String memberFamilyId = member.getFamilyId();
        if (!StringUtils.hasText(memberFamilyId)) {
            throw new AuthException("家庭信息异常，请重新登录。");
        }
        if (!StringUtils.hasText(invite.getFamilyId())) {
            throw new AuthException("手机号已加入家庭，请使用原家庭邀请码登录。");
        }
        if (!invite.getFamilyId().equals(memberFamilyId)) {
            throw new AuthException("手机号已加入其它家庭，请使用原家庭邀请码登录。");
        }
        AuthFamilyRecord family = familyService.getById(memberFamilyId);
        if (family == null) {
            throw new AuthException("家庭信息不存在，请检查邀请码。");
        }
        return family;
    }

    private AuthFamilyRecord createFamilyForInvite(AuthInviteCodeRecord invite, Instant now) {
        AuthFamilyRecord family = new AuthFamilyRecord();
        family.setId("family-" + UUID.randomUUID());
        family.setName(DatabaseInitializer.DEFAULT_FAMILY_NAME);
        family.setDefaultInviteCodeId(invite.getId());
        family.setCreatedAt(now.toString());
        familyService.save(family);
        invite.setFamilyId(family.getId());
        inviteCodeService.updateById(invite);
        moveInviteMembersToFamily(invite.getId(), family.getId());
        return family;
    }

    private boolean isUnclaimedInvite(AuthInviteCodeRecord invite) {
        return invite != null
                && !StringUtils.hasText(invite.getAssignedUserId())
                && !StringUtils.hasText(invite.getUsedAt());
    }

    private boolean shouldCreateDedicatedFamily(AuthInviteCodeRecord invite) {
        return invite != null
                && DatabaseInitializer.DEFAULT_FAMILY_ID.equals(invite.getFamilyId())
                && !isUnclaimedInvite(invite);
    }

    private void moveInviteMembersToFamily(String inviteCodeId, String familyId) {
        if (!StringUtils.hasText(inviteCodeId)) return;
        List<AuthFamilyMemberRecord> members = familyMemberService.list(
                new QueryWrapper<AuthFamilyMemberRecord>().eq("joined_invite_code_id", inviteCodeId)
        );
        for (AuthFamilyMemberRecord member : members) {
            member.setFamilyId(familyId);
            familyMemberService.updateById(member);
        }
    }

    private AuthUserRecord userByPhone(String phone) {
        return userService.getOne(new QueryWrapper<AuthUserRecord>().eq("phone", phone), false);
    }

    private AuthFamilyMemberRecord memberByUser(String userId) {
        return familyMemberService.getOne(new QueryWrapper<AuthFamilyMemberRecord>().eq("user_id", userId), false);
    }

    private AuthFamilyMemberRecord createFamilyMember(
            String familyId,
            String userId,
            String inviteCodeId,
            String roleName,
            Boolean caregiver,
            Instant now
    ) {
        AuthFamilyMemberRecord member = new AuthFamilyMemberRecord();
        member.setId("member-" + UUID.randomUUID());
        member.setFamilyId(familyId);
        member.setUserId(userId);
        member.setRoleName(normalizeRoleName(roleName));
        member.setIsCaregiver(Boolean.FALSE.equals(caregiver) ? "false" : "true");
        member.setJoinedInviteCodeId(inviteCodeId);
        member.setJoinedAt(now.toString());
        member.setLastSeenAt(now.toString());
        familyMemberService.save(member);
        return member;
    }

    private void markInviteUsedForCompatibility(AuthInviteCodeRecord invite, String userId, Instant now) {
        if (!StringUtils.hasText(invite.getAssignedUserId())) {
            invite.setAssignedUserId(userId);
        }
        if (!StringUtils.hasText(invite.getUsedAt())) {
            invite.setUsedAt(now.toString());
        }
        inviteCodeService.updateById(invite);
    }

    private boolean isActiveFamilyInvite(AuthInviteCodeRecord invite) {
        return invite != null
                && !"false".equalsIgnoreCase(invite.getActive());
    }

    private String normalizeRoleName(String roleName) {
        String normalized = roleName == null ? "" : roleName.trim();
        if (!StringUtils.hasText(normalized)) {
            return "家庭成员";
        }
        return normalized.length() > 20 ? normalized.substring(0, 20) : normalized;
    }

    private void fillPlaceholderMemberIdentity(AuthFamilyMemberRecord member, String roleName, Boolean caregiver) {
        String currentRole = member.getRoleName() == null ? "" : member.getRoleName().trim();
        if (!"家庭成员".equals(currentRole) && StringUtils.hasText(currentRole)) {
            return;
        }
        requireMemberSelection(roleName, caregiver);
        String nextRole = normalizeRoleName(roleName);
        if (!"家庭成员".equals(nextRole)) {
            validateRoleAvailable(member.getFamilyId(), nextRole, member.getUserId());
            member.setRoleName(nextRole);
            member.setIsCaregiver(Boolean.FALSE.equals(caregiver) ? "false" : "true");
        }
    }

    private void validateRoleAvailable(String familyId, String roleName, String excludeUserId) {
        String normalizedRole = normalizeRoleName(roleName);
        if (!UNIQUE_FAMILY_ROLE_SET.contains(normalizedRole)) return;
        if (!StringUtils.hasText(familyId)) return;
        QueryWrapper<AuthFamilyMemberRecord> query = new QueryWrapper<AuthFamilyMemberRecord>()
                .eq("family_id", familyId)
                .eq("role_name", normalizedRole);
        if (StringUtils.hasText(excludeUserId)) {
            query.ne("user_id", excludeUserId);
        }
        if (familyMemberService.count(query) > 0) {
            throw new AuthException("这个家庭已经有%s了，请选择其他身份。".formatted(normalizedRole));
        }
    }

    private List<String> occupiedUniqueRoles(String familyId, String excludeUserId) {
        if (!StringUtils.hasText(familyId)) return List.of();
        QueryWrapper<AuthFamilyMemberRecord> query = new QueryWrapper<AuthFamilyMemberRecord>().eq("family_id", familyId);
        if (StringUtils.hasText(excludeUserId)) {
            query.ne("user_id", excludeUserId);
        }
        List<String> roles = new ArrayList<>();
        for (AuthFamilyMemberRecord member : familyMemberService.list(query)) {
            String role = normalizeRoleName(member.getRoleName());
            if (UNIQUE_FAMILY_ROLE_SET.contains(role) && !roles.contains(role)) {
                roles.add(role);
            }
        }
        return UNIQUE_FAMILY_ROLES.stream().filter(roles::contains).toList();
    }

    private void requireMemberSelection(String roleName, Boolean caregiver) {
        if (!StringUtils.hasText(roleName) || caregiver == null) {
            throw new AuthException("请先选择家庭身份和是否照护人。");
        }
    }

    private String normalizePhone(String phone) {
        String normalized = phone == null ? "" : phone.trim().replaceAll("\\s+", "");
        if (!CHINA_PHONE.matcher(normalized).matches()) {
            throw new AuthException("请输入 11 位中国大陆手机号。");
        }
        return normalized;
    }

    private void checkRateLimit(String remoteKey, String phone) {
        String key = rateKey(remoteKey, phone);
        LoginAttemptBucket bucket = attempts.get(key);
        if (bucket == null) return;
        Instant now = Instant.now();
        if (now.isAfter(bucket.windowStartedAt().plus(properties.getLoginWindow()))) {
            attempts.remove(key);
            return;
        }
        if (bucket.count() >= properties.getMaxLoginAttempts()) {
            throw new AuthException("尝试次数有点多，请稍后再试。");
        }
    }

    private void recordFailedAttempt(String remoteKey, String phone) {
        String key = rateKey(remoteKey, phone);
        attempts.compute(key, (ignored, bucket) -> {
            Instant now = Instant.now();
            if (bucket == null || now.isAfter(bucket.windowStartedAt().plus(properties.getLoginWindow()))) {
                return new LoginAttemptBucket(1, now);
            }
            return new LoginAttemptBucket(bucket.count() + 1, bucket.windowStartedAt());
        });
    }

    private String rateKey(String remoteKey, String phone) {
        return (StringUtils.hasText(remoteKey) ? remoteKey : "local") + ":" + phone;
    }

    private record LoginAttemptBucket(int count, Instant windowStartedAt) {
    }
}
