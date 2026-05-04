package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.AuthSessionRecord;
import com.xiaobao.babycompanion.persistence.mapper.AuthSessionRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class AuthSessionRecordService extends ServiceImpl<AuthSessionRecordMapper, AuthSessionRecord> {
}
