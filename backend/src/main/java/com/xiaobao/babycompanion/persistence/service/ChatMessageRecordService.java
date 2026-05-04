package com.xiaobao.babycompanion.persistence.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.xiaobao.babycompanion.persistence.entity.ChatMessageRecord;
import com.xiaobao.babycompanion.persistence.mapper.ChatMessageRecordMapper;
import org.springframework.stereotype.Service;

@Service
public class ChatMessageRecordService extends ServiceImpl<ChatMessageRecordMapper, ChatMessageRecord> {
}
