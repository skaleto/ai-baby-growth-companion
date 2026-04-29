package com.xiaobao.babycompanion.service.deepseek;

import java.util.List;

public record DeepSeekChatResponse(
        String id,
        String model,
        List<DeepSeekChoice> choices
) {
}
