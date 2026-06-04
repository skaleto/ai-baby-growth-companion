package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.ClientErrorRecord;
import com.xiaobao.babycompanion.persistence.mapper.ClientErrorRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class ClientErrorRecordService extends ServiceImpl<ClientErrorRecordMapper, ClientErrorRecord> {
}
