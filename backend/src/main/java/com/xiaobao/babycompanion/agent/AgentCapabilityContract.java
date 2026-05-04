package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

public final class AgentCapabilityContract {

    private AgentCapabilityContract() {
    }

    public static Map<String, Object> promptContext() {
        return Map.of(
                "supportedActions", List.of(
                        "自动记录字段完整、低风险的日常照护日志",
                        "为字段不完整的记录生成补充问题",
                        "生成需要用户确认的成长事件、提醒、长期记忆和高风险照护记录",
                        "按计划调用联网查询工具并展示来源",
                        "在支持视觉输入的模型中描述图片或视频内容",
                        "通过 albumItem effectDecision 保存已上传且通过准入的照片或视频到相册"
                ),
                "unsupportedActions", List.of(
                        "不能在聊天文本里直接撤销、删除或修改历史记录",
                        "不能承诺已经完成没有对应 effectDecision 的动作",
                        "不能为照护记录臆造缺失的奶量、睡眠时长、结束时间或精确时间",
                        "混合喂养宝宝的喝奶记录不能臆造奶的类型；用户没说母乳或配方奶时必须追问",
                        "不能仅凭图片或视频生成喂养、睡眠、便便、体温等照护日志",
                        "不能承诺已经把图片或视频保存到相册，除非响应里有 albumItem effectDecision"
                ),
                "replyRules", List.of(
                        "只有 effectDecision.mode=auto 且动作属于 supportedActions 时，才可以说已经整理成记录",
                        "字段不足时必须追问，不要输出 careLogPatch 或伪时间线",
                        "如果 babyProfile.feeding 是混合喂养，用户只说喝奶/吃奶/喂奶和奶量但没说明母乳或配方奶，回复必须追问奶的类型，不要说已记录",
                        "用户要求撤销、删除、修改历史记录时，说明当前只能通过记录卡片撤销或到记录页编辑",
                        "用户只问图片或视频内容时只描述附件，不要创建照护记录或成长档案",
                        "App 截图、网页截图、聊天截图、记录页截图和纯文字界面图只可描述，不可入相册或生成照护日志"
                )
        );
    }

    public static Map<String, Object> imageBoundaryPolicy() {
        return Map.of(
                "photoDescription", "图片/视频描述、相册保存、照护日志是三件不同的事；描述附件不代表保存或记录。",
                "albumAdmission", "只有真实生活照片或视频里有宝宝本人、亲子互动、成长瞬间、医疗凭证等值得回看的内容，才可能进入相册；不确定时由前端展示确认卡。",
                "ignoredImages", List.of("App 截图", "网页截图", "聊天截图", "记录页截图", "纯 UI 或纯文字界面图", "无宝宝且无生活场景的图片"),
                "careRecordBoundary", "图片或视频不能单独生成喂养、睡眠、便便、体温等 careLog；只有用户文本或语音明确给出奶量、睡眠时长、体温等字段时才允许记录。"
        );
    }

    public static boolean unsupportedMutationRequest(String text) {
        String value = text == null ? "" : text;
        return value.matches(".*(撤销|删除|删掉|取消刚才|改掉|修改刚才|改一下刚才|回滚).*");
    }

    public static String unsupportedMutationMessage() {
        return "我现在还不能直接在聊天里撤销、删除或修改历史记录。如果是刚自动记录的那条，可以点记录卡片上的“撤销”；如果要改历史记录，可以到记录页手动编辑。";
    }
}
