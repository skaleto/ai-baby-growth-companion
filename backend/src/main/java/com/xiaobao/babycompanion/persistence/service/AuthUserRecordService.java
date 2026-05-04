package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.AuthUserRecord;
import com.xiaobao.babycompanion.persistence.mapper.AuthUserRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class AuthUserRecordService extends ServiceImpl<AuthUserRecordMapper, AuthUserRecord> {
}
