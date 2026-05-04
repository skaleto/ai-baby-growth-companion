package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.GrowthEventRecord;
import com.xiaobao.babycompanion.persistence.mapper.GrowthEventRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class GrowthEventRecordService extends ServiceImpl<GrowthEventRecordMapper, GrowthEventRecord> {
}
