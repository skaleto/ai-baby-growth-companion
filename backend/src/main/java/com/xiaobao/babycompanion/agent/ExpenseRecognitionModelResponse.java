package com.xiaobao.babycompanion.agent;

import com.xiaobao.babycompanion.service.deepseek.DeepSeekUsage;

record ExpenseRecognitionModelResponse(
        String id,
        String model,
        String content,
        DeepSeekUsage usage
) {
}
