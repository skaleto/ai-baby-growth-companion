package com.xiaobao.babycompanion.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("auth_family")
public class AuthFamilyRecord {

    @TableId(type = IdType.INPUT)
    private String id;
    private String name;
    private String defaultInviteCodeId;
    private String createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDefaultInviteCodeId() {
        return defaultInviteCodeId;
    }

    public void setDefaultInviteCodeId(String defaultInviteCodeId) {
        this.defaultInviteCodeId = defaultInviteCodeId;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
