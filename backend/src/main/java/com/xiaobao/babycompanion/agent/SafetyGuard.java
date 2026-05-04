package com.xiaobao.babycompanion.agent;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import com.xiaobao.babycompanion.dto.agent.AgentSafetyAlert;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SafetyGuard {

    private static final Pattern HIGH_FEVER = riskPattern(".*(3[89](\\.\\d)?|40(\\.\\d)?).*(度|℃|体温|发烧|发热).*|.*(发烧|发热|体温).*(3[89](\\.\\d)?|40(\\.\\d)?).*");
    private static final Pattern BREATHING = riskPattern(".*(呼吸困难|喘不上|喘不过气|憋气|嘴唇发紫|脸色发紫|抽搐|意识不清|嗜睡叫不醒).*");
    private static final Pattern MEDICINE = riskPattern(".*(吃药|用药|退烧药|抗生素|布洛芬|对乙酰氨基酚|剂量|药量).*");
    private static final Pattern ALLERGY = riskPattern(".*(过敏|皮疹|疹子|荨麻疹|红疹|呕吐|腹泻|喉咙肿|脸肿).*");
    private static final Pattern VACCINE = riskPattern(".*(疫苗|接种|预防针).*");
    private static final Pattern INJURY = riskPattern(".*(摔|磕|撞|跌落|出血|烫伤|烧伤).*");

    public List<AgentSafetyAlert> assess(String userMessage, String aiText) {
        String text = ((userMessage == null ? "" : userMessage) + "\n" + (aiText == null ? "" : aiText)).trim();
        if (!StringUtils.hasText(text)) return List.of();

        List<AgentSafetyAlert> alerts = new ArrayList<>();
        if (BREATHING.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "urgent",
                    "breathing",
                    "出现呼吸异常、发紫、抽搐或叫不醒等表现时，需要立即线下就医。",
                    "请尽快联系急救或前往儿童急诊，不要只依赖线上建议。"
            ));
        }
        if (HIGH_FEVER.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "urgent",
                    "fever",
                    "高热或小月龄发热需要更谨慎处理。",
                    "请结合宝宝月龄和精神状态，尽快咨询儿科医生或社区医院。"
            ));
        }
        if (MEDICINE.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "notice",
                    "medicine",
                    "用药和剂量需要由医生或药品说明书确认。",
                    "不要仅凭 AI 回复决定给药、加量或混用药物。"
            ));
        }
        if (ALLERGY.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "notice",
                    "allergy",
                    "疑似过敏需要观察呼吸、精神状态和皮疹变化。",
                    "如出现呼吸急促、面唇肿胀、持续呕吐或精神差，请及时就医。"
            ));
        }
        if (VACCINE.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "notice",
                    "vaccine",
                    "疫苗安排以当地社区医院或医生通知为准。",
                    "请带好接种本，并按社区医院要求确认禁忌和补种时间。"
            ));
        }
        if (INJURY.matcher(text).matches()) {
            alerts.add(new AgentSafetyAlert(
                    "notice",
                    "injury",
                    "外伤后需要关注出血、呕吐、嗜睡、精神差等信号。",
                    "如伤情明显或状态异常，请及时前往儿童急诊。"
            ));
        }
        return alerts.stream().distinct().limit(3).toList();
    }

    private static Pattern riskPattern(String expression) {
        return Pattern.compile(expression, Pattern.DOTALL);
    }
}
