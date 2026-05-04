package com.xiaobao.babycompanion.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("auth_family_member")
public class AuthFamilyMemberRecord {

    @TableId(type = IdType.INPUT)
    private String id;
    private String familyId;
    private String userId;
    private String roleName;
    private String isCaregiver;
    private String joinedInviteCodeId;
    private String joinedAt;
    private String lastSeenAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFamilyId() {
        return familyId;
    }

    public void setFamilyId(String familyId) {
        this.familyId = familyId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public String getIsCaregiver() {
        return isCaregiver;
    }

    public void setIsCaregiver(String isCaregiver) {
        this.isCaregiver = isCaregiver;
    }

    public String getJoinedInviteCodeId() {
        return joinedInviteCodeId;
    }

    public void setJoinedInviteCodeId(String joinedInviteCodeId) {
        this.joinedInviteCodeId = joinedInviteCodeId;
    }

    public String getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(String joinedAt) {
        this.joinedAt = joinedAt;
    }

    public String getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(String lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }
}
