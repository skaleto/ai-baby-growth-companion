package com.xiaobao.babycompanion.agent;

import java.util.List;

import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import org.springframework.stereotype.Component;

@Component
public class SkillRegistry {

    private static final Skill DEFAULT_SKILL = new Skill(
            "default-baby-companion",
            "默认宝宝成长伙伴",
            "第一版占位 skill，覆盖成长记录、照护日志、提醒、记忆和安全回复。"
    );

    public List<Skill> selectSkills(AgentChatRequest request) {
        return List.of(DEFAULT_SKILL);
    }
}
